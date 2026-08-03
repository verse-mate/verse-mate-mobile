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
# `< /dev/null` matters: the bridge client reads stdin, and when the script's stdout
# is redirected (as it is for most of these calls) it could block waiting for input
# that never comes. Every leg of a six-capture run hung this way, with no error,
# while the identical commands typed by hand returned instantly.
# One bridge session, with an explicit timeout and a poisoned-session guard.
#
# `pc`'s client timeout defaults to 120s. When a single adb call exceeds it the CLIENT returns but the
# SERVER keeps executing, so the session stays busy and every later call returns the banner
# "[command still running in 'perfcap' ...]" — on STDOUT, where this script reads its data. That
# banner then gets parsed as a device serial, or as a readiness marker that never matches, and the run
# stalls in a poll loop until something reaps it. Four captures died exactly that way with no error
# message and no artifacts, which is far worse than failing: a silent stall looks like slowness.
#
# So: a longer explicit timeout (adb dumps over the bridge are occasionally slow), and if the banner
# appears anyway, close the session and retry ONCE. A second occurrence is fatal, because continuing
# means reporting numbers derived from a banner.
pcrun() {
  local out
  out="$(pc -s perfcap --timeout 300 "$@" < /dev/null)"
  if [[ "$out" == *"still running in"* ]]; then
    pc -c perfcap >/dev/null 2>&1 || true
    out="$(pc -s perfcap --timeout 300 "$@" < /dev/null)"
    [[ "$out" == *"still running in"* ]] && die "The bridge session is wedged and will not reset.

A previous command is still executing server-side, so every probe returns a banner instead of data.
Nothing can be measured through it. Inspect with 'pc -l', kill with 'pc -c perfcap'."
  fi
  printf '%s\n' "$out"
}

# Shared pre-flight gates. Sourced rather than duplicated so capture-atrace.sh cannot drift from this.
# shellcheck source=scripts/perf/preflight.sh
source "$(dirname "${BASH_SOURCE[0]}")/preflight.sh"

# Run one adb command against the discovered device.
#
# The device serial is interpolated from THIS shell, not read from a PowerShell
# env var. Each `pc` invocation is its own command in the bridge session, so an
# env var set in one call is not reliably visible to the next — an earlier version
# of this script did that and every adb call silently ran with an empty -s.
adb_sh() { pcrun "& '$PC_ADB' -s $DEVICE $*"; }

# --- 0. a shell that answers --------------------------------------------------

# Start from a FRESH bridge session, every run.
#
# A persistent PowerShell that is waiting for more input — the state an unbalanced quote or a
# multi-line command leaves behind — accepts commands and never answers. Every probe in this
# script then times out, and because the first probe is device discovery the script blames the
# phone: "No device found. Attach a USB cable..." while `adb devices` from any other session
# lists it happily. That has now cost two debugging detours, the second one after the warning
# comment above had already been written, which is the argument for fixing it in code instead.
#
# `pc -c` on a session that does not exist is harmless, so this needs no guard.
pc -c perfcap >/dev/null 2>&1 || true

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

# A BRIDGE failure is not an answer about the app. `PKG_FLAGS` is read with `2>&1`, so when the `pc`
# bridge wedges it captures "HTTP handler shell.send failed, trying local: timed out" INTO the value.
# That string is non-empty and contains no "DEBUGGABLE", so the check below concluded "not a debuggable
# build" about an app that had just been verified debuggable by hand — a wedged transport reported as a
# fact about the device. Same defect class as the release-build check itself: never let a failed
# measurement masquerade as a measurement.
if [[ "$PKG_FLAGS" == *"shell.send failed"* || "$PKG_FLAGS" == *"still running in"* || "$PKG_FLAGS" == *"timed out"* ]]; then
  die "The pc bridge failed while reading package flags — this says NOTHING about the app.

Bridge said: $PKG_FLAGS

Clear the wedged session and retry:
  pc -c perfcap"
fi

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

# GATE: prove Metro can serve a bundle BEFORE the device is touched.
#
# Skipping this is what produced every white error screen in this project. After `bun start --clear`,
# Metro's first build takes minutes; launch inside that window and the dev client asks, gets nothing,
# and shows the error screen — and the capture then measures an app that never ran a line of our JS,
# reporting an idle app as a fast one. The gate forces the build on the PC and fails there, in words.
preflight_bundle_compiles || exit 1

# Force-stop first, so this is a real cold start rather than an intent handed to a running app.
#
# Without the stop, `am start` prints "Warning: Activity not started, intent has been delivered to
# currently running top-most instance." on STDERR. That is a success, but the `pc` bridge runs commands
# through PowerShell, which turns any stderr into a NativeCommandError and returns non-zero — and under
# `set -e` that killed this script silently, because the call redirects to /dev/null. The capture died
# right after "bundle served" with no message and no summary, which reads like a hang rather than an
# abort. Belt and braces: stop the app, and tolerate a non-zero from the launch either way, since the
# REAL gate is the `[VMPERF] monitor started` marker checked immediately below — that proves our JS ran,
# which is the only thing this launch needed to achieve.
adb_sh "shell am force-stop $PKG" >/dev/null 2>&1 || true
# PLAIN activity launch, not the dev-client deep link.
#
# `am start -a VIEW -d versemate://expo-development-client/?url=...` opens the Expo DEVELOPER MENU sheet
# over the app on this device. That sheet then blocks everything downstream: Maestro cannot see `Skip` or
# `chapter-selector-button`, so `reset-to-reader` fails, the reader never mounts, `useNativeText` never
# runs, and no `arm preference` line is logged — which presented as four unrelated failures. Confirmed by
# screenshotting the phone rather than reading logs.
#
# The deep link is only needed to TELL a dev client which packager to use. This one already persists it
# ("Connected to: http://localhost:8081" in its own menu), so a plain launch reconnects without the sheet.
# Keep $DEV_CLIENT_URL as the documented fallback for a client that has never been pointed at Metro.
# Deep link, but ONLY after the force-stop above — that distinction is the whole point.
#
# Deep-linking into an ALREADY-RUNNING dev client opens the Expo developer-menu sheet over the app, and
# that sheet blocks everything downstream (Maestro cannot see `Skip` or `chapter-selector-button`, the
# reader never mounts, `useNativeText` never logs its arm). Cold-starting with the link instead LOADS the
# bundle, which is what is wanted. Found by screenshotting the phone.
#
# A plain `am start -n $PKG/.MainActivity` is NOT a substitute: on a dev client that lands on its own
# launcher screen, and the capture then fails with "The JS bundle never started" — tried, reverted.
adb_sh "shell am start -a android.intent.action.VIEW -d '$DEV_CLIENT_URL'" >/dev/null 2>&1 || true

# Wait for the perf session's own startup line, which only appears once our
# bundle is actually executing. Polling for it beats a fixed sleep: a cold
# bundle can take 30s+, and a fixed wait is either flaky or wastefully long.
#
# The dump is UNBOUNDED, deliberately, and that is a fix rather than an oversight. `logcat -t
# <count>` applies its window to the WHOLE buffer and filters afterwards, so a tag filter does
# not make the window tag-relative. This phone logs GMS and vendor.qti.servicetracker chatter
# continuously, so within seconds the app's own ReactNativeJS lines are no longer among the last
# 400 of anything: `logcat -d -t 400 ReactNativeJS:V '*:S'` came back EMPTY while
# `logcat -d -t 3000 | grep VMPERF` found the marker every time. The script then reported "The JS
# bundle never started. Check that Metro is running..." against a healthy app, a healthy Metro
# and a live reverse tunnel, which cost two pointless Metro restarts.
#
# Cost is not a concern here because logcat was CLEARED moments ago, just above, so there is
# almost nothing in the buffer to dump — the same reasoning that lets the report itself be read
# with a full dump further down.
BUNDLE_READY=0
for _ in $(seq 1 "$BUNDLE_WAIT_TRIES"); do
  if adb_sh "logcat -d ReactNativeJS:V '*:S'" 2>/dev/null |
    grep -q 'VMPERF.*monitor started'; then
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

# Read the arm the app reports, from the boot logs we already have. Done BEFORE the
# clear below, because it costs nothing here — an earlier version launched an extra
# warm-up flow to produce this line, which added a whole app launch and chapter mount
# to every capture and made runs incomparable (13 mounts vs 8 for the identical flow).
# Unbounded for the reason spelled out at the poll above: a count-bounded window is global to the
# buffer, so on this chatty device it can come back empty and leave the capture labelled with an
# unknown arm. An A/B whose arms are mislabelled is worse than no A/B, because it looks like a
# result.
# `|| true` so the EXPLICIT check below can report this. Without it, a missing line means `grep -o`
# exits 1, `pipefail` makes the whole pipeline non-zero, the assignment fails, and `set -e` kills the
# script HERE — silently, before reaching the `die` that was written for exactly this case. The capture
# then ends after "bundle served" with no message, which reads as a hang.
ARM_LINE="$(adb_sh "logcat -d ReactNativeJS:V '*:S'" 2>/dev/null | grep -o 'arm preference=[a-z]*' | tail -1 | tr -d '\r' || true)"

# GATE: an app that logged errors must not be measured. A rejected import still closes its span, so a
# broken feature reports as a fast one — that is exactly how a lexicon that never loaded once measured
# as a 9x improvement.
preflight_no_errors "$DEVICE" || exit 1

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
# Verify the arm from the app's own reported flag (read above, pre-clear), not from
# rendered output. Inference was indirect and got it wrong once: a flip flow that
# reported FAILED had actually toggled the flag and the probe read the stale arm.
[[ -n "$ARM_LINE" ]] || die "The app never reported its renderer arm.

Expected a '[VMPERF] arm preference=...' line during boot. Either the bundle is
stale (Metro needs the current commit) or the app never started."
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

# Run the flow DETACHED and poll, instead of waiting inside one bridge call.
#
# A single `pcrun` cannot survive this: the `pc` bridge wedges on calls over roughly two minutes, and any
# real flow takes longer. What that produced was worse than a timeout — `pcrun` printed
# "HTTP handler shell.send failed, trying local: timed out" to stdout and RETURNED 0, so `if !` never
# fired, `maestro.log` was 57 bytes of that error, and the capture went on to collect, parse and write a
# summary for a flow whose outcome was unknown. The numbers looked plausible and were not: Bible-reader
# counters and `tab.switch n=2` for a flow that performs 18 tab taps.
#
# And a failed flow is now FATAL rather than a warning. The old code continued "so the partial capture is
# still available", but a flow that stopped early silently changes what the numbers mean — and in an A/B a
# mislabelled or truncated arm reads as a result. That is the one failure this harness exists to prevent.
PC_FLOW_LOG='D:/tmp/perfcap-maestro.log'
# Marker in its OWN file. Appending it to the log mixed encodings: `*>` creates the log as UTF-16LE, an
# `Out-File -Encoding utf8` append then reads back as "????????", and the poll below could never match a
# marker for a flow that had completed every step. Same defect as the exit-code marker in this script's
# own history — a completion signal must not share a file, or an encoding, with the output it signals about.
PC_FLOW_EXIT='D:/tmp/perfcap-maestro.exit'
pcrun "Remove-Item '$PC_FLOW_LOG','$PC_FLOW_EXIT' -ErrorAction SilentlyContinue" >/dev/null 2>&1 || true
# The detached command APPENDS its own exit marker. Maestro's wording is not a contract: this version
# (2.5.1) ends a SUCCESSFUL run with "Repeat 6 times... COMPLETED" and never prints "Flow Passed", so
# polling for that string burned the whole 20-minute budget and would then have reported the outcome as
# unknown for a flow that completed every step. An explicit `MAESTRO_EXIT=<code>` is version-proof.
# `Out-File -Encoding utf8` because PowerShell's `>` writes UTF-16LE, which reads back unparseable.
pc -s "perfcap-flow" --bg \
  "cd '$PC_REPO'; \$env:PATH += ';$PC_MAESTRO_BIN'; maestro --device $DEVICE test '$FLOW' *> '$PC_FLOW_LOG'; \"MAESTRO_EXIT=\$LASTEXITCODE\" | Out-File -Encoding utf8 '$PC_FLOW_EXIT'" \
  < /dev/null > /dev/null 2>&1

FLOW_RESULT=''
for _ in $(seq 1 80); do
  tail_out="$(pcrun "if (Test-Path '$PC_FLOW_EXIT') { Get-Content '$PC_FLOW_EXIT' } else { '' }" 2>/dev/null || true)"
  case "$tail_out" in
    *"MAESTRO_EXIT=0"*) FLOW_RESULT='passed'; break ;;
    *"MAESTRO_EXIT="*)  FLOW_RESULT="failed ($(printf '%s' "$tail_out" | grep -o 'MAESTRO_EXIT=[0-9]*' | tail -1))"; break ;;
  esac
  sleep 15
done

pcrun "if (Test-Path '$PC_FLOW_LOG') { Get-Content '$PC_FLOW_LOG' }" > "$OUT/maestro.log" 2>&1 || true

if [[ "$FLOW_RESULT" != 'passed' ]]; then
  die "The Maestro flow did not report success (result: ${FLOW_RESULT:-unknown/timed out}).

NOTHING was measured, deliberately. A capture whose flow stopped early — or whose outcome could not be
read — describes some other interaction than the one named, and its numbers are indistinguishable from
valid ones. See $OUT/maestro.log

Common causes:
  * the Expo developer-menu sheet is covering the app, so every selector misses
  * the app is parked on a screen the flow's preconditions do not expect
    (shared/reset-to-reader.yaml asserts chapter-selector-button, which does NOT exist on Topics)
  * a testID drifted"
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
