# Legacy renderer — measured baseline

Recorded before any native rendering is in the path, so the Phase 4 A/B has
something honest to compare against.

- **Device:** Sony Xperia 5 V (XQ-FS72), 120Hz panel, connected over USB
- **Build:** debug dev-client, JS from Metro over an `adb reverse` tunnel
- **Arm:** `legacy` — native text renderer OFF (the shipped `<Text>` tree)
- **Captured:** 2026-07-27
- **Reproduce:** `scripts/perf/capture-baseline.sh <scenario> --arm legacy`

Each scenario runs the identical interaction sequence in
`.maestro/perf/shared/reader-workout.yaml`: scroll, swipe to the next chapter,
scroll immediately (the trigger for the reported post-swipe hiccup), swipe back,
toggle Bible↔Insight twice, open a verse insight.

---

## Genesis 1 (31 verses)

Largest flush window of the run:

| metric | value |
| --- | --- |
| JS thread blocked | **26.1%** of a 30.0s window |
| JS blocks | 57 (7836.1ms total) |
| worst single block | **2098.3ms** |
| severity | 40 minor / 13 major / **4 severe** |
| text nodes rendered | **11,132** |

### Blocks attributed to open spans

| span | blocks | total blocked |
| --- | --- | --- |
| `swipe.settle` | 43 | **3161.7ms** |
| *(unattributed)* | 10 | 2704.1ms |
| `view.switch` | 2 | 1106.3ms |
| `reader.mount.bible` | 2 | 1106.3ms |
| `reader.mount.explanations` | 3 | 1023.6ms |

### Span durations

| span | n | mean | max |
| --- | --- | --- | --- |
| `view.switch` | 4 | 359.9ms | 581.4ms |
| `reader.mount.explanations` | 3 | 314.2ms | 575.1ms |
| `reader.mount.bible` | 2 | 431.4ms | 569.3ms |

### Frame timing (UI thread, `dumpsys gfxinfo`)

From a narrower window of the same run: p50 2.83ms, p90 7.25ms, p95 13.79ms,
**p99 428.59ms**, max 457.15ms. Two frames over 100ms (429ms, 457ms) — visible
freezes, not stutters.

## Matthew 5 (48 verses) — pending

## Psalm 119 (176 verses) — pending

The worst case, and the one Phase 4's gate is judged on.

---

## What this establishes

**The premise holds.** Three things were predicted from reading the code and are
now measured:

1. **Node count is the cost.** 11,132 RN `<Text>` nodes for one workout over a
   31-verse chapter. The prediction from
   `docs/native-text-rendering-plan.md` was 1,000-3,000 per chapter render;
   repeated renders across a workout land where expected.
2. **~500ms per chapter mount.** `reader.mount.bible` max 569.3ms — an
   independent reproduction of the 500-700ms figure the 2026-05-21 session found
   with different instrumentation.
3. **The Insight switch is ~360-580ms**, *with* the `InteractionManager` prewarm
   hack already in place. That is the "the UI doesn't switch to Insight
   instantly" complaint, quantified.

**One thing the code reading did NOT predict:** `swipe.settle` dominates. 43
blocks totalling 3.1s, far more than the mounts it contains. Swiping is where
the user actually loses time, which matches the complaint history better than
chapter-open does. Phase 4's gate should weigh swipe at least as heavily as
chapter-open.

**A quarter of the session with the JS thread blocked** is the headline. At 26.1%
the app cannot respond to a tap or advance an animation for a quarter of the time
the user is interacting with it.

## Reading these numbers fairly

- **A dev build is slower than release.** No minification, dev-mode React with
  its extra checks, and Metro serving the bundle. Absolute values are pessimistic;
  the A/B comparison is what matters, and both arms will run under identical
  conditions from one build.
- **The window is a 30s flush, not the whole run.** The monitor emits on an
  interval and on background, so a run yields several windows. The largest is
  quoted; the JSON reports hold all of them.
- **Unattributed blocks are real but unexplained.** 10 blocks / 2704ms had no
  span open. Some is app startup and offline sync; the rest wants more spans
  before it can be blamed on anything specific.
- **`textNodes` doubles under StrictMode**, since `perfAdd` runs during render.
  Fine for comparing arms, misleading as an absolute.
