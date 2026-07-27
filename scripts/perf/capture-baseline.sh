#!/usr/bin/env bash
#
# Capture a perf baseline for one scenario on a physical Android device.
#
# Runs from the Pi. Drives adb on ThorSPC over SSH (the phone pairs with the PC,
# not the Pi) and pulls the results back here for parsing.
#
#   scripts/perf/capture-baseline.sh <scenario> [--arm <name>]
#
#   scenario   basename of a flow in .maestro/perf/ (e.g. psalm-119)
#   --arm      label for the run, used in the output path. Use this to keep the
#              two sides of an A/B apart, e.g. --arm legacy / --arm native.
#
# Output: reports/perf/<arm>/<scenario>/ containing
#   logcat.txt      raw capture (keep it — the parser is not lossless by design)
#   report/*.json   reassembled PerfReports
#   gfxinfo.txt     UI-thread frame stats, which the JS monitor cannot see
#   summary.txt     human-readable
#
# Every step that can fail, fails loudly. A perf capture that half-worked and
# reported nothing is worse than one that stopped and said why.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PKG="org.versemate.app"
PC_ADB='D:/Android/Sdk/platform-tools/adb.exe'
PC_REPO='D:/Coding/VerseMate/verse-mate-mobile'
# Maestro is not on PATH in a non-interactive bridge shell, so it is added per call.
PC_MAESTRO_BIN='D:/dev/maestro/bin'
# Big enough that a chatty dev session cannot wrap the buffer mid-report.
LOGCAT_BUFFER='16M'
# Deep link that pins the dev client to Metro reached over the reverse tunnel.
DEV_CLIENT_URL='versemate://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081'
# 5s per try; a cold bundle on this app takes ~30-60s.
BUNDLE_WAIT_TRIES=24

die() { echo "ERROR: $*" >&2; exit 1; }
step() { echo "==> $*"; }

# --- args -------------------------------------------------------------------

SCENARIO="${1:-}"
[[ -n "$SCENARIO" ]] || die "usage: $0 <scenario> [--arm <name>]"
shift

ARM='baseline'
while [[ $# -gt 0 ]]; do
  case "$1" in
    --arm) ARM="${2:-}"; [[ -n "$ARM" ]] || die '--arm needs a value'; shift 2 ;;
    *) die "unknown argument: $1" ;;
  esac
done

FLOW=".maestro/perf/${SCENARIO}.yaml"
[[ -f "$REPO_ROOT/$FLOW" ]] || die "no such flow: $FLOW
Available: $(ls "$REPO_ROOT/.maestro/perf/" 2>/dev/null | tr '\n' ' ')"

OUT="$REPO_ROOT/reports/perf/${ARM}/${SCENARIO}"
mkdir -p "$OUT/report"

# --- helpers ----------------------------------------------------------------

# Run a PowerShell command on ThorSPC. `pc` is the persistent-shell bridge;
# preferred over raw ssh so the adb daemon survives between calls (a fresh SSH
# session per adb command is how the connection gets dropped mid-run).
pcrun() { pc -s perfcap "$@"; }

# Run one adb command against the discovered device.
#
# The device serial is interpolated from THIS shell, not read from a PowerShell
# env var. Each `pc` invocation is its own command in the bridge session, so an
# env var set in one call is not reliably visible to the next — an earlier version
# of this script did that and every adb call silently ran with an empty -s.
adb_sh() { pcrun "& '$PC_ADB' -s $DEVICE $*"; }

# --- 1. device ---------------------------------------------------------------

step 'Finding the phone'
# USB first: an attached cable is already listed and needs no discovery.
# Wireless is the fallback, and there the port rotates every time the phone
# toggles the setting, so it must be rediscovered rather than hard-coded.
# See versemate-phone-devloop.
#
# Both probes are ONE LINE each on purpose: multi-line PowerShell sent through
# the `pc` bridge hangs waiting for more input, which presents as a device that
# cannot be found rather than as a syntax problem.
DEVICE="$(pcrun "\$a='$PC_ADB'; \$u = & \$a devices | Select-String '\\sdevice\$' | ForEach-Object { (\$_ -split '\\s+')[0] } | Select-Object -First 1; if (\$u) { \"DEVICE=\$u\" }" 2>&1 | grep -oP 'DEVICE=\K\S+' | head -1)" || true

if [[ -z "${DEVICE:-}" ]]; then
  step 'No USB device; trying wireless over mDNS'
  DEVICE="$(pcrun "\$a='$PC_ADB'; & \$a mdns services 2>\$null | Select-String '_adb-tls-connect' | ForEach-Object { if (\$_ -match '(\\d+\\.\\d+\\.\\d+\\.\\d+:\\d+)') { \$r = & \$a connect \$matches[1] 2>&1; if (\$r -notmatch 'refused|failed') { \"DEVICE=\" + \$matches[1] } } }" 2>&1 | grep -oP 'DEVICE=\K\S+' | head -1)" || true
fi

[[ -n "${DEVICE:-}" ]] || die "No device found.

Attach a USB cable, or ask the operator to turn on Wireless Debugging
(Developer options). Wireless pairing is sticky across off/on cycles, so no
pairing code should be needed. If every discovered address refuses the
connection, pairing was wiped and a fresh 'adb pair <ip:port> <code>' is
required."

step "Device: $DEVICE"

# --- 2. verify it is a debug build ------------------------------------------

step 'Verifying the installed build is debuggable'
# A release build silently produces zero perf data (the session is __DEV__ only).
# Catching that here saves a full run that yields an empty report.
# Distinguish "not debuggable" from "the probe told us nothing".
#
# An earlier version ran `grep -c DEBUGGABLE` over the probe output and died when
# the count was 0 — which is also what an empty result looks like when the bridge
# hiccups. That guard failed closed on a perfectly good build and aborted a run
# for no reason. `Select-String`, not `grep`, because this executes in PowerShell
# on the PC where no Unix grep exists.
PKG_FLAGS="$(adb_sh "shell dumpsys package $PKG | Select-String 'pkgFlags' | Select-Object -First 1" 2>&1 | tr -d '\r')"

if [[ -z "${PKG_FLAGS// /}" ]]; then
  die "Could not read package flags for $PKG.

The probe returned nothing, which is not the same as 'not debuggable' — most
likely the app is not installed, or the bridge call failed. Check:
  adb -s $DEVICE shell dumpsys package $PKG | Select-String pkgFlags"
fi

if [[ "$PKG_FLAGS" != *DEBUGGABLE* ]]; then
  die "$PKG on the device is not a debuggable build.

Flags reported: $PKG_FLAGS

The perf session is __DEV__ only, so a release/preview APK records nothing.
Install the dev-client debug APK:
  $PC_REPO/android/app/build/outputs/apk/debug/app-debug.apk"
fi

# --- 3. reset state ----------------------------------------------------------

step 'Resetting app + logcat + frame stats'
adb_sh "shell am force-stop $PKG" >/dev/null
adb_sh "logcat -G $LOGCAT_BUFFER" >/dev/null
adb_sh 'logcat -c' >/dev/null
adb_sh "shell dumpsys gfxinfo $PKG reset" >/dev/null

# --- 3b. make sure the dev client is pointed at Metro ---------------------

step 'Launching against Metro and waiting for the bundle'
# A dev-client build boots into its launcher unless it is told which dev server
# to use, and then none of our JS runs — no perf session, no report. Deep-linking
# the bundle URL makes that deterministic instead of depending on whatever server
# the app happened to have saved.
#
# `adb reverse` is set first so `localhost` resolves to Metro on the PC over the
# USB cable, which also means this works regardless of either machine's LAN
# address.
adb_sh "reverse tcp:8081 tcp:8081" >/dev/null 2>&1 || true
adb_sh "shell am start -a android.intent.action.VIEW -d '$DEV_CLIENT_URL'" >/dev/null

# Wait for the perf session's own startup line, which only appears once our
# bundle is actually executing. Polling for it beats a fixed sleep: a cold
# bundle can take 30s+, and a fixed wait is either flaky or wastefully long.
BUNDLE_READY=0
for _ in $(seq 1 "$BUNDLE_WAIT_TRIES"); do
  if adb_sh "logcat -d ReactNativeJS:V '*:S'" 2>/dev/null | grep -q 'VMPERF.*monitor started'; then
    BUNDLE_READY=1
    break
  fi
  sleep 5
done
[[ "$BUNDLE_READY" == "1" ]] || die "The JS bundle never started.

No '[VMPERF] monitor started' line appeared within $((BUNDLE_WAIT_TRIES * 5))s.
Check that Metro is running on the PC:
  cd $PC_REPO && bun start
and that the reverse tunnel is up:
  adb -s $DEVICE reverse --list"

# The perf session started during app boot, so its records so far describe
# startup, not the flow. Clear logcat to scope the capture to the flow itself.
adb_sh 'logcat -c' >/dev/null
adb_sh "shell dumpsys gfxinfo $PKG reset" >/dev/null

# --- 3c. verify which arm is actually live -----------------------------------

step 'Verifying the arm'
# A paired capture had its flag-flip flow fail silently, so the "native" arm
# measured the legacy path and the comparison looked like a result. Never trust the
# flip; read the arm back from the app.
#
# The native path logs paragraph.compile spans and the legacy path logs textNodes
# from HighlightedText, so the presence of a compile span is a direct read of which
# renderer is live. Checked AFTER the bundle is up and the reader has rendered.
# Read the arm the app itself reports, rather than inferring it from rendered
# output. The app logs `[VMPERF] arm preference=<bool> available=<bool>` once the
# stored flag resolves. Inference was indirect and got it wrong: a flip flow that
# reported FAILED had actually toggled the flag (it only failed a later, unrelated
# assertion), and the probe still read the stale arm.
#
# The reader is warmed first because the log line only appears once the hook
# resolves. The reset flow is idempotent and cheap.
pcrun "cd '$PC_REPO'; \$env:PATH += ';$PC_MAESTRO_BIN'; maestro --device $DEVICE test '.maestro/perf/shared/reset-to-reader.yaml'" >/dev/null 2>&1 || true
ARM_LINE="$(adb_sh "logcat -d ReactNativeJS:V '*:S'" 2>/dev/null | grep -o 'arm preference=[a-z]*' | tail -1 | tr -d '\r')"
[[ -n "$ARM_LINE" ]] || die "The app never reported its renderer arm.

Expected a '[VMPERF] arm preference=...' line. Either the bundle is stale (Metro
needs the current commit) or the reader never mounted."
ARM_PROBE=0
[[ "$ARM_LINE" == 'arm preference=true' ]] && ARM_PROBE=1
step "App reports: $ARM_LINE"

if [[ "$ARM" == "native" && "$ARM_PROBE" == "0" ]]; then
  die "Asked to measure the NATIVE arm, but the app reports the flag is OFF.

Flip it with:
  maestro --device $DEVICE test .maestro/perf/enable-native-text.yaml
and confirm the toggle actually moved — that flow has failed silently before when a
modal was left open by a previous run."
fi
if [[ "$ARM" == "legacy" && "$ARM_PROBE" != "0" ]]; then
  die "Asked to measure the LEGACY arm, but the app reports the flag is ON.

Flip it off before capturing this arm."
fi
step "Arm confirmed: $ARM"

# --- 4. run the flow ---------------------------------------------------------

step "Running Maestro flow: $FLOW"
if ! pcrun "cd '$PC_REPO'; \$env:PATH += ';$PC_MAESTRO_BIN'; maestro --device $DEVICE test '$FLOW'" 2>&1 | tee "$OUT/maestro.log"; then
  echo 'WARNING: the Maestro flow failed. Continuing so the partial capture is' >&2
  echo 'still available — but treat the numbers as covering less than the flow' >&2
  echo "intended. See $OUT/maestro.log" >&2
fi

# --- 5. trigger the report emit ---------------------------------------------

step 'Backgrounding the app to flush the perf report'
# The session emits on AppState 'background'. HOME is the deterministic trigger.
adb_sh 'shell input keyevent KEYCODE_HOME' >/dev/null
sleep 3

# --- 6. collect --------------------------------------------------------------

step 'Collecting logcat + frame stats'
adb_sh "logcat -d ReactNativeJS:V '*:S'" > "$OUT/logcat.txt"
[[ -s "$OUT/logcat.txt" ]] || die "logcat capture is empty.

Either the app never started, or logcat was filtered wrong. Check $OUT/maestro.log."

adb_sh "shell dumpsys gfxinfo $PKG framestats" > "$OUT/gfxinfo.txt"

# --- 7. parse ----------------------------------------------------------------

step 'Parsing'
cd "$REPO_ROOT"
if bun scripts/perf/parse-report.ts "$OUT/logcat.txt" --out "$OUT/report" > "$OUT/summary.txt" 2>&1; then
  PARSE_OK=1
else
  PARSE_OK=0
fi
cat "$OUT/summary.txt"

echo ''
step 'Frame stats (UI thread — what the user actually saw)'
bun scripts/perf/summarise-gfxinfo.ts "$OUT/gfxinfo.txt" | tee "$OUT/frames.txt"

echo ''
echo "Artifacts: $OUT"
[[ "$PARSE_OK" == "1" ]] || die 'Report reassembly failed — see the summary above. Numbers are incomplete.'
