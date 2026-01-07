/**
 * useChapterNavigation Hook
 *
 * Encapsulates cross-book navigation logic for Bible chapter reading.
 * Calculates next/previous chapter references considering:
 * - Within-book navigation (Genesis 1 -> Genesis 2)
 * - Cross-book navigation (Genesis 50 -> Exodus 1)
 * - Testament boundaries (Malachi 4 -> Matthew 1)
 * - Circular Bible boundaries (Genesis 1 <-> Revelation 22)
 * - Single-chapter books (Obadiah, Philemon, 2 John, 3 John, Jude)
 *
 * Navigation is circular: swiping backward from Genesis 1 navigates to Revelation 22,
 * and swiping forward from Revelation 22 navigates to Genesis 1.
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
 *
 * // At Genesis 1 (Bible start):
 * // prevChapter: { bookId: 66, chapterNumber: 22 } (Revelation 22 - wraps around)
 * // canGoPrevious: true (circular navigation)
 *
 * // At Revelation 22 (Bible end):
 * // nextChapter: { bookId: 1, chapterNumber: 1 } (Genesis 1 - wraps around)
 * // canGoNext: true (circular navigation)
 * ```
 *
 * @see Spec: agent-os/specs/2025-10-23-native-page-swipe-navigation/spec.md (lines 248-270)
 * @see Spec: agent-os/specs/circular-bible-navigation/spec.md
 */

import { useMemo } from 'react';
import type { TestamentBook } from '@/src/api';

/**
 * Chapter location reference
 */
export interface ChapterLocation {
  bookId: number;
  chapterNumber: number;
}

/**
 * Navigation result with next/previous chapter references.
 *
 * With circular navigation enabled:
 * - `nextChapter` is always non-null (wraps from Revelation 22 to Genesis 1)
 * - `prevChapter` is always non-null (wraps from Genesis 1 to Revelation 22)
 * - `canGoNext` and `canGoPrevious` are always true when metadata is valid
 */
export interface ChapterNavigation {
  /** Next chapter reference (wraps from Revelation 22 to Genesis 1) */
  nextChapter: ChapterLocation | null;
  /** Previous chapter reference (wraps from Genesis 1 to Revelation 22) */
  prevChapter: ChapterLocation | null;
  /** Whether next navigation is available (always true with valid metadata) */
  canGoNext: boolean;
  /** Whether previous navigation is available (always true with valid metadata) */
  canGoPrevious: boolean;
}

/**
 * Hook to calculate next/previous chapter navigation with circular wrap-around.
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
 * // => { nextChapter: { bookId: 1, chapterNumber: 2 }, prevChapter: { bookId: 66, chapterNumber: 22 }, ... }
 *
 * // Cross-book navigation
 * useChapterNavigation(1, 50, books)
 * // => { nextChapter: { bookId: 2, chapterNumber: 1 }, ... }
 *
 * // Circular navigation at Bible end
 * useChapterNavigation(66, 22, books)
 * // => { nextChapter: { bookId: 1, chapterNumber: 1 }, ... }
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

    // Find Revelation (last book) for circular navigation
    const revelationBook = booksMetadata.find((b) => b.id === 66);
    const revelationChapterCount = revelationBook?.chapterCount ?? 22;

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
    } else {
      // At Revelation 22 (last chapter of Bible) - wrap to Genesis 1
      nextChapter = {
        bookId: 1,
        chapterNumber: 1,
      };
    }

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
    } else {
      // At Genesis 1 (first chapter of Bible) - wrap to Revelation 22
      prevChapter = {
        bookId: 66,
        chapterNumber: revelationChapterCount,
      };
    }

    // With circular navigation, we can always navigate (as long as we have valid references)
    return {
      nextChapter,
      prevChapter,
      canGoNext: nextChapter !== null,
      canGoPrevious: prevChapter !== null,
    };
  }, [bookId, chapterNumber, booksMetadata]);
}
