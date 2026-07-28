# Perf — what the profiler found, and what is left

Rewritten 2026-07-28. Supersedes the earlier version, whose central open question
("`reader.mount.bible` has never moved") is now answered.

## The answer

A Hermes CPU sampling profile of six forward chapter swipes settled it. Of 18s
wall clock the JS thread was **idle 72%**; the busy ~5.1s was:

| self time | frame |
| --- | --- |
| 1344ms | `[Host Function] completeRoot` ← `updateHostContainer` ← `completeWork` |
| 396ms | `[GC Young Gen]` |
| 350ms | `[Host Function] createNode` (225ms hosts + 125ms `createTextInstance`) |
| 178ms | `regExpConstructor` ← `LinkifyIt.compile` ← `MarkdownIt` |
| 167ms | `measureHeights` (ours) |
| 120ms | `buildLexIndex` + `normalizeStrongs` (the lexicon — ~2%) |

By subtree, `performWorkOnRoot` was 4270ms (23%), of which `renderRootSync` was
4066ms — against **~620ms for all of our own components combined**.

So the cost was never the text layer, and never the lexicon. It is **React
reconciliation plus Fabric's commit**, which is per-node overhead over the live
tree. `completeRoot` is Fabric committing the root's child set, and in Fabric's
persistent-tree model every commit diffs against the whole mounted tree — so a
node costs not only its own creation but a share of every later commit too.

That reframes the whole problem: **the lever is the number of mounted nodes**, not
the speed of any function.

### Why four earlier hypotheses died

Each was consistent with `reader.mount.bible ≈ 700ms` and each was about *our*
code, which the profile shows accounts for ~12% of busy time. Section staging,
sync measurement, off-screen view creation and O(chapter) compile were all real
improvements that could not move a number dominated by something else.

## What was fixed on the strength of it

1. **The markdown parser was being rebuilt on every render.**
   `react-native-markdown-display` declares it as a default parameter
   (`markdownit = MarkdownIt({typographer: true})`), so every render of every
   `<Markdown>` recompiled LinkifyIt's regex set. That was the entire 178ms —
   more than our native text measurement — and ~85% of all markdown time. Fixed
   with one shared instance in `lib/markdown/Markdown.tsx`; only the 9 import
   lines changed, so all 21 call sites benefit untouched.

2. **The Bible path was rendering the legacy per-word tree on every mount.**
   The native branch needs `paragraphWidth > 0`, known only after `onLayout`. A
   comment claimed only the session's first chapter paid that frame because the
   reader stays mounted across swipes — but each chapter has its **own**
   ChapterReader, one per pager page. Every mount rendered the whole chapter as
   per-word `<Text>`, had Fabric create all of it, and discarded it a frame
   later. The labelled counter proved it: **9,113 of 9,113** legacy text nodes
   came from `bible.paragraphFallback`, none from Insight or Topics. Fixed by
   remembering the last measured width at module scope and by reserving an
   estimated height instead of falling back.

3. **The Insight prewarm was sticky per page**, so every chapter the reader passed
   through kept its Insight subtree mounted and charged to every subsequent
   commit. Released when the page stops being current.

4. **The neighbour chapter now builds in idle time** rather than in the same
   commit as the navigation.

5. **The BibleInteraction context value was a fresh object on every provider
   render**, so every consumer re-rendered whether or not its data had moved. The
   re-render probe measured `render.page.by.bibleInteraction` at 83 in a
   45-second swipe session, cascading into both readers on all three pager pages.
   A plain `useMemo` could not fix it — the three mutations come from
   `useHighlights`, which has no `useCallback` anywhere, and the five triggers are
   inline, so every dependency was already new each render. The actions are now a
   facade created once that delegates through a ref; `value` depends only on the
   two data arrays.

### Measured, same flow and phone, first profile vs last

| | before | after |
| --- | --- | --- |
| JS idle | 72.1% | **85.7%** |
| busy JS | ~5080ms | **~2600ms** |
| `completeRoot` | 1344ms | **315ms** |
| `createNode` | 350ms | **113ms** |
| GC young gen | 396ms | 210ms |
| `regExpConstructor` | 178ms | **0** |
| our components | 620ms | 453ms |

Span report across the day: `reader.mount.bible` 700–800ms → **85ms**,
`view.switch` 418ms → **105ms**, `swipe.settle` 838ms → **521ms** mean (max
1444ms → 676ms), `swipe.pendingNav` 374ms → 284ms, legacy text nodes 9113 →
**1582**, reader renders 113 → **76**, frame p99 150ms → ~42ms, Missed Vsync 17 →
10.

Frame-level numbers vary a lot run to run (the same flow has produced 3.9% and
4.6% jank back to back); the JS-side numbers are the trustworthy signal.

### An honest negative result

Making `useAutoHighlights` return a frozen shared empty array did **not** move
`render.bible.by.autoHighlights` (28 before, 28 after). That churn is real
per-chapter data, not the `|| []`. The change is still correct — it removes a
genuine per-render allocation when the query has no data — but it was not the
driver, and recording it as a win would misdirect the next person.

## What is left, in order

1. **`swipe.settle` is 521ms mean and is now the biggest single user-visible
   number.** It covers navigation dispatch through the new chapter committing.
   With `completeRoot` down to 315ms across a whole 18s session, the commit is no
   longer the bulk of it — so the next step is to break `settle` into phases the
   way the swipe was split, rather than assume which part is slow.
2. **React still renders synchronously**, and sync renders cannot yield to a
   gesture. A chapter change dispatched inside `startTransition` would let React
   interrupt itself for the swipe. Untried, and now more attractive than when the
   commit itself dominated.
3. **`compileParagraph` is 366ms — the largest remaining cost in our own code.**
   It runs 281–314 times per session for roughly 7 chapters; worth checking
   whether the memo key is churning rather than making the function faster.
4. **`[Native] ErrorConstructor` shows 58ms.** Something is constructing Error
   objects in a hot path. Small, but unexplained, and unexplained costs in this
   project have a record of being someone's throwaway work.
5. **The worst JS block (~2000ms) is at app startup**, not in swiping — the top
   three blocks had no span open and two were in the first two seconds. Startup is
   a separate problem from the one being worked on, and nobody has looked at it.
6. **`data.alignment` reports mean 443ms, max 3074ms over 20 calls.** Mostly await
   rather than CPU (the profile puts lexicon CPU at ~120ms), but the first load
   parses a 17.8MB, 18,100-entry JSON. Separately, `loadAlignmentFor` rebuilds two
   whole-lexicon structures — an 18,100-key object spread and an `Object.entries`
   pass — on every uncached chapter, neither of which depends on the chapter.
   Cheap to hoist, in the `@versemate/lexicon` repo rather than here.
7. **Insight/Topics still use the legacy per-word renderer.** No longer urgent —
   the counter shows they contribute almost nothing in a reading session — but it
   is the largest unconverted surface.
8. **iOS has no Swift counterpart yet**, so the native path is Android-only and
   the flag stays off by default there.

## The swipe, and where the residual block actually lives

Fast swiping was fixed in three steps, and three further theories died to
measurement along the way. Recording the dead ones matters as much as the fixes:
each was plausible, each would have justified a large refactor, and each was wrong.

**Fixed.**

1. *The guard swallowed real swipes.* After each chapter change the pager recentres
   with `setPageWithoutAnimation`, and ViewPager2 emits trailing `onPageSelected`
   events for up to ~400ms afterwards. The old code rejected EVERY page-selected
   event in that window, so with a ~520ms commit there was close to a one-second
   dead zone per swipe. A trailing artifact is never preceded by a drag; a real
   swipe always is, so the guard discriminates on that instead.
2. *Targets were resolved from props*, i.e. from the chapter React had committed, so
   a second quick swipe aimed at a chapter already left behind. The pager now keeps
   a virtual position, advanced the moment a swipe settles, with a queue of
   dispatched-but-uncommitted chapters so an out-of-order commit cannot drag it
   backwards while an external navigation still wins.
3. *The recenter cleared the drag flag mid-drag.* The recenter fires when the
   PREVIOUS swipe commits, which at speed lands inside the NEXT drag — so that
   gesture's event looked like an artifact and was discarded. Eleven drags produced
   six navigations and exactly five swallows. The flag is now only cleared when no
   drag is in flight.

Operator-driven verification (Genesis 1 → 20, 19 chapter changes):
`swipe.rescuedDuringGuard` 17, `swipe.navResolved` 19, Missed Vsync **0**, jank
1.83%, p50 5ms. Seventeen of nineteen swipes would have been thrown away by the
original code.

**Theories that died, and what killed them.**

| theory | measurement | verdict |
| --- | --- | --- |
| the recenter blocks input while it seeks | `pager.recenter` 2.8ms mean, 4.7ms max | dead |
| the reader's ScrollView steals the gesture | `reader.touchStart` 10 vs `pager.dragStart` 10 | dead |
| ViewPager2 snaps the drag back | `swipe.snappedBack` 0–1 | dead |

The ScrollView theory came from a genuinely good observation — the vertical scroll
indicator flashes at the moment of the block — but the counters show the pager
registered every gesture as a drag, so nothing was stolen.

**What is left, and it is not our code.** Bucketing page-selected events by
position closes the accounting: ten fast drags produced 4 × position 2, 1 ×
position 0, and 6 × position 1 (five recenters plus one snap-back). Four drags
produced no page event at all. ViewPager2 entered dragging and then never crossed
its threshold to change page, because the drag began while it was still settling
from the previous fling and so started from a mid-transition offset.

Caveat: `adb shell input swipe` delivers far fewer motion events than a finger, so
ViewPager2's velocity tracker may not see a fling at all. Synthetic runs are a weak
proxy here, and the operator's own report — a high pace keeps up, only a very fast
one blocks — is the better evidence.

**That last case was attempted and it does not work.** Recovering intent from
`onPageScroll` — signed peak travel of the drag, gated on a 320ms flick window to
avoid turning a cancelled drag into a navigation — and calling `setPage` when
ViewPager2 declined:

| | without | with |
| --- | --- | --- |
| `pager.dragStart` | 10 | 10 |
| `swipe.navResolved` | 5 | 5 |
| `pager.selected.p2` | 4 | 4 |
| `swipe.forcedPage` | — | 4 |

`setPage` was called four times and produced zero additional navigations, and the
operator's own testing agreed before the numbers arrived. The reason is the
diagnosis eating itself: ViewPager2 declined those drags because it was still
settling, and a pager too busy to accept a drag is equally too busy to accept a
programmatic page. Reverted.

What that rules out is worth keeping: **no amount of recovering intent in JS and
handing it back to ViewPager2 will work**, because the refusal is downstream of us.
A real fix has to take the paging decision away from ViewPager2 — own the pager
offset in a gesture handler, or drop the 3-page recenter model for a virtualised
pager where there is no settle to collide with. Both are substantial, and the
current behaviour is fast enough that neither is urgent.

One measurement caveat that cost a wrong conclusion here: a hand-driven session
and a scripted one in the SAME recording window are indistinguishable in the
report, and mixing them made a no-op look like churn (`pager.dragStart` 48,
`swipe.navResolved` 23 for ten scripted swipes). Record one or the other, never
both.

## The gesture pager (ViewPager3), and what it cost to get right

ViewPager2 could not be talked round: it declines a drag that begins while it is
still settling, and declines a programmatic `setPage` in the same state. So the
paging decision moved into `GestureChapterPager`, behind the
`@versemate:gesture_pager` flag with a dev Settings toggle, one build serving both
arms.

**Four wrong turns, all corrected by operator testing rather than by reasoning.**
Recording them because each looked right when written:

1. *Sliding window with an offset correction.* Flashed a neighbouring chapter on
   EVERY swipe, single swipes included. Measured, not argued:
   `gesturePager.correctionLagMs` = **67ms mean**, four frames. The window was React
   state and the offset a shared value, so no effect could make them atomic. Narrowing
   the timing failed twice.
   → Fixed by positioning pages at an **absolute index** that never moves. Mounting or
   unmounting a page cannot disturb another, so the target page is already at its final
   position before the gesture starts and there is nothing left to correct.
2. *Gesture reading `index` from React state.* Two quick swipes advanced one chapter —
   the second flick computed its target from an index the first had not yet committed.
   The identical stale-state bug as the ViewPager path, relocated.
   → The gesture derives position from `scrollX`, and width and reachable bounds are
   shared values too. Bounds publish the furthest *resolvable* indices, not index ± 1,
   which would have been just as stale.
3. *One-screen-wide row.* Touches died after the first swipe: Android does not deliver
   touches to a child outside its parent's bounds. I diagnosed this correctly, then
   talked myself out of it when the operator suspected the nav buttons, then had to put
   it back when they pinned it down — works on the page you are on, dies once you swipe.
   → Row spans a fixed 65 chapters of index space.
4. *Route navigation per flick.* Each cost a React commit, a header render and a
   reading-position write for a chapter already left behind — the reported "state cannot
   keep up" and occasional stick.
   → Coalesced to the chapter a run ENDS on, 140ms after the last flick. Only safe
   because absolute indexing had already decoupled the visuals from the route.

### Text selection during swipes

Three attempts, and the first two were structurally wrong rather than merely unbuilt:

- Cancelling the *pending* long-press does nothing for someone who holds still past the
  500ms timeout before moving — which is the actual reported gesture.
- Clearing the selection and then calling `super.onTouchEvent()` on the same event lets
  the selection controller immediately re-establish it. A claimed swipe now withholds
  every subsequent event from super.
- Tap-to-dismiss must test for a selection on ACTION_**DOWN**: a selectable TextView
  collapses its selection on down, so by ACTION_UP there is nothing to detect and the
  tap falls through to the verse insight.
- Double-tap-to-select is the platform's, and is why rapid swiping sometimes left a word
  highlighted. The second tap of a pair is withheld from super.

**A build trap worth remembering:** a failed gradle build followed by `adb install`
reports "Success" — it installs the previous APK. Two rounds of native testing measured
code that had never compiled. Always check `BUILD SUCCESSFUL` before trusting an install.

## Harness notes worth keeping

- Read the JS report from **Metro's log**, not logcat. The app's `console.log`
  stopped reaching logcat on this build, and `logd` had also pruned the app's UID
  as chatty after a warning spam. Either alone loses the whole report.
- The bundle loads over **LAN**, not `adb reverse`. The reverse tunnel died
  mid-session while Metro kept serving from cache, so the dev client hung on an
  unreachable localhost and showed a black splash with no error anywhere.
- `.` in a JavaScript regex excludes `\r`, so `(.*)$` fails outright on a CRLF
  capture rather than capturing one extra character. A PowerShell-written capture
  reported "missing chunk(s) 0..12 of 13" with all thirteen in the file.
- Wake the device and dismiss the keyguard first. Captures end with KEYCODE_HOME,
  the screen times out, and Maestro then drives a locked phone and reports a
  missing testID.
- A phase span with no close is worse than no span: `swipe.pendingNav` was only
  ever ended by the next swipe reopening it, so it silently measured "time between
  swipes" and reported a 4467ms mean on an idle device.
- Auto-rotate is meant to stay OFF on this phone. The capture records and restores
  it, and prints the post-Maestro value — a full run leaves it untouched, so
  Maestro is not what flips it.

---

# Update 2026-07-29 — the UI thread, measured at last

Everything above is about the JS thread. It was the wrong thread for the remaining
complaint ("small stutterings when switching"), and four fixes aimed there all
measured as noise.

## The instrument that was missing

`scripts/perf/framestats.ts` splits each frame into its UI-thread phases: input,
animation, traversals (measure+layout), draw, sync, gpu. Two traps had to be fixed
before its numbers meant anything, and both had silently corrupted output:

- **A row with `Flags != 0` must be discarded** — Android's own contract. Exactly
  one such row in 120 carried a −17,006ms frame and dragged the reported means to
  −131ms total and −141ms sync.
- **`dumpsys` emits one PROFILEDATA block per window**, each with its own header,
  followed by unrelated prose. Reading from the first marker to EOF swallows it.

Also: **the panel is 120Hz.** `FrameInterval` reports 8,340,090ns, so the budget
is **8.3ms**, not 16.7ms. Every jank number recorded before this was measured
against a target twice as forgiving as reality.

## What it says

Across 25 captures the slow-frame count tracks the **`animation` phase and nothing
else**:

| capture | anim (slow frames) | slow frames |
| --- | --- | --- |
| `mybible` (reference app) | 2.6ms | 2/120 |
| `cap-native-swipe-only` (ours, nothing mounting) | **0.9ms** | **3/119** |
| `tabs4` (Insight tab switching) | 6.3ms | 28/119 |
| `ab-viewpager` (gesture pager OFF) | 9.7ms | 16/119 |
| `v5` | 28.8ms | 7/119 |

`traversals` sits at **0.2–0.6ms throughout** and `draw` at 1–3ms. **It is not
layout, and not tree depth.** On Fabric the `animation` phase is the Choreographer
callback, which is where mount items are dispatched and where Reanimated worklets
run — neither is the JS thread, which is exactly why a Hermes profile showed JS
98% idle while the screen stuttered.

`ab-viewpager` has the gesture pager off and no `scrollX` worklets, and still shows
9.7ms, so this is not our Reanimated code. What every bad capture has in common is
**a subtree being mounted**. And our own best capture is 0.9ms/3 frames, in
MyBible's territory — so the floor is not the platform's.

## Ruled out, with numbers

Spreading ONE surface's mount across frames from JS. `useProgressiveReveal` ramped
the markdown block cap a few blocks per frame via chained rAF. A/B on the new
automated `insight-tabs` flow (same gestures both arms):

| | before | after |
| --- | --- | --- |
| frame mean | 13.19ms | 12.70ms |
| frames over 8.33ms | 79/119 | 86/119 |
| p95 frame | 35.8ms | 26.9ms |
| `tab.switch` mean | 85.7ms | 90.9ms |
| `view.switch` mean | 92.9ms | 106.0ms |

Worst single frame improves; over-budget count, tail and both felt latencies get
worse. Reverted in `d2f5218`.

That makes five measured non-improvements on this surface — tab pre-warm,
explanation prop identity, per-word node hunt, one-shot block cap, per-frame ramp.
**Do not retry them blind.**

## In flight: fewer views, not later views

`lib/text/compile-markdown.ts` + `components/markdown/NativeMarkdown.tsx` render
markdown as one native text view per BLOCK instead of one RN `Text` per inline run,
reusing the span renderer the verses already use. Gated by the same
`useNativeText()` flag, falling back wholesale on anything inexpressible (tables,
images, strikethrough). `perfCount('markdown.native' | 'markdown.fallback.<reason>')`
so an A/B cannot be fooled by a silent fallback.

Needs a native build: `fontStyle` was declared in `types.ts` and merged by the JS
side but **never encoded on the wire**, so italic silently did nothing.

## Harness traps that cost real time

- **`logcat -t <count>` applies its window to the whole buffer and filters
  afterwards.** On this chatty phone (`GMS`, `vendor.qti.servicetracker`)
  `logcat -d -t 400 ReactNativeJS:V '*:S'` returns EMPTY while
  `logcat -d -t 3000 | grep VMPERF` finds the marker every time. The capture script
  reported "No device found / the JS bundle never started" against a healthy app,
  healthy Metro and a live reverse tunnel.
- **A wedged `pc` bridge session** accepts commands and never answers, which
  presents as the same false "no device". `capture-baseline.sh` now closes its
  session before every run.
- **A perf flow that does not exist on the checked-out commit** makes Maestro a
  no-op and the capture reports zero frames. When A/B-ing across commits, restore
  `.maestro/` from the newer one — instrumentation must be identical in both arms.
