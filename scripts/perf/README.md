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
