#!/bin/bash
set -e

adb install app.apk

# Force landscape orientation BEFORE warm-up so the app initializes
# in split-view mode (width >= 1024dp triggers split view)
adb shell settings put system accelerometer_rotation 0
adb shell settings put system user_rotation 1
echo "Tablet emulator set to landscape orientation"

# Warm up: use Maestro to properly initialize the app in landscape/split-view.
# The warmup uses clearState:true with extended timeout for EAS Update download.
# Retry once if it fails (transient EAS Update delivery issue).
echo "=========================================="
echo "Running warm-up (EAS Update + onboarding + seed DB)"
echo "=========================================="

# Warmup expects chapter-selector-button, but tablet in landscape shows split-view.
# Use the tablet-specific warmup that waits for split-view ID instead.
if ! maestro test .maestro/shared/warmup-tablet.yaml; then
  echo "Warm-up failed, retrying after 10s..."
  sleep 10
  maestro test .maestro/shared/warmup-tablet.yaml
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
