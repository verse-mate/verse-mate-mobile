// Custom React Query hooks wrapping the generated options
import { useEffect } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import {
	transformTestamentsToBooks,
	transformChapterResponse,
	transformExplanationResponse,
	type ChapterContent,
	type ExplanationContent,
} from '../bible/types';
import type {
	GetBibleTestamentsData,
	GetBibleBooksData,
	GetBibleBookByBookIdByChapterNumberData,
	GetBibleBookExplanationByBookIdByChapterNumberData,
	GetBibleChapterIdByBookIdByChapterNumberData,
	PostBibleBookChapterSaveLastReadData,
	PostBibleBookChapterLastReadData,
	PostBibleBookBookmarkAddData,
	DeleteBibleBookBookmarkRemoveData,
	GetBibleBookBookmarksByUserIdData,
	PostBibleBookNoteAddData,
	PutBibleBookNoteUpdateData,
	DeleteBibleBookNoteRemoveData,
	GetBibleBookNotesByUserIdData,
	PostBibleHighlightAddData,
	PutBibleHighlightByHighlightIdData,
	DeleteBibleHighlightByHighlightIdData,
	GetBibleHighlightsByUserIdData,
	GetBibleHighlightsByUserIdByBookIdByChapterNumberData,
} from './types.gen';
import type { Options } from './sdk.gen';

import {
	getBibleTestamentsOptions,
	getBibleBooksOptions,
	getBibleBookByBookIdByChapterNumberOptions,
	getBibleBookExplanationByBookIdByChapterNumberOptions,
	getBibleChapterIdByBookIdByChapterNumberOptions,
	postBibleBookChapterSaveLastReadMutation,
	postBibleBookChapterLastReadMutation,
	postBibleBookBookmarkAddMutation,
	deleteBibleBookBookmarkRemoveMutation,
	getBibleBookBookmarksByUserIdOptions,
	postBibleBookNoteAddMutation,
	putBibleBookNoteUpdateMutation,
	deleteBibleBookNoteRemoveMutation,
	getBibleBookNotesByUserIdOptions,
	postBibleHighlightAddMutation,
	putBibleHighlightByHighlightIdMutation,
	deleteBibleHighlightByHighlightIdMutation,
	getBibleHighlightsByUserIdOptions,
	getBibleHighlightsByUserIdByBookIdByChapterNumberOptions,
} from './@tanstack/react-query.gen';

// Note: Options type is already exported from sdk.gen via index.ts

// Bible Testaments
export const useBibleTestaments = (options?: Options<GetBibleTestamentsData>) => {
	const query = useQuery(getBibleTestamentsOptions(options));

	// Transform the response to return the testaments array with friendly property names
	return {
		...query,
		data: query.data?.testaments ? transformTestamentsToBooks(query.data.testaments) : [],
	};
};

// Bible Books
export const useBibleBooks = (options?: Options<GetBibleBooksData>) =>
	useQuery(getBibleBooksOptions(options));

// Bible Chapter - wrapper for simpler API
export const useBibleChapter = (bookId: number, chapterNumber: number, version?: string) => {
	const query = useQuery({
		...getBibleBookByBookIdByChapterNumberOptions({
			path: { bookId: String(bookId), chapterNumber: String(chapterNumber) },
			query: version ? { versionKey: version } : undefined,
		}),
		enabled: bookId > 0 && chapterNumber > 0, // Only fetch when valid IDs
	});

	return {
		...query,
		data: query.data && 'book' in query.data ? transformChapterResponse(query.data as any) : null,
	};
};

// Bible Chapter Explanation - wrapper for simpler API
export const useBibleChapterExplanation = (bookId: number, chapterNumber: number, explanationType?: string) => {
	const query = useQuery({
		...getBibleBookExplanationByBookIdByChapterNumberOptions({
			path: { bookId: String(bookId), chapterNumber: String(chapterNumber) },
			query: explanationType ? { explanationType } : undefined,
		}),
		enabled: bookId > 0 && chapterNumber > 0 && Boolean(explanationType), // Only fetch when valid parameters
	});

	return {
		...query,
		data: query.data && 'explanation' in query.data ? transformExplanationResponse(query.data as any) : null,
	};
};

// Bible Chapter ID
export const useBibleChapterId = (
	options: Options<GetBibleChapterIdByBookIdByChapterNumberData>,
) =>
	useQuery(
		getBibleChapterIdByBookIdByChapterNumberOptions(options),
	);

// Save Last Read - wraps mutation to accept simple object instead of Options<T>
export const useSaveLastRead = () => {
	const mutation = useMutation(postBibleBookChapterSaveLastReadMutation());

	return {
		...mutation,
		mutate: (params: { user_id: string; book_id: number; chapter_number: number }) => {
			mutation.mutate({
				body: params as any,
			});
		},
	};
};

// Get Last Read - wraps the POST mutation as a query for convenience
export const useLastRead = (userId: string) => {
	const mutation = useMutation(postBibleBookChapterLastReadMutation());

	// Auto-fetch on mount (only if userId is provided)
	useEffect(() => {
		if (userId) {
			mutation.mutate({ body: { user_id: userId } as any });
		}
	}, [userId]);

	return {
		data: mutation.data && 'result' in mutation.data ? (mutation.data.result as Record<string, any>) : {},
		isPending: mutation.isPending,
		isIdle: mutation.isIdle,
		isLoading: mutation.isPending, // Backwards compat
		isSuccess: mutation.isSuccess,
		isError: mutation.isError,
		error: mutation.error,
	};
};

// Bookmarks
export const useAddBookmark = (
	options?: Partial<Options<PostBibleBookBookmarkAddData>>,
) => useMutation(postBibleBookBookmarkAddMutation(options));

export const useRemoveBookmark = (
	options?: Partial<Options<DeleteBibleBookBookmarkRemoveData>>,
) => useMutation(deleteBibleBookBookmarkRemoveMutation(options));

export const useBookmarks = (
	options: Options<GetBibleBookBookmarksByUserIdData>,
) =>
	useQuery(getBibleBookBookmarksByUserIdOptions(options));

// Notes
export const useAddNote = (
	options?: Partial<Options<PostBibleBookNoteAddData>>,
) => useMutation(postBibleBookNoteAddMutation(options));

export const useUpdateNote = (
	options?: Partial<Options<PutBibleBookNoteUpdateData>>,
) => useMutation(putBibleBookNoteUpdateMutation(options));

export const useRemoveNote = (
	options?: Partial<Options<DeleteBibleBookNoteRemoveData>>,
) => useMutation(deleteBibleBookNoteRemoveMutation(options));

export const useNotes = (options: Options<GetBibleBookNotesByUserIdData>) =>
	useQuery(getBibleBookNotesByUserIdOptions(options));

// Highlights
export const useAddHighlight = (
	options?: Partial<Options<PostBibleHighlightAddData>>,
) => useMutation(postBibleHighlightAddMutation(options));

export const useUpdateHighlight = (
	options?: Partial<Options<PutBibleHighlightByHighlightIdData>>,
) => useMutation(putBibleHighlightByHighlightIdMutation(options));

export const useRemoveHighlight = (
	options?: Partial<Options<DeleteBibleHighlightByHighlightIdData>>,
) => useMutation(deleteBibleHighlightByHighlightIdMutation(options));

export const useHighlights = (
	options: Options<GetBibleHighlightsByUserIdData>,
) =>
	useQuery(getBibleHighlightsByUserIdOptions(options));

export const useChapterHighlights = (
	options: Options<GetBibleHighlightsByUserIdByBookIdByChapterNumberData>,
) =>
	useQuery(
		getBibleHighlightsByUserIdByBookIdByChapterNumberOptions(options),
	);

// Reading Mode Hooks (Summary, ByLine, Detailed)
// These hooks fetch chapter content and explanation data

/**
 * Fetch chapter content with transformations
 */
export const useBibleChapterContent = (bookId: number, chapterNumber: number) => {
	const query = useQuery(
		getBibleBookByBookIdByChapterNumberOptions({
			path: { bookId: String(bookId), chapterNumber: String(chapterNumber) },
		})
	);

	return {
		...query,
		data: query.data && 'book' in query.data ? transformChapterResponse(query.data as any) : null,
	};
};

/**
 * Fetch explanation for a chapter
 */
const useBibleExplanation = (bookId: number, chapterNumber: number, explanationType?: string) => {
	const query = useQuery({
		...getBibleBookExplanationByBookIdByChapterNumberOptions({
			path: { bookId: String(bookId), chapterNumber: String(chapterNumber) },
			query: explanationType ? { explanationType } : undefined,
		}),
		enabled: bookId > 0 && chapterNumber > 0 && Boolean(explanationType), // Only fetch when valid parameters
	});

	return {
		...query,
		data: query.data && 'explanation' in query.data ? transformExplanationResponse(query.data as any) : null,
	};
};

// Export reading mode hooks
export { useBibleExplanation };

export const useBibleSummary = (
	bookId: number,
	chapterNumber: number,
	_queryKey?: any,
	options?: { enabled?: boolean }
) => {
	const query = useQuery({
		...getBibleBookExplanationByBookIdByChapterNumberOptions({
			path: { bookId: String(bookId), chapterNumber: String(chapterNumber) },
			query: { explanationType: 'summary' },
		}),
		enabled: options?.enabled,
	});

	return {
		...query,
		data: query.data && 'explanation' in query.data ? transformExplanationResponse(query.data as any) : null,
	};
};

export const useBibleByLine = (
	bookId: number,
	chapterNumber: number,
	_queryKey?: any,
	options?: { enabled?: boolean }
) => {
	const query = useQuery({
		...getBibleBookExplanationByBookIdByChapterNumberOptions({
			path: { bookId: String(bookId), chapterNumber: String(chapterNumber) },
			query: { explanationType: 'byline' },
		}),
		enabled: options?.enabled,
	});

	return {
		...query,
		data: query.data && 'explanation' in query.data ? transformExplanationResponse(query.data as any) : null,
	};
};

export const useBibleDetailed = (
	bookId: number,
	chapterNumber: number,
	_queryKey?: any,
	options?: { enabled?: boolean }
) => {
	const query = useQuery({
		...getBibleBookExplanationByBookIdByChapterNumberOptions({
			path: { bookId: String(bookId), chapterNumber: String(chapterNumber) },
			query: { explanationType: 'detailed' },
		}),
		enabled: options?.enabled,
	});

	return {
		...query,
		data: query.data && 'explanation' in query.data ? transformExplanationResponse(query.data as any) : null,
	};
};

// Prefetch hooks for next/previous chapters
export const usePrefetchNextChapter = (bookId: number, currentChapter: number, totalChapters: number) => {
	const queryClient = useQueryClient();

	useEffect(() => {
		const nextChapter = currentChapter + 1;
		if (nextChapter <= totalChapters) {
			queryClient.prefetchQuery(
				getBibleBookByBookIdByChapterNumberOptions({
					path: { bookId: String(bookId), chapterNumber: String(nextChapter) },
				})
			);
		}
	}, [queryClient, bookId, currentChapter, totalChapters]);

	// Return a function for manual prefetching if needed
	return () => {
		const nextChapter = currentChapter + 1;
		if (nextChapter <= totalChapters) {
			queryClient.prefetchQuery(
				getBibleBookByBookIdByChapterNumberOptions({
					path: { bookId: String(bookId), chapterNumber: String(nextChapter) },
				})
			);
		}
	};
};

export const usePrefetchPreviousChapter = (bookId: number, currentChapter: number) => {
	const queryClient = useQueryClient();

	useEffect(() => {
		const prevChapter = currentChapter - 1;
		if (prevChapter >= 1) {
			queryClient.prefetchQuery(
				getBibleBookByBookIdByChapterNumberOptions({
					path: { bookId: String(bookId), chapterNumber: String(prevChapter) },
				})
			);
		}
	}, [queryClient, bookId, currentChapter]);

	// Return a function for manual prefetching if needed
	return () => {
		const prevChapter = currentChapter - 1;
		if (prevChapter >= 1) {
			queryClient.prefetchQuery(
				getBibleBookByBookIdByChapterNumberOptions({
					path: { bookId: String(bookId), chapterNumber: String(prevChapter) },
				})
			);
		}
	};
};
