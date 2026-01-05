// Custom React Query hooks wrapping the generated options
import { useEffect } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { getAccessToken } from '@/lib/auth/token-storage';
import {
	transformTestamentsToBooks,
	transformChapterResponse,
	transformExplanationResponse,
	type ChapterContent,
	type ExplanationContent,
} from './bible/types';
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
	GetTopicsCategoriesData,
	GetTopicsSearchData,
	GetTopicsByIdData,
	GetTopicsByIdReferencesData,
	GetTopicsByIdExplanationData,
} from './generated/types.gen';
import type { Options } from './generated/sdk.gen';

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
	getTopicsCategoriesOptions,
	getTopicsSearchOptions,
	getTopicsByIdOptions,
	getTopicsByIdReferencesOptions,
	getTopicsByIdExplanationOptions,
} from './generated/@tanstack/react-query.gen';

// Note: Options type is already exported from sdk.gen via index.ts

// Bible Testaments
export const useBibleTestaments = (
	options?: Options<GetBibleTestamentsData>,
	queryOptions?: { enabled?: boolean },
) => {
	const query = useQuery({
		...getBibleTestamentsOptions(options),
		...(queryOptions as any),
	});

	// Transform the response to return the testaments array with friendly property names
	return {
		...query,
		data: (query.data as any)?.testaments ? transformTestamentsToBooks((query.data as any).testaments) : [],
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

// ============================================================================
// TOPICS HOOKS
// ============================================================================

/**
 * Fetch all available topic categories
 * Returns: { categories: string[] }
 */
export const useTopicsCategories = (options?: Options<GetTopicsCategoriesData>) => {
	const query = useQuery(getTopicsCategoriesOptions(options));

	return {
		...query,
		data: query.data && 'categories' in query.data ? query.data.categories : [],
	};
};

/**
 * Search/fetch topics by category
 * @param category - Category to filter by (e.g., "EVENT", "PROPHECY", "PARABLE")
 * @param options - Additional query options (e.g., { enabled: false })
 */
export const useTopicsSearch = (category: string, options?: { enabled?: boolean }) => {
	const query = useQuery({
		...getTopicsSearchOptions({
			query: {
				category,
			},
		}),
		enabled: Boolean(category), // Only fetch when category is provided
		...(options as any), // Allow overriding options like enabled
	});

	return {
		...query,
		data: query.data && typeof query.data === 'object' && 'topics' in query.data ? query.data.topics : [],
	};
};

/**
 * Fetch topic details by ID with verse placeholder replacement
 *
 * Returns topic metadata, references, and all explanation types (summary, byline, detailed)
 * with verse placeholders replaced when bibleVersion is provided.
 *
 * @param topicId - Topic UUID
 * @param bibleVersion - Bible version key for verse replacement (e.g., "NASB1995")
 *   When provided, the backend replaces {verse:...} placeholders in all explanations.
 *   Web app defaults to NASB1995. TODO: Should come from user settings in AsyncStorage.
 */
export const useTopicById = (topicId: string, bibleVersion?: string) => {
	const query = useQuery({
		...getTopicsByIdOptions({
			path: { id: topicId },
			query: bibleVersion ? ({ bible_version: bibleVersion } as any) : undefined,
		}),
		enabled: Boolean(topicId), // Only fetch when topicId is provided
	});

	return {
		...query,
		data: query.data && 'topic' in query.data ? query.data : null,
	};
};

/**
 * Fetch topic Bible references (with parsed verses)
 * @param topicId - Topic UUID
 * @param version - Optional Bible version key
 */
export const useTopicReferences = (topicId: string, version?: string) => {
	const query = useQuery({
		...getTopicsByIdReferencesOptions({
			path: { id: topicId },
			query: version ? { version } : undefined,
		}),
		enabled: Boolean(topicId), // Only fetch when topicId is provided
	});

	return {
		...query,
		data: query.data && 'references' in query.data ? query.data.references : null,
	};
};

/**
 * Fetch topic explanation with verse placeholder replacement
 *
 * @param topicId - Topic UUID
 * @param type - Explanation type ("summary", "byline", "detailed")
 * @param lang - Language code (e.g., "en-US")
 * @param bibleVersion - Bible version key for verse replacement (e.g., "NASB1995")
 *   Required for placeholder replacement. Backend only replaces {verse:...} placeholders
 *   when this parameter is provided. Defaults to NASB1995 in web app's useBibleVersion hook.
 *   TODO: This should eventually come from user settings stored in AsyncStorage
 */
export const useTopicExplanation = (
	topicId: string,
	type?: 'summary' | 'byline' | 'detailed',
	lang?: string,
	bibleVersion?: string,
) => {
	const query = useQuery({
		...getTopicsByIdExplanationOptions({
			path: { id: topicId },
			query: {
				...(type && { type }),
				...(lang && { lang }),
				...(bibleVersion && { bible_version: bibleVersion }),
			} as any, // Using 'as any' because bible_version is not in the OpenAPI spec but is supported by the backend
		}),
		enabled: Boolean(topicId), // Only fetch when topicId is provided
	});

	return {
		...query,
		data: query.data && 'explanation' in query.data ? query.data.explanation : null,
	};
};

// ============================================================================
// Recently Viewed Books Hooks
// ============================================================================

/**
 * Get user's recently viewed books
 */
export function getUserRecentlyViewedBooksOptions() {
	return {
		queryKey: ['user', 'recently-viewed-books'],
		queryFn: async () => {
			const baseUrl = process.env.EXPO_PUBLIC_API_URL || 'https://api.versemate.org';

			// Get access token from storage for authentication
			const accessToken = await getAccessToken();

			const headers: HeadersInit = {};
			if (accessToken) {
				headers['Authorization'] = `Bearer ${accessToken}`;
			}

			const response = await fetch(`${baseUrl}/user/recently-viewed-books`, {
				method: 'GET',
				headers,
			});
			if (!response.ok) {
				throw new Error('Failed to fetch recently viewed books');
			}
			return response.json();
		},
	};
}

/**
 * Sync recently viewed books with backend
 */
export function postUserRecentlyViewedBooksSyncMutation() {
	return {
		mutationFn: async ({ body }: { body: { books: { bookId: string; timestamp: number }[] } }) => {
			const baseUrl = process.env.EXPO_PUBLIC_API_URL || 'https://api.versemate.org';

			// Get access token from storage for authentication
			const accessToken = await getAccessToken();

			const headers: HeadersInit = { 'Content-Type': 'application/json' };
			if (accessToken) {
				headers['Authorization'] = `Bearer ${accessToken}`;
			}

			const response = await fetch(`${baseUrl}/user/recently-viewed-books/sync`, {
				method: 'POST',
				headers,
				body: JSON.stringify(body),
			});
			if (!response.ok) {
				throw new Error('Failed to sync recently viewed books');
			}
			return response.json();
		},
	};
}
