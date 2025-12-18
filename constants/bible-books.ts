/**
 * Bible Books Constants
 *
 * Contains metadata for all 66 Bible books for parsing and reference handling.
 */

export interface BibleBook {
  id: number;
  name: string;
  testament: 'OT' | 'NT';
  chapterCount: number;
}

/**
 * All 66 Bible books with metadata
 */
export const BIBLE_BOOKS: BibleBook[] = [
  // Old Testament (1-39)
  { id: 1, chapterCount: 50, name: 'Genesis', testament: 'OT' },
  { id: 2, chapterCount: 40, name: 'Exodus', testament: 'OT' },
  { id: 3, chapterCount: 27, name: 'Leviticus', testament: 'OT' },
  { id: 4, chapterCount: 36, name: 'Numbers', testament: 'OT' },
  { id: 5, chapterCount: 34, name: 'Deuteronomy', testament: 'OT' },
  { id: 6, chapterCount: 24, name: 'Joshua', testament: 'OT' },
  { id: 7, chapterCount: 21, name: 'Judges', testament: 'OT' },
  { id: 8, chapterCount: 4, name: 'Ruth', testament: 'OT' },
  { id: 9, chapterCount: 31, name: '1 Samuel', testament: 'OT' },
  { id: 10, chapterCount: 24, name: '2 Samuel', testament: 'OT' },
  { id: 11, chapterCount: 22, name: '1 Kings', testament: 'OT' },
  { id: 12, chapterCount: 25, name: '2 Kings', testament: 'OT' },
  { id: 13, chapterCount: 29, name: '1 Chronicles', testament: 'OT' },
  { id: 14, chapterCount: 36, name: '2 Chronicles', testament: 'OT' },
  { id: 15, chapterCount: 10, name: 'Ezra', testament: 'OT' },
  { id: 16, chapterCount: 13, name: 'Nehemiah', testament: 'OT' },
  { id: 17, chapterCount: 10, name: 'Esther', testament: 'OT' },
  { id: 18, chapterCount: 42, name: 'Job', testament: 'OT' },
  { id: 19, chapterCount: 150, name: 'Psalms', testament: 'OT' },
  { id: 20, chapterCount: 31, name: 'Proverbs', testament: 'OT' },
  { id: 21, chapterCount: 12, name: 'Ecclesiastes', testament: 'OT' },
  { id: 22, chapterCount: 8, name: 'Song of Solomon', testament: 'OT' },
  { id: 23, chapterCount: 66, name: 'Isaiah', testament: 'OT' },
  { id: 24, chapterCount: 52, name: 'Jeremiah', testament: 'OT' },
  { id: 25, chapterCount: 5, name: 'Lamentations', testament: 'OT' },
  { id: 26, chapterCount: 48, name: 'Ezekiel', testament: 'OT' },
  { id: 27, chapterCount: 12, name: 'Daniel', testament: 'OT' },
  { id: 28, chapterCount: 14, name: 'Hosea', testament: 'OT' },
  { id: 29, chapterCount: 3, name: 'Joel', testament: 'OT' },
  { id: 30, chapterCount: 9, name: 'Amos', testament: 'OT' },
  { id: 31, chapterCount: 1, name: 'Obadiah', testament: 'OT' },
  { id: 32, chapterCount: 4, name: 'Jonah', testament: 'OT' },
  { id: 33, chapterCount: 7, name: 'Micah', testament: 'OT' },
  { id: 34, chapterCount: 3, name: 'Nahum', testament: 'OT' },
  { id: 35, chapterCount: 3, name: 'Habakkuk', testament: 'OT' },
  { id: 36, chapterCount: 3, name: 'Zephaniah', testament: 'OT' },
  { id: 37, chapterCount: 2, name: 'Haggai', testament: 'OT' },
  { id: 38, chapterCount: 14, name: 'Zechariah', testament: 'OT' },
  { id: 39, chapterCount: 4, name: 'Malachi', testament: 'OT' },

  // New Testament (40-66)
  { id: 40, chapterCount: 28, name: 'Matthew', testament: 'NT' },
  { id: 41, chapterCount: 16, name: 'Mark', testament: 'NT' },
  { id: 42, chapterCount: 24, name: 'Luke', testament: 'NT' },
  { id: 43, chapterCount: 21, name: 'John', testament: 'NT' },
  { id: 44, chapterCount: 28, name: 'Acts', testament: 'NT' },
  { id: 45, chapterCount: 16, name: 'Romans', testament: 'NT' },
  { id: 46, chapterCount: 16, name: '1 Corinthians', testament: 'NT' },
  { id: 47, chapterCount: 13, name: '2 Corinthians', testament: 'NT' },
  { id: 48, chapterCount: 6, name: 'Galatians', testament: 'NT' },
  { id: 49, chapterCount: 6, name: 'Ephesians', testament: 'NT' },
  { id: 50, chapterCount: 4, name: 'Philippians', testament: 'NT' },
  { id: 51, chapterCount: 4, name: 'Colossians', testament: 'NT' },
  { id: 52, chapterCount: 5, name: '1 Thessalonians', testament: 'NT' },
  { id: 53, chapterCount: 3, name: '2 Thessalonians', testament: 'NT' },
  { id: 54, chapterCount: 6, name: '1 Timothy', testament: 'NT' },
  { id: 55, chapterCount: 4, name: '2 Timothy', testament: 'NT' },
  { id: 56, chapterCount: 3, name: 'Titus', testament: 'NT' },
  { id: 57, chapterCount: 1, name: 'Philemon', testament: 'NT' },
  { id: 58, chapterCount: 13, name: 'Hebrews', testament: 'NT' },
  { id: 59, chapterCount: 5, name: 'James', testament: 'NT' },
  { id: 60, chapterCount: 5, name: '1 Peter', testament: 'NT' },
  { id: 61, chapterCount: 3, name: '2 Peter', testament: 'NT' },
  { id: 62, chapterCount: 5, name: '1 John', testament: 'NT' },
  { id: 63, chapterCount: 1, name: '2 John', testament: 'NT' },
  { id: 64, chapterCount: 1, name: '3 John', testament: 'NT' },
  { id: 65, chapterCount: 1, name: 'Jude', testament: 'NT' },
  { id: 66, chapterCount: 22, name: 'Revelation', testament: 'NT' },
];

/**
 * Get book by ID
 */
export function getBookById(bookId: number): BibleBook | undefined {
  return BIBLE_BOOKS.find((b) => b.id === bookId);
}

/**
 * Get book by name (case-insensitive)
 */
export function getBookByName(name: string): BibleBook | undefined {
  const normalizedName = name.trim();

  // Handle "Psalm" -> "Psalms" special case
  if (normalizedName.toLowerCase() === 'psalm') {
    return BIBLE_BOOKS.find((b) => b.name === 'Psalms');
  }

  return BIBLE_BOOKS.find((b) => b.name.toLowerCase() === normalizedName.toLowerCase());
}

/**
 * Get books by testament
 */
export function getBooksByTestament(testament: 'OT' | 'NT'): BibleBook[] {
  return BIBLE_BOOKS.filter((b) => b.testament === testament);
}
