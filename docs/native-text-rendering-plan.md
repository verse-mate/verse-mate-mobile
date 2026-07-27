# Native text rendering for VerseMate mobile

**Status:** plan, awaiting approval
**Author:** drafted 2026-07-27
**Supersedes:** `versemate-chapter-virtualization` (folded in as Phase 6), the
dormant `modules/dotted-underline-text/` experiment (its drawing code is
harvested, the module is retired in Phase 7).

---

## 1. Why the app is slow

Two independent cost axes. Both have the same root fix.

### Axis A — shadow-node explosion in the text hot path

`components/bible/HighlightedText.tsx` renders **one to two RN `<Text>` nodes
per word token** (`HighlightedText.tsx:1088-1105` plain, `:1056-1082`
single-word lexicon, `:1009-1035` multi-word lexicon phrase). Every token also
gets its own `onPress` / `onLongPress` closures and `responderProps`.

`ChapterReader.tsx:596-741` then nests all of that inside **one
paragraph-mode `<Text>`** per verse group, plus four more `<Text>` nodes per
verse just to paint the superscript verse number and its highlight background
(`:673-715`).

Node count for a single paragraph group of 5 verses × ~25 words:

| layer | nodes |
| --- | --- |
| paragraph `<Text>` | 1 |
| per-verse `<Text>` | 5 |
| superscript group (`<Text>` ×4 per verse) | 20 |
| `HighlightedText` root + segment wrappers | ~10 |
| per-token `<Text>` (1 plain / 2 lexicon) | ~125-250 |
| **total** | **~160-290** |

A chapter is 10-20 such groups → **1,000-3,000 shadow nodes**. Psalm 119 (176
verses) is far worse.

The cost is not just React reconciliation. Android's `ReactTextShadowNode`
flattens the entire nested `<Text>` subtree into a single `Spannable` and
re-measures it on **every commit**; iOS does the equivalent with
`NSAttributedString`. So any state touching a verse — adding a highlight,
changing selection, toggling lexicon underlines, changing font size —
re-flattens and re-measures the whole paragraph.

**This is already measured.** The 2026-05-21 runtime-instrumentation session
(recovered from `versemate-swipe-perf` + `~/.claude/history.jsonl`) put a
16ms-cadence JS-thread heartbeat in the app and found **500-700ms of JS block
per buffer-chapter `ChapterReader` mount**.

The workarounds in the codebase are all load-bearing scaffolding around this
single cost, and each one is its own bug source:

| workaround | location | what it hides |
| --- | --- | --- |
| `setBibleSectionsMax(20)` @200ms → `Infinity` @500ms | `ChapterPage.tsx:518-525` | chapter mount cost |
| `bylineMax(30)` @200ms → `Infinity` @500ms | `ChapterPage.tsx:180-181` | by-line mount cost |
| `isPreloading` → `SkeletonLoader` instead of content | `ChapterPage.tsx:1244-1266` | buffer-chapter mount (this is the ~500ms skeleton-on-swipe you dislike) |
| `insightPrewarmed` + `InteractionManager.runAfterInteractions` | `ChapterPage.tsx:470-493` | Bible↔Insight switch latency |
| `splitMarkdownForVirtualization` | `TopicPage.tsx:105` | markdown-leaf `HighlightedText` wrapping cost |
| `useDeferredValue` on the pager chapter | `SimpleChapterPager` call-site | header-lag symptom |

### Axis B — the underline is impossible in RN primitives

Verified against RN 0.81.5 sources (`TextAttributeProps.java`, empty switch
cases ~line 201/206, recorded in `HighlightedText.tsx:1288-1298`): on Android
`textDecorationStyle` and `textDecorationColor` are **no-ops**. Underline
*thickness* is unsettable on both platforms. So web parity — hairline dotted
gold underline, two tiers — cannot be expressed. Today both platforms ship a
compromise solid line (`HighlightedText.tsx:1311-1335`).

### Why the May 2026 native attempt failed

`modules/dotted-underline-text/` was wired as a native view **nested inside**
the paragraph-mode `<Text>`. RN gives Views-inside-Text a 0×0 layout, so the
text vanished and only the superscript digits rendered — exactly the reported
symptom ("for a split second when i swipe i see the text and then it
disappears and only the superscript digits are shown"). It was parked as
dormant and the underline reverted to solid on both platforms.

The module itself is **not wasted work**. Its Kotlin (`DottedUnderlineTextView.kt`)
already implements, correctly: per-range dotted/solid underline drawing via
`DashPathEffect`, per-range background / foreground / weight spans, per-range
tap hit-testing through `Layout.getOffsetForHorizontal`, and native selection.
That is the decoration and interaction layer, done. What it lacks is a correct
**measurement** layer — it fights Yoga with `shouldUseAndroidLayout` plus an
`onMeasure` override hack (`DottedUnderlineTextView.kt:101-112`).

---

## 2. Architecture decision

### The shape: a paragraph-level primitive, not a full-chapter native view

One self-measuring native view **replaces** each paragraph-mode `<Text>`. It is
a leaf in the *View* tree, never inside a Text tree. RN keeps owning sections,
scrolling, headings, tooltips, modals.

```
ScrollView / FlatList                     (RN)
├─ <Text> section subtitle                (RN)
├─ <VMText>  verses 1-5                   NATIVE — 1 node
├─ <VMText>  verses 6-11                  NATIVE — 1 node
└─ <VMText>  verses 12-18                 NATIVE — 1 node
```

~10-20 nodes per chapter, down from 1,000-3,000.

**A full-chapter native renderer was considered and rejected.** It re-implements
~1,100 lines of `ChapterReader` in Kotlin *and* Swift — section headings,
paragraph breaking, scroll-to-verse, scroll-velocity FAB, text-visibility
tracking, tooltip anchoring — and it cannot interleave the RN components that
live inside the reader (`BookmarkToggle`, `NotesButton`,
`AvailableOfflineBadge`, the audio entry, `VisualsPanel`, `LexiconPopover`, the
error modal). Every future content feature would then need native work in two
languages. It buys almost nothing on top of the paragraph primitive, because
scrolling in RN is *already* native and the measurement work is identical —
it just moves. It is worse on both performance-ceiling and modularity, which
are the two things that matter here. Virtualization (Phase 6) beats it
outright: with a virtualized list only *visible* paragraphs are measured at
all, whereas a full-chapter view must measure the whole chapter up front.

### The measurement layer: a real Fabric shadow node, not Expo's push model

Expo's self-sizing API (`shadowNodeProxy.setViewSize`) exists on both platforms,
but reading its implementation shows it is the wrong tool for text:

- `ExpoViewComponentDescriptor::adopt` (`expo-modules-core/common/cpp/fabric/`)
  applies the state via `snode->setSize(...)`, which sets **fixed Yoga style
  dimensions**. It is a *push*: the view lays out, then measures, then pushes a
  size, then re-lays-out. One frame of reflow on every mount — visible content
  jump on chapter open, and it breaks scroll-offset restoration. That is the
  same family of bug as the teleport/hiccup symptoms we just spent a session
  killing.
- The Android and iOS state constructors disagree: iOS's `ExpoViewState(w,h)`
  maps negatives to `NaN` (so you can push height-only), Android's
  `ExpoViewState(prev, folly::dynamic)` reads `data["width"].getDouble()` raw
  and would adopt a negative width. Height-only self-sizing is not portable.

Instead, do what RN's own `<Text>` does. `VMTextShadowNode` subclasses
`ConcreteViewShadowNode` and implements **`measureContent(LayoutContext,
LayoutConstraints)`** using RN's own text engine:

- `TextLayoutManager::measure()` → synchronous, single-pass, Yoga-native
  measurement with **no reflow frame**.
- Metrics are **identical to RN `<Text>`** because it is literally the same
  engine — native paragraphs and surrounding RN text cannot visually drift.
- RN's measurement cache comes for free.
- `TextLayoutManager::measureLines()` → **native line rects**, which replaces
  `onTextLayout` + `paragraphLineLayoutsRef` for lexicon-popover and tooltip
  anchoring, with no JS round-trip.
- `AttributedString::Fragment` carries per-fragment `TextAttributes`, so the
  decoration model is native end-to-end.

Precedent and confirmation, all present in `node_modules`:
`react-native/ReactCommon/react/renderer/components/text/ParagraphShadowNode.{h,cpp}`,
`.../textlayoutmanager/TextLayoutManager.h`,
`.../attributedstring/AttributedString.h`.

Cost, stated honestly: this is C++ plus codegen wiring (CMake on Android, a
podspec + component registration on iOS), and it touches RN internal APIs that
can shift between RN versions. We are pinned to RN 0.81.5 / Expo 54, the module
is ours, and Phase 2 exists specifically to prove or disprove this before any
domain code depends on it. Section 5 documents the fallback.

### REVISION (2026-07-27, after investigating the build path)

The C++ shadow node remains the ideal, but investigating what it actually takes
turned up three things that change the sequencing:

1. **No precedent in this dependency tree.** Nothing in `node_modules` — not
   `react-native-svg`, `-screens`, `-pager-view` — implements `measureContent`.
   Every third-party Fabric component here uses default Yoga measurement.
2. **Codegen has no override hook.** `GenerateShadowNodeH` unconditionally emits
   `using XShadowNode = ConcreteViewShadowNode<...>` — a type alias, not a
   subclass. Supplying a custom shadow node means bypassing codegen for the C++
   side entirely and registering a hand-written `ComponentDescriptorProvider`,
   through per-platform internal registration paths.
3. **Android's documented custom-measure hook needs C++ anyway.**
   `ViewManager.measure` carries the comment "This function is never called
   automatically" — it only fires from `FabricUIManager.measure`, which is
   reached from a custom C++ shadow node. So there is no Kotlin-only route to
   Yoga-integrated measurement.

Meanwhile a better intermediate exists than the reflow-push model rejected
above. Expo's `Function()` is a **synchronous JSI call**
(`SyncFunctionComponent`), so the module can expose:

```ts
measureText({ text, ranges, width, fontSize, ... }): number  // height, synchronous
```

JS then renders `<VMText style={{ width, height }} />`, and Yoga has exact
dimensions on the **first** layout pass. No state push, no reflow frame, no
Android/iOS NaN divergence. The width comes from `useWindowDimensions()` minus
stylesheet padding — synchronously available, so not even an extra layout pass.
Measurement and drawing are the same Kotlin/Swift code against the same
`TextPaint`, so they agree by construction and cannot clip.

Its one real cost is that measurement runs on the JS thread. Mitigated by a
native-side cache keyed on `(text, width, fontSize, fontScale)`: a chapter pays
~20 `StaticLayout` measures once (~1-3ms each) instead of 500-700ms of nested
`<Text>` flattening, and pays nothing on re-render.

**So Phase 2 splits:**

- **2a — sync-measure (Kotlin only, stable public APIs).** Delivers exact
  first-layout measurement and the whole decoration/interaction layer. This is
  what gets measured in Phase 4.
- **2b — C++ `measureContent`, only if 2a's numbers justify it.** Escalation
  moves measurement off the JS thread entirely and onto RN's own
  `TextLayoutManager` with its cache. The range model, the compiler and the
  Kotlin drawing code are all unchanged by the swap — it is contained to the
  measurement layer, which is exactly why it is safe to defer rather than
  gamble the phase on unprecedented build plumbing.

This is a sequencing change, not a scope reduction: 2b stays on the table and
the design keeps it cheap to reach.

### The modularity seam: a pure-TypeScript range compiler

The native module knows nothing about Bibles, verses, lexicons, highlights, or
topics. It is a generic text engine:

```tsx
<VMText
  text={string}
  ranges={TextRange[]}
  style={TextStyle}
  onRangeTap={(index) => void}
  onPress={(charOffset) => void}
  onSelectionChange={({start, end}) => void}
  onTextLayout={(lines) => void}
/>
```

All domain knowledge stays in TypeScript, in one pure function:

```ts
compileParagraph(input: ParagraphInput): {
  text: string;
  ranges: TextRange[];
  charMap: CharMap;   // char offset → (verseNumber, charInVerse)
}
```

That function is where verses, highlights, auto-highlights, lexicon alignment,
multi-word surfaces, red-letter, superscripts and selection get flattened into
one string plus a sorted, precedence-resolved range list. It is pure, so it is
fully unit-testable in Jest with **no device and no native build**.

This is what makes Bible and Topics share the work. Every text surface in the
app already funnels through `HighlightedText`:

| surface | call site |
| --- | --- |
| Bible paragraph groups | `ChapterReader.tsx:716` |
| Bible single-verse mode | `ChapterReader.tsx:752` |
| Topics verse list | `TopicText.tsx:173` |
| Topics markdown leaves | `TopicPage.tsx:272` |
| Topics explanations | `TopicExplanationsPanel.tsx:173` |
| Study panel / Bible explanations | `StudyPanel.tsx`, `BibleExplanationsPanel.tsx` |

Keep `HighlightedText`'s public prop contract byte-identical and swap its
internals, and all seven surfaces convert at once.

---

## 3. Phases

Sequenced hardest-and-riskiest-first, so we learn whether the approach holds
before anything depends on it. Every phase has an explicit exit criterion.
Platform order per phase: **Kotlin → validate on the Xperia → Swift port →
merge** (iOS never sees a half-done phase; Andy only tests merged work).

### Phase 0 — Baseline measurement harness

No performance claim without numbers, and no fix without evidence of the cause.

- Restore the dev-only JS-thread heartbeat from the May session (16ms cadence,
  log `JS-block <ms>` when the gap exceeds 30ms). This is the instrument that
  turned three hours of theorising into a 20-minute finding, and it is worth
  making permanent rather than re-inventing.
- Add timers around: chapter-open → first content paint, paragraph mount,
  Bible↔Insight switch, swipe → content visible.
- Android frame truth from outside the app:
  `adb shell dumpsys gfxinfo org.versemate.app framestats` for real frame times
  and jank counts.
- `scripts/perf/capture-baseline.sh` — drives a fixed Maestro flow on the phone
  over ADB, emits JSON/CSV.
- Baseline three chapters: **Genesis 1** (short), **Matthew 5** (typical),
  **Psalm 119** (176 verses — worst case).

*Exit:* committed baseline numbers for all three chapters, reproducible by
re-running one script.

### Phase 1 — Range compiler (pure TypeScript, zero native)

- `compileParagraph()` as specified above, replacing the `segments` memo
  (`HighlightedText.tsx:456`), the tokenizer + `lexHits` + multi-word matching,
  and the superscript/background juggling in `ChapterReader.tsx:629-735`.
- Range kinds: `lexUnderline` (regular | theme), `highlightBg`,
  `autoHighlightBg`, `redLetterColor`, `verseNumberSuperscript`, `selection`.
- **Explicit overlap precedence** (selection > highlight > auto-highlight >
  lexicon underline). The current nested-`<Text>` tree resolves overlaps
  implicitly and accidentally; making it explicit is itself a bug fix.
- Fold in the known lexicon gap while we are here: the hyphenated-token edge
  case documented at `HighlightedText.tsx:1347-1353`.

*Exit:* Jest golden-fixture tests green, including a differential test that
renders the current tree and asserts the compiler derives the same decoration
set. Fully verifiable on the Pi, no device.

### Phase 2 — Native measurement, Android (the risky phase)

New module `modules/versemate-text/`.

- C++ `VMTextShadowNode : ConcreteViewShadowNode<...>` with `measureContent()`
  via `TextLayoutManager::measure()`, building an `AttributedString` whose
  `Fragment`s come from `text` + `ranges`.
- Codegen config in the module's `package.json`; CMake wiring on Android. The
  module is already linked at `node_modules/@versemate/…` via a `file:` dep, so
  codegen can discover it.
- Kotlin mounting layer that renders the `Spannable` and draws decorations —
  **port `drawRange` / `drawWholeText` from `DottedUnderlineTextView.kt`
  verbatim**, they are already correct.

*Exit:* a `<VMText>` rendering plain text is **pixel-identical** to an RN
`<Text>` with the same style — same line breaks, same height — verified by
on-device screenshot diff at 3 font scales × portrait/landscape. No reflow
frame on mount.

**STATUS: met on Genesis 1 (2026-07-27).** The native reader renders on device
with correct paragraph grouping, correct superscript verse numbers, line spacing
matching legacy line-for-line, no clipping (so the synchronous measurement agreed
with what was drawn) — and **real dotted gold underlines on Android**, the
decoration RN cannot express there at all. Four bugs had to be fixed on device
that compiling and registering cleanly did not catch:

1. **Every view failed to construct.** `setTextIsSelectable(true)` fires
   `onSelectionChanged` from the inner view's `init`, and the inner view is created
   by an outer property initializer — so the handler ran before the outer
   `EventDispatcher` delegates existed and recursed until the stack blew. The
   reader rendered its chrome and no text.
2. **No underline ever drew.** The TS type nests `underline: {style,color,thickness}`;
   the Kotlin Record declares them flat. `underlineStyle` arrived null for every
   range, and a null style is a valid "no underline", so nothing errored.
3. **Line height applied twice, inconsistently.** Both the measuring `StaticLayout`
   and the drawing `TextView` backed a target height out of natural leading
   independently, and disagreed.
4. **`lineHeight` not font-scaled.** `fontSize` converted through SP (applies the
   user's font scale), `lineHeight` through raw density (does not). The reader style
   is `lineHeight: fontSize * 2.0` and the test device sits at font scale 0.85, so
   the effective ratio was 2.35× — 17.6% too loose. Invisible on any device left at
   1.0.

Still to verify for full exit: 3 font scales × both orientations, and Psalm 119.

### Phase 3 — Decoration + interaction, Android

- `ranges` → real dotted underlines on Android at last, with per-range colour
  and thickness (Axis B closes here), plus backgrounds, colours, weights.
- `onRangeTap(index)` → JS maps index → lexicon entry / highlight / verse via
  `charMap`.
- `onPress(charOffset)` → verse tap.
- Native selection + `onSelectionChange(start,end)` → the dictionary Define
  flow.
- Line rects from `measureLines()` → replaces `handleTextLayout` and
  `paragraphLineLayoutsRef` for popover anchoring.

*Exit:* every item in the QA checklist (§4) passes on the Xperia.

### Phase 4 — Swap in behind a runtime flag, then A/B

- `HighlightedText` keeps its exact public props; internally branches to
  `<VMText>` (fed by the Phase-1 compiler) or the legacy tree.
- The flag is **runtime** (AsyncStorage / dev setting), not build-time, so
  **one build serves both arms** — otherwise the comparison is contaminated.
- Re-run the Phase-0 harness on both arms, same build, same device, same flow.

*Exit gate:* a large, unambiguous win on Psalm 119 chapter-open and on swipe.
If the numbers do not show it, **stop and re-diagnose** rather than continue —
the whole premise is that Axis A dominates, and this is where that premise gets
tested against reality.

### Phase 5 — Topics, Study, Insight, markdown parity

- Convert the remaining six `HighlightedText` call sites. Mostly verification,
  since Phase 4 preserved the contract.
- Markdown is the real win here: `TopicPage.tsx:272` and
  `TopicExplanationsPanel.tsx:173` currently wrap **every markdown text leaf**
  in a `HighlightedText`. Compile a whole markdown block into a single
  `<VMText>` where the block has no nested elements.

*Exit:* Topics + Study + Insight visually unchanged, node counts down, Jest
suites green.

### Phase 6 — Virtualization, and delete the scaffolding

This is where your extra-scope items actually land. All of it is only safe
*because* mounts are now cheap.

- Virtualize sections (`FlatList`/`FlashList` over `chapter.sections`,
  `ListHeaderComponent` = title row) — the pending
  `versemate-chapter-virtualization` plan, now with a much lower risk profile.
- **Delete the `isPreloading` skeleton gate** → buffer chapters render real
  content → **no more skeleton on swipe**.
- Delete `setBibleSectionsMax`, `bylineMax`, `splitMarkdownForVirtualization`,
  `insightPrewarmed` + the `InteractionManager` prewarm.
- **Bible↔Insight instant switch:** with prewarm gone and mounts cheap, the
  toggle should repaint on tap instead of waiting on the ~300ms `activeView`
  reconciliation.
- Move scroll handlers (FAB visibility, text-visibility tracking) into
  Reanimated worklets so scrolling costs zero JS.

*Exit:* harness shows no regression; swipe has no skeleton; switch is
sub-frame; the staged timers are gone from the codebase.

### Phase 7 — iOS port

- Swift mounting layer: `NSAttributedString` + TextKit, custom underline
  drawing pass, `UITextInteraction` for selection. The C++ shadow node is
  **shared** — that is the whole point of putting measurement there.
- Validate on the Mac simulator (needs the Mac powered on — it was unreachable
  at 192.168.0.154 when I checked), then a TestFlight build for Andy.
- Retire `modules/dotted-underline-text/` once its drawing logic is fully
  harvested.

*Exit:* iOS visually matches Android and web; Andy confirms on TestFlight.

### Phase 8 — Verse-insight load latency (independent axis)

Deliberately last and deliberately separate: this is almost certainly a **data**
problem, not a rendering one, so it gets its own evidence pass rather than being
assumed away by the native work.

- Instrument `useBibleByLine` → `useBibleChapterExplanation` →
  `parseByLineExplanation`; log fetch vs parse vs render separately.
- Candidates to *confirm, not assume*: cold React Query cache per chapter,
  SQLite reads on the JS thread (offline path does
  `DELETE`-then-bulk-`INSERT` per sync), markdown parse cost.
- Prior art to not re-derive: `versemate-byline-insight-content-pipeline` —
  phone insight renders through `ChapterReader` in `explanationsOnly` mode, not
  `BibleExplanationsPanel`; the API genuinely returns nested
  `{explanation:{explanation}}`; the parser was hardened in mobile PR #355.
- Fix matched to whatever the evidence says.

*Exit:* measured insight-open latency, and a fix traceable to a specific
logged cause.

---

## 4. QA checklist (from `versemate-chapter-virtualization`, extended)

This change touches the verse-rendering hot path. Do not ship a phase without
walking this on-device.

- [ ] Scroll within a chapter — smooth, no jank, no clipping top/bottom
- [ ] Swipe to next chapter — no skeleton flash
- [ ] Swipe to previous chapter — same
- [ ] Rapid double-swipe — lands on the right chapter
- [ ] Swipe then immediately scroll — no teleport-to-top
- [ ] Tap an underlined word → lexicon popover opens at the correct position
- [ ] Dotted underline renders as real dots on **Android** (the Axis-B fix)
- [ ] Two tiers (regular vs theme) visually distinct, matching web
- [ ] Lexicon-underline off switch (MOBILE-1001 #7) still works
- [ ] Text selection → highlight a verse range
- [ ] Long-press a word → Define button → dictionary
- [ ] Tap a note indicator → NotesModal
- [ ] Tap plain text → verse insight tooltip
- [ ] Highlight + auto-highlight backgrounds, incl. spanning verse boundaries
- [ ] Red-letter "Jesus's Words" toggle
- [ ] Deep-link `/bible/1/3?verse=5` scrolls to verse 5
- [ ] Bookmark toggle in the title row
- [ ] Font-size setting scales verse text *and* insight text
- [ ] Landscape rotation, and rotate-while-scrolled
- [ ] Non-English Bible with Strong's-tagged tap-to-meaning
- [ ] Offline chapter (downloaded) renders identically
- [ ] Topics verse list + Topics markdown
- [ ] Study panel collapsibles
- [ ] Maestro `.maestro/regression/` + `.maestro/bible-reading/` green
- [ ] Psalm 119 opens without a visible stall

## 5. Risks and fallbacks

| risk | mitigation |
| --- | --- |
| `TextLayoutManager` not linkable from a local Expo module | Phase 2 exists to find this out before anything depends on it. Fallback: Expo `shadowNodeProxy.setViewSize` push model, plus a height cache keyed by `(text, width, fontScale)` so the reflow frame only ever happens once per unique paragraph. Documented, not preferred. |
| RN internal C++ API shifts on upgrade | Pinned to RN 0.81.5 / Expo 54. The shadow node is small and isolated to one module; treat an RN major upgrade as requiring a Phase-2 revalidation. |
| Native text selection behaves differently from RN's | Phase 3 exit criterion covers it explicitly; the existing Kotlin already does `setTextIsSelectable`. |
| Perf win smaller than predicted | Phase 4 is an explicit **stop-and-re-diagnose gate**, not a formality. |
| Regression in a surface nobody tests | Runtime flag stays in for the whole project so any surface can be A/B'd on one build, and reverted instantly. |
| Pi pre-commit `tsc --noEmit` OOMs | Known: commit from ThorSPC over SSH. |

## 6. How we test

- **Android (primary loop):** Xperia 5 V over wireless ADB through ThorSPC.
  Auto-discover the rotating port via `adb mdns services` rather than asking
  for it. Metro on ThorSPC at `192.168.0.193:8081`. Full recipe in
  `versemate-phone-devloop`.
- **Native changes need a dev-client rebuild**, unlike JS-only work — the
  Metro-only loop does not cover Kotlin/Swift/C++ edits. JS phases (0, 1, 4, 5,
  6) stay on the fast Metro loop.
- **iOS:** Mac simulator over SSH (Mac must be powered on), then EAS →
  TestFlight for Andy.
- **Jest:** the range compiler and all JS-side logic, runnable on the Pi.
- **Maestro:** existing flows as the regression net.
