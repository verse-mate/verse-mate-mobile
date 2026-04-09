#!/bin/bash
set -e

adb install app.apk

# Phase 0: Network diagnostic — prove whether emulator can reach api.versemate.org
# This is the key question blocking authenticated E2E tests. Results go into the
# workflow summary so we have definitive evidence for the next fix.
echo "=========================================="
echo "Phase 0: Emulator network diagnostic"
echo "=========================================="

{
  echo "### Emulator Network Diagnostic"
  echo ""
  echo "\`\`\`"

  echo "--- Test 1: Raw network (ping 8.8.8.8) ---"
  adb shell "ping -c 3 -W 5 8.8.8.8" 2>&1 || echo "FAILED: ping 8.8.8.8"
  echo ""

  echo "--- Test 2: DNS configuration ---"
  adb shell "getprop net.dns1" 2>&1 || echo "no net.dns1"
  adb shell "getprop net.dns2" 2>&1 || echo "no net.dns2"
  echo ""

  echo "--- Test 3: DNS resolution + ping api.versemate.org ---"
  adb shell "ping -c 3 -W 5 api.versemate.org" 2>&1 || echo "FAILED: ping api.versemate.org"
  echo ""

  echo "--- Test 4: HTTPS request via curl (if available) ---"
  if adb shell "which curl" 2>&1 | grep -q curl; then
    adb shell "curl -v --max-time 10 https://api.versemate.org/openapi/json 2>&1 | head -50" || echo "FAILED: curl request"
  else
    echo "curl not available in emulator shell"
  fi
  echo ""

  echo "--- Test 5: HTTPS via wget (fallback) ---"
  if adb shell "which wget" 2>&1 | grep -q wget; then
    adb shell "wget -S --timeout=10 -O /dev/null https://api.versemate.org/openapi/json 2>&1 | head -30" || echo "FAILED: wget request"
  else
    echo "wget not available in emulator shell"
  fi
  echo ""

  echo "--- Test 6: Open socket via /system/bin/toolbox ---"
  adb shell "echo 'GET /openapi/json HTTP/1.1\r\nHost: api.versemate.org\r\nConnection: close\r\n\r\n' | /system/bin/timeout 10 /system/bin/nc api.versemate.org 443 2>&1 | head -5" || echo "nc not available or failed"
  echo ""

  echo "\`\`\`"
} | tee -a "${GITHUB_STEP_SUMMARY:-/tmp/diagnostic-output.txt}"

echo "=========================================="
echo "Phase 0 complete — see workflow summary for results"
echo "=========================================="

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

# Seed auth tokens into AsyncStorage (after warmup so DB exists)
# Tokens are fetched from API on the HOST (emulator can't reach API directly)
if [ -n "$E2E_TEST_EMAIL" ] && [ -n "$E2E_TEST_PASSWORD" ]; then
  echo "=========================================="
  echo "Seeding auth tokens into AsyncStorage"
  echo "=========================================="
  bash .github/scripts/seed-auth-tokens.sh || echo "WARNING: Token seeding failed (non-fatal)"
fi

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
  # Folders that need auth token re-seeding before running
  AUTH_FOLDERS=" auth bookmarks highlights notes "

  for folder in auth bible-reading bookmarks dictionary highlights navigation notes recents regression search settings swipe topics; do
    echo "=========================================="
    echo "Running tests in .maestro/$folder/"
    echo "=========================================="

    # Re-seed auth tokens before folders with authenticated tests
    # (previous test's clearState may have wiped them)
    if echo "$AUTH_FOLDERS" | grep -q " $folder "; then
      if [ -n "$E2E_TEST_EMAIL" ] && [ -n "$E2E_TEST_PASSWORD" ]; then
        echo "Re-seeding auth tokens for $folder..."
        bash .github/scripts/seed-auth-tokens.sh 2>&1 || echo "WARNING: Re-seeding failed"
      fi
    fi

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
