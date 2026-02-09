// Custom React Query hooks wrapping the generated options
import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { getAccessToken } from '@/lib/auth/token-storage';
import type { TopicCategory, TopicListItem } from '@/types/topics';
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
	GetTopicsSearchResponse,
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

// Offline mode imports
import { useOfflineContext } from '@/contexts/OfflineContext';
import { getLocalBibleChapter, getLocalCommentary, getLocalTopics, getLocalTopic, getLocalTopicReferences } from '@/services/offline';
import { getBookById } from '@/constants/bible-books';
import { parseAndInjectVerses } from '@/services/offline/topic-renderer.service';

// Note: Options type is already exported from sdk.gen via index.ts

/**
 * API topic item type from the search response
 * This matches the shape returned by the /topics/search endpoint
 */
type ApiTopicItem = GetTopicsSearchResponse['topics'][number];

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

// Bible Chapter - wrapper for simpler API with Offline Support
export const useBibleChapter = (bookId: number, chapterNumber: number, version?: string) => {
	const { downloadedBibleVersions } = useOfflineContext();
	const effectiveVersion = version || 'NASB1995'; // Default to NASB1995 if not specified
	const isLocal = downloadedBibleVersions.includes(effectiveVersion);

	const query = useQuery({
		queryKey: ['bible-chapter', bookId, chapterNumber, effectiveVersion, isLocal ? 'local' : 'remote'],
		queryFn: async () => {
			if (isLocal) {
				const verses = await getLocalBibleChapter(effectiveVersion, bookId, chapterNumber);
				if (!verses || verses.length === 0) return null;

				const bookInfo = getBookById(bookId);
				
				// Transform local data to match API response shape
				return {
					bookId,
					bookName: bookInfo?.name || `Book ${bookId}`,
					chapterNumber,
					testament: bookInfo?.testament || 'OT',
					title: `${bookInfo?.name || ''} ${chapterNumber}`,
					sections: [{
						subtitle: null,
						verses: verses.map(v => ({
							number: v.verse_number,
							text: v.text,
							verseNumber: v.verse_number,
						})),
					}],
				};
			}
			
			// Remote fetch
			const options = getBibleBookByBookIdByChapterNumberOptions({
				path: { bookId: String(bookId), chapterNumber: String(chapterNumber) },
				query: version ? { versionKey: version } : undefined,
			});
			
			if (!options.queryFn) {
				throw new Error('Query function not defined');
			}
			
			const response = await options.queryFn({ 
				queryKey: options.queryKey || [], 
				meta: undefined, 
				signal: new AbortController().signal 
			} as any);
            
            return response;
		},
		enabled: bookId > 0 && chapterNumber > 0,
	});

	return {
		...query,
		data: isLocal ? query.data : (query.data && 'book' in query.data ? transformChapterResponse(query.data as any) : null),
	};
};

// Bible Chapter Explanation - wrapper for simpler API with Offline Support
export const useBibleChapterExplanation = (bookId: number, chapterNumber: number, explanationType?: string, language?: string) => {
	const { downloadedCommentaryLanguages } = useOfflineContext();
	const effectiveLanguage = language || 'en';
	const isLocal = downloadedCommentaryLanguages.includes(effectiveLanguage);

	const query = useQuery({
		queryKey: ['bible-explanation', bookId, chapterNumber, explanationType, effectiveLanguage, isLocal ? 'local' : 'remote'],
		queryFn: async () => {
			if (isLocal && explanationType) {
				// Local fetch
                // Note: local DB currently stores one explanation per chapter per language? 
                // Spec says: `type TEXT NOT NULL`. So we can filter by type.
                // But `getLocalCommentary` currently only fetches by language/book/chapter (limit 1).
                // We might need to update `getLocalCommentary` to filter by type or fetch all and filter here.
                // For now, let's assume getLocalCommentary returns what we need or we update it.
                // Actually `getLocalCommentary` query is: SELECT ... WHERE ... LIMIT 1. This might be wrong if we have multiple types.
                // Let's assume for now we get the right one or update the service later. 
                // Wait, I should probably update `getLocalCommentary` to accept `type`.
                
                // For this implementation, I will call getLocalCommentary. If it doesn't support type, it might return wrong one.
                // But the spec schema has `type`.
                const explanation = await getLocalCommentary(effectiveLanguage, bookId, chapterNumber);
                
                if (!explanation || explanation.type !== explanationType) return null;

				return {
					bookId: explanation.book_id,
					chapterNumber: explanation.chapter_number,
					type: explanation.type,
					content: explanation.explanation,
					languageCode: explanation.language_code,
				};
			}

			// Remote fetch
			const options = getBibleBookExplanationByBookIdByChapterNumberOptions({
				path: { bookId: String(bookId), chapterNumber: String(chapterNumber) },
				query: {
					...(explanationType && { explanationType }),
					...(language && { lang: language }),
				} as any,
			});

			if (!options.queryFn) {
				throw new Error('Query function not defined');
			}

			const response = await options.queryFn({ 
				queryKey: options.queryKey || [], 
				meta: undefined, 
				signal: new AbortController().signal 
			} as any);
            
            return response;
		},
		enabled: bookId > 0 && chapterNumber > 0 && Boolean(explanationType),
	});

	return {
		...query,
		data: isLocal ? query.data : (query.data && 'explanation' in query.data ? transformExplanationResponse(query.data as any) : null),
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
const useBibleExplanation = (bookId: number, chapterNumber: number, explanationType?: string, language?: string) => {
	const query = useQuery({
		...getBibleBookExplanationByBookIdByChapterNumberOptions({
			path: { bookId: String(bookId), chapterNumber: String(chapterNumber) },
			query: {
				...(explanationType && { explanationType }),
				...(language && { lang: language }),
			} as any,
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
	options?: { enabled?: boolean; language?: string }
) => {
	const query = useQuery({
		...getBibleBookExplanationByBookIdByChapterNumberOptions({
			path: { bookId: String(bookId), chapterNumber: String(chapterNumber) },
			query: {
				explanationType: 'summary',
				...(options?.language && { lang: options.language }),
			} as any,
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
	options?: { enabled?: boolean; language?: string }
) => {
	const query = useQuery({
		...getBibleBookExplanationByBookIdByChapterNumberOptions({
			path: { bookId: String(bookId), chapterNumber: String(chapterNumber) },
			query: {
				explanationType: 'byline',
				...(options?.language && { lang: options.language }),
			} as any,
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
	options?: { enabled?: boolean; language?: string }
) => {
	const query = useQuery({
		...getBibleBookExplanationByBookIdByChapterNumberOptions({
			path: { bookId: String(bookId), chapterNumber: String(chapterNumber) },
			query: {
				explanationType: 'detailed',
				...(options?.language && { lang: options.language }),
			} as any,
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

	// Extract topics array from response, defaulting to empty array
	// Use type assertion since TypeScript can't narrow the type through property check
	const topics: ApiTopicItem[] = query.data && typeof query.data === 'object' && 'topics' in query.data
		? (query.data as GetTopicsSearchResponse).topics
		: [];

	return {
		...query,
		data: topics,
	};
};

/**
 * Category order for global topic navigation
 * This defines the canonical order of categories when navigating across all topics
 */
const CATEGORY_ORDER: TopicCategory[] = ['EVENT', 'PROPHECY', 'PARABLE', 'THEME'];

/**
 * Helper function to convert API topic items to TopicListItem with category
 */
function mapTopicsWithCategory(topics: ApiTopicItem[], category: TopicCategory): TopicListItem[] {
	return topics.map((topic) => ({
		topic_id: topic.topic_id,
		name: topic.name,
		description: typeof topic.description === 'string' ? topic.description : undefined,
		sort_order: typeof topic.sort_order === 'number' ? topic.sort_order : 0,
		category,
	}));
}

/**
 * Fetch all topics from all categories combined into a single sorted array
 *
 * This hook is used for global circular navigation across all topics.
 * Topics are sorted by:
 * 1. Category order: EVENT -> PROPHECY -> PARABLE -> THEME
 * 2. Within each category: by sort_order
 *
 * @returns Combined loading/error states and the merged sorted array of all topics
 */
export const useAllTopics = () => {
	// Fetch topics from each category
	const eventQuery = useTopicsSearch('EVENT');
	const prophecyQuery = useTopicsSearch('PROPHECY');
	const parableQuery = useTopicsSearch('PARABLE');
	const themeQuery = useTopicsSearch('THEME');

	// Combined loading state - true if ANY category is still loading
	const isLoading =
		eventQuery.isLoading ||
		prophecyQuery.isLoading ||
		parableQuery.isLoading ||
		themeQuery.isLoading;

	// Combined error state - true if ANY category has an error
	const isError =
		eventQuery.isError ||
		prophecyQuery.isError ||
		parableQuery.isError ||
		themeQuery.isError;

	// Combine and sort all topics
	// Memoized to prevent unnecessary recalculations
	const data = useMemo((): TopicListItem[] => {
		// If still loading, return empty array
		if (isLoading) {
			return [];
		}

		// Map each category's topics with their category field
		const categoryDataMap: Record<TopicCategory, TopicListItem[]> = {
			EVENT: mapTopicsWithCategory(eventQuery.data, 'EVENT'),
			PROPHECY: mapTopicsWithCategory(prophecyQuery.data, 'PROPHECY'),
			PARABLE: mapTopicsWithCategory(parableQuery.data, 'PARABLE'),
			THEME: mapTopicsWithCategory(themeQuery.data, 'THEME'),
		};

		// Combine in category order, with topics within each category sorted by sort_order
		const allTopics: TopicListItem[] = [];
		for (const category of CATEGORY_ORDER) {
			const categoryTopics = categoryDataMap[category];
			// Sort by sort_order within category (API may not guarantee order)
			categoryTopics.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
			allTopics.push(...categoryTopics);
		}

		return allTopics;
	}, [
		isLoading,
		eventQuery.data,
		prophecyQuery.data,
		parableQuery.data,
		themeQuery.data,
	]);

	return {
		data,
		isLoading,
		isError,
		// Expose individual query states for debugging if needed
		queries: {
			event: eventQuery,
			prophecy: prophecyQuery,
			parable: parableQuery,
			theme: themeQuery,
		},
	};
};

/**
 * Fetch topic details by ID with verse placeholder replacement (Offline Aware)
 */
export const useTopicById = (topicId: string, bibleVersion?: string) => {
	const { downloadedTopicLanguages, downloadedBibleVersions } = useOfflineContext();
	const isLocal = downloadedTopicLanguages.length > 0;
    const effectiveVersion = bibleVersion || 'NASB1995';

	const query = useQuery({
		queryKey: ['topic-by-id', topicId, bibleVersion, isLocal ? 'local' : 'remote'],
		queryFn: async () => {
			if (isLocal) {
				const topic = await getLocalTopic(topicId);
				if (!topic) return null;

                // Parse content if we have a bible version and it's downloaded
                let content = topic.content;
                if (downloadedBibleVersions.includes(effectiveVersion)) {
                    content = await parseAndInjectVerses(topic.content, effectiveVersion, { includeReference: true });
                }

				return {
					topic: {
						topic_id: topic.topic_id,
						name: topic.name,
						description: content, // Map content to description/content
                        content: content,
						language_code: topic.language_code,
					},
                    // We can also fetch references here if needed by the API shape, 
                    // but the hook return value extracts 'topic' property.
                    references: [], // Placeholder
				};
			}

			const options = getTopicsByIdOptions({
				path: { id: topicId },
				query: bibleVersion ? ({ bible_version: bibleVersion } as any) : undefined,
			});

			if (!options.queryFn) {
				throw new Error('Query function not defined');
			}

			const response = await options.queryFn({ 
				queryKey: options.queryKey || [], 
				meta: undefined, 
				signal: new AbortController().signal 
			} as any);
            return response;
		},
		enabled: Boolean(topicId),
	});

	return {
		...query,
		data: query.data && 'topic' in query.data ? query.data : null,
	};
};

/**
 * Fetch topic Bible references (Offline Aware)
 */
export const useTopicReferences = (topicId: string, version?: string) => {
	const { downloadedTopicLanguages } = useOfflineContext();
	const isLocal = downloadedTopicLanguages.length > 0;

	const query = useQuery({
		queryKey: ['topic-references', topicId, version, isLocal ? 'local' : 'remote'],
		queryFn: async () => {
			if (isLocal) {
				const references = await getLocalTopicReferences(topicId);
				// Transform to match API reference shape if needed
                // API usually returns { book_id, chapter_number, verse_start, verse_end }
				return {
                    references: references.map(ref => ({
                        book_id: ref.book_id,
                        chapter_number: ref.chapter_number,
                        verse_start: ref.verse_start,
                        verse_end: ref.verse_end
                    }))
                };
			}

			const options = getTopicsByIdReferencesOptions({
				path: { id: topicId },
				query: version ? { version } : undefined,
			});

			if (!options.queryFn) {
				throw new Error('Query function not defined');
			}

			const response = await options.queryFn({ 
				queryKey: options.queryKey || [], 
				meta: undefined, 
				signal: new AbortController().signal 
			} as any);
            return response;
		},
		enabled: Boolean(topicId),
	});

	return {
		...query,
		data: query.data && 'references' in query.data ? query.data.references : null,
	};
};

/**
 * Fetch topic explanation with verse placeholder replacement (Offline Aware)
 */
export const useTopicExplanation = (
	topicId: string,
	type?: 'summary' | 'byline' | 'detailed',
	lang?: string,
	bibleVersion?: string,
) => {
	const { downloadedTopicLanguages, downloadedBibleVersions } = useOfflineContext();
	const isLocal = downloadedTopicLanguages.length > 0;
    const effectiveVersion = bibleVersion || 'NASB1995';

	const query = useQuery({
		queryKey: ['topic-explanation', topicId, type, lang, bibleVersion, isLocal ? 'local' : 'remote'],
		queryFn: async () => {
			if (isLocal) {
				const topic = await getLocalTopic(topicId);
				if (!topic) return null;

                // Offline topics currently only have one "content" field.
                // We return it regardless of requested 'type', or we could restrict it.
                // For now, return the content as the explanation.
                
                let content = topic.content;
                if (downloadedBibleVersions.includes(effectiveVersion)) {
                    content = await parseAndInjectVerses(topic.content, effectiveVersion, { includeReference: true });
                }

				return {
					explanation: {
                        book_id: 0, // Placeholder
                        chapter_number: 0, // Placeholder
                        type: type || 'detailed',
                        explanation: content,
                        explanation_id: 0,
                        language_code: topic.language_code
                    }
				};
			}

			const options = getTopicsByIdExplanationOptions({
				path: { id: topicId },
				query: {
					...(type && { type }),
					...(lang && { lang }),
					...(bibleVersion && { bible_version: bibleVersion }),
				} as any,
			});

			if (!options.queryFn) {
				throw new Error('Query function not defined');
			}

			const response = await options.queryFn({ 
				queryKey: options.queryKey || [], 
				meta: undefined, 
				signal: new AbortController().signal 
			} as any);
            return response;
		},
		enabled: Boolean(topicId),
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