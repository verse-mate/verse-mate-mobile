/**
 * Tests for useChapterNavigation hook
 *
 * Tests navigation logic for:
 * - Next/previous within same book
 * - Cross-book navigation (Genesis 50 → Exodus 1, Exodus 1 → Genesis 50)
 * - Bible boundaries (Genesis 1, Revelation 22)
 * - Single-chapter books (Obadiah, Philemon, 2 John, 3 John, Jude)
 */

import { renderHook } from '@testing-library/react-native';
import { useChapterNavigation } from '@/hooks/bible/use-chapter-navigation';
import { mockTestamentBooks } from '../mocks/data/bible-books.data';

describe('useChapterNavigation', () => {
  describe('within same book navigation', () => {
    it('should navigate to next chapter within Genesis', () => {
      const { result } = renderHook(() => useChapterNavigation(1, 1, mockTestamentBooks));

      expect(result.current.nextChapter).toEqual({ bookId: 1, chapterNumber: 2 });
      expect(result.current.canGoNext).toBe(true);
    });

    it('should navigate to previous chapter within Genesis', () => {
      const { result } = renderHook(() => useChapterNavigation(1, 10, mockTestamentBooks));

      expect(result.current.prevChapter).toEqual({ bookId: 1, chapterNumber: 9 });
      expect(result.current.canGoPrevious).toBe(true);
    });

    it('should navigate within Psalms (large book)', () => {
      const { result } = renderHook(() => useChapterNavigation(19, 75, mockTestamentBooks));

      expect(result.current.nextChapter).toEqual({ bookId: 19, chapterNumber: 76 });
      expect(result.current.prevChapter).toEqual({ bookId: 19, chapterNumber: 74 });
      expect(result.current.canGoNext).toBe(true);
      expect(result.current.canGoPrevious).toBe(true);
    });
  });

  describe('cross-book navigation', () => {
    it('should navigate from Genesis 50 to Exodus 1', () => {
      const { result } = renderHook(() => useChapterNavigation(1, 50, mockTestamentBooks));

      expect(result.current.nextChapter).toEqual({ bookId: 2, chapterNumber: 1 });
      expect(result.current.canGoNext).toBe(true);
    });

    it('should navigate from Exodus 1 to Genesis 50', () => {
      const { result } = renderHook(() => useChapterNavigation(2, 1, mockTestamentBooks));

      expect(result.current.prevChapter).toEqual({ bookId: 1, chapterNumber: 50 });
      expect(result.current.canGoPrevious).toBe(true);
    });

    it('should navigate from Malachi 4 (OT) to Matthew 1 (NT)', () => {
      const { result } = renderHook(() => useChapterNavigation(39, 4, mockTestamentBooks));

      expect(result.current.nextChapter).toEqual({ bookId: 40, chapterNumber: 1 });
      expect(result.current.canGoNext).toBe(true);
    });

    it('should navigate from Matthew 1 (NT) to Malachi 4 (OT)', () => {
      const { result } = renderHook(() => useChapterNavigation(40, 1, mockTestamentBooks));

      expect(result.current.prevChapter).toEqual({ bookId: 39, chapterNumber: 4 });
      expect(result.current.canGoPrevious).toBe(true);
    });
  });

  describe('Bible boundaries', () => {
    it('should not allow previous navigation from Genesis 1', () => {
      const { result } = renderHook(() => useChapterNavigation(1, 1, mockTestamentBooks));

      expect(result.current.prevChapter).toBeNull();
      expect(result.current.canGoPrevious).toBe(false);
      expect(result.current.canGoNext).toBe(true);
    });

    it('should not allow next navigation from Revelation 22', () => {
      const { result } = renderHook(() => useChapterNavigation(66, 22, mockTestamentBooks));

      expect(result.current.nextChapter).toBeNull();
      expect(result.current.canGoNext).toBe(false);
      expect(result.current.canGoPrevious).toBe(true);
    });
  });

  describe('single-chapter books', () => {
    it('should handle Obadiah (book 31, single chapter)', () => {
      const { result } = renderHook(() => useChapterNavigation(31, 1, mockTestamentBooks));

      // Should navigate to Jonah 1 (next book)
      expect(result.current.nextChapter).toEqual({ bookId: 32, chapterNumber: 1 });
      // Should navigate to Amos 9 (previous book's last chapter)
      expect(result.current.prevChapter).toEqual({ bookId: 30, chapterNumber: 9 });
      expect(result.current.canGoNext).toBe(true);
      expect(result.current.canGoPrevious).toBe(true);
    });

    it('should handle Philemon (book 57, single chapter)', () => {
      const { result } = renderHook(() => useChapterNavigation(57, 1, mockTestamentBooks));

      // Should navigate to Hebrews 1 (next book)
      expect(result.current.nextChapter).toEqual({ bookId: 58, chapterNumber: 1 });
      // Should navigate to Titus 3 (previous book's last chapter)
      expect(result.current.prevChapter).toEqual({ bookId: 56, chapterNumber: 3 });
      expect(result.current.canGoNext).toBe(true);
      expect(result.current.canGoPrevious).toBe(true);
    });

    it('should handle 2 John (book 63, single chapter)', () => {
      const { result } = renderHook(() => useChapterNavigation(63, 1, mockTestamentBooks));

      expect(result.current.nextChapter).toEqual({ bookId: 64, chapterNumber: 1 });
      expect(result.current.prevChapter).toEqual({ bookId: 62, chapterNumber: 5 });
    });

    it('should handle 3 John (book 64, single chapter)', () => {
      const { result } = renderHook(() => useChapterNavigation(64, 1, mockTestamentBooks));

      expect(result.current.nextChapter).toEqual({ bookId: 65, chapterNumber: 1 });
      expect(result.current.prevChapter).toEqual({ bookId: 63, chapterNumber: 1 });
    });

    it('should handle Jude (book 65, single chapter)', () => {
      const { result } = renderHook(() => useChapterNavigation(65, 1, mockTestamentBooks));

      expect(result.current.nextChapter).toEqual({ bookId: 66, chapterNumber: 1 });
      expect(result.current.prevChapter).toEqual({ bookId: 64, chapterNumber: 1 });
    });
  });

  describe('edge cases', () => {
    it('should handle undefined books metadata', () => {
      const { result } = renderHook(() => useChapterNavigation(1, 1, undefined));

      expect(result.current.nextChapter).toBeNull();
      expect(result.current.prevChapter).toBeNull();
      expect(result.current.canGoNext).toBe(false);
      expect(result.current.canGoPrevious).toBe(false);
    });

    it('should handle empty books metadata', () => {
      const { result } = renderHook(() => useChapterNavigation(1, 1, []));

      expect(result.current.nextChapter).toBeNull();
      expect(result.current.prevChapter).toBeNull();
      expect(result.current.canGoNext).toBe(false);
      expect(result.current.canGoPrevious).toBe(false);
    });

    it('should handle invalid book ID', () => {
      const { result } = renderHook(() => useChapterNavigation(999, 1, mockTestamentBooks));

      expect(result.current.nextChapter).toBeNull();
      expect(result.current.prevChapter).toBeNull();
      expect(result.current.canGoNext).toBe(false);
      expect(result.current.canGoPrevious).toBe(false);
    });

    it('should handle invalid chapter number (exceeds book chapters)', () => {
      const { result } = renderHook(() => useChapterNavigation(1, 999, mockTestamentBooks));

      // Chapter 999 exceeds Genesis' 50 chapters, so logic treats it as "last chapter"
      // and allows navigation to next book (Exodus 1)
      expect(result.current.nextChapter).toEqual({ bookId: 2, chapterNumber: 1 });
      expect(result.current.canGoNext).toBe(true);
      // Should allow going to previous chapter (998)
      expect(result.current.prevChapter).toEqual({ bookId: 1, chapterNumber: 998 });
      expect(result.current.canGoPrevious).toBe(true);
    });
  });
});
