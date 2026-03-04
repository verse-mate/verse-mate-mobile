#!/bin/bash
set -e

TEST_FOLDER="$1"

# Only run tablet setup and tests for split-view (or full suite)
if [ -n "$TEST_FOLDER" ] && [ "$TEST_FOLDER" != "split-view" ]; then
  echo "Skipping tablet step (test folder '$TEST_FOLDER' runs on phone emulator only)"
  exit 0
fi

adb install app.apk

# Force landscape orientation BEFORE any app launch so the app initializes
# in split-view mode (width >= 1024dp triggers split view)
# Nexus 10 natural orientation is landscape (2560x1600 skin), so rotation 0
# keeps it in landscape. Rotation 1 would rotate it to portrait.
adb shell settings put system accelerometer_rotation 0
adb shell settings put system user_rotation 0

# Debug: log actual display dimensions to verify landscape
echo "Display info:"
adb shell wm size
adb shell dumpsys window displays | grep -E "cur=" | head -1
echo "Tablet emulator set to landscape orientation"

# Maestro warmup: clearState:true with extended timeouts.
# No ADB pre-launch — it interferes with landscape/split-view initialization.
# The phone step (which runs first) already primes the CDN cache.
echo "=========================================="
echo "Running warm-up (EAS Update + onboarding + split-view)"
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
