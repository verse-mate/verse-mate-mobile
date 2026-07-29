# Perf measurement harness

Tooling for measuring reader performance on a physical Android device, built for
the native-text-rendering project (`docs/native-text-rendering-plan.md`) but
useful for any reader perf question.

## Why it exists

The 2026-05-21 swipe-debug session established that guessing at render stalls in
this app costs hours and gets the answer wrong. Three plausible static-analysis
theories were discarded by runtime data; a JS-thread heartbeat found the real
cause in twenty minutes. That instrumentation was then deleted, so the next
investigation restarted from zero. This is the permanent version.

## The two instruments

| what | sees | blind to |
| --- | --- | --- |
| `lib/perf` (JS heartbeat + spans) | JS-thread stalls, and which app work was open during each | anything on the UI thread |
| `dumpsys gfxinfo` | real frame times, jank counts — what the user saw | which code caused it |

Use both. The JS monitor attributes a stall to app work; gfxinfo says whether it
cost a frame. Either alone will mislead you.

## Running a capture

Needs the phone connected (wireless ADB via ThorSPC) and Metro running on the PC.

```sh
scripts/perf/capture-baseline.sh psalm-119 --arm legacy
scripts/perf/capture-baseline.sh psalm-119 --arm native
```

`--arm` keeps the two sides of an A/B apart. For the comparison to mean
anything, both arms must come from **one build** with the path selected at
runtime — a rebuild between arms changes more than the flag.

Artifacts land in `reports/perf/<arm>/<scenario>/`. Keep `logcat.txt`: the parser
discards anything it cannot verify, so the raw capture is the only complete
record.

## Scenarios

| flow | chapter | verses | why |
| --- | --- | --- | --- |
| `genesis-1` | Genesis 1 | 31 | the everyday case |
| `matthew-5` | Matthew 5 | 48 | typical |
| `psalm-119` | Psalms 119 | 176 | worst case — the longest chapter in the Bible |

All three run the identical interaction sequence
(`.maestro/perf/shared/reader-workout.yaml`), so "cost scales with verse count"
is a testable claim rather than an assumption.

## Reading the output

```
JS blocks: 9 (3240.0ms total, worst 600.0ms) [minor 0 / major 5 / severe 4]
JS thread blocked 5.4% of the session

Blocks attributed to open spans:
  reader.mount.bible                    9 blocks  3240.0ms
```

The attribution line is the useful one. A block with `reader.mount.bible` open
means the chapter mount was running while the thread was unavailable — that is
evidence, not correlation-by-timestamp.

Severity buckets: **minor** 30–100ms (a stutter), **major** 100–300ms (clearly
janky), **severe** >300ms (the app looks frozen).

## Instrumented spans

| span | opens | closes |
| --- | --- | --- |
| `reader.mount.bible` | `ChapterReader` renders a chapter | after commit + layout |
| `reader.mount.explanations` | same, `explanationsOnly` mode | same |
| `view.switch` | `activeView` changes | after the new view commits |
| `swipe.settle` | native pager settles on a new page | after the new chapter commits |

Counter `textNodes` accumulates the per-token `<Text>` nodes
`HighlightedText` produced. It is the direct measure of the thing this project
removes. Absolute values only mean something compared against another run of the
same flow.

## Adding a span

Keep the set small. The value is in the per-block attribution, and that gets
*less* useful as spans multiply — if everything is always open, nothing is
implicated.

```ts
usePerfMountSpan('my.thing', keyThatChangesPerMeasurement, { meta: 'here' });
```

## Gotchas

- **Release builds record nothing.** The session is `__DEV__` only. The capture
  script checks for `DEBUGGABLE` up front and refuses rather than producing an
  empty report.
- **The report is emitted on background**, which is why the script sends
  `KEYCODE_HOME`. No background, no report.
- **The wireless-debug port rotates** every time the phone toggles the setting.
  The script rediscovers it over mDNS; never hard-code it.
- **logcat truncates messages over ~4076 bytes**, so reports are chunked and
  checksummed. A dropped chunk is reported as an error and exits non-zero — a
  truncated capture must not read as a clean run.
- **Counters double under StrictMode**, since `perfAdd` is called during render.
  Harmless for A/B (both arms double), misleading as an absolute.

## Hermes CPU profiling — the instrument that ends arguments

The span/counter harness above says *how long* something took. It cannot say
*what ran*, and that gap cost this project four dead hypotheses about chapter
mount: every one of them was consistent with the numbers, and every one was
wrong. A sampling profile does not need a hypothesis.

```sh
# 1. app running and in the foreground on the screen you want to measure
bun scripts/perf/hermes-profile.ts 18 /tmp/swipe.cpuprofile   # then drive the gesture
bun scripts/perf/hermes-analyse.ts /tmp/swipe.cpuprofile      # self + total time
bun scripts/perf/hermes-callers.ts /tmp/swipe.cpuprofile      # who calls the expensive frames
```

Reading it:

- **`[root]` self time is idle.** A run where `[root]` is 75% means the JS thread
  was busy a quarter of the time; compare that number between runs before
  anything else.
- **self time** names the function that was executing. `[Host Function] X` is
  native work called from JS — `completeRoot` is Fabric committing the tree,
  `createNode`/`createTextInstance` are shadow-node creation.
- **total time** names the subtree that owns the cost. Use it to find which of
  *our* components a native cost hangs under.

Two gotchas that cost real time here:

1. **Pick the right inspector target.** `/json/list` returns both the JS runtime
   ("React Native Bridgeless", advertises `prefersFuseboxFrontend`) and a "UI"
   connection. The UI page accepts a websocket and then answers nothing at all,
   so `Profiler.start` never replies — which looks exactly like "Hermes has no
   profiler". `hermes-profile.ts` selects on the capability, not on order.
2. **`Profiler.enable` is not implemented** and returns `-32601`. Awaiting it
   hangs the run with no error anywhere. It is fired and not awaited.

### Driving the gesture

Keep synthetic swipes clear of the screen edges. On a 1080px-wide phone with
gesture navigation, `input swipe 900 ... 150 ...` starts inside the right-edge
back-gesture zone: the first swipe fires system Back, leaves the app, and every
later swipe lands on the launcher — while the profile still "succeeds". Use
`800 -> 280` and assert the app is still foreground after each swipe.

Also prefer swiping FORWARD through new chapters over swiping back and forth
between two. Per-chapter caches (alignment, layout) hit on the second visit, so
an alternating flow measures something no reader ever does.

## atrace — what runs INSIDE a slow frame phase

`capture-baseline.sh` collects `gfxinfo framestats`, which tells you which **phase** of a frame was
slow. That is where this project's investigation kept landing: the `animation` phase, every time. A
phase is a time boundary, not a cause, so framestats cannot take you further — and three separate
hypotheses were offered for that phase before it was measured properly (one confirmed, one wrong, one
retracted as untested).

atrace goes inside it, because Android and React Native both emit **named** slices, and the app's own
show up once `atrace -a <package>` enables the `app` category:

```bash
# The Bible <-> Insight toggle, three times.
scripts/perf/capture-atrace.sh toggle \
  --taps "commentary-view-toggle:1800 bible-view-toggle:1800 commentary-view-toggle:1800"

# The Insight sub-tabs. --pre gets onto the Insight view OUTSIDE the measured window.
scripts/perf/capture-atrace.sh subtabs --pre "commentary-view-toggle:2500" \
  --taps "tab-byline:1500 tab-study:1500 tab-summary:1500"

# Re-attribute a trace already on disk, e.g. with a different phase or a longer table.
bun scripts/perf/atrace-slices.ts reports/perf/atrace/toggle.txt --within animation --top 30
```

Three things about it are deliberate:

- **Taps name a testID, not a pixel.** A hardcoded `input tap 839 143` taps the wrong thing on another
  screen size or after a layout change, and a capture of the wrong interaction is indistinguishable
  from a capture of a fast one. IDs resolve from a `uiautomator dump` taken *before* the window opens,
  since the dump itself perturbs the app.
- **`--pre` exists so warm-up stays out of the measurement.** Getting to the screen is not the thing
  being measured, and its frames would dilute the window — the same mistake that once produced a
  phantom regression here by measuring the wrong 120 frames.
- **Ranking is by SELF time**, not total. A parent's total includes all its children, so `animation`
  totalling 30ms tells you nothing about which child to fix. Self time is additive across the tree, so
  the top row is the thing actually executing.

Keep the window short. atrace produced ~16MB of text for four seconds of scrolling on this phone, and
the buffer is a ring — a long capture silently discards its own beginning. The parser reports what it
dropped (`ends with no begin`, `begins never closed`) rather than letting a truncated trace read as a
complete one.

The finding that motivated all of this is written up in `docs/perf-next-session.md` ("The animation
phase, finally opened up"): 119.4ms of one toggle's animation phase was 228 native text-view
creations, arriving in a single burst ~1.1s after the tap — the idle tab prewarm, not the tap itself.

## Verifying a session's changes

```bash
scripts/perf/verify-session.sh            # everything, ~12 min
scripts/perf/verify-session.sh lexicon    # just the biggest question, ~3 min
```

Runs each capture the current changes need and prints the result **next to the number it has to beat**,
with the arm those baselines came from. The baselines are hardcoded on purpose: every A/B in this project
that went wrong went wrong by comparing arms that were not comparable — one measured an idle app on the
wrong screen, one warmed the tabs before measuring a tab switch, one put 261 created views against 113.
Leaving the comparison to memory is how that happens.

Two rules it prints back at you, because both were learned expensively:

- **A wall-clock span around an `await` measures latency, not work.** Cross-check any span total against
  the session's total JS blocking. If the spans sum to more than the thread was ever blocked, they are
  measuring waiting — that is how `data.alignment` came to be called "the biggest cost in the app" when
  it was mostly an open span absorbing other work's time.
- **Judge a change on the felt metrics** — `tab.switch`, `view.switch`, `gesture.swipe` — not on frame
  phases alone. Two changes were reverted on 2026-07-29 for improving one while the other did not move.
