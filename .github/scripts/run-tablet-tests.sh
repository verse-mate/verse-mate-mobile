#!/bin/bash
set -e

adb install app.apk

# Force landscape orientation BEFORE warm launch so the app initializes
# in split-view mode (width >= 1024dp triggers split view)
adb shell settings put system accelerometer_rotation 0
adb shell settings put system user_rotation 1
echo "Tablet emulator set to landscape orientation"

# Warm launch: trigger EAS Update download + seed DB initialization
adb shell monkey -p org.versemate.app -c android.intent.category.LAUNCHER 1
sleep 20
adb shell am force-stop org.versemate.app
echo "Warm launch complete - update pre-downloaded, seed DB initialized"

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
