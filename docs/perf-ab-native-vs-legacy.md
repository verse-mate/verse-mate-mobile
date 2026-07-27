# A/B — native text renderer vs the legacy `<Text>` tree

- **Device:** Sony Xperia 5 V (XQ-FS72), font scale 0.85, over USB
- **Build:** ONE debug dev-client APK, arms selected at runtime via the Settings
  toggle. Two builds would differ in more than the flag.
- **Captured:** 2026-07-27
- **Flow:** identical `.maestro/perf/<chapter>.yaml` per arm — navigate, scroll,
  swipe next, scroll immediately, swipe back, toggle Bible↔Insight ×2, open a
  verse insight
- **Reproduce:** `scripts/perf/capture-baseline.sh <chapter> --arm <legacy|native>`

Each run produces exactly one measurement window covering the whole flow, so the
arms are activity-matched. An earlier attempt flushed every 30s and compared
windows containing different amounts of work — that comparison was discarded.

---

## Genesis 1 (31 verses)

Span counts match exactly across arms (3 / 4 / 11), so this is the cleaner of the
two comparisons.

| metric | legacy | native | change |
| --- | --- | --- | --- |
| **text nodes** | 21,831 | **3,008** | **−86%** |
| **JS blocked** | 21,323ms | **8,617ms** | **−60%** |
| JS blocked, % of window | 30.8% | 14.6% | −53% |
| blocks | 205 | 77 | −62% |
| severe blocks (>300ms) | 10 | 4 | −60% |
| **whole flow wall-clock** | 69.2s | **59.2s** | **−14%** |
| `reader.mount.bible` mean | 603ms | 509ms | −16% |
| `reader.mount.explanations` mean | 201ms | 115ms | −43% |
| `view.switch` mean | 185ms | 163ms | −12% |

## Psalm 119 (176 verses) — the gate chapter

Span counts are less well matched here (5 vs 8 bible mounts, 21 vs 26 view
switches), so the rates are softer evidence than Genesis's. The totals still move
in the same direction and by a similar magnitude.

| metric | legacy | native | change |
| --- | --- | --- | --- |
| **text nodes** | 35,941 | **15,442** | **−57%** |
| **JS blocked** | 31,622ms | **17,727ms** | **−44%** |
| JS blocked, % of window | 36.7% | 26.7% | −27% |
| blocks | 195 | 82 | −58% |
| **severe blocks (>300ms)** | 30 | **13** | **−57%** |
| **whole flow wall-clock** | 86.1s | **66.4s** | **−23%** |
| `reader.mount.bible` mean | 786ms | 730ms | −7% |
| `reader.mount.bible` max | 1502ms | 1321ms | −12% |
| **`reader.mount.explanations` mean** | 399ms | **114ms** | **−71%** |
| **`reader.mount.explanations` max** | 1737ms | **207ms** | **−88%** |
| `view.switch` mean | 401ms | 345ms | −14% |

---

## Verdict against Phase 4's gate

The gate was "a large, unambiguous win on Psalm 119 chapter-open **and** on
swipe." It is **partially met**, and the shortfall is informative rather than
fatal.

**Clearly won.** Blocked time (−44 to −60%), block count (−58 to −62%), severe
blocks (−57 to −60%), node count (−57 to −86%), and — the hardest signal to
game — the identical flow completing **14–23% faster in wall-clock**. Nothing was
tuned for these; they all move together.

**Not won: chapter-open specifically.** `reader.mount.bible` improved only 7% on
Psalm 119 and 16% on Genesis 1. Text-node count is plainly *not* what dominates
that particular span. Two candidates, both already on the plan:

1. **The staged-rendering scaffolding.** `ChapterPage` caps the Bible view at 20
   sections for the first 200ms (`setBibleSectionsMax`), so chapter-open is partly
   waiting on a timer that no renderer change can affect. Phase 6 removes it.
2. **Measurement moved onto the JS thread.** Every paragraph now calls a
   synchronous `measureHeight` during render. That is the trade Phase 2a made
   deliberately, and Phase 2b (C++ `measureContent` on RN's `TextLayoutManager`)
   is what removes it. This result is the first concrete argument for actually
   doing 2b rather than leaving it as an option.

**Swipe is excluded, because the instrumentation is wrong.** `swipe.settle`
reported mean 5071ms / max 19450ms — not a latency, a span that fails to close.
It closes on a `[bookId, chapterNumber]` change, so a swipe that does *not* change
chapter (a boundary, or a gesture the pager reads as a scroll) leaves it open until
the next real navigation. No swipe conclusion can be drawn from this data set;
tracked as a fix.

**Also notable:** the Insight view improved far more than the Bible view on Psalm
119 (−71% mean, −88% max) despite the Insight path **not** being converted yet —
it still renders through the legacy per-token tree. The likely reading is that
Insight was contending with the Bible view's cost rather than paying its own, so
making the Bible view cheap freed it. If so, converting Insight in Phase 5 should
help less than these numbers suggest.

## How to read these fairly

- **A dev build is slower than release** — no minification, dev-mode React,
  Metro-served bundle. Absolute values are pessimistic; the comparison is the
  point, and both arms ran from one build in one session on one device.
- **One run per arm per chapter.** No repeats, so run-to-run variance is
  unquantified. The consistency of direction across two chapters and six metrics
  is the reason for confidence, not statistical rigour.
- **Node counts double under StrictMode** (`perfAdd` runs during render). Fine for
  a ratio, misleading as an absolute.
- **Psalm 119's arms are imperfectly matched** on span counts. Genesis 1's match
  exactly and should be weighted more heavily.
