// Import query key functions at the top
import {
  getBibleBookBookmarksByUserIdQueryKey,
  getBibleBookByBookIdByChapterNumberQueryKey,
  getBibleBookExplanationByBookIdByChapterNumberQueryKey,
  getBibleBookNotesByUserIdQueryKey,
  getBibleBooksQueryKey,
  getBibleChapterIdByBookIdByChapterNumberQueryKey,
  getBibleHighlightsByUserIdByBookIdByChapterNumberQueryKey,
  getBibleHighlightsByUserIdQueryKey,
  getBibleTestamentsQueryKey,
} from './generated/@tanstack/react-query.gen';

// Re-export types and transformations from bible/types
// Type aliases for test compatibility
export type {
  BibleBook,
  BookMetadata,
  BookMetadata as TestamentBook,
  ChapterContent,
  ChapterSection,
  ExplanationContent,
  ReadingPosition,
  Subtitle,
  Testament,
  Verse,
} from './bible/types';
export * from './generated/sdk.gen';
export type * from './generated/types.gen';
export type {
  GetBibleBookByBookIdByChapterNumberResponse as GetBibleChapterResponse,
  GetBibleBookExplanationByBookIdByChapterNumberResponse as GetBibleExplanationResponse,
} from './generated/types.gen';
// Export hooks but exclude Options to avoid duplicate
export * from './hooks';

// Request body types for tests
export type SaveLastReadRequest = {
  user_id: string;
  book_id: number;
  chapter_number: number;
};

export type GetLastReadRequest = {
  user_id: string;
};

// Response types for last read
export type { PostBibleBookChapterLastReadResponse as GetLastReadResponse } from './generated/types.gen';

// Create a bibleKeys object for test compatibility
export const bibleKeys = {
  testaments: getBibleTestamentsQueryKey,
  books: getBibleBooksQueryKey,
  chapter: getBibleBookByBookIdByChapterNumberQueryKey,
  explanation: getBibleBookExplanationByBookIdByChapterNumberQueryKey,
  chapterId: getBibleChapterIdByBookIdByChapterNumberQueryKey,
  bookmarks: getBibleBookBookmarksByUserIdQueryKey,
  notes: getBibleBookNotesByUserIdQueryKey,
  highlights: getBibleHighlightsByUserIdQueryKey,
  chapterHighlights: getBibleHighlightsByUserIdByBookIdByChapterNumberQueryKey,
};
