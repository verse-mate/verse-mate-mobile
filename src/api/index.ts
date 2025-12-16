// Import query key functions at the top
import {
	getBibleTestamentsQueryKey,
	getBibleBooksQueryKey,
	getBibleBookByBookIdByChapterNumberQueryKey,
	getBibleBookExplanationByBookIdByChapterNumberQueryKey,
	getBibleChapterIdByBookIdByChapterNumberQueryKey,
	getBibleBookBookmarksByUserIdQueryKey,
	getBibleBookNotesByUserIdQueryKey,
	getBibleHighlightsByUserIdQueryKey,
	getBibleHighlightsByUserIdByBookIdByChapterNumberQueryKey,
} from './generated/@tanstack/react-query.gen';

export type * from './generated/types.gen';
export * from './generated/sdk.gen';
// Export hooks but exclude Options to avoid duplicate
export * from './hooks';

// Re-export types and transformations from bible/types
export type {
	Testament,
	BookMetadata,
	ReadingPosition,
	ChapterSection,
	Verse,
	ExplanationContent,
	BibleBook,
	ChapterContent,
	Subtitle,
} from './bible/types';

// Type aliases for test compatibility
export type { BookMetadata as TestamentBook } from './bible/types';
export type { GetBibleBookByBookIdByChapterNumberResponse as GetBibleChapterResponse } from './generated/types.gen';
export type { GetBibleBookExplanationByBookIdByChapterNumberResponse as GetBibleExplanationResponse } from './generated/types.gen';

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
