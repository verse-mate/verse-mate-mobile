#!/bin/bash
set -e

adb install app.apk

# TCP transparent proxy: forward the emulator's HTTPS traffic to the real API.
# CI Android emulators can't make direct HTTPS calls to api.versemate.org
# (TLS handshake fails despite TCP+DNS working). We fix this by:
# 1. socat on host: forwards TCP from port 443 to the real api.versemate.org:443
# 2. iptables in emulator: redirects traffic for the real API IP to 10.0.2.2 (host)
# Result: App → HTTPS api.versemate.org → iptables → 10.0.2.2 → socat → real API
# TLS passes through transparently (real cert, no cleartext, no self-signed)
echo "=========================================="
echo "Setting up TCP transparent proxy for API"
echo "=========================================="

# Resolve ALL IPs for api.versemate.org (Cloudflare uses multiple)
API_CNAME=$(dig +short api.versemate.org CNAME | head -1)
if [ -n "$API_CNAME" ]; then
  ALL_API_IPS=$(dig +short "$API_CNAME" A | grep -E '^[0-9]+\.')
else
  ALL_API_IPS=$(dig +short api.versemate.org A | grep -E '^[0-9]+\.')
fi
FIRST_API_IP=$(echo "$ALL_API_IPS" | head -1)
echo "API IPs: $(echo $ALL_API_IPS | tr '\n' ' ')"

# Start socat TCP forwarder on host port 443 (uses first resolved IP)
sudo socat TCP-LISTEN:443,fork,reuseaddr TCP:${FIRST_API_IP}:443 &
SOCAT_PID=$!
sleep 1
if kill -0 $SOCAT_PID 2>/dev/null; then
  echo "socat TCP proxy started on port 443 (PID: $SOCAT_PID)"
else
  echo "ERROR: socat failed to start on port 443"
fi

# Use iptables to redirect ALL API IPs from emulator to host
adb root 2>/dev/null || true
sleep 2
for ip in $ALL_API_IPS; do
  adb shell "iptables -t nat -A OUTPUT -p tcp -d ${ip} --dport 443 -j DNAT --to-destination 10.0.2.2:443" 2>&1 \
    && echo "iptables redirect: ${ip}:443 → 10.0.2.2:443" \
    || echo "WARNING: iptables failed for ${ip}"
done

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

# Start logcat capture in background
adb logcat -c 2>/dev/null || true
adb logcat -v time 'ReactNativeJS:I' 'ReactNative:W' '*:E' 2>/dev/null > /tmp/emulator-logcat-live.txt &
LOGCAT_PID=$!

TEST_FOLDER="$1"

# Build env var flags for authenticated tests
ENV_ARGS=()
if [ -n "$E2E_TEST_EMAIL" ] && [ -n "$E2E_TEST_PASSWORD" ]; then
  ENV_ARGS+=(--env "E2E_TEST_EMAIL=${E2E_TEST_EMAIL}" --env "E2E_TEST_PASSWORD=${E2E_TEST_PASSWORD}")
  echo "Authenticated test credentials configured"
fi

if [ -z "$TEST_FOLDER" ]; then
  # Run all folders except split-view (split-view requires tablet emulator)
  echo "Running all phone test folders..."
  OVERALL_EXIT=0

  for folder in auth bible-reading bookmarks dictionary highlights navigation notes recents regression search settings swipe topics; do
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

# Stop logcat capture
if [ -n "$LOGCAT_PID" ]; then
  kill $LOGCAT_PID 2>/dev/null || true
  cp /tmp/emulator-logcat-live.txt emulator-logcat.txt 2>/dev/null || true
fi
