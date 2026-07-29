#!/usr/bin/env bash
#
# Capture an atrace window around ONE interaction and attribute it to named slices.
#
# Runs from the Pi. Drives adb on ThorSPC over the persistent `pc` bridge, exactly like
# capture-baseline.sh — the phone pairs with the PC, and nothing heavy runs on the Pi.
#
# ## Why this exists alongside capture-baseline.sh
#
# capture-baseline.sh collects `gfxinfo framestats`, which says which PHASE of a frame was slow.
# Every finding in the reader work has pointed at one phase, `animation`, and framestats cannot say
# what executes inside it — so three separate hypotheses were offered for that phase (one confirmed,
# one wrong, one retracted as untested). That is the signature of guessing.
#
# atrace can answer it, because Android and React Native both emit named slices inside that phase:
# `SurfaceMountingManager::createViewUnsafe(...)`, `IntBufferBatchMountItem::mountInstructions::*`,
# `ReactTextViewManager.updateState`, `BatchEventDispatchedListeners`. The first capture taken this
# way attributed 119.4ms of the toggle's animation phase to 228 VMText view creations, and showed all
# 228 landing in two consecutive commits — which framestats had been unable to distinguish from
# "the animation phase is slow".
#
# ## Taps are resolved by testID, not pixels
#
# A hardcoded `input tap 839 143` silently taps the wrong thing on a different screen size or after a
# layout change, and a capture of the wrong interaction looks exactly like a capture of a fast one.
# So each tap names a testID, resolved from a `uiautomator dump` taken BEFORE the trace starts (the
# dump itself perturbs the app, so it must never happen inside the window).
#
# Usage:
#   scripts/perf/capture-atrace.sh <label> [--pre "id[:delayMs] ..."] --taps "id[:delayMs] ..."
#
# Examples:
#   # The Bible <-> Insight toggle, three times.
#   scripts/perf/capture-atrace.sh toggle \
#     --taps "commentary-view-toggle:1800 bible-view-toggle:1800 commentary-view-toggle:1800"
#
#   # The Insight sub-tabs. --pre gets us onto the Insight view first, OUTSIDE the trace window.
#   scripts/perf/capture-atrace.sh subtabs --pre "commentary-view-toggle:2500" \
#     --taps "tab-byline:1500 tab-study:1500 tab-summary:1500"
#
set -uo pipefail

PKG='org.versemate.app'
PC_ADB='D:/Android/Sdk/platform-tools/adb.exe'
SESSION='atrace'
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

die() { echo "capture-atrace: $*" >&2; exit 1; }
step() { printf '\n=== %s\n' "$*"; }

LABEL="${1:-}"
[[ -n "$LABEL" ]] || die "usage: $0 <label> [--pre \"id[:ms] ...\"] --taps \"id[:ms] ...\""
shift
PRE=''
TAPS=''
while [[ $# -gt 0 ]]; do
  case "$1" in
    --pre) PRE="${2:-}"; shift 2 ;;
    --taps) TAPS="${2:-}"; shift 2 ;;
    *) die "unknown argument: $1" ;;
  esac
done
[[ -n "$TAPS" ]] || die "--taps is required"

OUT="$REPO_ROOT/reports/perf/atrace"
mkdir -p "$OUT"

# `pc`'s client timeout can return while the command keeps running server-side, and the banner it
# prints then lands on stdout where a caller reads data. Retry once against a fresh session, then
# fail loudly — a number derived from that banner is fiction. Same guard as check_pr_versemate.sh.
pcrun() {
  local out
  out="$(pc -s "$SESSION" --timeout 300 "$1" < /dev/null 2>&1)"
  if [[ "$out" == *"still running in"* || "$out" == *"shell.send failed"* ]]; then
    pc -c "$SESSION" >/dev/null 2>&1 || true
    sleep 2
    out="$(pc -s "$SESSION" --timeout 300 "$1" < /dev/null 2>&1)"
    if [[ "$out" == *"still running in"* || "$out" == *"shell.send failed"* ]]; then
      die "the bridge session is wedged; nothing here can be trusted. Try: pc -c $SESSION"
    fi
  fi
  printf '%s\n' "$out"
}

step "Finding the device"
DEVICE="$(pcrun "& '$PC_ADB' devices" | awk '/\tdevice$/ {print $1; exit}' | tr -d '\r')"
[[ -n "$DEVICE" ]] || die "no adb device in state 'device'. Is the phone attached to ThorSPC?"
echo "device: $DEVICE"

adb_sh() { pcrun "& '$PC_ADB' -s $DEVICE $1"; }

# Resolve "id[:ms] id[:ms] ..." into "x y ms" lines, via a fresh UI dump.
#
# Parsed on the Pi rather than in PowerShell because the same regex already proved out here, and a
# 24KB XML is nothing to move. An unresolved id is fatal: tapping a default coordinate would produce
# a capture of whatever happened to be there.
resolve_taps() {
  local spec="$1" xml="$OUT/.ui-$LABEL.xml"
  adb_sh "shell uiautomator dump /sdcard/vm-ui.xml" >/dev/null
  adb_sh "pull /sdcard/vm-ui.xml D:/tmp/vm-ui.xml" >/dev/null
  scp -q -o ConnectTimeout=10 thorspc:D:/tmp/vm-ui.xml "$xml" || die "could not pull the UI dump"
  SPEC="$spec" python3 - "$xml" <<'PY'
import os, re, sys
xml = open(sys.argv[1], errors='replace').read()
centres = {}
for node in re.finditer(r'<node[^>]*?/?>', xml):
    n = node.group(0)
    rid = re.search(r'resource-id="([^"]*)"', n)
    b = re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', n)
    if rid and rid.group(1) and b:
        x1, y1, x2, y2 = map(int, b.groups())
        centres.setdefault(rid.group(1), ((x1 + x2) // 2, (y1 + y2) // 2))
missing = []
out = []
for item in os.environ['SPEC'].split():
    tid, _, ms = item.partition(':')
    if tid not in centres:
        missing.append(tid)
        continue
    x, y = centres[tid]
    out.append(f"{x} {y} {ms or 1500}")
if missing:
    sys.stderr.write(
        "unresolved testIDs: " + ", ".join(missing) + "\n"
        "They are not on screen right now. Available:\n  "
        + "\n  ".join(sorted(centres)[:40]) + "\n")
    sys.exit(1)
print("\n".join(out))
PY
}

if [[ -n "$PRE" ]]; then
  step "Warm-up taps (outside the trace): $PRE"
  PRE_TAPS="$(resolve_taps "$PRE")" || die "could not resolve --pre testIDs"
  while read -r x y ms; do
    [[ -n "${x:-}" ]] || continue
    echo "  tap $x,$y then wait ${ms}ms"
    adb_sh "shell input tap $x $y" >/dev/null
    sleep "$(awk "BEGIN{print $ms/1000}")"
  done <<< "$PRE_TAPS"
fi

step "Resolving measured taps: $TAPS"
MEASURED="$(resolve_taps "$TAPS")" || die "could not resolve --taps testIDs"
echo "$MEASURED" | sed 's/^/  /'

# Build ONE PowerShell payload for the traced window. Every tap and sleep has to happen inside a
# single bridge call: a per-tap round trip would add ~1s of bridge latency between taps, and the
# capture would describe the gaps rather than the interaction.
PS="\$a='$PC_ADB'; \$d='$DEVICE'
& \$a -s \$d shell atrace --async_start -a $PKG -c -b 16000 gfx view app 2>&1 | Out-Null
Start-Sleep -Milliseconds 400
"
while read -r x y ms; do
  [[ -n "${x:-}" ]] || continue
  PS+="& \$a -s \$d shell input tap $x $y
Start-Sleep -Milliseconds $ms
"
done <<< "$MEASURED"
PS+="New-Item -ItemType Directory -Force -Path D:/tmp | Out-Null
& \$a -s \$d shell atrace --async_stop 2>\$null | Out-File -Encoding utf8 D:/tmp/vm-atrace-$LABEL.txt
'BYTES=' + (Get-Item D:/tmp/vm-atrace-$LABEL.txt).Length"

step "Capturing"
CAP="$(pcrun "$PS")"
echo "$CAP" | grep -o 'BYTES=[0-9]*' || die "the capture produced no file. Raw output:
$CAP"

step "Pulling the trace"
TRACE="$OUT/$LABEL.txt"
scp -q -o ConnectTimeout=20 "thorspc:D:/tmp/vm-atrace-$LABEL.txt" "$TRACE" || die "scp of the trace failed"
ls -la "$TRACE"

step "Attributing"
cd "$REPO_ROOT"
bun scripts/perf/atrace-slices.ts "$TRACE" --top 16

echo
echo "trace kept at: $TRACE"
