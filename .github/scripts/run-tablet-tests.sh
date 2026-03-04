#!/bin/bash
set -e

adb install app.apk

# Force landscape orientation BEFORE any app launch so the app initializes
# in split-view mode (width >= 1024dp triggers split view)
adb shell settings put system accelerometer_rotation 0
adb shell settings put system user_rotation 1
echo "Tablet emulator set to landscape orientation"

# Phase 1: Pre-launch the app via ADB to trigger EAS Update download
# and seed DB extraction in landscape mode.
echo "=========================================="
echo "Phase 1: Pre-launching app for EAS Update download"
echo "=========================================="
adb shell am start -n org.versemate.app/.MainActivity
echo "Waiting 30s for EAS Update download and seed DB extraction..."
sleep 30
adb shell am force-stop org.versemate.app

# Phase 2: Maestro warmup with clearState:false to complete onboarding.
# Uses tablet-specific warmup that waits for split-view ID.
echo "=========================================="
echo "Phase 2: Maestro warm-up (onboarding + verification)"
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

TEST_FOLDER="$1"

if [ -z "$TEST_FOLDER" ]; then
  echo "Running split-view tests..."
  maestro test .maestro/split-view/
elif [ "$TEST_FOLDER" = "split-view" ]; then
  echo "Running split-view tests..."
  maestro test .maestro/split-view/
else
  echo "Skipping tablet step (test folder '$TEST_FOLDER' runs on phone emulator only)"
fi
