#!/bin/bash
set -e

TEST_FOLDER="$1"

# Only run tablet setup and tests for split-view (or full suite)
if [ -n "$TEST_FOLDER" ] && [ "$TEST_FOLDER" != "split-view" ]; then
  echo "Skipping tablet step (test folder '$TEST_FOLDER' runs on phone emulator only)"
  exit 0
fi

adb install app.apk

# Phase 1: Pre-launch in default orientation to download EAS Update + seed DB.
# This primes CDN and stores the update before we set landscape mode.
echo "=========================================="
echo "Phase 1: Pre-launching app for EAS Update download"
echo "=========================================="
adb shell am start -n org.versemate.app/.MainActivity
echo "Waiting 30s for EAS Update download and seed DB extraction..."
sleep 30
adb shell am force-stop org.versemate.app

# Dismiss any system ANR/crash dialogs from the pre-launch phase
sleep 3
adb shell input keyevent KEYCODE_HOME
adb shell input keyevent KEYCODE_BACK

# Phase 2: Force landscape orientation AFTER pre-launch. The app will
# re-initialize in landscape when Maestro launches it.
# Nexus 10 natural orientation is landscape (2560x1600 skin), so rotation 0
# keeps it in landscape. Rotation 1 would rotate it to portrait.
echo "=========================================="
echo "Phase 2: Setting landscape orientation"
echo "=========================================="
adb shell settings put system accelerometer_rotation 0
adb shell settings put system user_rotation 0

# Debug: log actual display dimensions to verify landscape
echo "Display info:"
adb shell wm size
adb shell dumpsys window displays | grep -E "cur=" | head -1
echo "Tablet emulator set to landscape orientation"

# Phase 3: Maestro warmup with clearState:false — preserves EAS Update
# and seed DB from Phase 1. Skip tap is optional since onboarding
# may already be completed during pre-launch.
echo "=========================================="
echo "Phase 3: Maestro warm-up (onboarding + split-view)"
echo "=========================================="
if ! maestro test .maestro/shared/warmup-tablet.yaml; then
  echo "Warm-up failed, retrying after 15s..."
  sleep 15
  if ! maestro test .maestro/shared/warmup-tablet.yaml; then
    echo "Warm-up failed twice, final retry after 15s..."
    sleep 15
    maestro test .maestro/shared/warmup-tablet.yaml
  fi
fi
echo "Warm-up complete"

echo "Running split-view tests..."
maestro test .maestro/split-view/
