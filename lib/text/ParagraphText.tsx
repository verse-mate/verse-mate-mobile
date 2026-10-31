/**
 * `<ParagraphText>` — render a run of verses as ONE native text view.
 *
 * This is the join between the two halves of the project: `compileParagraph`
 * turns domain data into a string plus decoration ranges, and `VMText` draws it
 * as a single view. Everything a caller previously got from a tree of
 * per-word `<Text>` nodes — verse taps, highlight taps, lexicon taps, line
 * geometry — comes back here through character offsets instead.
 *
 * ## Where the height comes from
 *
 * The text is measured synchronously during render and the result passed to
 * `VMText` as an explicit height, so Yoga sizes the view correctly on the first
 * layout pass. That is what avoids the reflow-and-jump that a self-measuring
 * view would cause on every one of a chapter's ~20 paragraphs.
 *
 * `width` is required and must be the width the caller will actually lay the
 * paragraph out at. Measuring at one width and rendering at another is the one
 * way this design can clip text, so it is a required prop rather than something
 * inferred — a wrong width should be a visible mistake at the call site, not a
 * silent one.
 */

import { useCallback, useMemo, useRef } from 'react';
import { type TextStyle, View } from 'react-native';
import {
  measureTextHeight,
  type TextLineLayout,
  type TextPressEvent,
  type TextSelectionActionEvent,
  type TextSelectionRange,
  VMText,
} from '@/modules/versemate-text';
import type { AlignedToken, LexEntry } from '@versemate/lexicon';
import type { AutoHighlight } from '@/types/auto-highlights';
import { perfSpan } from '@/lib/perf';
import {
  compileParagraph,
  type VerseSelection,
  verseAtOffset,
  verseNumberNearOffset,
  verseSelectionFromOffsets,
} from './compile-paragraph';
import type { CompiledParagraph, ParagraphInput } from './types';
import { wordAtOffset } from './word-at-offset';

/** What a lexicon word's card needs: the surface tapped or selected, its token and entry. */
export interface LexiconWordArgs {
  surface: string;
  token: AlignedToken;
  entry: LexEntry;
  isTheme: boolean;
}

/** One word of a multi-word selection that Define can show. */
export interface DefineChoice {
  /** As it reads in the text (the lexicon surface, which may be several words). */
  label: string;
  word: string;
  verseNumber: number;
  /** Set when the word has a Greek/Hebrew entry; otherwise it opens the English dictionary. */
  lexicon?: LexiconWordArgs;
}

/**
 * Words with no definition worth opening, unless the lexicon has them (then they carry a Greek or
 * Hebrew word and stay). English only: other languages' words never match and are all offered.
 */
const FILLER_WORDS = new Set(
  (
    'a an the and or but nor so yet of to in on at by for from with as into onto upon unto than ' +
    'that this these those it its is was be been are were am he she they we you i me him her them ' +
    'us his hers their our your my mine who whom whose which what not no do did does have has had ' +
    'will shall would should can could may might must then there here also'
  ).split(' ')
);

/**
 * The distinct words of a selection, in reading order, for Define's chips.
 *
 * A lexicon match counts once per lemma (it may span several words, or recur); other words once per
 * spelling. Filler words without a lexicon entry are left out, unless nothing else was selected.
 */
export function defineChoicesFor(
  compiled: CompiledParagraph,
  start: number,
  end: number
): DefineChoice[] {
  const all: DefineChoice[] = [];
  const seen = new Set<string>();
  const wordPattern = /[\p{L}\p{M}]+(?:['’-][\p{L}\p{M}]+)*/gu;
  const slice = compiled.text.slice(start, end);
  for (const match of slice.matchAll(wordPattern)) {
    const offset = start + (match.index ?? 0);
    const verseNumber = verseAtOffset(compiled, offset);
    if (verseNumber === null) continue;
    let lexicon: LexiconWordArgs | undefined;
    for (let i = compiled.ranges.length - 1; i >= 0; i--) {
      const target = compiled.targets[i];
      const range = compiled.ranges[i];
      if (target?.kind === 'lexicon' && offset >= range.start && offset < range.end) {
        lexicon = {
          surface: target.surface,
          token: target.token,
          entry: target.entry,
          isTheme: target.isTheme,
        };
        break;
      }
    }
    const { word } = wordAtOffset(compiled.text, offset);
    if (!word || !/\p{L}/u.test(word)) continue;
    const key = lexicon ? `lex:${lexicon.token.lemma}` : `word:${word.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    all.push({ label: lexicon ? lexicon.surface : word, word, verseNumber, lexicon });
  }
  const meaningful = all.filter((c) => c.lexicon || !FILLER_WORDS.has(c.word.toLowerCase()));
  return meaningful.length > 0 ? meaningful : all;
}

export interface ParagraphTextProps extends Omit<ParagraphInput, 'verses'> {
  /** Verses to render, in reading order. */
  verses: ParagraphInput['verses'];
  /** Width the paragraph will be laid out at, in dp. */
  width: number;
  /** Base text style. Font attributes are forwarded to the native view. */
  style?: TextStyle | TextStyle[];
  /** `via` says whether the verse number or the verse's text was tapped, for analytics. */
  onVerseTap?: (verseNumber: number, via: 'number' | 'text') => void;
  onHighlightTap?: (highlightId: number) => void;
  onAutoHighlightPress?: (autoHighlight: AutoHighlight) => void;
  onLexiconWordPress?: (args: LexiconWordArgs) => void;
  /**
   * Define a word that has no lexicon entry: its English dictionary card.
   *
   * Reached from the selection menu's Define, like `onLexiconWordPress` for a word that has a
   * Greek/Hebrew entry. A tap no longer defines: Andy moved Verse Insight back onto the whole verse
   * ("press the verse once for the insight", web #313), so a tap anywhere in a verse opens it.
   */
  onWordPress?: (args: { word: string; verseNumber: number }) => void;
  /**
   * Highlight what the reader selected, from the selection menu's Highlight.
   *
   * Andy's Olive Tree gesture: hold a word, drag over a few words or the whole verse, Highlight.
   */
  onHighlightSelection?: (selection: VerseSelection) => void;
  /**
   * Define on a selection of more than one word: its words, so the sheet can offer each one. Without
   * it, Define shows the word the selection starts in, as for a single word.
   */
  onDefineSelection?: (choices: DefineChoice[]) => void;
  /**
   * Localised menu labels for the selection actions. An action is offered only when its label and
   * its handler are both given.
   */
  selectionLabels?: { highlight?: string; define?: string };
  /** Line geometry after layout, for anchoring popovers to a tapped word. */
  onTextLayout?: (lines: TextLineLayout[]) => void;
  /**
   * When false, render an exact-height placeholder instead of the real text view.
   *
   * This is what makes windowing safe here. Height is measured synchronously
   * WITHOUT creating a view, so a placeholder occupies precisely the space the text
   * would — total content height is unchanged, scroll offsets stay valid, and
   * `measureLayout`-based scroll-to-verse keeps working. No FlatList, no
   * `getItemLayout`, no scroll drift.
   *
   * Defaults to true, so a caller that does not opt in behaves exactly as before.
   */
  isVisible?: boolean;
  /**
   * Native selection changed, in COMPILED text offsets. Use `verseAtOffset` from
   * the compiler to map a bound back to a verse.
   *
   * The platform owns the selection visual, handles and Copy menu; this is for the
   * app's own affordances on top, e.g. the Define button.
   */
  onSelectionChange?: (selection: TextSelectionRange) => void;
  /**
   * Pre-compiled paragraph, when the caller already compiled it.
   *
   * A windowing caller must compile every group to know its height, so without this
   * the same paragraph gets compiled twice — once for its offset, once to render it,
   * doubling the cost of the thing being optimised. Optional, so a standalone caller
   * still works unchanged.
   */
  compiled?: CompiledParagraph;
  /**
   * Pre-measured height in dp, when the caller already measured it.
   *
   * Same reasoning as `compiled`: the windowing caller measured this to compute
   * offsets, and re-measuring here would be pure duplication.
   */
  height?: number;
  testID?: string;
}

export function ParagraphText(props: ParagraphTextProps) {
  const {
    verses,
    width,
    style,
    highlights,
    autoHighlights,
    alignment,
    redLetterVerses,
    showLexUnderlines,
    includeVerseNumbers,
    selection,
    theme,
    onVerseTap,
    onHighlightTap,
    onAutoHighlightPress,
    onLexiconWordPress,
    onWordPress,
    onHighlightSelection,
    onDefineSelection,
    selectionLabels,
    onTextLayout,
    onSelectionChange,
    isVisible = true,
    compiled: compiledProp,
    height: heightProp,
    testID,
  } = props;

  // Dev-only. The A/B showed chapter-open barely improving (Psalm 119: -7%) even
  // though node count halved, so the cost has moved somewhere else. These two
  // spans say where: compiling ranges in JS, or the synchronous native measure.
  // Both run during render, so both land inside reader.mount.bible.
  // Only compile when the caller did not. A windowing caller compiles every group
  // already (it needs the heights), so compiling again here would double the cost of
  // the very thing being optimised.
  const ownCompiled = useMemo(
    () =>
      compiledProp ??
      compileWithSpan({
        verses,
        highlights,
        autoHighlights,
        alignment,
        redLetterVerses,
        showLexUnderlines,
        includeVerseNumbers,
        selection,
        theme,
      }),
    [
      compiledProp,
      verses,
      highlights,
      autoHighlights,
      alignment,
      redLetterVerses,
      showLexUnderlines,
      includeVerseNumbers,
      selection,
      theme,
    ]
  );

  // Font attributes are pulled out so both the measurement request and the memo
  // key see the same values. A style attribute that affects layout but is missing
  // here would measure stale and clip.
  const font = flattenFont(style);
  // Destructured into primitives for the memo below. Callers routinely pass a
  // fresh array (`style={[styles.base, cond && styles.red]}`), so keying on the
  // style prop — or on the object `flattenFont` returns — would invalidate on
  // every render and make the memo useless.
  const { fontSize, fontFamily, fontWeight, lineHeight, letterSpacing, textAlign } = font;

  const compiled = ownCompiled;

  const height = useMemo(() => {
    // Measured by the caller already; re-measuring would be pure duplication.
    if (heightProp != null) return heightProp;
    // Only the ranges that change metrics matter to measurement. Underlines and
    // backgrounds are drawn over the glyphs and cannot change line breaking, so
    // including them would evict the native cache on every highlight toggle for
    // no benefit.
    const metricRanges: CompiledParagraph['ranges'] = compiled.ranges;
    const metricRangesFlat = metricRanges
      .filter(
        (r) =>
          r.fontScale !== undefined ||
          r.baselineShift !== undefined ||
          r.fontWeight !== undefined ||
          // Widens an advance, so it changes line breaking. Omitting it here
          // measures the paragraph short while the view pins that height, which
          // clips text.
          r.advanceScale !== undefined
      )
      // Flattened to the bridge shape, same as the view prop. Measurement only
      // reads the metric fields, but sending the public nested shape here would
      // re-create the mismatch that silently dropped every underline.
      .map((r) => ({
        start: r.start,
        end: r.end,
        fontWeight: r.fontWeight,
        fontScale: r.fontScale,
        baselineShift: r.baselineShift,
        advanceScale: r.advanceScale,
        interactive: false,
      }));
    const endMeasure = perfSpan('paragraph.measure');
    const measured = measureTextHeight({
      text: compiled.text,
      ranges: metricRangesFlat,
      width,
      fontSize,
      fontFamily,
      fontWeight,
      lineHeight,
      letterSpacing,
      textAlign,
    });
    endMeasure();
    return measured;
  }, [
    heightProp,
    compiled.text,
    compiled.ranges,
    width,
    fontSize,
    fontFamily,
    fontWeight,
    lineHeight,
    letterSpacing,
    textAlign,
  ]);

  /**
   * Line geometry from the last layout, so a near-miss tap can be checked against the number's line.
   * A ref: it only matters at tap time, and keeping it in state would re-render on every layout.
   */
  const linesRef = useRef<TextLineLayout[]>([]);
  const handleTextLayout = useCallback(
    (lines: TextLineLayout[]) => {
      linesRef.current = lines;
      onTextLayout?.(lines);
    },
    [onTextLayout]
  );

  /** Which laid-out line an offset is on, or null before the first layout. */
  const lineOf = useCallback((offset: number): number | null => {
    const lines = linesRef.current;
    if (lines.length === 0) return null;
    const index = lines.findIndex((line) => offset >= line.start && offset < line.end);
    return index === -1 ? null : index;
  }, []);

  const handleRangeTap = useCallback(
    (index: number, charOffset: number) => {
      const target = compiled.targets[index];
      if (!target) return;
      // A finger that lands just beside a verse number meant the number, even when the word it
      // touched has a target of its own. The first word after a number very often does (a lexicon
      // word, a highlight), and with the underlines gone nothing shows which — so letting the word
      // win here would leave exactly the miss Andy reported.
      if (onVerseTap && target.kind !== 'verseNumber') {
        const nearNumber = verseNumberNearOffset(compiled, charOffset, lineOf);
        if (nearNumber !== null) {
          onVerseTap(nearNumber, 'number');
          return;
        }
      }
      switch (target.kind) {
        case 'verseNumber':
          onVerseTap?.(target.verseNumber, 'number');
          break;
        case 'lexicon':
          // A word is part of its verse: the tap opens the verse. Its definition is a hold away
          // (selection menu, Define).
          onVerseTap?.(target.verseNumber, 'text');
          break;
        case 'highlight':
          onHighlightTap?.(target.highlightId);
          break;
        case 'autoHighlight':
          onAutoHighlightPress?.(target.autoHighlight);
          break;
      }
    },
    [compiled, lineOf, onVerseTap, onHighlightTap, onAutoHighlightPress]
  );

  /**
   * A tap that hit no interactive range opens the verse it landed in.
   *
   * A finger just beside a verse number meant that number's verse (`verseNumberNearOffset`), which
   * is checked first: the joining space before a number otherwise belongs to the verse before it.
   */
  const handlePress = useCallback(
    (event: TextPressEvent) => {
      if (!onVerseTap) return;
      const nearNumber = verseNumberNearOffset(compiled, event.charOffset, lineOf);
      if (nearNumber !== null) {
        onVerseTap(nearNumber, 'number');
        return;
      }
      const verseNumber = verseAtOffset(compiled, event.charOffset);
      if (verseNumber !== null) onVerseTap(verseNumber, 'text');
    },
    [compiled, lineOf, onVerseTap]
  );

  const canDefine = !!(onWordPress || onLexiconWordPress);
  const selectionActions = useMemo(() => {
    const actions: { id: string; label: string }[] = [];
    if (onHighlightSelection && selectionLabels?.highlight) {
      actions.push({ id: 'highlight', label: selectionLabels.highlight });
    }
    if (canDefine && selectionLabels?.define) {
      actions.push({ id: 'define', label: selectionLabels.define });
    }
    return actions;
  }, [onHighlightSelection, canDefine, selectionLabels?.highlight, selectionLabels?.define]);

  /**
   * Highlight / Define from the selection menu.
   *
   * Define acts on the word the selection starts in: a hold selects one word, so that is the word
   * the reader pressed. A Greek/Hebrew lexicon match there wins over the English dictionary, as a
   * tap on it used to.
   */
  const handleSelectionAction = useCallback(
    ({ id, start, end }: TextSelectionActionEvent) => {
      if (id === 'highlight') {
        const selection = verseSelectionFromOffsets(compiled, start, end);
        if (selection) onHighlightSelection?.(selection);
        return;
      }
      if (id !== 'define') return;
      if (onDefineSelection) {
        const choices = defineChoicesFor(compiled, start, end);
        if (choices.length > 1) {
          onDefineSelection(choices);
          return;
        }
      }
      // First letter at or after the start, so a selection that began on a space still finds it.
      let offset = start;
      while (offset < end && /\s/.test(compiled.text[offset] ?? '')) offset++;
      for (let i = compiled.ranges.length - 1; i >= 0; i--) {
        const target = compiled.targets[i];
        const range = compiled.ranges[i];
        if (target?.kind === 'lexicon' && offset >= range.start && offset < range.end) {
          onLexiconWordPress?.({
            surface: target.surface,
            token: target.token,
            entry: target.entry,
            isTheme: target.isTheme,
          });
          return;
        }
      }
      const { word } = wordAtOffset(compiled.text, offset);
      const verseNumber = verseAtOffset(compiled, offset);
      // Whitespace, or digits only (a verse number): nothing to define.
      if (!word || verseNumber === null || !/\p{L}/u.test(word)) return;
      onWordPress?.({ word, verseNumber });
    },
    [compiled, onHighlightSelection, onDefineSelection, onLexiconWordPress, onWordPress]
  );

  // Off-window: no native views at all. A Psalm 119 mount creates ~35 paragraph
  // groups where a phone shows about 4, so ~31 ExpoView + TextView pairs were being
  // created, measured and laid out off-screen on every chapter open. Chapter-open
  // was the one metric the native renderer did not improve (-4%), and this is why.
  //
  // Rendered after the measure hook above, not before, so the height is known and
  // the hook order is unconditional.
  if (!isVisible) {
    return (
      <View
        style={height != null ? { height, width } : undefined}
        testID={testID ? `${testID}-placeholder` : undefined}
      />
    );
  }

  return (
    <VMText
      height={height ?? undefined}
      onPress={onVerseTap ? handlePress : undefined}
      onRangeTap={handleRangeTap}
      onSelectionAction={selectionActions.length > 0 ? handleSelectionAction : undefined}
      onSelectionChange={onSelectionChange}
      selectionActions={selectionActions}
      onTextLayout={handleTextLayout}
      ranges={compiled.ranges}
      style={style}
      testID={testID}
      text={compiled.text}
      width={width}
    />
  );
}

interface ResolvedFont {
  fontSize: number;
  fontFamily?: string;
  fontWeight?: string;
  lineHeight?: number;
  letterSpacing?: number;
  textAlign?: string;
}

/**
 * Pull layout-affecting font attributes out of a style prop.
 *
 * Returns a plain object rather than the flattened style so the measurement memo
 * has a stable, minimal key: a re-render that changes only a colour should not
 * invalidate a measurement.
 */
/**
 * `compileParagraph` wrapped in a span.
 *
 * A thin wrapper rather than spans inside the compiler, so the compiler stays a
 * pure function with no instrumentation dependency — it is testable in Jest
 * precisely because it has none.
 */
function compileWithSpan(input: Parameters<typeof compileParagraph>[0]) {
  const end = perfSpan('paragraph.compile');
  try {
    return compileParagraph(input);
  } finally {
    end();
  }
}

function flattenFont(style: TextStyle | TextStyle[] | undefined): ResolvedFont {
  const merged: TextStyle = Array.isArray(style)
    ? Object.assign({}, ...style.filter(Boolean))
    : (style ?? {});
  return {
    // Matches React Native's default <Text> size, so an unstyled paragraph
    // measures as the platform would draw it.
    fontSize: typeof merged.fontSize === 'number' ? merged.fontSize : 14,
    fontFamily: merged.fontFamily,
    fontWeight: merged.fontWeight != null ? String(merged.fontWeight) : undefined,
    lineHeight: typeof merged.lineHeight === 'number' ? merged.lineHeight : undefined,
    letterSpacing: typeof merged.letterSpacing === 'number' ? merged.letterSpacing : undefined,
    textAlign: merged.textAlign,
  };
}
