/**
 * Bible API Types
 *
 * Type definitions for the Bible API responses, with transformations
 * from the generated SDK types to the expected UI types.
 */

// Re-export generated types
export type {
  GetBibleBookByBookIdByChapterNumberResponse,
  GetBibleBookExplanationByBookIdByChapterNumberResponse,
  GetBibleBooksResponse,
  GetBibleTestamentsResponse,
  PostBibleBookChapterLastReadResponse,
} from '../generated/types.gen';

// Testament type
export type Testament = 'OT' | 'NT';

// Book metadata with friendly property names
export interface BookMetadata {
  /** Book ID (1-66) */
  id: number;
  /** Book name (e.g., "Genesis", "Matthew") */
  name: string;
  /** Testament (Old Testament or New Testament) */
  testament: Testament;
  /** Genre/category number */
  genre: number;
  /** Number of chapters in the book */
  chapterCount: number;
}

// Reading position
export interface ReadingPosition {
  book_id: number;
  chapter_number: number;
}

// Chapter section
export interface ChapterSection {
  subtitle?: string | null;
  startVerse?: number; // For UI display
  endVerse?: number; // For UI display
  verses: Verse[];
}

// Verse
export interface Verse {
  number: number;
  text: string;
  verseNumber: number; // API uses verseNumber, map to number (both required for compatibility)
}

// Explanation content
export interface ExplanationContent {
  /** Book ID (1-66) */
  bookId: number;
  /** Chapter number */
  chapterNumber: number;
  /** Explanation type (summary, detailed, etc.) */
  type: string;
  /** Explanation content */
  content: string;
  /** Language code (e.g., "en-US") */
  languageCode: string;
}

// Bible book (full details)
export interface BibleBook {
  bookName: string;
  chapterNumber: number;
  sections: ChapterSection[];
}

// Chapter content
export interface ChapterContent extends BibleBook {
  /** Book ID (1-66) */
  bookId: number;
  /** Testament (Old Testament or New Testament) */
  testament: string;
  /** Title for display (e.g., "Genesis 1") */
  title: string;
}

// Subtitle
export interface Subtitle {
  text: string;
  verseNumber: number;
}

/**
 * Transform API testament response to BookMetadata array
 */
export function transformTestamentsToBooks(
  testaments: { b: number; n: string; t: Testament; g: number; c: number }[]
): BookMetadata[] {
  return testaments.map((book) => ({
    id: book.b,
    name: book.n,
    testament: book.t,
    genre: book.g,
    chapterCount: book.c,
  }));
}

/**
 * Transform API chapter response to ChapterContent
 */
export function transformChapterResponse(apiResponse: {
  book?: {
    bookId: number;
    name: string;
    testament: string;
    genre: { g: number; n: string | unknown };
    chapters: {
      chapterNumber: number;
      subtitles: {
        subtitle: string;
        start_verse: number;
        end_verse: number;
      }[];
      verses: {
        verseNumber: number;
        text: string;
      }[];
    }[];
  };
  message?: string;
}): ChapterContent | null {
  if (!apiResponse.book || !apiResponse.book.chapters || apiResponse.book.chapters.length === 0) {
    return null;
  }

  const book = apiResponse.book;
  const chapter = book.chapters[0];

  // Group verses by subtitle
  const sections: ChapterSection[] = [];

  if (chapter.subtitles && chapter.subtitles.length > 0) {
    for (const subtitle of chapter.subtitles) {
      const sectionVerses = chapter.verses
        .filter((v) => v.verseNumber >= subtitle.start_verse && v.verseNumber <= subtitle.end_verse)
        .map((v) => ({
          number: v.verseNumber,
          text: v.text,
          verseNumber: v.verseNumber,
        }));

      sections.push({
        subtitle: subtitle.subtitle,
        startVerse: subtitle.start_verse,
        endVerse: subtitle.end_verse,
        verses: sectionVerses,
      });
    }
  } else {
    // No subtitles, create single section
    sections.push({
      subtitle: null,
      verses: chapter.verses.map((v) => ({
        number: v.verseNumber,
        text: v.text,
        verseNumber: v.verseNumber,
      })),
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
 * Transform API explanation response
 */
export function transformExplanationResponse(apiResponse: {
  explanation?: {
    book_id: number;
    chapter_number: number;
    type: string;
    explanation: string | unknown;
    explanation_id: number;
    language_code: string;
  };
}): ExplanationContent | null {
  if (!apiResponse.explanation) {
    return null;
  }

  return {
    bookId: apiResponse.explanation.book_id,
    chapterNumber: apiResponse.explanation.chapter_number,
    type: apiResponse.explanation.type,
    content:
      typeof apiResponse.explanation.explanation === 'string'
        ? apiResponse.explanation.explanation
        : '',
    languageCode: apiResponse.explanation.language_code,
  };
}
