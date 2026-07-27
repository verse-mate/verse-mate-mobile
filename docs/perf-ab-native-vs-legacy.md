# A/B — native text renderer vs the legacy `<Text>` tree

- **Device:** Sony Xperia 5 V (XQ-FS72), font scale 0.85, over USB
- **Build:** ONE debug dev-client APK; arms selected at runtime via the Settings
  toggle. Two builds would differ in more than the flag.
- **Chapter:** Psalm 119 (176 verses, one section) — the worst case
- **Captured:** 2026-07-27, post-memoisation
- **Both arms verified** from the app's own reported flag
  (`[VMPERF] arm preference=…`), not inferred and not assumed
- **Reproduce:** `scripts/perf/capture-baseline.sh psalm-119 --arm <legacy|native>`

One measurement window per run, covering the whole flow, so the arms are
activity-matched.

---

## Result

| metric | legacy | native | change |
| --- | --- | --- | --- |
| **text nodes** | 34,568 | **15,383** | **−55%** |
| **JS blocked** | 37,518ms | **19,316ms** | **−49%** |
| JS blocked, % of window | 38.8% | 24.8% | −36% |
| **blocks** | 287 | **95** | **−67%** |
| **severe blocks (>300ms)** | 34 | **14** | **−59%** |
| **flow wall-clock** | 96.7s | **77.8s** | **−20%** |
| **`swipe.settle` mean** | 2079ms | **1628ms** | **−22%** |
| **`reader.mount.explanations` mean** | 382ms | **103ms** | **−73%** |
| `view.switch` mean | 418ms | 337ms | −19% |
| `reader.mount.bible` mean | 764ms | 774ms | **+1%** |

Native-only spans, after the grouping memo fix:

| span | calls | total | mean |
| --- | --- | --- | --- |
| `paragraph.compile` | 349 | 367ms | 1.05ms |
| `paragraph.measure` | 349 | 190ms | 0.54ms |

---

## Cumulative result (2026-07-28)

Three further changes landed after the first A/B, each measured on the same device
and flow. Psalm 119:

| metric | legacy | native only | + UI-thread scroll | + windowing |
| --- | --- | --- | --- | --- |
| JS blocked | 38.0% | 22.1% | 26.5% | **16.7%** |
| severe blocks (>300ms) | 34 | 14 | 15 | **6** |
| Janky frames | 6.19% | 2.08% | 2.60% | **2.13%** |
| p99 frame | 61ms | 32ms | 31ms | **23ms** |
| Missed Vsync | 216 | 21 | 24 | **20** |
| Slow UI thread | 238 | 79 | 89 | **56** |
| text nodes | 34,568 | 15,383 | 15,174 | **10,241** |
| `paragraph.compile` calls | — | 349 | 349 | **152** |

Against legacy: blocked **−56%**, jank **−66%**, p99 **−62%**, Slow UI thread
**−76%**, Missed Vsync **−91%**, severe blocks **34 → 6**.

### The one metric that never moved

`reader.mount.bible` has now been measured at 726, 699, 761, 702 and 817ms across
arms and changes. It does not respond to any of this. Everything that reduces *node
count* leaves it alone, so whatever dominates chapter-open is not text rendering —
it is something in the mount path not yet instrumented. That wants its own
evidence pass rather than another guess; three hypotheses have already died here
(staging, sync measurement, off-screen view creation).

### Why the scroll worklet looked like a regression

The "+ UI-thread scroll" column looks worse than "native only" on frame metrics.
It is not: that capture was contaminated by the arm-verification step, which ran an
extra warm-up flow and inflated the window from 78s to 95s and chapter mounts from
8 to 13. Re-measured cleanly, the worklet improved every metric. A guard that
changes the thing it measures is its own bug.

## What this establishes

**A clear win on everything except chapter-open.** Blocked time −49%, blocks −67%,
severe blocks −59%, node count −55%, and the identical flow finishing **20% faster
in wall-clock** — the hardest of those to game. Swipe, the symptom the operator
complains about most, improved **22%** and now has a trustworthy number for the
first time.

**Chapter-open does not improve. At all.** `reader.mount.bible` came out −7%, +19%
and +1% across three verified runs — that is noise around zero. The native text
path does not make opening a chapter faster, and no amount of further work on
*text rendering* will change that. Worth stating plainly because it was the
headline hypothesis.

## Two hypotheses killed by this data

**1. The staged-rendering scaffolding. Wrong.** `setBibleSectionsMax` caps the
Bible view at 20 sections for the first 200ms — but Psalm 119 is
`sections: 1, verses: 176`. Slicing one section to three is the whole chapter, so
staging has no effect here and cannot be what dominates.

**2. Phase 2b (C++ `measureContent`) is not worth doing.** This was going to be
the escalation if the sync-measure trade proved costly. It didn't:
`paragraph.measure` totals **190ms across a 78-second window** — about 24ms per
chapter mount, against a 774ms mount. Moving measurement off the JS thread would
recover under 4% of chapter-open. The plan's REVISION section framed 2b as
deferred-but-likely; the measurement says drop it. Keep the sync-measure design.

## Where chapter-open actually goes

By elimination: a Psalm 119 mount creates ~35 paragraph groups. Compile and
measure together account for ~70ms of the 774ms. The remaining ~90% is React
reconciliation plus **creating and laying out 35 `ExpoView` + `TextView` pairs**.

Fewer, cheaper nodes than 35,000 — but still 35 real native views, all created
whether or not they are on screen.

That makes **virtualization (Phase 6) the next lever**, and for a reason the
original plan only half-anticipated: not to make mounts cheaper, but to stop
performing ~30 of them. The plan listed virtualization as a way to remove the
skeleton-on-swipe trade-off; the measurement says it is also the only remaining
route to faster chapter-open.

## How to read these fairly

- **A dev build is slower than release** — no minification, dev-mode React,
  Metro-served bundle. Absolute values are pessimistic; the comparison is the point.
- **Run-to-run variance is large.** The same legacy flow has produced 74s, 97s and
  129s windows on a warming device. Direction is consistent across runs and metrics;
  any single percentage is not precise.
- **Span counts are not perfectly matched** (native saw 8 bible mounts to legacy's
  5, 26 view switches to 21). Means are comparable; totals are not.
- **Node counts double under StrictMode** (`perfAdd` runs during render). Fine as a
  ratio, misleading as an absolute.
- **One chapter.** Genesis 1 showed the same directions at smaller magnitudes
  before the memo fix.

## Harness bugs found while getting here

Every one of these produced *plausible numbers* rather than an error, which is why
they are recorded:

1. **30s flush windows** — arms compared across windows holding different amounts
   of work.
2. **Maestro `${VAR}` never interpolated** in `id:` selectors, and a tap on a
   non-existent id reported COMPLETED — three scenarios measured Genesis 1 while
   every step showed green.
3. **`swipe.settle` never closed** without a chapter change → 19s "latency".
4. **`swipe.settle` opened on every `onPageSelected`**, including spurious trailing
   events → both arms pinned at the 3s cap.
5. **`clearState: true`** wiped the dev client's Metro URL, so the app recorded
   nothing.
6. **Block attribution missed spans that closed inside the gap** — every stall read
   as unattributed.
7. **A leftover modal** made the flag-flip flow fail, so the "native" arm silently
   measured legacy.
8. **`assertVisible: "In the beginning"`** never passed in either arm — a native
   `TextView` does not expose verse text to the accessibility tree — so a
   *successful* flip reported FAILED.
