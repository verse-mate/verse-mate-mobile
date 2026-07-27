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

import { useCallback, useMemo } from 'react';
import type { TextStyle } from 'react-native';
import {
  measureTextHeight,
  type TextLineLayout,
  type TextSelectionRange,
  VMText,
} from '@/modules/versemate-text';
import type { AlignedToken, LexEntry } from '@versemate/lexicon';
import type { AutoHighlight } from '@/types/auto-highlights';
import { compileParagraph, verseAtOffset } from './compile-paragraph';
import type { ParagraphInput } from './types';

export interface ParagraphTextProps extends Omit<ParagraphInput, 'verses'> {
  /** Verses to render, in reading order. */
  verses: ParagraphInput['verses'];
  /** Width the paragraph will be laid out at, in dp. */
  width: number;
  /** Base text style. Font attributes are forwarded to the native view. */
  style?: TextStyle | TextStyle[];
  onVerseTap?: (verseNumber: number) => void;
  onHighlightTap?: (highlightId: number) => void;
  onAutoHighlightPress?: (autoHighlight: AutoHighlight) => void;
  onLexiconWordPress?: (args: {
    surface: string;
    token: AlignedToken;
    entry: LexEntry;
    isTheme: boolean;
  }) => void;
  /** Line geometry after layout, for anchoring popovers to a tapped word. */
  onTextLayout?: (lines: TextLineLayout[]) => void;
  /**
   * Native selection changed, in COMPILED text offsets. Use `verseAtOffset` to map
   * a bound back to a verse.
   *
   * The platform owns the selection visual, handles and Copy menu; this is for the
   * app's own affordances on top, e.g. the Define button.
   */
  onSelectionChange?: (selection: TextSelectionRange) => void;
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
    onTextLayout,
    onSelectionChange,
    testID,
  } = props;

  const compiled = useMemo(
    () =>
      compileParagraph({
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

  const height = useMemo(() => {
    // Only the ranges that change metrics matter to measurement. Underlines and
    // backgrounds are drawn over the glyphs and cannot change line breaking, so
    // including them would evict the native cache on every highlight toggle for
    // no benefit.
    const metricRanges = compiled.ranges.filter(
      (r) => r.fontScale !== undefined || r.baselineShift !== undefined || r.fontWeight !== undefined
    );
    return measureTextHeight({
      text: compiled.text,
      ranges: metricRanges,
      width,
      fontSize,
      fontFamily,
      fontWeight,
      lineHeight,
      letterSpacing,
      textAlign,
    });
  }, [
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

  const handleRangeTap = useCallback(
    (index: number) => {
      const target = compiled.targets[index];
      if (!target) return;
      switch (target.kind) {
        case 'lexicon':
          onLexiconWordPress?.({
            surface: target.surface,
            token: target.token,
            entry: target.entry,
            isTheme: target.isTheme,
          });
          break;
        case 'highlight':
          onHighlightTap?.(target.highlightId);
          break;
        case 'autoHighlight':
          onAutoHighlightPress?.(target.autoHighlight);
          break;
      }
    },
    [compiled.targets, onLexiconWordPress, onHighlightTap, onAutoHighlightPress]
  );

  const handlePress = useCallback(
    (event: { charOffset: number }) => {
      if (!onVerseTap) return;
      const verseNumber = verseAtOffset(compiled, event.charOffset);
      // Null only for an empty paragraph; firing with a bogus verse number would
      // open the wrong insight, so do nothing.
      if (verseNumber !== null) onVerseTap(verseNumber);
    },
    [compiled, onVerseTap]
  );

  return (
    <VMText
      height={height ?? undefined}
      onPress={onVerseTap ? handlePress : undefined}
      onRangeTap={handleRangeTap}
      onSelectionChange={onSelectionChange}
      onTextLayout={onTextLayout}
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
