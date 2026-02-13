#!/bin/bash
set -e

adb install app.apk

# Warm launch: trigger EAS Update download
adb shell monkey -p org.versemate.app -c android.intent.category.LAUNCHER 1
sleep 15
adb shell am force-stop org.versemate.app
echo "Warm launch complete - update pre-downloaded"

TEST_FOLDER="$1"

# Run split-view tests only when no folder specified or split-view folder requested
if [ -z "$TEST_FOLDER" ] || [ "$TEST_FOLDER" = "split-view" ]; then
  echo "Running split-view tests on tablet emulator..."
  maestro test .maestro/split-view/
else
  echo "Skipping split-view tests (requested folder: $TEST_FOLDER)"
fi
