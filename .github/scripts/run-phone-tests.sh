#!/bin/bash
set -e

adb install app.apk

# Dismiss any system dialogs (e.g., "Pixel Launcher isn't responding")
adb shell input keyevent KEYCODE_ENTER 2>/dev/null || true
sleep 2

# Warm launch: trigger EAS Update download
adb shell monkey -p org.versemate.app -c android.intent.category.LAUNCHER 1
sleep 15

# Dismiss any system dialogs that appeared during warm launch
adb shell am broadcast -a android.intent.action.CLOSE_SYSTEM_DIALOGS 2>/dev/null || true
sleep 2

adb shell am force-stop org.versemate.app
echo "Warm launch complete - update pre-downloaded"

TEST_FOLDER="$1"

if [ -z "$TEST_FOLDER" ]; then
  # Run all folders except split-view (split-view requires tablet emulator)
  echo "Running all phone test folders..."
  OVERALL_EXIT=0
  for folder in auth bible-reading bookmarks highlights navigation notes regression settings swipe topics; do
    echo "=========================================="
    echo "Running tests in .maestro/$folder/"
    echo "=========================================="
    maestro test ".maestro/$folder/" || OVERALL_EXIT=1
  done
  if [ $OVERALL_EXIT -ne 0 ]; then
    echo "Some phone tests failed"
    exit 1
  fi
elif [ "$TEST_FOLDER" = "split-view" ]; then
  echo "Skipping phone step (split-view tests run on tablet emulator only)"
else
  echo "Running tests in .maestro/$TEST_FOLDER/"
  maestro test ".maestro/$TEST_FOLDER/"
fi
