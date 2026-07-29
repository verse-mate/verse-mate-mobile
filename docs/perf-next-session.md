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

## Result: native markdown is a real win (2026-07-29)

Same-binary A/B on `.maestro/perf/insight-tabs.yaml`, flipping only the `useNativeText`
preference — no commit swap, so the two arms differ by one boolean:

| | React markdown | native markdown |
| --- | --- | --- |
| frames over 8.33ms | 74/119 (62.2%) | **57/119 (47.9%)** |
| frame mean | 16.53ms | **11.36ms** |
| p90 | 22.96ms | **17.02ms** |
| p95 | 44.94ms | **32.79ms** |
| p99 | 279.33ms | **61.71ms** |
| worst frame | 300.34ms | **62.82ms** |
| `tab.switch` mean | 136.9ms | **118.4ms** |

The tail is the headline: a 300ms frame is a visible hitch, and it is gone. Phase breakdown
confirms the mechanism rather than just the outcome — `animation` (Fabric mount dispatch)
**7.2ms → 4.1ms**, which is the exact lever the 25-capture analysis identified. `traversals`
rose 0.2 → 2.1ms and `draw` 1.1 → 1.7ms, since native views do real measure and fewer, larger
views each draw more; both remain small.

`view.switch` regressed (161.7 → 265.0ms) but on **n=6 vs 16**, and the flag also flips the verse
renderer, so the Bible pane differs between arms too. Not claimable either way — re-measure with
the `enabled` prop override if it matters.

Two traps for whoever measures next:

- **A release/preview build has `__DEV__` false, so there is no perf session and no `perfCount`.**
  `gfxinfo`/`framestats` still work; span timings and the `markdown.native` /
  `markdown.fallback.<reason>` path counters do not. Confirm the path on a dev build.
- **`markdown.native` counts TRANSITIONS, not renders.** It lives in an effect keyed on the
  fallback reason, so one document rendering natively for a whole session counts once. It answers
  "did the native path engage" and nothing more. A `fallback.unmeasured` of 1 at startup is
  expected — width is unknown for one frame.


## Harness traps, round two (2026-07-29, unattended run)

Four captures produced no artifacts and no error, and the visible symptoms pointed at four different
innocent things before the real cause turned up. Worth reading before debugging this harness again,
because the pattern repeated: **a dead dependency produces symptoms everywhere except where it lives.**

Actual cause: **Metro was dead.** It had been started inside a `pc` bridge session
(`pc -s metro4 --bg "bun start"`), and a tidy-up loop that closed stale sessions by name included
`metro4` — which killed the dev server. Every subsequent capture sat in the readiness poll waiting for
a bundle that could never arrive.

What it looked like on the way down, in order:

1. Captures stalling silently after "Launching against Metro" — read as "slow", then as the harness's
   background task being reaped.
2. `pc` sessions returning `[command still running in 'perfcap' ...]` **on stdout**, which the script
   parsed as a device serial and as a readiness marker. Now guarded: `pcrun` retries once after
   closing the session and dies loudly on a second occurrence, because any number derived from that
   banner is fiction.
3. A wedged **adb server** — `adb devices` and even `adb kill-server` hung, needing
   `Get-Process adb | Stop-Process -Force`.
4. A stale **`adb reverse`** registration: `reverse --list` happily reported `tcp:8081`, while the
   phone got HTTP `000` on `localhost:8081`. Re-adding it did not help, because there was nothing
   listening on the other end.

Only step 4's `curl` from the phone, plus checking `Get-NetTCPConnection -LocalPort 8081`, showed
Metro itself was gone. **Check that the server is alive before debugging the transport to it.**

Two durable fixes: long-lived servers are now launched detached
(`Start-Process ... -WindowStyle Hidden`) so no session close can kill them, and bridge sessions are
closed individually rather than in a sweep.


## How to measure a RELEASE build (added 2026-07-29)

The largest number in every capture is `data.alignment`: 18 calls, 9,785ms total, **mean 543ms** — about
six times the total cost of all tab switching, and by far the biggest single item in the report.

It has never been attributable, for a specific reason. Chapter alignments load through `import()`, and
`@versemate/lexicon` ships each chapter as its own Metro code-split chunk, so **in dev the first request
for a chunk makes Metro transform it on demand** — routinely 100-500ms, which matches the mean almost
exactly. The spread supports that too: a 543ms mean against a 2,856ms max looks like I/O, not a
deterministic loop. In a release build those chunks are pre-bundled and much of the cost may simply not
exist.

The instrument switched itself off in precisely the build that could answer this, because every perf
primitive was gated on `__DEV__`. That is now one predicate, `perfEnabled()` in `lib/perf/enabled.ts`:

    __DEV__ || process.env.EXPO_PUBLIC_PERF === '1'

`EXPO_PUBLIC_*` is inlined at build time, so with the flag unset it folds to `__DEV__` and dead-code
elimination strips the perf code exactly as before. A normal release build is unchanged.

To take the measurement:

    eas build --profile preview-perf --platform android

`preview-perf` extends `preview` and overrides only what a measurable build needs:

- `EXPO_PUBLIC_PERF=1` — turns the instrument on outside `__DEV__`.
- `buildType: apk` + `:app:assembleRelease` — `preview` builds an **`.aab`**, which `adb install`
  cannot install. A profile whose entire purpose is to be installed and measured must produce an APK;
  the first version of this profile did not, and would have burned a build to produce an artifact that
  could not go on the phone.
- `autoIncrement: false`, `distribution: internal` — this build must never reach a tester, and it should
  not consume a build number from the real preview lane.

Verified as a precondition: `babel.config.js` is plain `babel-preset-expo` with no
`transform-remove-console`, so the report still reaches logcat in a release build. If that ever changes,
this measurement silently returns nothing. Then capture as usual: the app emits its report on background, which
`adb shell input keyevent KEYCODE_HOME` triggers, and `scripts/perf/capture-baseline.sh` already does.

**Why this is the highest-value next step.** It decides whether the lexicon work (a data-generation change
to `@versemate/lexicon`, needing a small generated `strongs -> slug` map plus a lazy definition lookup) is
worth doing at all. Right now that decision would be a guess about the biggest number on the board.

---

# The animation phase, finally opened up (2026-07-29)

Every finding in this work pointed at one frame phase, `animation`, and `framestats` cannot say what
executes inside a phase — only where its boundaries are. Three hypotheses were offered for it: one
confirmed, one wrong, one retracted as untested. That ratio is the signature of guessing, so the phase
needed naming rather than a fourth theory.

## atrace does name it

Android and React Native both emit named trace slices, and the app's own process emits them under the
`app` category once `atrace -a <package>` enables it. New tooling:

- `scripts/perf/capture-atrace.sh <label> [--pre "id[:ms] …"] --taps "id[:ms] …"` — starts atrace,
  drives the interaction by **testID** (resolved from a `uiautomator dump` taken before the window,
  because the dump itself perturbs the app), stops, pulls the trace, and attributes it.
- `scripts/perf/atrace-slices.ts` — B/E pairs into per-thread stacks, aggregated by **self** time
  (duration minus time spent in children). Total wall time double-counts: `animation` totalling 30ms
  says nothing about which child to fix.

## What the toggle actually spends its time on

Three Bible↔Insight toggles on Acts 23. `animation` x425: p50 0.74ms, p95 7.54ms, **max 46.70ms**,
20/425 over the 8.34ms budget. Inside it, by self time:

```
   self(ms)  count  slice
    119.4     228   SurfaceMountingManager::createViewUnsafe(ViewManagerAdapter_VMText)
     37.8     425   Choreographer#scheduleVsyncLocked
     31.6     158   ReactTextViewManager.updateState
     28.1     108   IntBufferBatchMountItem::mountInstructions::UPDATE_PROPS numInstructions=10
     13.7       1   IntBufferBatchMountItem::mountInstructions::UPDATE_LAYOUT numInstructions=172
     12.7       1   IntBufferBatchMountItem::mountInstructions::UPDATE_LAYOUT numInstructions=190
```

**228 native text views created, ~0.52ms each.** Not a slow animation — a mount storm inside the
animation phase.

## Two details that changed the fix

Bucketing the creations by time against the known tap times (0.4s → Insight, 2.2s → Bible, 4.0s →
Insight) was decisive:

```
VMText:  1.50s:120  1.75s:108        <- ONE burst, ~1.1s AFTER the first tap
RCTView: 0.50s:2  0.75s:18  1.50s:65  1.75s:59  4.25s:6
```

1. **The 2nd and 3rd toggles create almost nothing.** The steady-state toggle is already cheap, and
   the sticky mount (`insightPrewarmed || insightMountAllowed`) works. So mounting is the whole cost,
   and the earlier toggle work has nothing left to win.
2. **The burst is not the tap.** It lands ~1.1s later — it is the idle tab prewarm, so the stall
   arrives *while the reader is reading*, which is worse than a slow tap.

The prewarm's comment says "one tab per idle window". It wasn't achieving that:
`InteractionManager.runAfterInteractions` resolves immediately when nothing is in flight, and the
effect re-runs on every `visitedTabs` change, so the remaining tabs chained into consecutive frames —
one burst, exactly as measured.

## The fix, sized from the measurement

- `NativeMarkdown` mounts `BLOCKS_PER_FRAME = 8` blocks per `requestAnimationFrame`
  (8 × 0.52 = ~4.2ms against an 8.34ms budget, leaving room for traversal and draw). `rAF` rather
  than a timer, because a `setTimeout(0)` chain runs several times per frame under load and would
  coalesce back into the big commit.
- `PREWARM_TAB_GAP_MS = 250` spaces one prewarmed tab from the next, so two ramps (~14 frames each)
  cannot overlap and re-create the storm.

## Still open

- `ReactTextViewManager.updateState` x158 — a legacy RN `<Text>` path is still mounting during the
  toggle. Worth finding which surface: it is 31.6ms that the native renderer was supposed to have
  replaced.
- `FabricEventEmitter.receiveEvent('topSelectionChange')` fired **1254 times** in six seconds. Cheap
  natively (5.0ms total) but it crosses into JS on every one, and nothing needs a selection event from
  a view that was just created.
- `createViewUnsafe` at ~0.52ms per view is the real unit cost. Fabric can recycle views per component
  type; if VMText opted in, the ramp could be shorter as well as smoother.

## Measured result of the ramp (same-scenario A/B, 2026-07-29)

Three Bible↔Insight toggles, the identical flow as the capture above:

| | before | after |
|---|---|---|
| `animation` max | **46.70ms** | **20.51ms** |
| `animation` p95 | 7.47ms | 5.00ms |
| frames over 8.34ms | 20/425 (4.7%) | 3/333 (0.9%) |
| VMText created *inside* the phase | 228 | **0** |

Two honest caveats. The two windows are not perfectly matched: the before-capture happened to contain
the prewarm burst and the after-capture does not, because with the ramp the prewarm finished during the
7s settle instead of stalling on the first toggle — which is the intended outcome, but it means part of
the delta is "the work moved out of this window" rather than "the work got cheaper". The total work is
unchanged by design; only its distribution changed.

Second, a chapter-navigation capture taken the same day did **not** improve — 65 VMText creations still
land in a single frame, p95 52/frame:

```
AFTER (chapter nav): 261 creations, peak 100 per 250ms, animation max 59.48ms
```

That is not the ramp failing. Both changes were verified present in the PC source that Metro serves
(`BLOCKS_PER_FRAME` x4, `PREWARM_TAB_GAP_MS` x3) and the app was cold-started after the sync, so the
code is live. The creations in that scenario are the **Bible reader's paragraph views**
(`ChapterReader` → `ParagraphText` → VMText), a different path that the markdown ramp does not touch:
it is windowed by viewport, but its mount is not spread across frames.

So: Insight/markdown mounting is fixed, Bible-paragraph mounting is not, and that is the next target —
the same `rAF` chunk applied to `ChapterReader`'s paragraph groups. Worth measuring before assuming,
because paragraphs are what the reader looks at on arrival, so a visible top-down ramp there is a UX
trade the toggle case did not have.

## Correction: the block ramp was inert, and the real cause was two timers

The section above credits `BLOCKS_PER_FRAME` with the toggle improvement. That was wrong, and the
correction is worth more than the original claim.

**First, the A/B that killed it.** Same binary, same `insight-tabs.yaml` flow, the only difference
`BLOCKS_PER_FRAME = 8` vs a value large enough to disable the ramp:

| | ramp on | ramp off |
|---|---|---|
| `tab.switch` mean | 35.5ms | **34.7ms** |
| `view.switch` mean | **36.4ms** | 37.6ms |
| `anim.tabSwitch.worstFrameMs` | 49 | **42** |
| `anim.viewSwitch.worstFrameMs` | **44** | 59 |
| `markdown.native` | **1** | **1** |

Noise in both directions — and `markdown.native` = **1** explains why. The ramp chunks blocks *within*
one `<Markdown>` instance, but the By Line tab renders **one `<Markdown>` per verse section** (~35 for
Acts 23, 176 for Psalm 119), each only a few blocks. Chunking inside an instance cannot help a surface
whose cost is many small instances mounted together. Reverted.

This is the same trap that produced the earlier "five non-improvements": the fix was measured against
frame phases, which moved, rather than the felt metric, which didn't.

**Second, what the two commits actually were.** `TabContent` revealed byline sections in two discrete
bumps — 5, then 30 at 200ms, then *everything* at 500ms. Two timers, 300ms apart. The atrace burst was
**two commits of 120 and 108 views, 250ms apart.** The bumps *are* the burst, and `30 → ∞` is the worst
of them: it mounts every remaining section at once, 146 more on Psalm 119.

Fixed by ramping `bylineMax` **+4 sections per `requestAnimationFrame`** instead, and by resetting it
per chapter — `Infinity` was sticky, so the next chapter inherited "reveal everything" and mounted in
one commit, which is the other place the capture found a storm.

Same-scenario A/B on `next-chapter-button:6500`:

| | two-step timers | per-frame ramp |
|---|---|---|
| worst `animation` frame | 59.48ms | **41.89ms** |
| peak VMText creations in one frame | 65 | **54** |
| frames over 8.34ms | 27/447 | 25/457 |

**Honest reading: a ~30% cut to the worst frame, and the over-budget count did not move.** 54 creations
still land in one frame, where +4 sections should be ~12 views. Two candidates, both measurable: the
Bible view's own mount is not ramped at all on the native path (`bibleSectionsMax` is set straight to
`POSITIVE_INFINITY`, ChapterPage.tsx:797-812), and React batches several rAF-driven `setState`s into one
commit whenever the JS thread is blocked — which `data.alignment` does for ~1.9s. So a per-frame ramp
does not guarantee per-frame commits, and any future ramp must be verified, not assumed.

**And `data.alignment` got worse the closer it was looked at**: this session's capture puts it at 7 calls,
**mean 1902.6ms, 13.3s total** in an 82s session — not the 543ms recorded earlier. It is far and away the
largest cost in the app, and `preview-perf` exists to establish whether a release build still pays it.

## Correction: `data.alignment` was never 13 seconds of work

Two places above call `data.alignment` the largest cost in the app — "6× the total cost of all tab
switching", "mean 1902.6ms, 13.3s total". **That reading was wrong**, and the arithmetic that disproves
it was sitting in the same report:

```
=== background — 81981.3ms session ===
JS blocks: 61 (5197.3ms total, worst 1991.2ms) [minor 51 / major 9 / severe 1]
JS thread blocked 6.3% of the session

  data.alignment    7   13318.2   1902.6   3028.2   3028.2
```

The JS thread was blocked for **5197ms in the entire session**. The alignment spans total **13318ms**. A
span cannot consume more CPU than the thread ever spent blocked, so most of that 13.3s is the span
sitting open across an `await` — waiting, including waiting through other work such as the chapter
mount. The report even says so directly: "Blocks attributed to open spans" credits every open span with
a block, so a long-lived span accumulates other people's cost. `startup.toFirstPaint` showing 59 blocks
is the same artifact.

**What is real** is one ~2s block, reproducible across two independent runs (`worst 1991.2ms` and
`1946.1ms`, one "severe" each). That matches the known one-time 18MB `_lemmas.json` parse — previously
measured at 652ms on a Pi 5 and ~1.9s on the phone. It is deferred past first paint, so it costs nothing
at startup; but it blocks the JS thread for two seconds, so any swipe or tab switch landing inside that
window simply freezes.

Consequences:

- **The `preview-perf` release measurement is no longer the priority.** It existed to answer "is the
  13.3s real or a Metro artifact?", and that question dissolves rather than resolves. Two back-to-back
  runs of the same flow also showed the alignment mean barely moving (1902.6 → 1634.3ms) when Metro's
  transform cache was warm, which is further evidence the number was never dominated by on-demand
  transforms. The profile stays (correctly configured now) for when a release-only question comes up.
- **The lexicon split is still worth doing**, but for the honest reason: a single 2s JS block, not a
  13-second aggregate. That does not need a release build to justify — it is visible in dev.

Method lesson, since this is the second attribution error in one session: a **wall-clock span around an
`await` measures latency, not work.** Cross-check any span total against the session's total JS blocking
before calling it a cost. If spans sum to more than the thread was ever blocked, they are measuring
waiting.

## The buffer-page ramp (#16): kept, on a same-binary felt-metric A/B

Only **buffer** pages ramp. The current page still mounts whole and immediately, because it is what the
reader is looking at and a chapter visibly filling in top-down is a worse artifact than one mount. That
split is not a compromise — it is where the cost actually is: with the gesture pager, moving to the next
chapter *promotes* a page that is already built and then builds a new offscreen neighbour, so the views
created during a navigation mostly belong to a page nobody is looking at.

Promotion stays safe. The effect re-runs with `isPreloading` false and sets `POSITIVE_INFINITY`, so a page
still ramping completes in one commit — which preserves exactly what the original comment was protecting:
"a page left capped at 3 sections would render three and then visibly jump when it became current".

**atrace** (`next-chapter-button:6500`, comparable workloads of 261 vs 247 created views):

| | timers, bible=INF | + buffer ramp |
|---|---|---|
| worst `animation` frame | 59.48ms | **48.59ms** |
| peak VMText creations in one frame | 65 | **48** |
| p95 creations per frame | 52 | **40** |
| frames over 8.34ms | 27/447 (6.0%) | 33/485 (6.8%) |

**Felt metric** (`swipe-only.yaml`, same binary, only `BIBLE_SECTIONS_PER_FRAME` changed):

| | ramp on | ramp off |
|---|---|---|
| `anim.swipe.worstFrameMs` | **34** | 48 |
| `anim.swipe.dropped` | **2** | 3 |
| `gesture.swipe` mean | **420.9ms** | 429.2ms |
| `anim.swipe.window` mean | **517.7ms** | 534.1ms |

Kept because **both instruments agree in direction and nothing contradicts** — which is precisely the
test the markdown block ramp failed, where frame phases improved while `tab.switch` did not.

Stated plainly, though: this is modest. `gesture.swipe` moves 2%, which is inside the noise for n=6; the
load-bearing numbers are the worst frame (34 vs 48) and dropped frames (2 vs 3), and they are consistent
with atrace's peak-per-frame drop. The over-budget *count* still rises slightly, because spreading work
converts one large overrun into several small ones — an acceptable trade for a smaller spike, but a trade.

### What the swipe capture says is actually worst

Both arms are dominated by something neither ramp touches:

```
buffer-on : JS blocks 129 (10163.0ms total, worst 2162.7ms) [severe 2] — blocked 17.7% of session
buffer-off: JS blocks 110 ( 9292.8ms total, worst 2206.7ms) [severe 2] — blocked 18.6% of session
```

A **~2.2s** block, twice per session, while the mount work being optimised is measured in tens of
milliseconds. That is the lexicon parse (task #14), and it is the largest real stall left in the reader by
two orders of magnitude. Fix that before any further mount micro-tuning.

---

# The lexicon parse: the actual biggest stall (2026-07-29, second half)

Everything above optimises mount work measured in tens of milliseconds. The same captures were showing,
in plain sight, a **~2s block of the JS thread** — four independent times:

```
insight-tabs  ramp-on : JS blocks  61 ( 5197.3ms total, worst 1991.2ms) [severe 1]
insight-tabs  ramp-off: JS blocks  59 ( 5267.7ms total, worst 1946.1ms) [severe 1]
swipe-only  buffer-on : JS blocks 129 (10163.0ms total, worst 2162.7ms) [severe 2] — blocked 17.7%
swipe-only  buffer-off: JS blocks 110 ( 9292.8ms total, worst 2206.7ms) [severe 2] — blocked 18.6%
```

A 2-second freeze is not a dropped frame, it is the app stopping. It is deferred past first paint so
startup is unaffected, but a swipe or tab switch landing inside that window simply stops.

## What was in the 18.7MB

Measured field by field rather than assumed:

| field | size | needed to render a chapter? |
|---|---|---|
| `notes` | 5.54 MB | no — popover only |
| `related` | 4.51 MB | no — popover only |
| `semanticRange` | 2.09 MB | no — popover only |
| `lemma` | 0.32 MB | yes |
| `pos` | 0.21 MB | yes |
| `basicGloss` | 0.19 MB | yes |
| `translit` | 0.18 MB | yes |
| `strongs` | 0.13 MB | yes |
| `loaded` | 0.09 MB | yes |

**12.1MB of 18.7MB is prose that is only read when a reader taps a word** — and `loadAlignmentFor`
awaited all of it before a chapter could render, for one field: `strongs`, to disambiguate homographs.

## The fix

Upstream (`verse-mate-lexicon` PR #6, pinned here at `f660236`): a `{ lite: true }` option resolving the
chapter's lexicon from a **1.15MB columnar projection — 16x smaller** — plus `lookupLemma(slug)` for the
prose.

```
row-oriented (6 fields)   2.48 MB
columnar                  1.42 MB
columnar + pos vocab      1.15 MB
```

Columnar because at this size the field *names* dominate: five keys repeated 18,100 times cost more than
the values.

Two things made the mobile side almost free:

- **Every field kept is one of `LexEntry`'s REQUIRED fields**, so a light entry satisfies the type
  structurally — no type changes anywhere in the app.
- **`LexiconPopover` already fills in progressively**, because non-English versions resolve their card
  from the backend. So a tap opens instantly on the light entry and `lookupLemma` upgrades it; the
  upgrade is skipped for HAND_LEXICON's ~144 full entries, and applied only if the tapped lemma is still
  the active one (a reader can tap a second word while the first is loading, and a stale result would put
  the wrong definition under the right heading).

## Unverified — this is the first thing to measure

The phone left with the operator before this could be captured. `data.alignment.first` (added alongside)
isolates exactly this cost, and the decisive signal is **whether the ~2s "severe" block disappears**, not
whether it shrinks. If a ~2s block survives, the parse was never the cause and the premise here is wrong.

    scripts/perf/verify-session.sh lexicon

## Harness fix that came out of it

`check_pr_versemate.sh` never installed dependencies. A branch changing `package.json` or `bun.lock`
therefore ran its gates against the PREVIOUS dependency tree — green, and proving nothing about the
change under test. It now installs after the sync when a manifest changed, fails loudly, and names a
lockfile/package.json disagreement explicitly (CI installs `--frozen-lockfile`, so it would fail there
too). Same defect class as the `check_pr.sh` fix where the install ran *before* the sync and so always
installed the wrong revision.
