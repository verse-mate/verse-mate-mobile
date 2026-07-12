import { bookHasRedLetter, getRedLetterVerses, isRedLetterVerse } from '@versemate/red-letter';

describe('@versemate/red-letter integration', () => {
  it('returns the words-of-Jesus verses for a Gospel chapter', () => {
    const mark10 = getRedLetterVerses(41, 10);
    expect(mark10.length).toBeGreaterThan(0);
    expect(mark10).toContain(29); // Jesus speaks in Mark 10:29
    expect(mark10).not.toContain(1); // v1 is narration
  });

  it('isRedLetterVerse membership check', () => {
    expect(isRedLetterVerse(41, 10, 29)).toBe(true);
    expect(isRedLetterVerse(41, 10, 1)).toBe(false);
  });

  it('books with no words of Jesus resolve to empty / false', () => {
    expect(bookHasRedLetter(1)).toBe(false); // Genesis
    expect(getRedLetterVerses(1, 1)).toEqual([]);
  });
});
