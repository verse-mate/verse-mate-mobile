/**
 * Utility to parse Bible verse references
 * Handles formats like "Genesis 1:1", "John 3:16", "1 Corinthians 13:4"
 */

import { getBookByName } from '@/constants/bible-books';

/**
 * Parsed verse reference data
 */
export interface ParsedVerseReference {
  bookId: number;
  bookName: string;
  chapterNumber: number;
  verseNumber: number;
  originalReference: string;
}

/**
 * Parse a verse reference string into its components
 * Supports formats:
 * - "Genesis 1:1"
 * - "John 3:16"
 * - "1 Corinthians 13:4-7" (returns start verse only)
 * - "Psalm 23:1" (handles "Psalm" and "Psalms")
 *
 * @param reference - Verse reference string (e.g., "Genesis 1:1")
 * @returns Parsed reference data or null if invalid
 */
export function parseVerseReference(reference: string): ParsedVerseReference | null {
  if (!reference || typeof reference !== 'string') {
    return null;
  }

  // Regex to match book name, chapter, and verse
  // Handles: "Book Name Chapter:Verse" or "Book Name Chapter:Verse-EndVerse"
  const match = reference.match(/^(.+?)\s+(\d+):(\d+)(?:-\d+)?$/);

  if (!match) {
    return null;
  }

  const [, bookName, chapterStr, verseStr] = match;
  const chapterNumber = Number.parseInt(chapterStr, 10);
  const verseNumber = Number.parseInt(verseStr, 10);

  if (Number.isNaN(chapterNumber) || Number.isNaN(verseNumber)) {
    return null;
  }

  // Find book by name (handles "Psalm" -> "Psalms" special case)
  const book = getBookByName(bookName);

  if (!book) {
    console.warn(`Could not find book for reference: ${reference}`);
    return null;
  }

  return {
    bookId: book.id,
    bookName: book.name,
    chapterNumber,
    verseNumber,
    originalReference: reference,
  };
}

/**
 * Format a verse reference for display
 * @param bookName - Book name (e.g., "Genesis")
 * @param chapter - Chapter number
 * @param verse - Verse number
 * @returns Formatted reference (e.g., "Genesis 1:1")
 */
export function formatVerseReference(bookName: string, chapter: number, verse: number): string {
  return `${bookName} ${chapter}:${verse}`;
}
