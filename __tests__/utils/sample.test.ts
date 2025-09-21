// Sample utility functions for testing
export const formatVerseReference = (book: string, chapter: number, verse: number): string => {
  return `${book} ${chapter}:${verse}`;
};

export const isValidChapter = (chapter: number): boolean => {
  return chapter > 0 && chapter <= 150; // Assuming max 150 chapters
};

describe('Utility Functions', () => {
  describe('formatVerseReference', () => {
    it('formats verse reference correctly', () => {
      const result = formatVerseReference('Genesis', 1, 1);
      expect(result).toBe('Genesis 1:1');
    });

    it('handles different books and chapters', () => {
      const result = formatVerseReference('Psalms', 23, 4);
      expect(result).toBe('Psalms 23:4');
    });
  });

  describe('isValidChapter', () => {
    it('returns true for valid chapter numbers', () => {
      expect(isValidChapter(1)).toBe(true);
      expect(isValidChapter(50)).toBe(true);
      expect(isValidChapter(150)).toBe(true);
    });

    it('returns false for invalid chapter numbers', () => {
      expect(isValidChapter(0)).toBe(false);
      expect(isValidChapter(-1)).toBe(false);
      expect(isValidChapter(151)).toBe(false);
    });
  });
});