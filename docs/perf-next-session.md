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

Measured effect of 1+3 alone (same flow, same phone): idle 72.1% → 75.1%,
`regExpConstructor` 178ms → 0, `MarkdownIt` 211ms → 10ms, GC 396ms → 275ms, our
components 620ms → 385ms.

Swipe path across the day: `swipe.settle` 838ms → 607ms mean (max 1444ms →
653ms), `swipe.pendingNav` 374ms → 266ms, frame p99 150ms → 81ms.

## What is left, in order

1. **`completeRoot` is still ~1262ms (28% of busy time).** It is proportional to
   the live tree. The remaining big contributors are the three chapters the pager
   keeps mounted and whatever the Insight subtree costs while visible. Next
   measurement to take: how many commits happen per swipe, and how large the tree
   is at each. If commit count is the driver, batching or `startTransition` on the
   chapter change is the fix; if tree size is, virtualization is.
2. **React is rendering synchronously** (`renderRootSync` 4066ms,
   `performSyncWorkOnRoot` 1436ms). Sync renders cannot yield to a gesture. A
   chapter change dispatched inside `startTransition` would let React interrupt
   itself for the swipe. Untried.
3. **`data.alignment` reports mean 443ms, max 3074ms over 20 calls.** Mostly await
   rather than CPU (the profile puts lexicon CPU at ~120ms), but the first load
   parses a 17.8MB, 18,100-entry JSON. Separately, `loadAlignmentFor` rebuilds two
   whole-lexicon structures — an 18,100-key object spread and an `Object.entries`
   pass — on every uncached chapter, neither of which depends on the chapter.
   Cheap to hoist, in the `@versemate/lexicon` repo rather than here.
4. **Insight/Topics still use the legacy per-word renderer.** No longer urgent —
   the counter shows they contribute almost nothing in a reading session — but it
   is the largest unconverted surface.
5. **iOS has no Swift counterpart yet**, so the native path is Android-only and
   the flag stays off by default there.

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
