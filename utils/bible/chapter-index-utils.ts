/**
 * Chapter Index Calculation Utilities
 *
 * Provides utilities for converting between:
 * - (bookId, chapterNumber) ↔ absolute page index (0-1188)
 *
 * The Bible has 1,189 chapters across 66 books. These utilities enable
 * page-based navigation by converting between book-based chapter references
 * and absolute zero-indexed positions.
 *
 * @example
 * ```ts
 * // Genesis 1 is index 0
 * getAbsolutePageIndex(1, 1, books) // => 0
 *
 * // Exodus 1 is index 50 (after Genesis's 50 chapters)
 * getAbsolutePageIndex(2, 1, books) // => 50
 *
 * // Revelation 22 is the last chapter
 * getAbsolutePageIndex(66, 22, books) // => 1188
 *
 * // Convert back from index to chapter reference
 * getChapterFromPageIndex(50, books) // => { bookId: 2, chapterNumber: 1 }
 * ```
 *
 * @see Spec: agent-os/specs/2025-10-23-native-page-swipe-navigation/spec.md
 */

import type { TestamentBook } from '@/src/api';

/**
 * Chapter location reference (bookId + chapterNumber)
 */
export interface ChapterLocation {
  bookId: number;
  chapterNumber: number;
}

/**
 * Get the absolute zero-indexed page index for a given book and chapter
 *
 * Calculates the cumulative index by summing all chapters in books before
 * the target book, then adding the chapter offset within the book.
 *
 * @param bookId - Book ID (1-66)
 * @param chapterNumber - Chapter number (1-based)
 * @param booksMetadata - Array of all Bible books with chapter counts
 * @returns Zero-indexed absolute page index (0-1188), or -1 if invalid
 *
 * @example
 * ```ts
 * getAbsolutePageIndex(1, 1, books) // 0 (Genesis 1)
 * getAbsolutePageIndex(1, 50, books) // 49 (Genesis 50)
 * getAbsolutePageIndex(2, 1, books) // 50 (Exodus 1)
 * getAbsolutePageIndex(66, 22, books) // 1188 (Revelation 22)
 * ```
 */
export function getAbsolutePageIndex(
  bookId: number,
  chapterNumber: number,
  booksMetadata: TestamentBook[] | undefined
): number {
  // Validate inputs
  if (!booksMetadata || booksMetadata.length === 0) {
    return -1;
  }

  // Find the current book
  const currentBook = booksMetadata.find((b) => b.id === bookId);
  if (!currentBook) {
    return -1;
  }

  // Validate chapter number is within book's range
  if (chapterNumber < 1 || chapterNumber > currentBook.chapterCount) {
    return -1;
  }

  // Sum all chapters in books before this one
  let cumulativeIndex = 0;
  for (const book of booksMetadata) {
    if (book.id < bookId) {
      cumulativeIndex += book.chapterCount;
    } else {
      break; // We've reached the current book
    }
  }

  // Add the chapter offset within the current book (chapterNumber is 1-based)
  cumulativeIndex += chapterNumber - 1;

  return cumulativeIndex;
}

/**
 * Get the book ID and chapter number from an absolute page index
 *
 * Converts a zero-indexed absolute position back to a (bookId, chapterNumber) reference
 * by iterating through books and finding which book contains the index.
 *
 * @param pageIndex - Zero-indexed absolute page index (0-1188)
 * @param booksMetadata - Array of all Bible books with chapter counts
 * @returns Chapter location or null if invalid
 *
 * @example
 * ```ts
 * getChapterFromPageIndex(0, books) // { bookId: 1, chapterNumber: 1 }
 * getChapterFromPageIndex(50, books) // { bookId: 2, chapterNumber: 1 }
 * getChapterFromPageIndex(1188, books) // { bookId: 66, chapterNumber: 22 }
 * ```
 */
export function getChapterFromPageIndex(
  pageIndex: number,
  booksMetadata: TestamentBook[] | undefined
): ChapterLocation | null {
  // Validate inputs
  if (!booksMetadata || booksMetadata.length === 0 || pageIndex < 0) {
    return null;
  }

  // Iterate through books to find which contains this index
  let cumulativeChapters = 0;

  for (const book of booksMetadata) {
    const bookEndIndex = cumulativeChapters + book.chapterCount - 1;

    // Check if this index falls within the current book
    if (pageIndex <= bookEndIndex) {
      // Calculate chapter number within this book
      const chapterOffset = pageIndex - cumulativeChapters;
      const chapterNumber = chapterOffset + 1; // Convert to 1-based

      return {
        bookId: book.id,
        chapterNumber,
      };
    }

    cumulativeChapters += book.chapterCount;
  }

  // Index exceeds total Bible chapters
  return null;
}

/**
 * Validate if a page index is within valid Bible range
 *
 * @param pageIndex - Zero-indexed absolute page index
 * @param booksMetadata - Array of all Bible books with chapter counts
 * @returns True if index is valid (0-1188)
 *
 * @example
 * ```ts
 * isValidPageIndex(0, books) // true (Genesis 1)
 * isValidPageIndex(1188, books) // true (Revelation 22)
 * isValidPageIndex(-1, books) // false
 * isValidPageIndex(1189, books) // false
 * ```
 */
export function isValidPageIndex(
  pageIndex: number,
  booksMetadata: TestamentBook[] | undefined
): boolean {
  if (!booksMetadata || booksMetadata.length === 0 || pageIndex < 0) {
    return false;
  }

  const maxIndex = getMaxPageIndex(booksMetadata);
  return pageIndex <= maxIndex;
}

/**
 * Get the maximum valid page index (last chapter of Revelation)
 *
 * Calculates the total number of chapters in the Bible and returns
 * the zero-indexed maximum (total - 1).
 *
 * @param booksMetadata - Array of all Bible books with chapter counts
 * @returns Maximum page index (1188 for complete Bible), or 0 if invalid
 *
 * @example
 * ```ts
 * getMaxPageIndex(books) // 1188 (Revelation 22, 1189 total chapters)
 * ```
 */
export function getMaxPageIndex(booksMetadata: TestamentBook[] | undefined): number {
  if (!booksMetadata || booksMetadata.length === 0) {
    return 0;
  }

  // Sum all chapters across all books
  const totalChapters = booksMetadata.reduce((sum, book) => sum + book.chapterCount, 0);

  // Return zero-indexed maximum (totalChapters - 1)
  return totalChapters - 1;
}
