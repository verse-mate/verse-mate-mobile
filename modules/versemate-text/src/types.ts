/**
 * Public types for `@versemate/text`.
 *
 * ## Scope discipline
 *
 * Nothing here knows about Bibles, verses, lexicons, highlights or topics. This
 * is a generic "render a string with decorated character ranges, and tell me
 * where it was tapped" primitive.
 *
 * That boundary is the whole point. Domain knowledge lives in `lib/text/`, which
 * compiles verses + highlights + lexicon alignment into a flat string plus
 * `TextRange[]`. Because the compiler is pure TypeScript it is testable without
 * a device, and because the native side is generic it is reusable by the Bible
 * reader, Topics, Study and rendered markdown alike.
 *
 * If you find yourself wanting to add `verseNumber` to `TextRange`, add a `tag`
 * instead and resolve it on the JS side.
 */

/** How a range's underline is drawn. */
export type UnderlineStyle = 'solid' | 'dotted' | 'dashed';

/** Underline description. Separate from `TextRange` so it can be omitted wholly. */
export interface RangeUnderline {
  style: UnderlineStyle;
  /** Any color string the platform accepts, including `rgba(...)`. */
  color: string;
  /** Thickness in dp/pt. Fractional values are honoured — this is drawn, not a system underline. */
  thickness: number;
}

/**
 * One decorated character range.
 *
 * `start` is inclusive, `end` exclusive — same convention as `String.slice`, so
 * `text.slice(start, end)` is exactly the decorated substring.
 *
 * ## Layering
 *
 * Ranges may overlap. They are applied in array order, so a later range wins on
 * any attribute it sets, exactly like layered `Spannable` spans on Android or
 * `NSAttributedString` attributes on iOS. Callers are responsible for emitting
 * them in the intended order; `lib/text` does this via an explicit layer
 * constant rather than leaving it to chance.
 */
export interface TextRange {
  start: number;
  end: number;

  underline?: RangeUnderline;
  backgroundColor?: string;
  /** Foreground text color. */
  color?: string;
  /** CSS-style weight: `'400'`, `'700'`, `'bold'`. */
  fontWeight?: string;
  fontStyle?: 'normal' | 'italic';

  /**
   * Font size multiplier relative to the view's base size, e.g. `0.7` for a
   * verse-number superscript. Relative rather than absolute so the range
   * survives the user changing their reader font size.
   */
  fontScale?: number;
  /**
   * Baseline offset as a multiple of the base font size. Positive raises the
   * text. Combined with `fontScale` this expresses super/subscript without a
   * platform-specific superscript flag — Android's `SuperscriptSpan` and iOS's
   * `NSBaselineOffset` disagree on magnitude, so the multiplier is the portable
   * unit.
   */
  baselineShift?: number;

  /**
   * Multiplier on this range's horizontal advance. 1 (or absent) means none.
   *
   * Widens the space the characters occupy WITHOUT touching line metrics:
   * `ScaleXSpan` on Android and `.kern` on iOS are both horizontal-only. The
   * platform's own offset lookup then honours the larger target, so this needs
   * no hit-testing code at all.
   *
   * It exists because a verse number is 6-17dp of glyph and needs a target of
   * at least 24dp, and the two obvious alternatives are both worse. `fontScale`
   * on the trailing space is metric-affecting VERTICALLY, so the scale needed to
   * reach the floor renders that space at ~69pt and makes its line five times
   * taller. A hit rectangle around the glyphs cannot reach the floor either: it
   * has to be clamped to the neighbouring glyph runs or it steals their taps,
   * and the whitespace inside that clamp is only about a quarter of the font
   * size, which left the real target at 12-22dp.
   *
   * A multiplier rather than a width so no density conversion is needed on
   * either side of the bridge.
   *
   * This DOES change layout: the gap after a verse number is genuinely wider.
   * That makes it metric-affecting horizontally, so it must be included in the
   * measurement request, or the paragraph measures short and the view clips.
   */
  advanceScale?: number;

  /**
   * When true, taps inside this range fire `onRangeTap` with the range's index
   * instead of falling through to `onPress`. Ranges that are purely decorative
   * (a highlight background, a red-letter color) leave this unset so a tap on
   * them still reads as a tap on the verse.
   */
  interactive?: boolean;

  /**
   * Opaque caller-defined label. The native side never interprets it; it exists
   * so a compiled range remains debuggable in a logged report, and so JS can
   * assert on intent in tests without reaching for indices.
   */
  tag?: string;
}

/** Line geometry reported back after layout, for anchoring popovers and tooltips. */
export interface TextLineLayout {
  /** Character offset where this line starts. */
  start: number;
  /** Character offset just past this line's last character. */
  end: number;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Distance from the line's top to its text baseline. */
  baseline: number;
}

/** Payload for `onSelectionChange`. */
export interface TextSelectionRange {
  /** Inclusive char offset, or -1 when the selection was cleared. */
  start: number;
  /** Exclusive char offset, or -1 when the selection was cleared. */
  end: number;
}

/** Payload for `onPress` — a tap that did not land on an interactive range. */
export interface TextPressEvent {
  /**
   * Character offset nearest the tap. Lets the caller resolve which verse was
   * tapped without needing a range per verse, which is the difference between
   * one node and one-node-per-verse.
   */
  charOffset: number;
  x: number;
  y: number;
}
