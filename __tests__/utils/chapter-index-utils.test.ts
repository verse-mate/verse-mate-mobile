/**
 * Tests for chapter index calculation utilities
 *
 * Tests conversion between:
 * - (bookId, chapterNumber) → absolute page index (0-1188)
 * - absolute page index → (bookId, chapterNumber)
 * - Validation of page indices
 * - Maximum page index calculation
 */

import {
  getAbsolutePageIndex,
  getChapterFromPageIndex,
  getMaxPageIndex,
  isValidPageIndex,
} from '@/utils/bible/chapter-index-utils';
import { mockTestamentBooks } from '../mocks/data/bible-books.data';

describe('chapter-index-utils', () => {
  describe('getAbsolutePageIndex', () => {
    it('should return 0 for Genesis 1', () => {
      const index = getAbsolutePageIndex(1, 1, mockTestamentBooks);
      expect(index).toBe(0);
    });

    it('should return 1 for Genesis 2', () => {
      const index = getAbsolutePageIndex(1, 2, mockTestamentBooks);
      expect(index).toBe(1);
    });

    it('should return 49 for Genesis 50 (last chapter of Genesis)', () => {
      const index = getAbsolutePageIndex(1, 50, mockTestamentBooks);
      expect(index).toBe(49);
    });

    it('should return 50 for Exodus 1 (first chapter after Genesis)', () => {
      const index = getAbsolutePageIndex(2, 1, mockTestamentBooks);
      expect(index).toBe(50);
    });

    it('should calculate correct index for Psalms 1 (book 19)', () => {
      // Sum of chapters before Psalms: Genesis(50) + Exodus(40) + ... + Job(42) = 478
      const index = getAbsolutePageIndex(19, 1, mockTestamentBooks);
      expect(index).toBe(478);
    });

    it('should calculate correct index for Matthew 1 (first NT book)', () => {
      // Sum of all OT chapters
      const otChapters = mockTestamentBooks
        .filter((b) => b.testament === 'OT')
        .reduce((sum, b) => sum + b.chapterCount, 0);
      const index = getAbsolutePageIndex(40, 1, mockTestamentBooks);
      expect(index).toBe(otChapters);
    });

    it('should return 1188 for Revelation 22 (last chapter of Bible)', () => {
      const index = getAbsolutePageIndex(66, 22, mockTestamentBooks);
      expect(index).toBe(1188);
    });

    it('should return -1 for undefined books metadata', () => {
      const index = getAbsolutePageIndex(1, 1, undefined);
      expect(index).toBe(-1);
    });

    it('should return -1 for empty books metadata', () => {
      const index = getAbsolutePageIndex(1, 1, []);
      expect(index).toBe(-1);
    });

    it('should return -1 for invalid book ID', () => {
      const index = getAbsolutePageIndex(999, 1, mockTestamentBooks);
      expect(index).toBe(-1);
    });

    it('should return -1 for chapter number exceeding book chapters', () => {
      const index = getAbsolutePageIndex(1, 999, mockTestamentBooks);
      expect(index).toBe(-1);
    });

    it('should return -1 for chapter number less than 1', () => {
      const index = getAbsolutePageIndex(1, 0, mockTestamentBooks);
      expect(index).toBe(-1);
    });
  });

  describe('getChapterFromPageIndex', () => {
    it('should return Genesis 1 for index 0', () => {
      const chapter = getChapterFromPageIndex(0, mockTestamentBooks);
      expect(chapter).toEqual({ bookId: 1, chapterNumber: 1 });
    });

    it('should return Genesis 2 for index 1', () => {
      const chapter = getChapterFromPageIndex(1, mockTestamentBooks);
      expect(chapter).toEqual({ bookId: 1, chapterNumber: 2 });
    });

    it('should return Genesis 50 for index 49', () => {
      const chapter = getChapterFromPageIndex(49, mockTestamentBooks);
      expect(chapter).toEqual({ bookId: 1, chapterNumber: 50 });
    });

    it('should return Exodus 1 for index 50', () => {
      const chapter = getChapterFromPageIndex(50, mockTestamentBooks);
      expect(chapter).toEqual({ bookId: 2, chapterNumber: 1 });
    });

    it('should return Exodus 40 for index 89', () => {
      const chapter = getChapterFromPageIndex(89, mockTestamentBooks);
      expect(chapter).toEqual({ bookId: 2, chapterNumber: 40 });
    });

    it('should return Matthew 1 for first NT chapter', () => {
      const otChapters = mockTestamentBooks
        .filter((b) => b.testament === 'OT')
        .reduce((sum, b) => sum + b.chapterCount, 0);
      const chapter = getChapterFromPageIndex(otChapters, mockTestamentBooks);
      expect(chapter).toEqual({ bookId: 40, chapterNumber: 1 });
    });

    it('should return Revelation 22 for index 1188', () => {
      const chapter = getChapterFromPageIndex(1188, mockTestamentBooks);
      expect(chapter).toEqual({ bookId: 66, chapterNumber: 22 });
    });

    it('should handle single-chapter book Obadiah (book 31)', () => {
      // Calculate index for Obadiah 1
      const obIndex = getAbsolutePageIndex(31, 1, mockTestamentBooks);
      const chapter = getChapterFromPageIndex(obIndex, mockTestamentBooks);
      expect(chapter).toEqual({ bookId: 31, chapterNumber: 1 });
    });

    it('should return null for negative index', () => {
      const chapter = getChapterFromPageIndex(-1, mockTestamentBooks);
      expect(chapter).toBeNull();
    });

    it('should return null for index exceeding Bible chapters', () => {
      const chapter = getChapterFromPageIndex(1189, mockTestamentBooks);
      expect(chapter).toBeNull();
    });

    it('should return null for undefined books metadata', () => {
      const chapter = getChapterFromPageIndex(0, undefined);
      expect(chapter).toBeNull();
    });

    it('should return null for empty books metadata', () => {
      const chapter = getChapterFromPageIndex(0, []);
      expect(chapter).toBeNull();
    });
  });

  describe('isValidPageIndex', () => {
    it('should return true for index 0 (Genesis 1)', () => {
      const valid = isValidPageIndex(0, mockTestamentBooks);
      expect(valid).toBe(true);
    });

    it('should return true for index 1188 (Revelation 22)', () => {
      const valid = isValidPageIndex(1188, mockTestamentBooks);
      expect(valid).toBe(true);
    });

    it('should return true for middle index', () => {
      const valid = isValidPageIndex(500, mockTestamentBooks);
      expect(valid).toBe(true);
    });

    it('should return false for negative index', () => {
      const valid = isValidPageIndex(-1, mockTestamentBooks);
      expect(valid).toBe(false);
    });

    it('should return false for index exceeding Bible chapters', () => {
      const valid = isValidPageIndex(1189, mockTestamentBooks);
      expect(valid).toBe(false);
    });

    it('should return false for undefined books metadata', () => {
      const valid = isValidPageIndex(0, undefined);
      expect(valid).toBe(false);
    });

    it('should return false for empty books metadata', () => {
      const valid = isValidPageIndex(0, []);
      expect(valid).toBe(false);
    });
  });

  describe('getMaxPageIndex', () => {
    it('should return 1188 for complete Bible (1189 chapters, 0-indexed)', () => {
      const maxIndex = getMaxPageIndex(mockTestamentBooks);
      expect(maxIndex).toBe(1188);
    });

    it('should return 0 for undefined books metadata', () => {
      const maxIndex = getMaxPageIndex(undefined);
      expect(maxIndex).toBe(0);
    });

    it('should return 0 for empty books metadata', () => {
      const maxIndex = getMaxPageIndex([]);
      expect(maxIndex).toBe(0);
    });

    it('should calculate correct total for all 66 books', () => {
      const expectedTotal = mockTestamentBooks.reduce((sum, b) => sum + b.chapterCount, 0);
      const maxIndex = getMaxPageIndex(mockTestamentBooks);
      expect(maxIndex).toBe(expectedTotal - 1); // 0-indexed
    });
  });

  describe('round-trip conversions', () => {
    it('should convert Genesis 1 to index and back', () => {
      const index = getAbsolutePageIndex(1, 1, mockTestamentBooks);
      const chapter = getChapterFromPageIndex(index, mockTestamentBooks);
      expect(chapter).toEqual({ bookId: 1, chapterNumber: 1 });
    });

    it('should convert Revelation 22 to index and back', () => {
      const index = getAbsolutePageIndex(66, 22, mockTestamentBooks);
      const chapter = getChapterFromPageIndex(index, mockTestamentBooks);
      expect(chapter).toEqual({ bookId: 66, chapterNumber: 22 });
    });

    it('should convert Matthew 1 to index and back', () => {
      const index = getAbsolutePageIndex(40, 1, mockTestamentBooks);
      const chapter = getChapterFromPageIndex(index, mockTestamentBooks);
      expect(chapter).toEqual({ bookId: 40, chapterNumber: 1 });
    });

    it('should convert Psalms 119 to index and back', () => {
      const index = getAbsolutePageIndex(19, 119, mockTestamentBooks);
      const chapter = getChapterFromPageIndex(index, mockTestamentBooks);
      expect(chapter).toEqual({ bookId: 19, chapterNumber: 119 });
    });

    it('should handle all single-chapter books', () => {
      const singleChapterBooks = [31, 57, 63, 64, 65]; // Obadiah, Philemon, 2 John, 3 John, Jude

      for (const bookId of singleChapterBooks) {
        const index = getAbsolutePageIndex(bookId, 1, mockTestamentBooks);
        const chapter = getChapterFromPageIndex(index, mockTestamentBooks);
        expect(chapter).toEqual({ bookId, chapterNumber: 1 });
      }
    });
  });

  describe('cross-book index calculations', () => {
    it('should calculate correct indices for Genesis-Exodus boundary', () => {
      const gen50Index = getAbsolutePageIndex(1, 50, mockTestamentBooks);
      const exo1Index = getAbsolutePageIndex(2, 1, mockTestamentBooks);
      expect(exo1Index).toBe(gen50Index + 1);
    });

    it('should calculate correct indices for Malachi-Matthew boundary', () => {
      const mal4Index = getAbsolutePageIndex(39, 4, mockTestamentBooks);
      const mat1Index = getAbsolutePageIndex(40, 1, mockTestamentBooks);
      expect(mat1Index).toBe(mal4Index + 1);
    });

    it('should verify sequential indices across all books', () => {
      let expectedIndex = 0;

      for (const book of mockTestamentBooks) {
        for (let chapter = 1; chapter <= book.chapterCount; chapter++) {
          const index = getAbsolutePageIndex(book.id, chapter, mockTestamentBooks);
          expect(index).toBe(expectedIndex);
          expectedIndex++;
        }
      }

      // Should end at 1188 (1189 total chapters, 0-indexed)
      expect(expectedIndex - 1).toBe(1188);
    });
  });
});
