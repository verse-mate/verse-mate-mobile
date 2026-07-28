#!/usr/bin/env bash
# Pull every error and warning out of a Metro log.
#
# Why this exists: a red-box error is visible to whoever holds the phone and invisible to
# whoever reads the capture. That gap produced a wrong diagnosis — a blank screen during a
# swipe stress test was the app's error boundary catching a native prop-setter crash, and
# it was investigated as a coordinate bug in the pager instead. Errors DO reach Metro's
# log; nobody was reading the whole file.
#
# `[VMERR]` lines come from the perf session's console.error mirror and are the fastest
# signal. The rest catches anything that bypassed it, including native exceptions, which
# surface as prose rather than as a tagged line.
#
# Usage:
#   scripts/perf/errors.sh                     # the live Metro log on ThorSPC
#   scripts/perf/errors.sh path/to/metro.log   # a pulled copy
set -uo pipefail

LOG="${1:-}"
if [[ -z "$LOG" ]]; then
  PC_LOG='D:/tmp/vm-metro3.log'
  TMP="${TMPDIR:-/tmp}/vm-metro-errors.log"
  # Only the error-ish lines are transferred; the full log runs to tens of thousands.
  pc -s probe "(Get-Content '$PC_LOG' | Select-String 'VMERR|ERROR|Exception|Cannot set prop|Already in the pool|Invariant Violation|componentDidCatch|Unable to resolve')" \
    2>/dev/null | tr -d '\r' > "$TMP"
  LOG="$TMP"
fi

if [[ ! -s "$LOG" ]]; then
  echo "No error lines found (or the log could not be read: $LOG)"
  exit 0
fi

echo "=== [VMERR] tagged (perf session mirror) ==="
grep -a 'VMERR' "$LOG" | sed 's/.*\[VMERR\] //' | sort | uniq -c | sort -rn | head -20

echo
echo "=== native exceptions and failed prop sets ==="
grep -aE 'Cannot set prop|Exception|Already in the pool' "$LOG" | sed 's/^[[:space:]]*//' | sort -u | head -20

echo
echo "=== error boundaries and React recovery ==="
grep -aE 'componentDidCatch|concurrent rendering|Invariant Violation' "$LOG" | sed 's/^[[:space:]]*//' | sort -u | head -10

echo
echo "totals: $(grep -ac 'VMERR' "$LOG" || true) tagged, $(grep -acE 'ERROR' "$LOG" || true) ERROR lines"
