/**
 * useChapterNavigation Hook
 *
 * Encapsulates cross-book navigation logic for Bible chapter reading.
 * Calculates next/previous chapter references considering:
 * - Within-book navigation (Genesis 1 → Genesis 2)
 * - Cross-book navigation (Genesis 50 → Exodus 1)
 * - Testament boundaries (Malachi 4 → Matthew 1)
 * - Bible boundaries (Genesis 1 has no previous, Revelation 22 has no next)
 * - Single-chapter books (Obadiah, Philemon, 2 John, 3 John, Jude)
 *
 * @example
 * ```tsx
 * const { nextChapter, prevChapter, canGoNext, canGoPrevious } = useChapterNavigation(
 *   1,    // Genesis
 *   50,   // Chapter 50
 *   books // Books metadata
 * );
 *
 * // nextChapter: { bookId: 2, chapterNumber: 1 } (Exodus 1)
 * // prevChapter: { bookId: 1, chapterNumber: 49 } (Genesis 49)
 * // canGoNext: true
 * // canGoPrevious: true
 * ```
 *
 * @see Spec: agent-os/specs/2025-10-23-native-page-swipe-navigation/spec.md (lines 248-270)
 */

import { useMemo } from 'react';
import type { TestamentBook } from '@/src/api/generated';

/**
 * Chapter location reference
 */
export interface ChapterLocation {
  bookId: number;
  chapterNumber: number;
}

/**
 * Navigation result with next/previous chapter references
 */
export interface ChapterNavigation {
  /** Next chapter reference, or null if at Bible end */
  nextChapter: ChapterLocation | null;
  /** Previous chapter reference, or null if at Bible start */
  prevChapter: ChapterLocation | null;
  /** Whether next navigation is available */
  canGoNext: boolean;
  /** Whether previous navigation is available */
  canGoPrevious: boolean;
}

/**
 * Hook to calculate next/previous chapter navigation
 *
 * @param bookId - Current book ID (1-66)
 * @param chapterNumber - Current chapter number (1-based)
 * @param booksMetadata - Array of all Bible books with chapter counts
 * @returns Navigation metadata with next/prev chapter references
 *
 * @example
 * ```ts
 * // Within book navigation
 * useChapterNavigation(1, 1, books)
 * // => { nextChapter: { bookId: 1, chapterNumber: 2 }, prevChapter: null, ... }
 *
 * // Cross-book navigation
 * useChapterNavigation(1, 50, books)
 * // => { nextChapter: { bookId: 2, chapterNumber: 1 }, ... }
 *
 * // Bible boundaries
 * useChapterNavigation(66, 22, books)
 * // => { nextChapter: null, ... }
 * ```
 */
export function useChapterNavigation(
  bookId: number,
  chapterNumber: number,
  booksMetadata: TestamentBook[] | undefined
): ChapterNavigation {
  return useMemo(() => {
    // Handle undefined or empty metadata
    if (!booksMetadata || booksMetadata.length === 0) {
      return {
        nextChapter: null,
        prevChapter: null,
        canGoNext: false,
        canGoPrevious: false,
      };
    }

    // Find current book metadata
    const currentBook = booksMetadata.find((b) => b.id === bookId);
    if (!currentBook) {
      // Invalid book ID
      return {
        nextChapter: null,
        prevChapter: null,
        canGoNext: false,
        canGoPrevious: false,
      };
    }

    // Calculate next chapter
    let nextChapter: ChapterLocation | null = null;

    if (chapterNumber < currentBook.chapterCount) {
      // Next chapter is within the same book
      nextChapter = {
        bookId,
        chapterNumber: chapterNumber + 1,
      };
    } else if (bookId < 66) {
      // Last chapter of current book, move to first chapter of next book
      nextChapter = {
        bookId: bookId + 1,
        chapterNumber: 1,
      };
    }
    // else: bookId === 66 && at last chapter => null (Revelation 22)

    // Calculate previous chapter
    let prevChapter: ChapterLocation | null = null;

    if (chapterNumber > 1) {
      // Previous chapter is within the same book
      prevChapter = {
        bookId,
        chapterNumber: chapterNumber - 1,
      };
    } else if (bookId > 1) {
      // First chapter of current book, move to last chapter of previous book
      const prevBook = booksMetadata.find((b) => b.id === bookId - 1);
      if (prevBook) {
        prevChapter = {
          bookId: bookId - 1,
          chapterNumber: prevBook.chapterCount,
        };
      }
    }
    // else: bookId === 1 && chapterNumber === 1 => null (Genesis 1)

    return {
      nextChapter,
      prevChapter,
      canGoNext: nextChapter !== null,
      canGoPrevious: prevChapter !== null,
    };
  }, [bookId, chapterNumber, booksMetadata]);
}
