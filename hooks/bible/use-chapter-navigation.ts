/**
 * useChapterNavigation Hook
 *
 * Encapsulates cross-book navigation logic for Bible chapter reading.
 * Calculates next/previous chapter references considering:
 * - Within-book navigation (Genesis 1 -> Genesis 2)
 * - Cross-book navigation (Genesis 50 -> Exodus 1)
 * - Testament boundaries (Malachi 4 -> Matthew 1)
 * - Bible boundaries (Genesis 1, Revelation 22)
 * - Single-chapter books (Obadiah, Philemon, 2 John, 3 John, Jude)
 *
 * Supports two navigation modes:
 * - Linear (default): Stops at Bible boundaries
 * - Circular: Wraps from Genesis 1 <-> Revelation 22
 *
 * @example
 * ```tsx
 * // Linear mode (default) - stops at boundaries
 * const { nextChapter, prevChapter, canGoNext, canGoPrevious } = useChapterNavigation(
 *   1,    // Genesis
 *   1,    // Chapter 1
 *   books // Books metadata
 * );
 * // prevChapter: null (at Bible start)
 * // canGoPrevious: false
 *
 * // Circular mode - wraps at boundaries
 * const nav = useChapterNavigation(1, 1, books, true);
 * // prevChapter: { bookId: 66, chapterNumber: 22 } (Revelation 22)
 * // canGoPrevious: true
 * ```
 *
 * @see Spec: agent-os/specs/2026-02-01-chapter-header-slide-sync-v3/spec.md
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
 * Behavior depends on navigation mode:
 * - Linear mode: Returns null at boundaries, canGo* returns false
 * - Circular mode: Wraps at boundaries, canGo* always true
 */
export interface ChapterNavigation {
  /** Next chapter reference (null at Revelation 22 in linear mode) */
  nextChapter: ChapterLocation | null;
  /** Previous chapter reference (null at Genesis 1 in linear mode) */
  prevChapter: ChapterLocation | null;
  /** Whether next navigation is available */
  canGoNext: boolean;
  /** Whether previous navigation is available */
  canGoPrevious: boolean;
}

/**
 * Hook to calculate next/previous chapter navigation.
 *
 * @param bookId - Current book ID (1-66)
 * @param chapterNumber - Current chapter number (1-based)
 * @param booksMetadata - Array of all Bible books with chapter counts
 * @param circular - Enable circular navigation at boundaries (default: false)
 * @returns Navigation metadata with next/prev chapter references
 *
 * @example
 * ```ts
 * // Linear mode (default)
 * useChapterNavigation(1, 1, books)
 * // => { nextChapter: { bookId: 1, chapterNumber: 2 }, prevChapter: null, canGoPrevious: false }
 *
 * // Cross-book navigation
 * useChapterNavigation(1, 50, books)
 * // => { nextChapter: { bookId: 2, chapterNumber: 1 }, prevChapter: { bookId: 1, chapterNumber: 49 } }
 *
 * // Circular mode at Bible end
 * useChapterNavigation(66, 22, books, true)
 * // => { nextChapter: { bookId: 1, chapterNumber: 1 }, canGoNext: true }
 * ```
 */
export function useChapterNavigation(
  bookId: number,
  chapterNumber: number,
  booksMetadata: TestamentBook[] | undefined,
  circular: boolean = false
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
    let isAtBibleEnd = false;

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
      // At Revelation 22 (last chapter of Bible)
      isAtBibleEnd = true;
      if (circular) {
        // Wrap to Genesis 1
        nextChapter = {
          bookId: 1,
          chapterNumber: 1,
        };
      } else {
        // Linear mode: no next chapter
        nextChapter = null;
      }
    }

    // Calculate previous chapter
    let prevChapter: ChapterLocation | null = null;
    let isAtBibleStart = false;

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
      // At Genesis 1 (first chapter of Bible)
      isAtBibleStart = true;
      if (circular) {
        // Wrap to Revelation 22
        prevChapter = {
          bookId: 66,
          chapterNumber: revelationChapterCount,
        };
      } else {
        // Linear mode: no previous chapter
        prevChapter = null;
      }
    }

    // Determine navigation availability
    const canGoNext = circular ? !isAtBibleEnd || true : nextChapter !== null;
    const canGoPrevious = circular ? !isAtBibleStart || true : prevChapter !== null;

    return {
      nextChapter,
      prevChapter,
      canGoNext,
      canGoPrevious,
    };
  }, [bookId, chapterNumber, booksMetadata, circular]);
}
