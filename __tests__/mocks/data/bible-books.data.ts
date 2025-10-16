/**
 * Mock data: Bible books metadata
 *
 * Simplified list of all 66 Bible books for testing
 */

import type { TestamentBook } from '../../../src/api/generated';

/**
 * All 66 Bible books with metadata
 * Format matches GET /bible/testaments response
 */
export const mockTestamentBooks: TestamentBook[] = [
  // Old Testament (1-39)
  { id: 1, chapterCount: 50, name: 'Genesis', testament: 'OT', genre: 1 },
  { id: 2, chapterCount: 40, name: 'Exodus', testament: 'OT', genre: 1 },
  { id: 3, chapterCount: 27, name: 'Leviticus', testament: 'OT', genre: 1 },
  { id: 4, chapterCount: 36, name: 'Numbers', testament: 'OT', genre: 1 },
  { id: 5, chapterCount: 34, name: 'Deuteronomy', testament: 'OT', genre: 1 },
  { id: 6, chapterCount: 24, name: 'Joshua', testament: 'OT', genre: 2 },
  { id: 7, chapterCount: 21, name: 'Judges', testament: 'OT', genre: 2 },
  { id: 8, chapterCount: 4, name: 'Ruth', testament: 'OT', genre: 2 },
  { id: 9, chapterCount: 31, name: '1 Samuel', testament: 'OT', genre: 2 },
  { id: 10, chapterCount: 24, name: '2 Samuel', testament: 'OT', genre: 2 },
  { id: 11, chapterCount: 22, name: '1 Kings', testament: 'OT', genre: 2 },
  { id: 12, chapterCount: 25, name: '2 Kings', testament: 'OT', genre: 2 },
  { id: 13, chapterCount: 29, name: '1 Chronicles', testament: 'OT', genre: 2 },
  { id: 14, chapterCount: 36, name: '2 Chronicles', testament: 'OT', genre: 2 },
  { id: 15, chapterCount: 10, name: 'Ezra', testament: 'OT', genre: 2 },
  { id: 16, chapterCount: 13, name: 'Nehemiah', testament: 'OT', genre: 2 },
  { id: 17, chapterCount: 10, name: 'Esther', testament: 'OT', genre: 2 },
  { id: 18, chapterCount: 42, name: 'Job', testament: 'OT', genre: 3 },
  { id: 19, chapterCount: 150, name: 'Psalms', testament: 'OT', genre: 3 },
  { id: 20, chapterCount: 31, name: 'Proverbs', testament: 'OT', genre: 3 },
  { id: 21, chapterCount: 12, name: 'Ecclesiastes', testament: 'OT', genre: 3 },
  { id: 22, chapterCount: 8, name: 'Song of Solomon', testament: 'OT', genre: 3 },
  { id: 23, chapterCount: 66, name: 'Isaiah', testament: 'OT', genre: 4 },
  { id: 24, chapterCount: 52, name: 'Jeremiah', testament: 'OT', genre: 4 },
  { id: 25, chapterCount: 5, name: 'Lamentations', testament: 'OT', genre: 4 },
  { id: 26, chapterCount: 48, name: 'Ezekiel', testament: 'OT', genre: 4 },
  { id: 27, chapterCount: 12, name: 'Daniel', testament: 'OT', genre: 4 },
  { id: 28, chapterCount: 14, name: 'Hosea', testament: 'OT', genre: 4 },
  { id: 29, chapterCount: 3, name: 'Joel', testament: 'OT', genre: 4 },
  { id: 30, chapterCount: 9, name: 'Amos', testament: 'OT', genre: 4 },
  { id: 31, chapterCount: 1, name: 'Obadiah', testament: 'OT', genre: 4 },
  { id: 32, chapterCount: 4, name: 'Jonah', testament: 'OT', genre: 4 },
  { id: 33, chapterCount: 7, name: 'Micah', testament: 'OT', genre: 4 },
  { id: 34, chapterCount: 3, name: 'Nahum', testament: 'OT', genre: 4 },
  { id: 35, chapterCount: 3, name: 'Habakkuk', testament: 'OT', genre: 4 },
  { id: 36, chapterCount: 3, name: 'Zephaniah', testament: 'OT', genre: 4 },
  { id: 37, chapterCount: 2, name: 'Haggai', testament: 'OT', genre: 4 },
  { id: 38, chapterCount: 14, name: 'Zechariah', testament: 'OT', genre: 4 },
  { id: 39, chapterCount: 4, name: 'Malachi', testament: 'OT', genre: 4 },

  // New Testament (40-66)
  { id: 40, chapterCount: 28, name: 'Matthew', testament: 'NT', genre: 5 },
  { id: 41, chapterCount: 16, name: 'Mark', testament: 'NT', genre: 5 },
  { id: 42, chapterCount: 24, name: 'Luke', testament: 'NT', genre: 5 },
  { id: 43, chapterCount: 21, name: 'John', testament: 'NT', genre: 5 },
  { id: 44, chapterCount: 28, name: 'Acts', testament: 'NT', genre: 6 },
  { id: 45, chapterCount: 16, name: 'Romans', testament: 'NT', genre: 7 },
  { id: 46, chapterCount: 16, name: '1 Corinthians', testament: 'NT', genre: 7 },
  { id: 47, chapterCount: 13, name: '2 Corinthians', testament: 'NT', genre: 7 },
  { id: 48, chapterCount: 6, name: 'Galatians', testament: 'NT', genre: 7 },
  { id: 49, chapterCount: 6, name: 'Ephesians', testament: 'NT', genre: 7 },
  { id: 50, chapterCount: 4, name: 'Philippians', testament: 'NT', genre: 7 },
  { id: 51, chapterCount: 4, name: 'Colossians', testament: 'NT', genre: 7 },
  { id: 52, chapterCount: 5, name: '1 Thessalonians', testament: 'NT', genre: 7 },
  { id: 53, chapterCount: 3, name: '2 Thessalonians', testament: 'NT', genre: 7 },
  { id: 54, chapterCount: 6, name: '1 Timothy', testament: 'NT', genre: 7 },
  { id: 55, chapterCount: 4, name: '2 Timothy', testament: 'NT', genre: 7 },
  { id: 56, chapterCount: 3, name: 'Titus', testament: 'NT', genre: 7 },
  { id: 57, chapterCount: 1, name: 'Philemon', testament: 'NT', genre: 7 },
  { id: 58, chapterCount: 13, name: 'Hebrews', testament: 'NT', genre: 7 },
  { id: 59, chapterCount: 5, name: 'James', testament: 'NT', genre: 7 },
  { id: 60, chapterCount: 5, name: '1 Peter', testament: 'NT', genre: 7 },
  { id: 61, chapterCount: 3, name: '2 Peter', testament: 'NT', genre: 7 },
  { id: 62, chapterCount: 5, name: '1 John', testament: 'NT', genre: 7 },
  { id: 63, chapterCount: 1, name: '2 John', testament: 'NT', genre: 7 },
  { id: 64, chapterCount: 1, name: '3 John', testament: 'NT', genre: 7 },
  { id: 65, chapterCount: 1, name: 'Jude', testament: 'NT', genre: 7 },
  { id: 66, chapterCount: 22, name: 'Revelation', testament: 'NT', genre: 8 },
];

/**
 * Get mock book by ID
 */
export function getMockBook(bookId: number): TestamentBook | undefined {
  return mockTestamentBooks.find((b) => b.id === bookId);
}

/**
 * Get mock books by testament
 */
export function getMockBooksByTestament(testament: 'OT' | 'NT'): TestamentBook[] {
  return mockTestamentBooks.filter((b) => b.testament === testament);
}
