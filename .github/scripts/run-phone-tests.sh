#!/bin/bash
set -e

adb install app.apk

# Warm up: use Maestro to properly initialize the app (EAS Update download,
# onboarding completion, seed DB extraction). Retry once if it fails.
echo "=========================================="
echo "Running warm-up (EAS Update + onboarding + seed DB)"
echo "=========================================="
if ! maestro test .maestro/shared/warmup.yaml; then
  echo "Warm-up failed, retrying after 10s..."
  sleep 10
  maestro test .maestro/shared/warmup.yaml
fi
echo "Warm-up complete"

TEST_FOLDER="$1"

if [ -z "$TEST_FOLDER" ]; then
  # Run all folders except split-view (split-view requires tablet emulator)
  echo "Running all phone test folders..."
  OVERALL_EXIT=0
  for folder in auth bible-reading bookmarks highlights notes regression settings swipe topics navigation; do
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
