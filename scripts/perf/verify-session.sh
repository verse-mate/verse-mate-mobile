#!/usr/bin/env bash
#
# Run every measurement needed to judge the 2026-07-29 changes, and print the numbers next to the
# values they have to beat.
#
# Runs from the Pi, drives the phone via ThorSPC, and needs the phone attached to the PC. Roughly 12
# minutes for the full set.
#
#   scripts/perf/verify-session.sh              # everything
#   scripts/perf/verify-session.sh lexicon      # just the lexicon question (fastest, ~3 min)
#   scripts/perf/verify-session.sh swipe insight
#
# ## Why a script and not a list of commands in a doc
#
# Every A/B in this project that went wrong went wrong the same way: the two arms were not comparable.
# One measured an idle app on the wrong screen; one warmed the tabs before measuring the tab switch;
# one compared 261 created views against 113. A capture that half-worked and still printed numbers is
# worse than one that failed, because the numbers get believed.
#
# So the baselines below are hardcoded from the captures they came from, each with its arm name, and the
# script prints them side by side rather than leaving the comparison to memory.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

WANT=("$@")
[[ ${#WANT[@]} -eq 0 ]] && WANT=(lexicon swipe insight mount)

want() { printf '%s\n' "${WANT[@]}" | grep -qx "$1"; }
step() { printf '\n\033[1m=== %s\033[0m\n' "$*"; }

# ── 1. The lexicon question — the single biggest stall ───────────────────────
#
# `data.alignment` used to conflate the once-per-process 18.7MB `_lemmas.json` parse with per-chapter
# work, which is how it came to be read as "13.3s, the biggest cost in the app" when the session's TOTAL
# JS blocking was 5197ms. 11f2609 split the span; 6e49489 switched to the 1.15MB light projection.
#
# What to look for:
#   * `data.alignment.first`  — was the ~2s parse. Should now be a fraction of it.
#   * `JS blocks ... worst`   — the ~2s "severe" block should be GONE, not merely smaller. If a ~2s
#                              block survives, the parse was never the cause and the premise was wrong.
if want lexicon; then
  step "LEXICON — is the ~2s block gone? (genesis-1)"
  scripts/perf/capture-baseline.sh genesis-1 --arm lite-lexicon || echo "  capture FAILED — see output above"
  S="reports/perf/lite-lexicon/genesis-1/summary.txt"
  if [[ -f "$S" ]]; then
    echo
    echo "  ---- now ----"
    sed -n '2,3p' "$S" | sed 's/^/  /'
    grep -E "^  data\.alignment" "$S" | sed 's/^/  /'
    echo "  ---- before (buffer-on/swipe-only + ramp-on/insight-tabs, 2026-07-29) ----"
    echo "    JS blocks: 129 (10163.0ms total, worst 2162.7ms) [severe 2] — blocked 17.7%"
    echo "    data.alignment  7 calls  mean 1902.6ms  max 3028.2ms   (conflated first + warm)"
    echo "  A surviving ~2s 'severe' block means the parse was NOT the cause — say so and re-diagnose."
  fi
fi

# ── 2. Swipe — the felt metric for the buffer ramp (e262096) ────────────────
if want swipe; then
  step "SWIPE — buffer-page ramp still holding? (swipe-only)"
  scripts/perf/capture-baseline.sh swipe-only --arm verify || echo "  capture FAILED"
  S="reports/perf/verify/swipe-only/summary.txt"
  if [[ -f "$S" ]]; then
    echo
    echo "  ---- now ----"
    grep -E "^  (gesture\.swipe|anim\.swipe\.window) |anim\.swipe\.(dropped|worstFrameMs)" "$S" | sed 's/^/  /'
    echo "  ---- before ----"
    echo "    ramp ON : worstFrameMs 34  dropped 2  gesture.swipe mean 420.9ms"
    echo "    ramp OFF: worstFrameMs 48  dropped 3  gesture.swipe mean 429.2ms"
  fi
fi

# ── 3. Insight tabs — the felt metric the markdown ramp failed ──────────────
#
# Kept in the set precisely BECAUSE a change was reverted here on 2026-07-29: the markdown block ramp
# improved frame phases while `tab.switch` did not move, and `markdown.native` = 1 showed it had almost
# nothing to act on. Any future claim about this surface has to move these two numbers.
if want insight; then
  step "INSIGHT — tab/view switch latency (insight-tabs)"
  scripts/perf/capture-baseline.sh insight-tabs --arm verify || echo "  capture FAILED"
  S="reports/perf/verify/insight-tabs/summary.txt"
  if [[ -f "$S" ]]; then
    echo
    echo "  ---- now ----"
    grep -E "^  (tab\.switch|view\.switch) |markdown\.native|markdown\.fallback|text\.selectionEvent" "$S" | sed 's/^/  /'
    echo "  ---- before ----"
    echo "    tab.switch mean 35.5ms / view.switch 36.4ms (ramp on)"
    echo "    tab.switch mean 34.7ms / view.switch 37.6ms (ramp off — the wash that got it reverted)"
    echo "    text.selectionEvent 1518   <- 11f2609 should cut this hard"
  fi
fi

# ── 4. Mount storm — per-frame view creation (atrace) ───────────────────────
if want mount; then
  step "MOUNT — views created per frame (atrace, chapter navigation)"
  scripts/perf/capture-atrace.sh verify-nav --taps "next-chapter-button:6500" || echo "  capture FAILED"
  echo
  echo "  ---- before ----"
  echo "    timers, bible=INF : worst animation frame 59.48ms  peak 65/frame  p95 52/frame"
  echo "    + byline ramp     : worst 41.89ms          peak 54/frame  p95 32/frame"
  echo "    + buffer ramp     : worst 48.59ms          peak 48/frame  p95 40/frame"
  echo "  Single captures here are NOISY — the same code produced 261 and 113 created views on"
  echo "  consecutive runs. Compare per-FRAME figures, not totals, and run it twice before believing it."
fi

step "Done"
cat <<'EOF'
Reminders that cost time when forgotten:
  * A wall-clock span around an `await` measures LATENCY, not work. Cross-check any span total against
    the session's total JS blocking; if the spans sum to more, they are measuring waiting.
  * Judge a change on tab.switch / view.switch / gesture.swipe — the felt metrics — not on frame phases
    alone. Two changes were reverted on 2026-07-29 for passing one and failing the other.
  * `logcat -t N` windows the WHOLE buffer before filtering by tag, so a tag-filtered count can come
    back empty on this chatty phone. Bound by time or not at all.
EOF
