/**
 * Tests for the paragraph range compiler.
 *
 * This is the file that makes the native swap safe. Every decoration rule that
 * currently only exists as JSX nesting inside `HighlightedText` is asserted here
 * as data, so Phase 4 can replace the renderer and rely on the decorations being
 * identical rather than hoping so.
 */

import type { AlignedToken, ChapterAlignment, LexEntry } from '@versemate/lexicon';
import { compileParagraph, RANGE_LAYER, verseAtOffset } from '@/lib/text/compile-paragraph';
import type {
  CompiledParagraph,
  CompileHighlight,
  CompileTheme,
  ParagraphInput,
} from '@/lib/text/types';
import type { AutoHighlight } from '@/types/auto-highlights';

const THEME: CompileTheme = {
  mode: 'light',
  lexUnderlineColor: 'rgba(176,154,109,0.55)',
  lexUnderlineThemeColor: 'rgba(199,176,116,0.75)',
  lexUnderlineThickness: 1,
  lexUnderlineStyle: 'dotted',
  redLetterColor: '#c1121f',
  selectionColor: '#3390FF40',
};

function compile(overrides: Partial<ParagraphInput> = {}): CompiledParagraph {
  return compileParagraph({
    verses: [{ verseNumber: 1, text: 'In the beginning God created.' }],
    theme: THEME,
    ...overrides,
  });
}

function highlight(over: Partial<CompileHighlight> = {}): CompileHighlight {
  return {
    highlight_id: 1,
    start_verse: 1,
    end_verse: 1,
    start_char: null,
    end_char: null,
    color: 'yellow',
    ...over,
  };
}

function autoHighlight(over: Partial<AutoHighlight> = {}): AutoHighlight {
  return {
    auto_highlight_id: 10,
    theme_id: 2,
    theme_name: 'Key Verses',
    theme_color: 'blue',
    book_id: 1,
    chapter_number: 1,
    start_verse: 1,
    end_verse: 1,
    relevance_score: 1,
    ...over,
  } as AutoHighlight;
}

function alignmentFor(
  verseNumber: number,
  surfaces: Record<string, string | string[]>,
  themeLemmas: string[] = []
): ChapterAlignment {
  const tokens: AlignedToken[] = [];
  const lexicon: Record<string, LexEntry> = {};
  for (const [lemma, surface] of Object.entries(surfaces)) {
    tokens.push({ lemma, surface } as unknown as AlignedToken);
    lexicon[lemma] = { translit: `t-${lemma}`, basicGloss: 'gloss' } as unknown as LexEntry;
  }
  return { verses: { [verseNumber]: tokens }, lexicon, themeLemmas } as unknown as ChapterAlignment;
}

/** All ranges carrying the given tag prefix, with the text they cover. */
function taggedRanges(compiled: CompiledParagraph, prefix: string) {
  return compiled.ranges
    .map((r, i) => ({ ...r, index: i, covers: compiled.text.slice(r.start, r.end) }))
    .filter((r) => r.tag?.startsWith(prefix));
}

describe('compileParagraph — text assembly', () => {
  it('emits verse numbers as real digits, styled into a superscript', () => {
    const out = compile();
    // Real digits rather than Unicode superscript characters: those are not
    // selectable as numbers, break copy/paste, and read badly to screen readers.
    expect(out.text).toBe('1 In the beginning God created.');

    const [number] = taggedRanges(out, 'verse-number:');
    expect(number.covers).toBe('1');
    expect(number.fontScale).toBeLessThan(1);
    expect(number.baselineShift).toBeGreaterThan(0);
  });

  it('separates the verse number from the text with a non-breaking space', () => {
    // A normal space lets the number wrap to the end of a line, orphaned from
    // its verse.
    expect(compile().text).toContain('1 In');
  });

  it('joins multiple verses with a single space and records their spans', () => {
    const out = compile({
      verses: [
        { verseNumber: 1, text: 'Alpha.' },
        { verseNumber: 2, text: 'Beta.' },
      ],
    });

    expect(out.text).toBe('1 Alpha. 2 Beta.');
    expect(out.verses).toEqual([
      { verseNumber: 1, start: 0, end: 8, textStart: 2 },
      { verseNumber: 2, start: 9, end: 16, textStart: 11 },
    ]);
    expect(out.text.slice(out.verses[1].textStart, out.verses[1].end)).toBe('Beta.');
  });

  it('omits verse numbers when asked', () => {
    const out = compile({ includeVerseNumbers: false });
    expect(out.text).toBe('In the beginning God created.');
    expect(taggedRanges(out, 'verse-number:')).toHaveLength(0);
    expect(out.verses[0]).toMatchObject({ start: 0, textStart: 0 });
  });

  it('handles multi-digit verse numbers', () => {
    const out = compile({ verses: [{ verseNumber: 176, text: 'Let my cry come.' }] });
    expect(out.text).toBe('176 Let my cry come.');
    expect(taggedRanges(out, 'verse-number:')[0].covers).toBe('176');
    expect(out.verses[0].textStart).toBe(4);
  });

  it('produces no ranges for plain text with nothing applied', () => {
    const out = compile({ includeVerseNumbers: false });
    expect(out.ranges).toEqual([]);
    expect(out.targets).toEqual([]);
  });

  it('accepts an empty verse list', () => {
    const out = compile({ verses: [] });
    expect(out.text).toBe('');
    expect(out.ranges).toEqual([]);
    expect(out.verses).toEqual([]);
  });
});

describe('compileParagraph — user highlights', () => {
  it('covers the verse body but not its number when no char range is given', () => {
    const out = compile({ highlights: [highlight()] });
    const [hl] = taggedRanges(out, 'highlight:');
    // Highlighting the superscript number is a visual bug — the number is not
    // part of what the user selected.
    expect(hl.covers).toBe('In the beginning God created.');
  });

  it('honours character precision within a verse', () => {
    const out = compile({ highlights: [highlight({ start_char: 3, end_char: 16 })] });
    expect(taggedRanges(out, 'highlight:')[0].covers).toBe('the beginning');
  });

  it('runs to the end of the first verse of a multi-verse highlight', () => {
    const out = compile({
      verses: [
        { verseNumber: 1, text: 'Alpha beta.' },
        { verseNumber: 2, text: 'Gamma delta.' },
      ],
      highlights: [highlight({ start_verse: 1, end_verse: 2, start_char: 6, end_char: 5 })],
    });

    const ranges = taggedRanges(out, 'highlight:');
    expect(ranges.map((r) => r.covers)).toEqual(['beta.', 'Gamma']);
  });

  it('covers a whole middle verse of a three-verse highlight', () => {
    const out = compile({
      verses: [
        { verseNumber: 1, text: 'One.' },
        { verseNumber: 2, text: 'Two.' },
        { verseNumber: 3, text: 'Three.' },
      ],
      highlights: [highlight({ start_verse: 1, end_verse: 3, start_char: 1, end_char: 5 })],
    });
    expect(taggedRanges(out, 'highlight:').map((r) => r.covers)).toEqual(['ne.', 'Two.', 'Three']);
  });

  it('ignores highlights outside the paragraph', () => {
    const out = compile({ highlights: [highlight({ start_verse: 5, end_verse: 6 })] });
    expect(taggedRanges(out, 'highlight:')).toHaveLength(0);
  });

  it('clamps a stored offset that overruns the current text', () => {
    // Highlights are stored per chapter+verse, not per Bible version, so a
    // shorter translation can leave an offset past the end of the verse.
    const out = compile({ highlights: [highlight({ start_char: 3, end_char: 9999 })] });
    const [hl] = taggedRanges(out, 'highlight:');
    expect(hl.end).toBeLessThanOrEqual(out.text.length);
    expect(hl.covers).toBe('the beginning God created.');
  });

  it('falls back to the whole verse for a non-numeric char bound', () => {
    // The generated API type leaves these `unknown`. A NaN offset would produce a
    // highlight that renders nowhere and gives no clue why, so an unusable bound
    // degrades to whole-verse instead.
    const out = compile({
      highlights: [highlight({ start_char: 'oops' as unknown as number, end_char: 12 })],
    });
    expect(taggedRanges(out, 'highlight:')[0].covers).toBe('In the beginning God created.');
  });

  it('accepts a numeric string char bound', () => {
    const out = compile({
      highlights: [
        highlight({ start_char: '3' as unknown as number, end_char: '16' as unknown as number }),
      ],
    });
    expect(taggedRanges(out, 'highlight:')[0].covers).toBe('the beginning');
  });

  it('drops a highlight that clamps to nothing', () => {
    const out = compile({ highlights: [highlight({ start_char: 500, end_char: 600 })] });
    expect(taggedRanges(out, 'highlight:')).toHaveLength(0);
  });

  it('emits multiple highlights in one verse in document order', () => {
    const out = compile({
      highlights: [
        highlight({ highlight_id: 2, start_char: 17, end_char: 20, color: 'green' }),
        highlight({ highlight_id: 1, start_char: 3, end_char: 6 }),
      ],
    });
    expect(taggedRanges(out, 'highlight:').map((r) => r.covers)).toEqual(['the', 'God']);
  });

  it('resolves the tapped range to the highlight id', () => {
    const out = compile({ highlights: [highlight({ highlight_id: 42 })] });
    const [hl] = taggedRanges(out, 'highlight:');
    expect(out.targets[hl.index]).toEqual({
      kind: 'highlight',
      verseNumber: 1,
      highlightId: 42,
    });
    expect(hl.interactive).toBe(true);
  });

  it('uses the dark palette in dark mode', () => {
    const light = compile({ highlights: [highlight()] });
    const dark = compile({ highlights: [highlight()], theme: { ...THEME, mode: 'dark' } });
    expect(taggedRanges(light, 'highlight:')[0].backgroundColor).not.toBe(
      taggedRanges(dark, 'highlight:')[0].backgroundColor
    );
  });
});

describe('compileParagraph — auto-highlights', () => {
  it('covers the whole verse body and is lighter than a user highlight', () => {
    const out = compile({ autoHighlights: [autoHighlight()], highlights: [highlight()] });
    const [auto] = taggedRanges(out, 'auto-highlight:');
    const [user] = taggedRanges(out, 'highlight:');

    expect(auto.covers).toBe('In the beginning God created.');
    // Auto-highlights read as suggestions, so they carry lower alpha.
    expect(alphaOf(auto.backgroundColor!)).toBeLessThan(alphaOf(user.backgroundColor!));
  });

  it('is layered below user highlights so the user wins on overlap', () => {
    const out = compile({ autoHighlights: [autoHighlight()], highlights: [highlight()] });
    const auto = taggedRanges(out, 'auto-highlight:')[0].index;
    const user = taggedRanges(out, 'highlight:')[0].index;
    // Later index = applied later = wins.
    expect(auto).toBeLessThan(user);
  });

  it('resolves the tapped range to the auto-highlight', () => {
    const auto = autoHighlight({ auto_highlight_id: 77 });
    const out = compile({ autoHighlights: [auto] });
    const target = out.targets[taggedRanges(out, 'auto-highlight:')[0].index];
    expect(target).toMatchObject({ kind: 'autoHighlight', verseNumber: 1 });
    expect((target as { autoHighlight: AutoHighlight }).autoHighlight.auto_highlight_id).toBe(77);
  });
});

describe('compileParagraph — red letter', () => {
  it('colors only the verse body of a listed verse', () => {
    const out = compile({
      verses: [
        { verseNumber: 1, text: 'Narration.' },
        { verseNumber: 2, text: 'I am the way.' },
      ],
      redLetterVerses: new Set([2]),
    });

    const ranges = taggedRanges(out, 'red-letter:');
    expect(ranges).toHaveLength(1);
    expect(ranges[0].covers).toBe('I am the way.');
    expect(ranges[0].color).toBe(THEME.redLetterColor);
  });

  it('composes with a highlight background rather than replacing it', () => {
    const out = compile({ redLetterVerses: new Set([1]), highlights: [highlight()] });
    const red = taggedRanges(out, 'red-letter:')[0];
    const hl = taggedRanges(out, 'highlight:')[0];
    // Red letter sets color only; the highlight sets background only.
    expect(red.backgroundColor).toBeUndefined();
    expect(hl.color).toBeUndefined();
    expect(red.index).toBeGreaterThan(hl.index);
  });

  it('emits nothing when the toggle is off', () => {
    expect(taggedRanges(compile(), 'red-letter:')).toHaveLength(0);
  });
});

describe('compileParagraph — lexicon', () => {
  const align = alignmentFor(1, { G1: 'beginning' });

  it('underlines a matched word with the regular color', () => {
    const out = compile({ alignment: align });
    const [lex] = taggedRanges(out, 'lexicon:');
    expect(lex.covers).toBe('beginning');
    expect(lex.underline).toEqual({
      style: 'dotted',
      color: THEME.lexUnderlineColor,
      thickness: 1,
    });
  });

  it('uses the brighter color for a theme lemma', () => {
    const out = compile({ alignment: alignmentFor(1, { G1: 'beginning' }, ['G1']) });
    expect(taggedRanges(out, 'lexicon:')[0].underline?.color).toBe(THEME.lexUnderlineThemeColor);
  });

  it('keeps taps live but drops the underline when underlines are off', () => {
    // MOBILE-1001 #7 turns off the decoration, not the feature.
    const out = compile({ alignment: align, showLexUnderlines: false });
    const [lex] = taggedRanges(out, 'lexicon:');
    expect(lex.underline).toBeUndefined();
    expect(lex.interactive).toBe(true);
  });

  it('offsets matches into compiled coordinates, past the verse number', () => {
    const out = compile({ alignment: align });
    const [lex] = taggedRanges(out, 'lexicon:');
    // Would be 7 in verse-local coordinates; the "1 " prefix shifts it.
    expect(lex.start).toBe(out.verses[0].textStart + 7);
    expect(out.text.slice(lex.start, lex.end)).toBe('beginning');
  });

  it('resolves a tapped range to its lexicon entry', () => {
    const out = compile({ alignment: align });
    const target = out.targets[taggedRanges(out, 'lexicon:')[0].index];
    expect(target).toMatchObject({
      kind: 'lexicon',
      verseNumber: 1,
      surface: 'beginning',
      isTheme: false,
    });
  });

  it('emits one continuous range for a multi-word phrase', () => {
    // Current shipped behaviour (Andy's coalesce request). Preserved on purpose:
    // whether whitespace-separated phrases SHOULD coalesce is a design question,
    // not a port detail.
    const out = compile({
      verses: [{ verseNumber: 1, text: 'Submit yourselves therefore to God.' }],
      alignment: alignmentFor(1, { G5293: 'Submit yourselves' }),
    });
    const ranges = taggedRanges(out, 'lexicon:');
    expect(ranges).toHaveLength(1);
    expect(ranges[0].covers).toBe('Submit yourselves');
  });

  it('stops the underline before trailing punctuation', () => {
    const out = compile({
      verses: [{ verseNumber: 1, text: 'Consider it pure joy, brothers.' }],
      alignment: alignmentFor(1, { G5479: 'joy' }),
    });
    expect(taggedRanges(out, 'lexicon:')[0].covers).toBe('joy');
  });

  it('matches per verse, not across the paragraph', () => {
    const out = compile({
      verses: [
        { verseNumber: 1, text: 'joy abounds' },
        { verseNumber: 2, text: 'joy remains' },
      ],
      // Only verse 2 has an alignment entry.
      alignment: alignmentFor(2, { G5479: 'joy' }),
    });
    const ranges = taggedRanges(out, 'lexicon:');
    expect(ranges).toHaveLength(1);
    expect(ranges[0].start).toBeGreaterThanOrEqual(out.verses[1].textStart);
  });

  it('emits nothing without an alignment', () => {
    expect(taggedRanges(compile({ alignment: null }), 'lexicon:')).toHaveLength(0);
  });
});

describe('compileParagraph — selection', () => {
  it('washes over everything else', () => {
    const out = compile({
      highlights: [highlight()],
      alignment: alignmentFor(1, { G1: 'beginning' }),
      selection: { start: 2, end: 8 },
    });
    const [selection] = taggedRanges(out, 'selection');
    expect(selection.index).toBe(out.ranges.length - 1);
    expect(selection.backgroundColor).toBe(THEME.selectionColor);
  });

  it('ignores an empty or inverted selection', () => {
    expect(taggedRanges(compile({ selection: { start: 5, end: 5 } }), 'selection')).toHaveLength(0);
    expect(taggedRanges(compile({ selection: { start: 9, end: 4 } }), 'selection')).toHaveLength(0);
    expect(taggedRanges(compile({ selection: null }), 'selection')).toHaveLength(0);
  });
});

describe('compileParagraph — layering', () => {
  it('emits ranges in ascending layer order', () => {
    const out = compile({
      verses: [{ verseNumber: 1, text: 'In the beginning God created.' }],
      autoHighlights: [autoHighlight()],
      highlights: [highlight()],
      redLetterVerses: new Set([1]),
      alignment: alignmentFor(1, { G1: 'beginning' }),
      selection: { start: 2, end: 8 },
    });

    const layerOf = (tag: string): number => {
      if (tag.startsWith('auto-highlight:')) return RANGE_LAYER.autoHighlight;
      if (tag.startsWith('highlight:')) return RANGE_LAYER.highlight;
      if (tag.startsWith('red-letter:')) return RANGE_LAYER.redLetter;
      if (tag.startsWith('verse-number:')) return RANGE_LAYER.verseNumber;
      if (tag.startsWith('lexicon:')) return RANGE_LAYER.lexicon;
      return RANGE_LAYER.selection;
    };

    const layers = out.ranges.map((r) => layerOf(r.tag as string));
    expect(layers).toEqual([...layers].sort((a, b) => a - b));
    // All six decoration kinds present, so the ordering assertion is meaningful.
    expect(new Set(layers).size).toBe(6);
  });

  it('keeps ranges and targets the same length', () => {
    const out = compile({
      autoHighlights: [autoHighlight()],
      highlights: [highlight()],
      alignment: alignmentFor(1, { G1: 'beginning' }),
      redLetterVerses: new Set([1]),
    });
    expect(out.targets).toHaveLength(out.ranges.length);
  });

  it('keeps every range inside the compiled text', () => {
    const out = compile({
      verses: [
        { verseNumber: 1, text: 'In the beginning God created.' },
        { verseNumber: 2, text: 'And the earth was formless.' },
      ],
      highlights: [highlight({ start_verse: 1, end_verse: 2, start_char: 3, end_char: 9 })],
      autoHighlights: [autoHighlight({ end_verse: 2 })],
      alignment: alignmentFor(2, { G2: 'earth' }),
      redLetterVerses: new Set([2]),
    });

    for (const range of out.ranges) {
      expect(range.start).toBeGreaterThanOrEqual(0);
      expect(range.end).toBeLessThanOrEqual(out.text.length);
      expect(range.end).toBeGreaterThan(range.start);
    }
  });
});

describe('verseAtOffset', () => {
  const out = compileParagraph({
    verses: [
      { verseNumber: 4, text: 'Alpha.' },
      { verseNumber: 5, text: 'Beta.' },
    ],
    theme: THEME,
  });

  it('resolves an offset inside each verse', () => {
    expect(verseAtOffset(out, 0)).toBe(4);
    expect(verseAtOffset(out, 3)).toBe(4);
    expect(verseAtOffset(out, out.verses[1].textStart)).toBe(5);
  });

  it('attributes the separator space to the preceding verse', () => {
    expect(verseAtOffset(out, out.verses[0].end)).toBe(4);
  });

  it('attributes a tap past the end to the last verse', () => {
    // Tapping the empty area after the final line must still open that verse
    // rather than doing nothing.
    expect(verseAtOffset(out, out.text.length + 50)).toBe(5);
  });

  it('returns null for an empty paragraph', () => {
    expect(verseAtOffset(compileParagraph({ verses: [], theme: THEME }), 0)).toBeNull();
  });
});

/** Parse the trailing 8-bit alpha from a `#rrggbbaa` color. */
function alphaOf(color: string): number {
  return Number.parseInt(color.slice(-2), 16);
}
