#!/bin/bash
set -e

adb install app.apk

# Phase 1: Pre-launch the app via ADB to trigger EAS Update download
# and seed DB extraction. This is passive (never fails) and gives the
# network-dependent EAS Update time to complete before Maestro runs.
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

# Phase 1.5: Seed auth tokens into AsyncStorage (if credentials available)
# This avoids Maestro's inputText limitation on secureTextEntry fields on Android
# (known issue: mobile-dev-inc/maestro#1061)
if [ -n "$E2E_TEST_EMAIL" ] && [ -n "$E2E_TEST_PASSWORD" ]; then
  echo "=========================================="
  echo "Phase 1.5: Seeding auth tokens into AsyncStorage"
  echo "=========================================="
  bash .github/scripts/seed-auth-tokens.sh || echo "WARNING: Auth token seeding failed (non-fatal)"
fi

# Phase 2: Maestro warmup with clearState:false — preserves EAS Update
# and seed DB from Phase 1. Skip tap is optional (onboarding may be done).
echo "=========================================="
echo "Phase 2: Maestro warm-up (onboarding + verification)"
echo "=========================================="
if ! maestro test .maestro/shared/warmup.yaml; then
  echo "Warm-up failed, retrying after 15s..."
  sleep 15
  if ! maestro test .maestro/shared/warmup.yaml; then
    echo "Warm-up failed twice, final retry after 15s..."
    sleep 15
    maestro test .maestro/shared/warmup.yaml
  fi
fi
echo "Warm-up complete"

TEST_FOLDER="$1"

# Build env var flags for authenticated tests using arrays (safe for special chars)
ENV_ARGS=()
if [ -n "$E2E_TEST_EMAIL" ] && [ -n "$E2E_TEST_PASSWORD" ]; then
  ENV_ARGS+=(--env "E2E_TEST_EMAIL=${E2E_TEST_EMAIL}" --env "E2E_TEST_PASSWORD=${E2E_TEST_PASSWORD}")
  echo "Authenticated test credentials configured"
fi

if [ -z "$TEST_FOLDER" ]; then
  # Run all folders except split-view (split-view requires tablet emulator)
  echo "Running all phone test folders..."
  OVERALL_EXIT=0
  for folder in auth bible-reading bookmarks dictionary highlights notes regression search recents settings swipe topics navigation; do
    echo "=========================================="
    echo "Running tests in .maestro/$folder/"
    echo "=========================================="
    maestro test "${ENV_ARGS[@]}" ".maestro/$folder/" || OVERALL_EXIT=1
  done
  if [ $OVERALL_EXIT -ne 0 ]; then
    echo "Some phone tests failed"
    exit 1
  fi
elif [ "$TEST_FOLDER" = "split-view" ]; then
  echo "Skipping phone step (split-view tests run on tablet emulator only)"
else
  echo "Running tests in .maestro/$TEST_FOLDER/"
  maestro test "${ENV_ARGS[@]}" ".maestro/$TEST_FOLDER/"
fi
