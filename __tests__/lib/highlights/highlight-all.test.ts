import {
  collectBookOccurrences,
  findPhraseOccurrences,
  HIGHLIGHT_ALL_RUN_GAP_MS,
  highlightAllRun,
  highlightAllRunIds,
  phraseHighlightsInBook,
  type SavedHighlightLike,
} from '@/lib/highlights/highlight-all';

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

const T0 = Date.parse('2026-11-01T20:00:00.000Z');

function saved(
  id: number,
  overrides: Partial<SavedHighlightLike> & { atMs?: number } = {}
): SavedHighlightLike {
  const { atMs = 0, ...rest } = overrides;
  return {
    highlight_id: id,
    book_id: 43,
    color: 'yellow',
    start_char: 0,
    end_char: 4,
    selected_text: 'I am',
    created_at: new Date(T0 + atMs).toISOString(),
    ...rest,
  };
}

describe('phraseHighlightsInBook', () => {
  it('finds every highlight of the words in the book, however they were cased or made', () => {
    const highlights = [
      saved(1),
      saved(2, { selected_text: 'i AM', color: 'green', atMs: 86_400_000 }),
      saved(3, { selected_text: 'I  am ' }),
      saved(4, { book_id: 42 }), // another book
      saved(5, { selected_text: 'I am the' }), // other words
      saved(6, { start_char: null, end_char: null, selected_text: null }), // a whole verse
    ];
    expect(phraseHighlightsInBook(highlights, 43, 'I am').map((h) => h.highlight_id)).toEqual([
      1, 2, 3,
    ]);
  });

  it('treats either apostrophe as the same word', () => {
    const highlights = [saved(1, { selected_text: 'Lord\u2019s' })];
    expect(phraseHighlightsInBook(highlights, 43, "Lord's")).toHaveLength(1);
  });
});

describe('highlightAllRun', () => {
  it('returns the burst of same words, colour and book that the highlight was saved in', () => {
    const run = [saved(1, { atMs: 0 }), saved(2, { atMs: 400 }), saved(3, { atMs: 900 })];
    const highlights = [
      ...run,
      saved(4, { atMs: 600, color: 'green' }), // other colour
      saved(5, { atMs: 700, book_id: 42 }), // other book
      saved(6, { atMs: 3_600_000 }), // the same words an hour later, by hand
    ];
    expect(highlightAllRun(highlights, run[1])?.map((h) => h.highlight_id)).toEqual([1, 2, 3]);
    expect(highlightAllRun(highlights, highlights[5])).toBeNull();
  });

  it('keeps two runs of the same words apart', () => {
    const later = HIGHLIGHT_ALL_RUN_GAP_MS + 5_000;
    const highlights = [
      saved(1, { atMs: 0 }),
      saved(2, { atMs: 500 }),
      saved(3, { atMs: later }),
      saved(4, { atMs: later + 500 }),
    ];
    expect(highlightAllRun(highlights, highlights[0])?.map((h) => h.highlight_id)).toEqual([1, 2]);
    expect(highlightAllRun(highlights, highlights[3])?.map((h) => h.highlight_id)).toEqual([3, 4]);
  });

  it('is null for a highlight made on its own, or of whole verses', () => {
    const alone = saved(1);
    expect(highlightAllRun([alone], alone)).toBeNull();
    const verse = saved(2, { start_char: null, end_char: null, selected_text: null });
    expect(
      highlightAllRun(
        [verse, saved(3, { start_char: null, end_char: null, selected_text: null })],
        verse
      )
    ).toBeNull();
  });
});

describe('highlightAllRunIds', () => {
  it('collects every run and nothing made on its own', () => {
    const later = HIGHLIGHT_ALL_RUN_GAP_MS + 5_000;
    const highlights = [
      saved(1, { atMs: 0 }),
      saved(2, { atMs: 500 }),
      saved(3, { atMs: later }),
      saved(4, { atMs: later + 500 }),
      saved(5, { atMs: 3_600_000 }), // the same words an hour later, by hand
      saved(6, { atMs: 600, color: 'green' }), // other colour, alone
      saved(7, { start_char: null, end_char: null, selected_text: null }),
      saved(8, { start_char: null, end_char: null, selected_text: null }),
    ];
    expect([...highlightAllRunIds(highlights)].sort((a, b) => a - b)).toEqual([1, 2, 3, 4]);
  });

  it('agrees with highlightAllRun', () => {
    const highlights = [saved(1, { atMs: 0 }), saved(2, { atMs: 400 }), saved(3, { atMs: 9e6 })];
    const ids = highlightAllRunIds(highlights);
    for (const h of highlights) {
      expect(ids.has(h.highlight_id)).toBe(highlightAllRun(highlights, h) !== null);
    }
  });
});
