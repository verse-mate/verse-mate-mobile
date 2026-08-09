/**
 * Tests for tokenisation and lexicon matching.
 *
 * These encode the behaviour currently buried in `HighlightedText`'s render
 * path. Getting them right is what makes the native swap safe: if the compiler
 * derives the same decorations the JSX tree did, the only thing changing is how
 * they are drawn.
 */

import type { AlignedToken, ChapterAlignment, LexEntry } from '@versemate/lexicon';
import {
  buildLexIndex,
  expandToMatchUnits,
  matchLexicon,
  normalizeWord,
  tokenize,
} from '@/lib/text/tokenize';

/** Minimal lexicon entry — only the fields the compiler reads. */
function entry(translit: string, gloss = 'gloss'): LexEntry {
  return { translit, basicGloss: gloss } as unknown as LexEntry;
}

function token(lemma: string, surface: string | string[]): AlignedToken {
  return { lemma, surface } as unknown as AlignedToken;
}

/** Build a one-verse alignment. */
function alignment(
  verseNumber: number,
  tokens: AlignedToken[],
  themeLemmas: string[] = []
): ChapterAlignment {
  const lexicon: Record<string, LexEntry> = {};
  for (const t of tokens) lexicon[t.lemma] = entry(`translit-${t.lemma}`);
  return { verses: { [verseNumber]: tokens }, lexicon, themeLemmas } as unknown as ChapterAlignment;
}

/** Run the full match pipeline over a verse. */
function matchesIn(text: string, align: ChapterAlignment, verseNumber = 1) {
  const index = buildLexIndex(align, verseNumber);
  if (!index) return [];
  const units = expandToMatchUnits(text, tokenize(text));
  return matchLexicon(text, units, index);
}

describe('tokenize', () => {
  it('records raw and punctuation-free core offsets', () => {
    const text = 'Consider it pure joy, my brothers.';
    const tokens = tokenize(text);

    expect(tokens).toHaveLength(6);
    // "Consider it pure joy," -> `joy,` occupies [17, 21).
    expect(tokens[3]).toMatchObject({
      raw: 'joy,',
      start: 17,
      end: 21,
      coreStart: 17,
      coreEnd: 20,
    });
    // The core excludes the comma so an underline can stop before it, matching
    // web's per-word spans.
    expect(text.slice(tokens[3].coreStart, tokens[3].coreEnd)).toBe('joy');
  });

  it('strips leading punctuation from the core', () => {
    const text = 'he said "Come, follow me."';
    const tokens = tokenize(text);
    const quoted = tokens.find((t) => t.raw.startsWith('"'));
    expect(quoted).toBeDefined();
    expect(text.slice(quoted!.coreStart, quoted!.coreEnd)).toBe('Come');
  });

  it('keeps apostrophes and hyphens inside the core', () => {
    const text = "God's self-control";
    const tokens = tokenize(text);
    expect(text.slice(tokens[0].coreStart, tokens[0].coreEnd)).toBe("God's");
    expect(text.slice(tokens[1].coreStart, tokens[1].coreEnd)).toBe('self-control');
  });

  it('tracks trailing whitespace', () => {
    const tokens = tokenize('one two');
    expect(tokens[0].trailingSpace).toBe(true);
    expect(tokens[1].trailingSpace).toBe(false);
  });

  it('returns nothing for empty or whitespace-only input', () => {
    expect(tokenize('')).toEqual([]);
    expect(tokenize('   ')).toEqual([]);
  });

  it('handles a token that is entirely punctuation without inverting its core', () => {
    const tokens = tokenize('word ... word');
    const punct = tokens[1];
    expect(punct.raw).toBe('...');
    // Nothing survives stripping, so the core must be empty rather than negative.
    expect(punct.coreEnd).toBe(punct.coreStart);
  });
});

describe('normalizeWord', () => {
  it('lowercases and strips edge punctuation', () => {
    expect(normalizeWord('Trials,')).toBe('trials');
    expect(normalizeWord('"Come!"')).toBe('come');
    expect(normalizeWord('(brothers)')).toBe('brothers');
  });

  it('preserves internal hyphens and apostrophes', () => {
    expect(normalizeWord("God's")).toBe("god's");
    expect(normalizeWord('double-minded')).toBe('double-minded');
  });
});

describe('buildLexIndex', () => {
  it('returns null when the verse has no alignment', () => {
    expect(buildLexIndex(alignment(1, [token('l1', 'joy')]), 2)).toBeNull();
    expect(buildLexIndex(null, 1)).toBeNull();
  });

  it('indexes single-word surfaces', () => {
    const index = buildLexIndex(alignment(1, [token('G5479', 'joy')]), 1);
    expect(index?.single.has('joy')).toBe(true);
    expect(index?.multi.size).toBe(0);
  });

  it('indexes a hyphenated surface as multi-part, keyed by its first part', () => {
    const index = buildLexIndex(alignment(1, [token('G1374', 'double-minded')]), 1);
    expect(index?.single.size).toBe(0);
    expect(index?.multi.get('double')?.[0].parts).toEqual(['double', 'minded']);
  });

  it('registers every cross-translation surface variant', () => {
    // Newer @versemate/lexicon builds ship surface arrays. Missing a variant
    // silently drops the underline when the API serves a different translation.
    const index = buildLexIndex(
      alignment(1, [token('G5293', ['Submit', 'Submit yourselves', 'Be subject'])]),
      1
    );
    expect(index?.single.has('submit')).toBe(true);
    expect(index?.multi.get('submit')?.map((c) => c.parts)).toEqual([['submit', 'yourselves']]);
    expect(index?.multi.get('be')?.[0].parts).toEqual(['be', 'subject']);
  });

  it('marks theme lemmas', () => {
    const index = buildLexIndex(alignment(1, [token('G5479', 'joy')], ['G5479']), 1);
    expect(index?.single.get('joy')?.isTheme).toBe(true);
  });

  it('keeps the first surface when two lemmas claim it', () => {
    // First-write-wins keeps the data file's ordering authoritative.
    const index = buildLexIndex(alignment(1, [token('FIRST', 'joy'), token('SECOND', 'joy')]), 1);
    expect(index?.single.get('joy')?.token.lemma).toBe('FIRST');
  });

  it('skips tokens whose lemma is absent from the lexicon', () => {
    const align = alignment(1, [token('G1', 'joy')]);
    (align.lexicon as Record<string, LexEntry>) = {};
    expect(buildLexIndex(align, 1)?.single.size).toBe(0);
  });
});

describe('expandToMatchUnits', () => {
  it('splits a hyphenated token into separate units', () => {
    const text = 'a double-minded man';
    const units = expandToMatchUnits(text, tokenize(text));
    expect(units.map((u) => u.word)).toEqual(['a', 'double', 'minded', 'man']);
    // Offsets must still point into the original string.
    expect(text.slice(units[1].start, units[1].end)).toBe('double');
    expect(text.slice(units[2].start, units[2].end)).toBe('minded');
  });

  it('flags punctuation that would break a phrase', () => {
    const text = 'double, minded';
    const units = expandToMatchUnits(text, tokenize(text));
    expect(units[0].blockedAfter).toBe(true);
    expect(units[1].blockedAfter).toBe(false);
  });

  it('does not treat a hyphen as a phrase break', () => {
    const text = 'double-minded man';
    const units = expandToMatchUnits(text, tokenize(text));
    expect(units[0].blockedAfter).toBe(false);
  });

  it('drops tokens with no word characters', () => {
    const text = 'word — word';
    const units = expandToMatchUnits(text, tokenize(text));
    expect(units.map((u) => u.word)).toEqual(['word', 'word']);
  });
});

describe('matchLexicon', () => {
  it('matches a single word regardless of case and trailing punctuation', () => {
    const matches = matchesIn('Consider it pure Joy,', alignment(1, [token('G5479', 'joy')]));
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({ surface: 'Joy', isMultiWord: false });
  });

  it('matches a whitespace-separated multi-word phrase', () => {
    const matches = matchesIn(
      'Submit yourselves therefore to God',
      alignment(1, [token('G5293', 'Submit yourselves')])
    );
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({ surface: 'Submit yourselves', isMultiWord: true });
  });

  it('matches a hyphenated verse token against a hyphenated lexicon surface', () => {
    // The documented VER-mobile-lex-coverage-gap edge case: the lexicon splits
    // "double-minded" into two parts, but the verse tokeniser produced one token
    // "double-minded", so neither map matched and the hit was silently lost.
    const matches = matchesIn(
      'he is double-minded in all his ways',
      alignment(1, [token('G1374', 'double-minded')])
    );
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({ surface: 'double-minded', isMultiWord: true });
  });

  it('matches a hyphenated lexicon surface against whitespace-separated verse words', () => {
    const matches = matchesIn(
      'he is double minded in all his ways',
      alignment(1, [token('G1374', 'double-minded')])
    );
    expect(matches).toHaveLength(1);
    expect(matches[0].surface).toBe('double minded');
  });

  it('refuses a phrase broken by punctuation', () => {
    const matches = matchesIn(
      'he is double, minded in all his ways',
      alignment(1, [token('G1374', 'double-minded')])
    );
    expect(matches).toHaveLength(0);
  });

  it('prefers the longest candidate at a position', () => {
    const matches = matchesIn(
      'the kingdom of heaven is near',
      alignment(1, [token('SHORT', 'kingdom of'), token('LONG', 'kingdom of heaven')])
    );
    expect(matches).toHaveLength(1);
    expect(matches[0].surface).toBe('kingdom of heaven');
    expect(matches[0].hit.token.lemma).toBe('LONG');
  });

  it('prefers a multi-word phrase over a single-word hit at the same position', () => {
    const matches = matchesIn(
      'Submit yourselves to God',
      alignment(1, [token('SINGLE', 'Submit'), token('PHRASE', 'Submit yourselves')])
    );
    expect(matches).toHaveLength(1);
    expect(matches[0].hit.token.lemma).toBe('PHRASE');
  });

  it('does not overlap matches', () => {
    const matches = matchesIn(
      'faith and patience and hope',
      alignment(1, [token('A', 'faith and'), token('B', 'and patience')])
    );
    // "faith and" consumes both units, so "and patience" cannot also start at
    // the same "and".
    expect(matches).toHaveLength(1);
    expect(matches[0].surface).toBe('faith and');
  });

  it('finds every separate single-word hit in a verse', () => {
    const matches = matchesIn(
      'joy and peace and faith',
      alignment(1, [token('A', 'joy'), token('B', 'peace'), token('C', 'faith')])
    );
    expect(matches.map((m) => m.surface)).toEqual(['joy', 'peace', 'faith']);
  });

  it('does not run past the end of the verse for a phrase that cannot fit', () => {
    const matches = matchesIn('kingdom of', alignment(1, [token('L', 'kingdom of heaven')]));
    expect(matches).toHaveLength(0);
  });
});
