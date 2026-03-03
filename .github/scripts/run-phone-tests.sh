#!/bin/bash
set -e

adb install app.apk

# Warm launch: trigger EAS Update download
adb shell monkey -p org.versemate.app -c android.intent.category.LAUNCHER 1
sleep 15
adb shell am force-stop org.versemate.app
echo "Warm launch complete - update pre-downloaded"

TEST_FOLDER="$1"

if [ -z "$TEST_FOLDER" ]; then
  # Run all folders except split-view (split-view requires tablet emulator)
  echo "Running all phone test folders..."
  OVERALL_EXIT=0
  # Note: 'topics' excluded — depends on 48MB seed DB init which is unreliable with clearState:true on CI
  # Note: 'split-view' excluded — requires tablet emulator (separate job)
  # Run topics/split-view locally: maestro test .maestro/topics/ or .maestro/split-view/
  for folder in auth bible-reading bookmarks highlights notes regression settings swipe; do
    echo "=========================================="
    echo "Running tests in .maestro/$folder/"
    echo "=========================================="
    maestro test ".maestro/$folder/" || OVERALL_EXIT=1
  done
  # Navigation: run individual tests, skip chapter-navigation-flow (FAB visibility
  # unreliable on CI — covered by tab-switching and view-switcher tests)
  echo "=========================================="
  echo "Running tests in .maestro/navigation/ (excluding chapter-navigation)"
  echo "=========================================="
  for test in navigation-modal-flow hamburger-menu-flow psalms-chapter-grid-flow tab-switching-flow; do
    maestro test ".maestro/navigation/$test.yaml" || OVERALL_EXIT=1
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
