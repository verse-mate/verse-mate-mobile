import {
  HIGHLIGHT_STOP as E,
  highlightRanges,
  HIGHLIGHT_START as S,
} from '@/lib/bible-search/highlight-ranges';
import { isSearchable, splitSearchWords } from '@/lib/bible-search/search-words';

describe('splitSearchWords', () => {
  it('matches the unfinished last word as a prefix, a trailing space ends it', () => {
    expect(splitSearchWords('east and wes')).toEqual({
      words: ['east', 'and', 'wes'],
      prefix: true,
    });
    expect(splitSearchWords('east and west ')?.prefix).toBe(false);
  });

  it('drops query syntax and keeps accents and Devanagari vowel signs in the word', () => {
    expect(splitSearchWords('"east" & (west)*')?.words).toEqual(['east', 'west']);
    expect(splitSearchWords('Jesús')?.words).toEqual(['Jesús']);
    expect(splitSearchWords('तुम्हें प्रेम')?.words).toEqual(['तुम्हें', 'प्रेम']);
  });

  it('rejects input with nothing to search', () => {
    expect(splitSearchWords(' !! ')).toBeNull();
    expect(splitSearchWords('a')).toBeNull();
  });
});

describe('isSearchable', () => {
  it('needs two letters or digits', () => {
    expect(isSearchable('a')).toBe(false);
    expect(isSearchable(' a! ')).toBe(false);
    expect(isSearchable('lo')).toBe(true);
  });
});

describe('highlightRanges', () => {
  it('reads the markers back into ranges over the original text', () => {
    const text = 'As far as the east is from the west';
    expect(highlightRanges(`As far as the ${S}east${E} is from the ${S}west${E}`, text)).toEqual([
      [14, 18],
      [31, 35],
    ]);
  });

  it('takes a phrase span as one range (SQLite FTS5 marks phrases whole)', () => {
    const text = 'many will come from east and west, and recline';
    expect(highlightRanges(`many will come from ${S}east and west${E}, and recline`, text)).toEqual(
      [[20, 33]]
    );
  });

  it('keeps only whole phrase occurrences when asked to', () => {
    const text = 'from east and west, and recline';
    const marked = `from ${S}east${E} ${S}and${E} ${S}west${E}, ${S}and${E} recline`;
    expect(
      highlightRanges(marked, text, { words: ['east', 'and', 'west'], prefix: false })
    ).toEqual([
      [5, 9],
      [10, 13],
      [14, 18],
    ]);
  });

  it('returns nothing when the markers do not reproduce the text', () => {
    expect(highlightRanges(`${S}east${E} and`, 'East and')).toEqual([]);
  });
});
