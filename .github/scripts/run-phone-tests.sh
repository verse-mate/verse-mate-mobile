#!/bin/bash
set -e

adb install app.apk

# Warm launch: trigger EAS Update download + seed DB initialization
adb shell monkey -p org.versemate.app -c android.intent.category.LAUNCHER 1
sleep 20
adb shell am force-stop org.versemate.app
echo "Warm launch complete - update pre-downloaded, seed DB initialized"

TEST_FOLDER="$1"

if [ -z "$TEST_FOLDER" ]; then
  # Run all folders except split-view (split-view requires tablet emulator)
  echo "Running all phone test folders..."
  OVERALL_EXIT=0
  for folder in auth bible-reading bookmarks highlights notes regression settings swipe topics; do
    echo "=========================================="
    echo "Running tests in .maestro/$folder/"
    echo "=========================================="
    maestro test ".maestro/$folder/" || OVERALL_EXIT=1
  done
  # Navigation: run all individual tests
  echo "=========================================="
  echo "Running tests in .maestro/navigation/"
  echo "=========================================="
  maestro test ".maestro/navigation/" || OVERALL_EXIT=1
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
