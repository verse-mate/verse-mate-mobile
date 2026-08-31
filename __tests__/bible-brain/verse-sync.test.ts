/**
 * Verse-sync logic for Bible Brain narration.
 *
 * Timings are real values measured from `ENGESVN1DA` John 3 (37 verses,
 * 273s of audio), so the fixtures match what the API actually returns.
 */
import {
  findActiveVerse,
  findActiveVerseIndex,
  normalizeTimestamps,
  seekSecondsForVerse,
  type VerseTimestamp,
  verseHighlightWindow,
} from '@/lib/bible-brain/verse-sync';

/** First six verses of ESV John 3 as the API returns them. */
const JOHN_3: VerseTimestamp[] = [
  { verse: 1, seconds: 2.78 },
  { verse: 2, seconds: 8 },
  { verse: 3, seconds: 20.36 },
  { verse: 4, seconds: 28.6 },
  { verse: 5, seconds: 38.19 },
  { verse: 6, seconds: 47.88 },
];

describe('findActiveVerseIndex', () => {
  it('returns -1 before the first verse begins', () => {
    expect(findActiveVerseIndex(JOHN_3, 0)).toBe(-1);
    expect(findActiveVerseIndex(JOHN_3, 2.77)).toBe(-1);
  });

  it('activates a verse exactly on its boundary', () => {
    expect(findActiveVerseIndex(JOHN_3, 2.78)).toBe(0);
    expect(findActiveVerseIndex(JOHN_3, 8)).toBe(1);
  });

  it('holds the previous verse until the next one starts', () => {
    expect(findActiveVerseIndex(JOHN_3, 7.99)).toBe(0);
    expect(findActiveVerseIndex(JOHN_3, 20.35)).toBe(1);
  });

  it('stays on the last verse past the end of the list', () => {
    expect(findActiveVerseIndex(JOHN_3, 500)).toBe(JOHN_3.length - 1);
  });

  it('handles an empty timestamp list', () => {
    expect(findActiveVerseIndex([], 12)).toBe(-1);
  });

  it('agrees with a linear scan across the whole chapter', () => {
    // Guards the binary search against an off-by-one that a handful of
    // hand-picked cases would miss.
    const linear = (t: VerseTimestamp[], at: number) => {
      let found = -1;
      for (let i = 0; i < t.length; i++) if (t[i].seconds <= at) found = i;
      return found;
    };
    for (let at = 0; at <= 60; at += 0.13) {
      expect(findActiveVerseIndex(JOHN_3, at)).toBe(linear(JOHN_3, at));
    }
  });
});

describe('findActiveVerse', () => {
  it('reports the verse number, not the index', () => {
    expect(findActiveVerse(JOHN_3, 21)).toBe(3);
  });

  it('is null before narration reaches verse 1', () => {
    expect(findActiveVerse(JOHN_3, 1)).toBeNull();
  });
});

describe('seekSecondsForVerse', () => {
  it('finds the offset for a known verse', () => {
    expect(seekSecondsForVerse(JOHN_3, 5)).toBe(38.19);
  });

  it('is null for a verse with no timing', () => {
    expect(seekSecondsForVerse(JOHN_3, 99)).toBeNull();
  });
});

describe('normalizeTimestamps', () => {
  it('sorts out-of-order entries so the binary search stays valid', () => {
    const normalized = normalizeTimestamps([
      { verse: 3, seconds: 20.36 },
      { verse: 1, seconds: 2.78 },
      { verse: 2, seconds: 8 },
    ]);
    expect(normalized.map((t) => t.verse)).toEqual([1, 2, 3]);
  });

  it('drops the verse-0 heading marker', () => {
    const normalized = normalizeTimestamps([
      { verse: 0, seconds: 0 },
      { verse: 1, seconds: 2.78 },
    ]);
    expect(normalized).toEqual([{ verse: 1, seconds: 2.78 }]);
  });

  it('drops malformed and negative entries', () => {
    const normalized = normalizeTimestamps([
      { verse: null, seconds: 5 },
      { verse: 2, seconds: null },
      { verse: 3, seconds: -1 },
      { verse: Number.NaN, seconds: 9 },
      { verse: 4, seconds: 10 },
    ]);
    expect(normalized).toEqual([{ verse: 4, seconds: 10 }]);
  });

  it('keeps the earliest offset when a verse is duplicated', () => {
    const normalized = normalizeTimestamps([
      { verse: 1, seconds: 9 },
      { verse: 1, seconds: 2.78 },
    ]);
    expect(normalized).toEqual([{ verse: 1, seconds: 2.78 }]);
  });

  it('returns an empty array for an empty input', () => {
    expect(normalizeTimestamps([])).toEqual([]);
  });
});

describe('verseHighlightWindow', () => {
  it('returns the active verse plus its neighbours', () => {
    const result = verseHighlightWindow(JOHN_3, 21, 1);
    expect(result.active).toBe(3);
    expect(result.nearby).toEqual([2, 3, 4]);
  });

  it('clamps the window at the start of the chapter', () => {
    const result = verseHighlightWindow(JOHN_3, 3, 2);
    expect(result.active).toBe(1);
    expect(result.nearby).toEqual([1, 2, 3]);
  });

  it('is empty before narration starts', () => {
    expect(verseHighlightWindow(JOHN_3, 0)).toEqual({ active: null, nearby: [] });
  });
});
