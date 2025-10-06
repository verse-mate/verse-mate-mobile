/**
 * Bible API TypeScript Types
 *
 * Generated from actual API responses
 * Base URL: https://api.verse-mate.apegro.dev
 * Date: 2025-10-06
 */

// ============================================================================
// Core Domain Types
// ============================================================================

/**
 * Genre classification for Bible books
 * Genres: 1=Law, 2=History, 3=Wisdom, 4=Prophets, 5=Gospels, 6=Acts, 7=Epistles, 8=Apocalyptic
 */
export interface BibleGenre {
  g: number;      // Genre ID
  n: string;      // Genre name
}

/**
 * Verse with number and text
 */
export interface Verse {
  verseNumber: number;
  text: string;
}

/**
 * Verse ID variant (used in /bible/books response)
 */
export interface VerseWithId {
  verseId: number;
  text: string;
}

/**
 * Subtitle section header with verse range
 */
export interface Subtitle {
  subtitle: string;
  start_verse: number;
  end_verse: number;
}

/**
 * Chapter with verses and subtitles
 */
export interface Chapter {
  chapterNumber: number;
  subtitles: Subtitle[];
  verses: Verse[];
}

/**
 * Chapter variant with ID (used in /bible/books response)
 */
export interface ChapterWithId {
  chapterId: number;
  subtitles: Subtitle[];
  verses: VerseWithId[];
}

/**
 * Bible book metadata
 */
export interface BibleBook {
  bookId: number;
  name: string;
  testament: 'OT' | 'NT';
  genre: BibleGenre;
  chapters: Chapter[] | ChapterWithId[];
}

/**
 * Simplified book info (from /bible/testaments)
 *
 * Field mappings:
 * - b: book ID
 * - c: chapter count
 * - n: book name
 * - t: testament (OT/NT)
 * - g: genre ID
 */
export interface TestamentBook {
  b: number;      // bookId
  c: number;      // chapter count
  n: string;      // name
  t: 'OT' | 'NT'; // testament
  g: number;      // genre ID
}

// ============================================================================
// API Response Types
// ============================================================================

/**
 * GET /bible/books
 *
 * Returns all 66 Bible books with ALL chapters and verses.
 * WARNING: This response is VERY large (~10MB+).
 * Use /bible/book/{bookId}/{chapterNumber} for single chapters instead.
 */
export interface GetBibleBooksResponse {
  books: BibleBook[];
}

/**
 * GET /bible/testaments
 *
 * Returns all 66 books with metadata but no verse content.
 * Lighter weight than /bible/books.
 */
export interface GetBibleTestamentsResponse {
  testaments: {
    keys: TestamentBook[];
  };
}

/**
 * GET /bible/book/{bookId}/{chapterNumber}
 *
 * Returns a single chapter with verses and subtitles.
 */
export interface GetBibleChapterResponse {
  book: {
    bookId: number;
    name: string;
    testament: 'OT' | 'NT';
    genre: BibleGenre;
    chapters: [Chapter]; // Always array with single chapter
  };
}

/**
 * GET /bible/book/explanation/{bookId}/{chapterNumber}
 *
 * Returns AI-generated explanation for a chapter.
 *
 * Query Parameters:
 * - versionKey?: string (Bible version, e.g., "NASB", "NIV")
 * - explanationType?: string (e.g., "summary", "byline", "detailed")
 */
export interface GetBibleExplanationResponse {
  explanation: {
    book_id: number;
    chapter_number: number;
    type: string;                    // "summary", "byline", "detailed"
    explanation: string;              // Markdown-formatted explanation
    explanation_id: number;
    language_code: string;            // e.g., "en-US"
  };
}

/**
 * POST /bible/book/chapter/save-last-read
 *
 * Saves user's last read position.
 */
export interface SaveLastReadRequest {
  user_id: string;        // UUID
  book_id: number;
  chapter_number: number;
}

/**
 * POST /bible/book/chapter/last-read
 *
 * Gets user's last read position.
 */
export interface GetLastReadRequest {
  user_id: string;        // UUID
}

export interface GetLastReadResponse {
  book_id: number;
  chapter_number: number;
}

// ============================================================================
// Normalized/Transformed Types (for Frontend Use)
// ============================================================================

/**
 * Normalized book metadata (without chapter content)
 * Used for book selection lists and navigation
 */
export interface BookMetadata {
  id: number;
  name: string;
  testament: 'OT' | 'NT';
  chapterCount: number;
  genre: {
    id: number;
    name: string;
  };
}

/**
 * Normalized chapter content
 * Used for displaying Bible text
 */
export interface ChapterContent {
  bookId: number;
  bookName: string;
  chapterNumber: number;
  testament: 'OT' | 'NT';
  title: string;            // e.g., "Genesis 1"
  sections: ChapterSection[];
}

/**
 * Chapter section with subtitle and verses
 */
export interface ChapterSection {
  subtitle?: string;
  startVerse: number;
  endVerse: number;
  verses: Verse[];
}

/**
 * Normalized explanation content
 */
export interface ExplanationContent {
  bookId: number;
  chapterNumber: number;
  type: 'summary' | 'byline' | 'detailed';
  content: string;          // Markdown-formatted
  explanationId: number;
  languageCode: string;
}

// ============================================================================
// Helper/Utility Types
// ============================================================================

/**
 * Reading position tracking
 */
export interface ReadingPosition {
  bookId: number;
  chapterNumber: number;
  timestamp: number;        // Unix timestamp
}

/**
 * Reading progress for a book
 */
export interface BookProgress {
  bookId: number;
  chaptersRead: number[];   // Array of chapter numbers read
  lastChapterRead: number;
  totalChapters: number;
  percentage: number;       // 0-100
}

/**
 * Content tab type
 */
export type ContentTabType = 'summary' | 'byline' | 'detailed';

/**
 * Testament type
 */
export type Testament = 'OT' | 'NT';

/**
 * Bible version key
 */
export type BibleVersion = 'NASB' | 'NIV' | 'ESV' | 'KJV' | string;

// ============================================================================
// Type Guards
// ============================================================================

export function isOldTestament(bookId: number): boolean {
  return bookId >= 1 && bookId <= 39;
}

export function isNewTestament(bookId: number): boolean {
  return bookId >= 40 && bookId <= 66;
}

export function getTestament(bookId: number): Testament {
  return isOldTestament(bookId) ? 'OT' : 'NT';
}

/**
 * Genre ID to name mapping
 */
export const GENRE_NAMES: Record<number, string> = {
  1: 'Law',
  2: 'History',
  3: 'Wisdom',
  4: 'Prophets',
  5: 'Gospels',
  6: 'Acts',
  7: 'Epistles',
  8: 'Apocalyptic',
};

/**
 * Get genre name from ID
 */
export function getGenreName(genreId: number): string {
  return GENRE_NAMES[genreId] || 'Unknown';
}

// ============================================================================
// Data Transformers
// ============================================================================

/**
 * Transform TestamentBook to BookMetadata
 */
export function transformTestamentBook(book: TestamentBook): BookMetadata {
  return {
    id: book.b,
    name: book.n,
    testament: book.t,
    chapterCount: book.c,
    genre: {
      id: book.g,
      name: getGenreName(book.g),
    },
  };
}

/**
 * Transform API chapter response to ChapterContent
 */
export function transformChapterResponse(response: GetBibleChapterResponse): ChapterContent {
  const { book } = response;
  const chapter = book.chapters[0]; // Always single chapter

  // Group verses by subtitle sections
  const sections: ChapterSection[] = [];

  if (chapter.subtitles.length === 0) {
    // No subtitles - all verses in one section
    sections.push({
      startVerse: 1,
      endVerse: chapter.verses.length,
      verses: chapter.verses,
    });
  } else {
    // Group verses by subtitle
    chapter.subtitles.forEach((subtitle, index) => {
      const startVerse = subtitle.start_verse;
      const endVerse = subtitle.end_verse;

      const sectionVerses = chapter.verses.filter(
        v => v.verseNumber >= startVerse && v.verseNumber <= endVerse
      );

      sections.push({
        subtitle: subtitle.subtitle,
        startVerse,
        endVerse,
        verses: sectionVerses,
      });
    });
  }

  return {
    bookId: book.bookId,
    bookName: book.name,
    chapterNumber: chapter.chapterNumber,
    testament: book.testament,
    title: `${book.name} ${chapter.chapterNumber}`,
    sections,
  };
}

/**
 * Transform explanation response to ExplanationContent
 */
export function transformExplanationResponse(
  response: GetBibleExplanationResponse
): ExplanationContent {
  const { explanation } = response;

  return {
    bookId: explanation.book_id,
    chapterNumber: explanation.chapter_number,
    type: explanation.type as ContentTabType,
    content: explanation.explanation,
    explanationId: explanation.explanation_id,
    languageCode: explanation.language_code,
  };
}
