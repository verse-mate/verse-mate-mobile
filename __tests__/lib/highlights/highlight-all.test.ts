import { collectBookOccurrences, findPhraseOccurrences } from '@/lib/highlights/highlight-all';

describe('findPhraseOccurrences', () => {
  it('finds every occurrence, case-insensitively, with offsets into the text', () => {
    const text = 'I am the bread of life. Truly I am; i AM he.';
    expect(findPhraseOccurrences(text, 'I am')).toEqual([
      { start: 0, end: 4, text: 'I am' },
      { start: 30, end: 34, text: 'I am' },
      { start: 36, end: 40, text: 'i AM' },
    ]);
  });

  it('matches whole words only', () => {
    // "am" inside "Amos", "lamb" and "amen" is not the word "am".
    expect(findPhraseOccurrences('Amos saw the lamb; amen, I am.', 'am')).toEqual([
      { start: 27, end: 29, text: 'am' },
    ]);
  });

  it('still finds a match that begins inside a rejected one', () => {
    // "am am" first matches inside "lam am" (refused: mid-word), then for real at 4.
    expect(findPhraseOccurrences('lam am am', 'am am')).toEqual([
      { start: 4, end: 9, text: 'am am' },
    ]);
  });

  it('lets any whitespace stand between the words', () => {
    expect(findPhraseOccurrences('the Son of  Man', 'son of man')).toHaveLength(1);
  });

  it('treats straight and curly apostrophes as the same', () => {
    expect(findPhraseOccurrences('the Lord’s house', "Lord's")).toHaveLength(1);
    expect(findPhraseOccurrences("the Lord's house", 'Lord’s')).toHaveLength(1);
  });

  it('takes regex characters in the phrase literally', () => {
    expect(findPhraseOccurrences('Who are you? (he asked)', 'you? (he')).toHaveLength(1);
    expect(findPhraseOccurrences('a.b', 'a*b')).toEqual([]);
  });

  it('finds nothing for an empty phrase', () => {
    expect(findPhraseOccurrences('anything', '   ')).toEqual([]);
  });
});

describe('collectBookOccurrences', () => {
  const book: Record<number, { verseNumber: number; text: string }[] | null> = {
    1: [
      { verseNumber: 1, text: 'In the beginning was the Word' },
      { verseNumber: 2, text: 'the Word was with God, and the Word was God' },
    ],
    2: null,
    3: [{ verseNumber: 16, text: 'For God so loved the world' }],
  };

  it('collects matches in Bible order with chapter and verse', async () => {
    const { occurrences, missingChapters } = await collectBookOccurrences({
      phrase: 'the Word',
      chapterCount: 3,
      loadChapter: async (chapter) => book[chapter],
    });
    expect(occurrences.map((o) => [o.chapter, o.verse, o.start, o.end])).toEqual([
      [1, 1, 21, 29],
      [1, 2, 0, 8],
      [1, 2, 27, 35],
    ]);
    expect(missingChapters).toEqual([2]);
  });

  it('counts a chapter that fails to load as missing, not as an error', async () => {
    const { occurrences, missingChapters } = await collectBookOccurrences({
      phrase: 'God',
      chapterCount: 3,
      loadChapter: async (chapter) => {
        if (chapter === 1) throw new Error('network');
        return book[chapter];
      },
    });
    expect(missingChapters).toEqual([1, 2]);
    expect(occurrences.map((o) => o.chapter)).toEqual([3]);
  });

  it('stops when aborted', async () => {
    const controller = new AbortController();
    const loaded: number[] = [];
    await collectBookOccurrences({
      phrase: 'God',
      chapterCount: 3,
      signal: controller.signal,
      loadChapter: async (chapter) => {
        loaded.push(chapter);
        controller.abort();
        return book[chapter];
      },
    });
    expect(loaded).toEqual([1]);
  });
});
