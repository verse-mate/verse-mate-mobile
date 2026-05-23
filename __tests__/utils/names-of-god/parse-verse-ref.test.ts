import {
  compareVerseRefs,
  parseSortVerseRefs,
  parseVerseRef,
} from '@/utils/names-of-god/parse-verse-ref';

describe('parseVerseRef', () => {
  it('parses a simple single-word book ref', () => {
    const result = parseVerseRef('Genesis 2:4');
    expect(result).toEqual({
      raw: 'Genesis 2:4',
      bookId: 1,
      bookName: 'Genesis',
      chapter: 2,
      verse: 4,
    });
  });

  it('parses a numbered book ref', () => {
    const result = parseVerseRef('1 Samuel 16:7');
    expect(result).toEqual({
      raw: '1 Samuel 16:7',
      bookId: 9,
      bookName: '1 Samuel',
      chapter: 16,
      verse: 7,
    });
  });

  it('parses a three-word book name', () => {
    const result = parseVerseRef('Song of Solomon 2:1');
    expect(result).toEqual({
      raw: 'Song of Solomon 2:1',
      bookId: 22,
      bookName: 'Song of Solomon',
      chapter: 2,
      verse: 1,
    });
  });

  it('parses a New Testament ref', () => {
    const result = parseVerseRef('Revelation 1:8');
    expect(result).toEqual(expect.objectContaining({ bookId: 66, chapter: 1, verse: 8 }));
  });

  it('returns null for an unknown book name', () => {
    expect(parseVerseRef('Hezekiah 3:2')).toBeNull();
  });

  it('returns null for a malformed ref', () => {
    expect(parseVerseRef('Genesis')).toBeNull();
    expect(parseVerseRef('Genesis 2')).toBeNull();
    expect(parseVerseRef('')).toBeNull();
  });
});

describe('compareVerseRefs', () => {
  it('sorts by book first', () => {
    const genesis = parseVerseRef('Genesis 1:1')!;
    const exodus = parseVerseRef('Exodus 1:1')!;
    expect(compareVerseRefs(genesis, exodus)).toBeLessThan(0);
  });

  it('sorts by chapter when book is the same', () => {
    const ch1 = parseVerseRef('Genesis 1:1')!;
    const ch2 = parseVerseRef('Genesis 2:1')!;
    expect(compareVerseRefs(ch1, ch2)).toBeLessThan(0);
  });

  it('sorts by verse when book and chapter are the same', () => {
    const v1 = parseVerseRef('Genesis 1:1')!;
    const v5 = parseVerseRef('Genesis 1:5')!;
    expect(compareVerseRefs(v1, v5)).toBeLessThan(0);
  });

  it('returns 0 for identical refs', () => {
    const a = parseVerseRef('Exodus 3:14')!;
    const b = parseVerseRef('Exodus 3:14')!;
    expect(compareVerseRefs(a, b)).toBe(0);
  });
});

describe('parseSortVerseRefs', () => {
  it('returns refs in canonical order', () => {
    const raw = ['Revelation 22:13', 'Genesis 1:1', 'Exodus 3:14'];
    const sorted = parseSortVerseRefs(raw);
    expect(sorted.map((r) => r.bookId)).toEqual([1, 2, 66]);
  });

  it('silently drops unparseable refs', () => {
    const raw = ['Genesis 1:1', 'BadBook 3:4', 'Exodus 1:1'];
    const sorted = parseSortVerseRefs(raw);
    expect(sorted).toHaveLength(2);
  });

  it('returns an empty array for empty input', () => {
    expect(parseSortVerseRefs([])).toEqual([]);
  });
});
