# Perf — where things stand and what to run next

Written 2026-07-28, overnight, with the phone and PC off. Everything here is
committed on `feat/native-text-rendering`.

## Run this first

```sh
scripts/perf/capture-all.sh
```

Both arms × three scenarios (Genesis 1, Psalm 119, swipe-only), then prints the arm
comparison and the scaling report. Takes roughly 25 minutes. It restores the
**native** arm at the end, so the app is usable afterwards — leaving the device on
legacy once already cost an evening of testing the wrong renderer.

Prerequisites: phone on with USB debugging, Metro running on the PC
(`cd D:/Coding/VerseMate/verse-mate-mobile && bun start`).

## The report that matters most

```sh
bun scripts/perf/compare.ts --scaling native
```

Genesis 1 is 31 verses, Psalm 119 is 176 — a **5.7×** verse ratio. Every metric is
printed with its own ratio:

- **near 1.0×** — correctly independent of chapter length. This is the goal.
- **near 5.7×** — doing per-verse work at a moment it should not be. That is the
  reported "swiping depends on the length of the chapter", made specific enough to
  point at code.

Before tonight's change, mount was squarely in the second category:
`useParagraphLayout` compiled and measured every paragraph to compute offsets, so
Psalm 119 did 35 lexicon compiles and 35 layout builds against Genesis 1's 7 — and a
swipe mounts the adjacent chapter. It should now be near 1.0×. **If it is not, that
is the single most valuable thing to chase**, and the ratio will say which metric
still carries it.

## The three reported symptoms, and what now measures each

| symptom | metric to read | where |
| --- | --- | --- |
| swiping sluggish, scales with chapter length | `swipe.pendingNav` vs `swipe.settle`, and the scaling ratio | `--scaling native`, `--arms swipe-only` |
| toggle animation stutters | `anim.viewSwitch.dropped`, `anim.viewSwitch.worstFrameMs` | counters in any capture |
| small stutterings while reading | `Janky frames`, `p99`, `Slow UI thread` | `--arms psalm-119`, UI THREAD block |

**Swipe is now two phases.** `swipe.pendingNav` covers the pager settling and
deciding to navigate; `swipe.settle` covers building and committing the new chapter.
They feel identical to a user and need opposite fixes, so read them separately: a
large `pendingNav` means the gesture layer is slow, a large `settle` means the
content is.

**The animation counters are new** because nothing could see that symptom before.
The JS heartbeat watches the JS thread while the animation runs on the UI thread,
and `gfxinfo` averages a 300ms animation into a 60-second session. `frame-watch`
records rAF cadence scoped to the interaction. Note what it means: if the animation
looks janky but these counters are clean, the jank is native and the fix is in the
opposite place.

## Landed tonight (all untested on device)

1. **Mount is O(visible), not O(chapter).** Heights for off-screen paragraphs are
   estimated in O(1) from character count, calibrated against the first real
   measurement so they land within a line. Only paragraphs near the viewport are
   compiled and measured.
2. **Section staging stands down** when windowing is active — its 200ms/500ms
   re-renders straddled the 180ms toggle animation.
3. **Swipe phase split**, **frame-watch**, **scaling report**, **swipe-only
   scenario**, **one-command runner**.

Treat all of it as unverified. Two of the last three windowing attempts measured as
doing nothing, and looked correct while doing so.

## The one metric that has never moved

`reader.mount.bible`: 726, 699, 761, 702, 817ms across every arm and change. Three
hypotheses have died on it — section staging (Psalm 119 is one section, so slicing
does nothing), sync measurement (190ms across a 78s window), and off-screen view
creation (windowing did not move it).

Tonight's O(visible) change is the fourth candidate and the first one that attacks
per-verse work directly. **If the scaling ratio comes back near 1.0× but
`reader.mount.bible` is still ~700ms, then chapter-open is dominated by something
that is neither per-verse nor text-related**, and the next step is to bisect the
mount itself — instrument `ChapterPage`'s effects, the query/`useBibleChapter` path,
and the Insight prewarm — rather than optimise the renderer further.

## On dissecting another app's binary

Offered as an option; my view is that it is not the shortcut it looks like.

A release APK is minified and largely native; what is recoverable is roughly "they
use a recycling list" and "their text is one view per block" — both of which are
already the direction here. The specific numbers that would actually help (how they
paginate, what they precompute, where their measurement happens) are not legible
from a binary in less time than measuring our own app takes.

There is a cheaper version of the same idea worth doing if chapter-open stays stuck:
install a Bible app that feels right, run `dumpsys gfxinfo` against **it** while
scrolling and chapter-switching, and compare its frame profile to ours. That answers
"how much better is actually achievable on this device" with an afternoon's work and
no reverse engineering. It also settles whether the remaining gap is architectural or
just a few more fixes.

## Known gaps

- **Insight/Topics still use the legacy per-token renderer.** Only the Bible
  paragraph path is converted. `reader.mount.explanations` is already down to ~100ms
  on the native path, so this is not urgent, but it is the largest unconverted
  surface.
- **iOS is not started.** The Kotlin has no Swift counterpart yet, so the native
  path is Android-only. The flag is off by default, so iOS is unaffected.
- **One run per configuration.** Run-to-run variance on a warm device is large — the
  same legacy flow has produced 74s, 97s and 129s windows. Direction across metrics
  is trustworthy; single percentages are not.
