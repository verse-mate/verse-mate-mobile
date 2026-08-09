/**
 * Compile VerseMate's domain model into one flat string plus decoration ranges.
 *
 * ## What this replaces
 *
 * `HighlightedText` currently expresses every decoration as nested RN `<Text>`
 * elements — one or two per *word*. A five-verse paragraph becomes 160-290
 * shadow nodes, a chapter 1,000-3,000, and Android re-flattens the whole nested
 * tree into a single `Spannable` on every commit. That is the cost this project
 * removes.
 *
 * Here the same information becomes data: a string and a flat `TextRange[]`.
 * Rendering it is one native view.
 *
 * ## Why a pure function
 *
 * Every decoration rule in the app — highlight boundaries across verse edges,
 * lexicon single/multi-word matching, red-letter, verse-number superscripts,
 * selection — is currently entangled with JSX and therefore only testable
 * through a renderer. As a pure function it is testable in Jest with no device,
 * which is what makes the native layer safe to build on top of.
 */

import type { TextRange } from '@/modules/versemate-text';
import { getHighlightColor } from '@/constants/highlight-colors';
import type {
  CompiledParagraph,
  CompileHighlight,
  CompileTheme,
  CompileVerse,
  ParagraphInput,
  RangeTarget,
  VerseSpan,
} from './types';
import { buildLexIndex, expandToMatchUnits, matchLexicon, tokenize } from './tokenize';

/**
 * Layer order. Ranges are emitted sorted by layer, and the native side applies
 * them in array order, so a higher layer wins on any attribute it sets.
 *
 * Making this an explicit constant is a behaviour fix in itself: the nested
 * `<Text>` tree resolves overlaps implicitly, by whatever nesting the render
 * path happened to produce.
 */
export const RANGE_LAYER = {
  /** AI-generated theme highlights sit lowest — a user highlight must win. */
  autoHighlight: 0,
  highlight: 1,
  /** Words of Jesus: sets color only, so it composes with a highlight background. */
  redLetter: 2,
  verseNumber: 3,
  /** Underlines never conflict with backgrounds, but must sit above red-letter. */
  lexicon: 4,
  /** Selection washes over everything. */
  selection: 5,
} as const;

/** Opacity applied to user highlight backgrounds. */
const HIGHLIGHT_OPACITY = 0.35;
/** Auto-highlights are lighter so they read as suggestions, not user intent. */
const AUTO_HIGHLIGHT_OPACITY = 0.2;

/** Superscript verse numbers: 70% size, raised by a third of the base size. */
const VERSE_NUMBER_SCALE = 0.7;
const VERSE_NUMBER_BASELINE_SHIFT = 0.33;

/** Non-breaking space after a verse number, so it never wraps away from its verse. */
const NBSP = ' ';

interface Emitted {
  layer: number;
  range: TextRange;
  target: RangeTarget | null;
}

/**
 * Compile a paragraph.
 *
 * Verses are joined with a single space. Verse numbers, when included, are
 * rendered as their literal digits and styled into a superscript by a range —
 * rather than the Unicode superscript characters the current renderer uses.
 * Unicode superscripts are not selectable as numbers, break copy/paste, and read
 * poorly to screen readers; a styled range keeps the digits real.
 */
export function compileParagraph(input: ParagraphInput): CompiledParagraph {
  const {
    verses,
    highlights = [],
    autoHighlights = [],
    alignment = null,
    redLetterVerses,
    showLexUnderlines = true,
    includeVerseNumbers = true,
    selection = null,
    theme,
  } = input;

  const parts: string[] = [];
  const verseSpans: VerseSpan[] = [];
  const emitted: Emitted[] = [];
  let cursor = 0;

  verses.forEach((verse, i) => {
    if (i > 0) {
      parts.push(' ');
      cursor += 1;
    }

    const start = cursor;
    let textStart = cursor;

    if (includeVerseNumbers) {
      const label = String(verse.verseNumber);
      parts.push(label, NBSP);
      emitted.push({
        layer: RANGE_LAYER.verseNumber,
        range: {
          start: cursor,
          end: cursor + label.length,
          fontScale: VERSE_NUMBER_SCALE,
          baselineShift: VERSE_NUMBER_BASELINE_SHIFT,
          color: theme.verseNumberColor,
          tag: `verse-number:${verse.verseNumber}`,
        },
        target: null,
      });
      cursor += label.length + NBSP.length;
      textStart = cursor;
    }

    parts.push(verse.text);
    cursor += verse.text.length;

    verseSpans.push({ verseNumber: verse.verseNumber, start, end: cursor, textStart });
  });

  const text = parts.join('');

  for (const span of verseSpans) {
    const verse = verses.find((v) => v.verseNumber === span.verseNumber) as CompileVerse;

    emitAutoHighlights(emitted, span, autoHighlights, theme);
    emitHighlights(emitted, span, verse, highlights, theme);
    emitRedLetter(emitted, span, redLetterVerses, theme);
    emitLexicon(emitted, span, verse, alignment, showLexUnderlines, theme);
  }

  if (selection && selection.end > selection.start) {
    emitted.push({
      layer: RANGE_LAYER.selection,
      range: {
        start: selection.start,
        end: selection.end,
        backgroundColor: theme.selectionColor,
        tag: 'selection',
      },
      target: null,
    });
  }

  // Stable sort by layer. Within a layer the emission order is preserved, which
  // keeps document order for same-layer ranges (two highlights in one verse).
  emitted.sort((a, b) => a.layer - b.layer);

  return {
    text,
    ranges: emitted.map((e) => e.range),
    targets: emitted.map((e) => e.target),
    verses: verseSpans,
  };
}

// ---------------------------------------------------------------------------

/**
 * Auto-highlights cover whole verses — the API carries no character precision —
 * so one range spans the verse body.
 */
function emitAutoHighlights(
  out: Emitted[],
  span: VerseSpan,
  autoHighlights: ParagraphInput['autoHighlights'],
  theme: CompileTheme
): void {
  for (const auto of autoHighlights ?? []) {
    if (auto.start_verse > span.verseNumber || auto.end_verse < span.verseNumber) continue;
    out.push({
      layer: RANGE_LAYER.autoHighlight,
      range: {
        start: span.textStart,
        end: span.end,
        backgroundColor: withOpacity(
          getHighlightColor(auto.theme_color, theme.mode),
          AUTO_HIGHLIGHT_OPACITY
        ),
        interactive: true,
        tag: `auto-highlight:${auto.auto_highlight_id}`,
      },
      target: {
        kind: 'autoHighlight',
        verseNumber: span.verseNumber,
        autoHighlight: auto,
      },
    });
  }
}

/**
 * User highlights, which do carry character precision and may span verses.
 *
 * The clamping below is where the current renderer's four-branch conditional
 * lived. Expressed against the compiled offsets it reduces to: clamp the
 * highlight's character range to this verse's body, treating a null char bound
 * as "the whole verse".
 */
function emitHighlights(
  out: Emitted[],
  span: VerseSpan,
  verse: CompileVerse,
  highlights: CompileHighlight[],
  theme: CompileTheme
): void {
  const relevant = highlights
    .filter((h) => h.start_verse <= span.verseNumber && h.end_verse >= span.verseNumber)
    // Document order, so two highlights in one verse emit in reading order.
    // Coerced through the same narrowing as the bounds themselves — sorting on the
    // raw `unknown` would compare a string lexically and reorder them.
    .sort((a, b) => (asFiniteNumber(a.start_char) ?? 0) - (asFiniteNumber(b.start_char) ?? 0));

  for (const highlight of relevant) {
    const startChar = asFiniteNumber(highlight.start_char);
    const endChar = asFiniteNumber(highlight.end_char);
    const hasCharPrecision = startChar !== null && endChar !== null;

    // Offsets are relative to the verse's own text, so they need the verse's
    // body offset added to reach compiled coordinates.
    let from = 0;
    let to = verse.text.length;
    if (hasCharPrecision) {
      const isFirst = span.verseNumber === highlight.start_verse;
      const isLast = span.verseNumber === highlight.end_verse;
      if (isFirst) from = startChar;
      if (isLast) to = endChar;
    }

    // A stored offset can exceed the current text: the user may have highlighted
    // against a different Bible version. Clamp rather than emit an out-of-range
    // range the native side would have to defend against.
    from = clamp(from, 0, verse.text.length);
    to = clamp(to, from, verse.text.length);
    if (to <= from) continue;

    out.push({
      layer: RANGE_LAYER.highlight,
      range: {
        start: span.textStart + from,
        end: span.textStart + to,
        backgroundColor: withOpacity(
          getHighlightColor(highlight.color, theme.mode),
          HIGHLIGHT_OPACITY
        ),
        interactive: true,
        tag: `highlight:${highlight.highlight_id}`,
      },
      target: {
        kind: 'highlight',
        verseNumber: span.verseNumber,
        highlightId: highlight.highlight_id,
      },
    });
  }
}

/**
 * Words of Jesus. Colors the verse body only — the superscript number is not
 * part of the quotation, and the current renderer colors it by accident of
 * cascade.
 */
function emitRedLetter(
  out: Emitted[],
  span: VerseSpan,
  redLetterVerses: ReadonlySet<number> | undefined,
  theme: CompileTheme
): void {
  if (!redLetterVerses?.has(span.verseNumber)) return;
  out.push({
    layer: RANGE_LAYER.redLetter,
    range: {
      start: span.textStart,
      end: span.end,
      color: theme.redLetterColor,
      tag: `red-letter:${span.verseNumber}`,
    },
    target: null,
  });
}

/**
 * Lexicon underlines, one range per match.
 *
 * A multi-word match emits ONE range spanning the whole phrase, so the underline
 * reads as continuous. That is the current shipped behaviour (Andy's coalesce
 * request), and it is preserved here rather than quietly changed — the operator
 * has since questioned whether coalescing is right for whitespace-separated
 * phrases like "seventh day", but that is a design decision, not a port detail.
 * Switching it later means emitting one range per unit instead, which this
 * structure already supports.
 */
function emitLexicon(
  out: Emitted[],
  span: VerseSpan,
  verse: CompileVerse,
  alignment: ParagraphInput['alignment'],
  showUnderlines: boolean,
  theme: CompileTheme
): void {
  const index = buildLexIndex(alignment, span.verseNumber);
  if (!index) return;

  const tokens = tokenize(verse.text);
  const units = expandToMatchUnits(verse.text, tokens);
  const matches = matchLexicon(verse.text, units, index);

  for (const match of matches) {
    out.push({
      layer: RANGE_LAYER.lexicon,
      range: {
        start: span.textStart + match.start,
        end: span.textStart + match.end,
        // Taps stay live when underlines are hidden: the setting controls the
        // decoration, not the feature (MOBILE-1001 #7).
        underline: showUnderlines
          ? {
              style: theme.lexUnderlineStyle,
              color: match.hit.isTheme ? theme.lexUnderlineThemeColor : theme.lexUnderlineColor,
              thickness: theme.lexUnderlineThickness,
            }
          : undefined,
        interactive: true,
        tag: `lexicon:${span.verseNumber}:${match.start}`,
      },
      target: {
        kind: 'lexicon',
        verseNumber: span.verseNumber,
        surface: match.surface,
        token: match.hit.token,
        entry: match.hit.entry,
        isTheme: match.hit.isTheme,
      },
    });
  }
}

// ---------------------------------------------------------------------------

/**
 * Resolve which verse a character offset falls in.
 *
 * This is what makes one native view per paragraph possible: a plain-text tap
 * reports an offset, and the verse is looked up here rather than inferred from
 * which of many per-verse nodes was hit.
 */
export function verseAtOffset(compiled: CompiledParagraph, offset: number): number | null {
  // Return the last verse that starts at or before the offset, rather than only
  // matching strictly inside a verse's span. Verses are separated by a joining
  // space and a tap can also land past the final character (trailing whitespace,
  // or the blank remainder of the last line) — those offsets belong to the
  // preceding verse, not to nothing. Resolving them to null would make the tap
  // silently do nothing, which is exactly the class of dead-tap the per-verse
  // node tree avoided by accident.
  let found: number | null = null;
  for (const span of compiled.verses) {
    if (span.start > offset) break;
    found = span.verseNumber;
  }
  return found;
}

/** Append an 8-bit alpha channel to a `#rrggbb` color. */
function withOpacity(hexColor: string, opacity: number): string {
  const alpha = Math.round(opacity * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hexColor}${alpha}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Coerce an untyped API value to a usable character offset, or null.
 *
 * The generated `Highlight` type leaves `start_char`/`end_char` as `unknown`.
 * Numeric strings are accepted because JSON from an older API revision could
 * carry them; anything else — including NaN, which would poison every downstream
 * comparison silently — becomes null and is treated as "no character precision",
 * i.e. the whole verse. Losing precision is a visible, recoverable degradation;
 * a NaN offset produces a highlight that renders nowhere.
 */
function asFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
