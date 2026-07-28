#!/usr/bin/env bash
#
# Capture everything needed for a full diagnosis, in one run.
#
#   scripts/perf/capture-all.sh
#
# Captures both arms across a short chapter, a long chapter, and a swipe-only
# scenario, then prints the arm comparison and — the important one — the scaling
# report that says whether cost still tracks chapter length.
#
# Leaves the device on the NATIVE arm, so the operator can use the app afterwards
# without a stale flag making their impressions meaningless. That has happened once
# already.

set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."

CHAPTERS=(genesis-1 psalm-119 swipe-only)

# Flip the renderer flag. The capture script verifies the arm afterwards and fails
# loudly if a flip silently did not take, which has happened when a leftover modal
# blocked the flow — so this deliberately does not try to confirm it itself.
flip() {
  pc -s capall "cd D:/Coding/VerseMate/verse-mate-mobile; \$env:PATH += ';D:/dev/maestro/bin'; \$d = (& 'D:/Android/Sdk/platform-tools/adb.exe' devices | Select-String '\\sdevice\$' | ForEach-Object { (\$_ -split '\\s+')[0] } | Select-Object -First 1); maestro --device \$d test .maestro/perf/enable-native-text.yaml" >/dev/null 2>&1
}

echo "==> Capturing NATIVE arm"
for c in "${CHAPTERS[@]}"; do
  echo "    $c"
  bash scripts/perf/capture-baseline.sh "$c" --arm native >"/tmp/capall-native-$c.log" 2>&1 \
    || echo "      FAILED — see /tmp/capall-native-$c.log"
done

echo "==> Flipping to LEGACY"
flip

echo "==> Capturing LEGACY arm"
for c in "${CHAPTERS[@]}"; do
  echo "    $c"
  bash scripts/perf/capture-baseline.sh "$c" --arm legacy >"/tmp/capall-legacy-$c.log" 2>&1 \
    || echo "      FAILED — see /tmp/capall-legacy-$c.log"
done

echo "==> Restoring NATIVE arm for interactive use"
flip

echo ""
bun scripts/perf/compare.ts --arms psalm-119 || true
bun scripts/perf/compare.ts --arms swipe-only || true
echo ""
bun scripts/perf/compare.ts --scaling native || true
bun scripts/perf/compare.ts --scaling legacy || true
