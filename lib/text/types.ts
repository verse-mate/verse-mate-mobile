/**
 * Input and output types for the paragraph range compiler.
 *
 * The compiler is the seam between VerseMate's domain model (verses, highlights,
 * lexicon alignment, red-letter) and the generic `@versemate/text` primitive. It
 * is a pure function, so all of the decoration logic that currently lives inside
 * `HighlightedText`'s render tree becomes testable without a renderer or a
 * device.
 */

import type { TextRange } from '@/modules/versemate-text';
import type { AlignedToken, ChapterAlignment, LexEntry } from '@versemate/lexicon';
import type { HighlightColor } from '@/constants/highlight-colors';
import type { AutoHighlight } from '@/types/auto-highlights';

/** One verse of source text. */
export interface CompileVerse {
  verseNumber: number;
  text: string;
}

/**
 * The subset of a user highlight the compiler needs.
 *
 * Structural rather than importing `Highlight` from `use-highlights`, which is a
 * generated API type — the compiler should not break when the API schema gains
 * an unrelated field, and tests should not need to construct one.
 */
export interface CompileHighlight {
  highlight_id: number;
  start_verse: number;
  end_verse: number;
  /** Null means "the whole verse", matching the API. */
  start_char?: number | null;
  end_char?: number | null;
  color: HighlightColor;
}

/** Colors and metrics the compiler cannot derive on its own. */
export interface CompileTheme {
  /** Light or dark — selects the highlight palette. */
  mode: 'light' | 'dark';
  /** Hairline underline for ordinary lexicon-covered words. */
  lexUnderlineColor: string;
  /** Brighter underline for chapter-spine ("theme") words. */
  lexUnderlineThemeColor: string;
  /** Underline thickness in dp. Fractional is fine — this is drawn, not a system underline. */
  lexUnderlineThickness: number;
  /** Underline style. Real dots are the point of the native renderer. */
  lexUnderlineStyle: 'solid' | 'dotted';
  /** Words-of-Jesus text color. */
  redLetterColor: string;
  /** Tap/selection wash. */
  selectionColor: string;
  /** Verse-number superscript color, when it should differ from body text. */
  verseNumberColor?: string;
}

/** Everything needed to compile one paragraph. */
export interface ParagraphInput {
  /** Verses in reading order. Joined into one string in this order. */
  verses: CompileVerse[];
  highlights?: CompileHighlight[];
  autoHighlights?: AutoHighlight[];
  /** Greek/Hebrew alignment for this chapter, or null when unavailable/non-English. */
  alignment?: ChapterAlignment | null;
  /** Verses spoken by Jesus, rendered in red when the toggle is on. */
  redLetterVerses?: ReadonlySet<number>;
  /** Whether lexicon underlines are drawn. Taps still work when false. */
  showLexUnderlines?: boolean;
  /** Render superscript verse numbers inline. False for single-verse layouts. */
  includeVerseNumbers?: boolean;
  /**
   * Active selection, as char offsets into the *compiled* paragraph text. Kept
   * in compiled space because that is what the native view reports back.
   */
  selection?: { start: number; end: number } | null;
  theme: CompileTheme;
}

/** What a tapped interactive range means. */
export type RangeTarget =
  | {
      kind: 'lexicon';
      verseNumber: number;
      /** The rendered surface form, e.g. `double-minded`. */
      surface: string;
      token: AlignedToken;
      entry: LexEntry;
      isTheme: boolean;
    }
  | { kind: 'highlight'; verseNumber: number; highlightId: number }
  | { kind: 'autoHighlight'; verseNumber: number; autoHighlight: AutoHighlight };

/** Where a verse landed in the compiled string. */
export interface VerseSpan {
  verseNumber: number;
  /** Offset of the verse's first character, including its superscript number. */
  start: number;
  /** Offset just past the verse's last character. */
  end: number;
  /** Offset where the verse's body text begins, i.e. after the superscript. */
  textStart: number;
}

/** Compiler output. */
export interface CompiledParagraph {
  /** The flat string to hand to the native view. */
  text: string;
  /**
   * Decoration ranges in layer order — see `RANGE_LAYER`. Index positions are
   * meaningful: the native view reports taps by index into this array.
   */
  ranges: TextRange[];
  /**
   * Domain meaning per range, parallel to `ranges`. Non-interactive ranges hold
   * null. Parallel array rather than a map so an index from native is a direct
   * lookup with no allocation.
   */
  targets: (RangeTarget | null)[];
  /** Verse boundaries, in `text` coordinates, in reading order. */
  verses: VerseSpan[];
}
