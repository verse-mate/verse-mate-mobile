// Custom React Query hooks wrapping the generated options

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
// Offline mode imports
import { BIBLE_BOOKS, getBookById } from '@/constants/bible-books';
import { useOfflineContext } from '@/contexts/OfflineContext';
import { usePreferredLanguage } from '@/hooks/use-preferred-language';
import { getAccessToken } from '@/lib/auth/token-storage';
import {
  getLocalBibleChapter,
  getLocalCommentary,
  getLocalTopic,
  getLocalTopicExplanation,
  getLocalTopicExplanations,
  getLocalTopicReferences,
} from '@/services/offline';
import { parseAndInjectVerses } from '@/services/offline/verse-parser.service';
import type { TopicCategory, TopicListItem } from '@/types/topics';
import type { ExplanationContent } from './bible/types';
import {
  transformChapterResponse,
  transformExplanationResponse,
  transformTestamentsToBooks,
} from './bible/types';
import {
  deleteBibleBookBookmarkRemoveMutation,
  deleteBibleBookNoteRemoveMutation,
  deleteBibleHighlightByHighlightIdMutation,
  getBibleBookBookmarksByUserIdOptions,
  getBibleBookByBookIdByChapterNumberOptions,
  getBibleBookExplanationByBookIdByChapterNumberOptions,
  getBibleBookNotesByUserIdOptions,
  getBibleBooksOptions,
  getBibleChapterIdByBookIdByChapterNumberOptions,
  getBibleHighlightsByUserIdByBookIdByChapterNumberOptions,
  getBibleHighlightsByUserIdOptions,
  getBibleTestamentsOptions,
  getTopicsByIdExplanationOptions,
  getTopicsByIdOptions,
  getTopicsByIdReferencesOptions,
  getTopicsCategoriesOptions,
  getTopicsSearchOptions,
  postBibleBookBookmarkAddMutation,
  postBibleBookChapterLastReadMutation,
  postBibleBookChapterSaveLastReadMutation,
  postBibleBookNoteAddMutation,
  postBibleHighlightAddMutation,
  putBibleBookNoteUpdateMutation,
  putBibleHighlightByHighlightIdMutation,
} from './generated/@tanstack/react-query.gen';
import type { Options } from './generated/sdk.gen';
import type {
  DeleteBibleBookBookmarkRemoveData,
  DeleteBibleBookNoteRemoveData,
  DeleteBibleHighlightByHighlightIdData,
  GetBibleBookBookmarksByUserIdData,
  GetBibleBookNotesByUserIdData,
  GetBibleBooksData,
  GetBibleChapterIdByBookIdByChapterNumberData,
  GetBibleHighlightsByUserIdByBookIdByChapterNumberData,
  GetBibleHighlightsByUserIdData,
  GetBibleTestamentsData,
  GetBibleTestamentsResponse,
  GetTopicsCategoriesData,
  GetTopicsSearchResponse,
  PostBibleBookBookmarkAddData,
  PostBibleBookNoteAddData,
  PostBibleHighlightAddData,
  PutBibleBookNoteUpdateData,
  PutBibleHighlightByHighlightIdData,
} from './generated/types.gen';

// Note: Options type is already exported from sdk.gen via index.ts

/**
 * API topic item type from the search response
 * This matches the shape returned by the /topics/search endpoint
 */
type ApiTopicItem = GetTopicsSearchResponse['topics'][number];

// Bible Testaments
export const useBibleTestaments = (
  options?: Options<GetBibleTestamentsData>,
  queryOptions?: { enabled?: boolean }
) => {
  const query = useQuery({
    ...getBibleTestamentsOptions(options),
    // biome-ignore lint/suspicious/noExplicitAny: spreading caller-supplied query options into UseQueryOptions
    ...(queryOptions as any),
  });

  // Transform the response to return the testaments array with friendly property names.
  // Falls back to the local BIBLE_BOOKS constant (all 66 books, correct chapter counts)
  // so the navigation modal is usable offline even before any API response arrives.
  return {
    ...query,
    data: (query.data as GetBibleTestamentsResponse | undefined)?.testaments
      ? transformTestamentsToBooks((query.data as GetBibleTestamentsResponse).testaments)
      : BIBLE_BOOKS.map((b) => ({
          id: b.id,
          name: b.name,
          testament: b.testament,
          genre: 0,
          chapterCount: b.chapterCount,
        })),
  };
};

// Bible Books
export const useBibleBooks = (options?: Options<GetBibleBooksData>) =>
  useQuery(getBibleBooksOptions(options));

// Bible Chapter - wrapper for simpler API with Offline Support
export const useBibleChapter = (
  bookId: number,
  chapterNumber: number,
  version?: string,
  options?: { enabled?: boolean }
) => {
  const { downloadedBibleVersions } = useOfflineContext();
  const effectiveVersion = version || 'NASB1995'; // Default to NASB1995 if not specified
  const isLocal = downloadedBibleVersions.includes(effectiveVersion);

  // Use the generated query key so prefetch cache hits work
  const generatedOpts = getBibleBookByBookIdByChapterNumberOptions({
    path: { bookId: String(bookId), chapterNumber: String(chapterNumber) },
    query: version ? { versionKey: version } : undefined,
  });

  const query = useQuery({
    queryKey: generatedOpts.queryKey,
    staleTime: Number.POSITIVE_INFINITY, // Bible text is immutable within a session
    queryFn: async ({ signal }) => {
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
          sections: [
            {
              subtitle: null,
              verses: verses.map((v) => ({
                number: v.verse_number,
                text: v.text,
                verseNumber: v.verse_number,
              })),
            },
          ],
        };
      }

      // Remote fetch — reuse generatedOpts so the cache key matches prefetch
      if (!generatedOpts.queryFn) {
        throw new Error('Query function not defined');
      }

      const response = await generatedOpts.queryFn({
        queryKey: generatedOpts.queryKey || [],
        meta: undefined,
        signal,
        // biome-ignore lint/suspicious/noExplicitAny: React Query queryFn context shape not fully typed in generated client
      } as any);

      return response;
    },
    enabled: (options?.enabled ?? true) && bookId > 0 && chapterNumber > 0,
  });

  return {
    ...query,
    data: isLocal
      ? query.data
      : query.data && 'book' in query.data
        ? // biome-ignore lint/suspicious/noExplicitAny: generated response union type requires cast for transformer
          transformChapterResponse(query.data as any)
        : null,
  };
};

// Bible Chapter Explanation - wrapper for simpler API with Offline Support
export const useBibleChapterExplanation = (
  bookId: number,
  chapterNumber: number,
  explanationType?: string,
  language?: string,
  version?: string,
  enabled = true
) => {
  const { downloadedCommentaryLanguages, downloadedBibleVersions } = useOfflineContext();
  const effectiveLanguage = language || 'en';
  const effectiveVersion = version || 'NASB1995';

  // Match language code flexibly: try exact match first, then short code (e.g., 'en' from 'en-US')
  const shortCode = effectiveLanguage.split('-')[0].toLowerCase();
  const matchedLocalLanguage = downloadedCommentaryLanguages.find(
    (dl) =>
      dl === effectiveLanguage || dl === shortCode || dl.split('-')[0].toLowerCase() === shortCode
  );
  const isLocal = Boolean(matchedLocalLanguage);
  const localLanguage = matchedLocalLanguage || effectiveLanguage;

  // Use the generated query key so prefetch cache hits work
  const generatedExplOpts = getBibleBookExplanationByBookIdByChapterNumberOptions({
    path: { bookId: String(bookId), chapterNumber: String(chapterNumber) },
    query: {
      ...(explanationType && { explanationType }),
      ...(language && { lang: language }),
      // biome-ignore lint/suspicious/noExplicitAny: optional query params not reflected in generated strict type
    } as any,
  });

  const query = useQuery({
    queryKey: generatedExplOpts.queryKey,
    staleTime: 1000 * 60 * 30, // AI explanations: 30 min stale time
    queryFn: async ({ signal }) => {
      if (isLocal && explanationType) {
        // Local fetch - use the matched language code from the DB
        const explanation = await getLocalCommentary(
          localLanguage,
          bookId,
          chapterNumber,
          explanationType
        );

        if (!explanation) return null;

        // Inject verse text into placeholders (matches backend behavior with includeVerseNumbers: false)
        let content = explanation.explanation;
        if (downloadedBibleVersions.includes(effectiveVersion)) {
          content = await parseAndInjectVerses(content, effectiveVersion, {
            includeVerseNumbers: false,
          });
        }

        return {
          bookId: explanation.book_id,
          chapterNumber: explanation.chapter_number,
          type: explanation.type,
          content,
          languageCode: explanation.language_code,
        };
      }

      // Remote fetch — reuse generatedExplOpts so the cache key matches prefetch
      if (!generatedExplOpts.queryFn) {
        throw new Error('Query function not defined');
      }

      const response = await generatedExplOpts.queryFn({
        queryKey: generatedExplOpts.queryKey || [],
        meta: undefined,
        signal,
        // biome-ignore lint/suspicious/noExplicitAny: React Query queryFn context shape not fully typed in generated client
      } as any);

      return response;
    },
    enabled: enabled && bookId > 0 && chapterNumber > 0 && Boolean(explanationType),
  });

  return {
    ...query,
    data: (isLocal
      ? query.data
      : query.data && 'explanation' in query.data
        ? // biome-ignore lint/suspicious/noExplicitAny: generated response union type requires cast for transformer
          transformExplanationResponse(query.data as any)
        : null) as ExplanationContent | null | undefined,
  };
};

// Bible Chapter ID
export const useBibleChapterId = (options: Options<GetBibleChapterIdByBookIdByChapterNumberData>) =>
  useQuery(getBibleChapterIdByBookIdByChapterNumberOptions(options));

// Save Last Read - wraps mutation to accept simple object instead of Options<T>
export const useSaveLastRead = () => {
  const mutation = useMutation(postBibleBookChapterSaveLastReadMutation());

  return {
    ...mutation,
    mutate: (params: { user_id: string; book_id: number; chapter_number: number }) => {
      mutation.mutate({
        // biome-ignore lint/suspicious/noExplicitAny: generated mutation body type doesn't accept plain object
        body: params as any,
      });
    },
  };
};

// Get Last Read - wraps the POST mutation as a query for convenience
export const useLastRead = (userId: string) => {
  const mutation = useMutation(postBibleBookChapterLastReadMutation());

  // Auto-fetch on mount (only if userId is provided)
  // biome-ignore lint/correctness/useExhaustiveDependencies: mutation.mutate is stable from React Query
  useEffect(() => {
    if (userId) {
      // biome-ignore lint/suspicious/noExplicitAny: generated mutation body type doesn't accept plain object
      mutation.mutate({ body: { user_id: userId } as any });
    }
  }, [userId]);

  return {
    data:
      mutation.data && 'result' in mutation.data
        ? (mutation.data.result as Record<string, unknown>)
        : {},
    isPending: mutation.isPending,
    isIdle: mutation.isIdle,
    isLoading: mutation.isPending, // Backwards compat
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
  };
};

// Bookmarks
export const useAddBookmark = (options?: Partial<Options<PostBibleBookBookmarkAddData>>) =>
  useMutation(postBibleBookBookmarkAddMutation(options));

export const useRemoveBookmark = (options?: Partial<Options<DeleteBibleBookBookmarkRemoveData>>) =>
  useMutation(deleteBibleBookBookmarkRemoveMutation(options));

export const useBookmarks = (options: Options<GetBibleBookBookmarksByUserIdData>) =>
  useQuery(getBibleBookBookmarksByUserIdOptions(options));

// Notes
export const useAddNote = (options?: Partial<Options<PostBibleBookNoteAddData>>) =>
  useMutation(postBibleBookNoteAddMutation(options));

export const useUpdateNote = (options?: Partial<Options<PutBibleBookNoteUpdateData>>) =>
  useMutation(putBibleBookNoteUpdateMutation(options));

export const useRemoveNote = (options?: Partial<Options<DeleteBibleBookNoteRemoveData>>) =>
  useMutation(deleteBibleBookNoteRemoveMutation(options));

export const useNotes = (options: Options<GetBibleBookNotesByUserIdData>) =>
  useQuery(getBibleBookNotesByUserIdOptions(options));

// Highlights
export const useAddHighlight = (options?: Partial<Options<PostBibleHighlightAddData>>) =>
  useMutation(postBibleHighlightAddMutation(options));

export const useUpdateHighlight = (
  options?: Partial<Options<PutBibleHighlightByHighlightIdData>>
) => useMutation(putBibleHighlightByHighlightIdMutation(options));

export const useRemoveHighlight = (
  options?: Partial<Options<DeleteBibleHighlightByHighlightIdData>>
) => useMutation(deleteBibleHighlightByHighlightIdMutation(options));

export const useHighlights = (options: Options<GetBibleHighlightsByUserIdData>) =>
  useQuery(getBibleHighlightsByUserIdOptions(options));

export const useChapterHighlights = (
  options: Options<GetBibleHighlightsByUserIdByBookIdByChapterNumberData>
) => useQuery(getBibleHighlightsByUserIdByBookIdByChapterNumberOptions(options));

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
    data:
      query.data && 'book' in query.data
        ? // biome-ignore lint/suspicious/noExplicitAny: generated response union type requires cast for transformer
          transformChapterResponse(query.data as any)
        : null,
  };
};

/**
 * Fetch explanation for a chapter
 */
const useBibleExplanation = (
  bookId: number,
  chapterNumber: number,
  explanationType?: string,
  language?: string
) => {
  const query = useQuery({
    ...getBibleBookExplanationByBookIdByChapterNumberOptions({
      path: { bookId: String(bookId), chapterNumber: String(chapterNumber) },
      query: {
        ...(explanationType && { explanationType }),
        ...(language && { lang: language }),
        // biome-ignore lint/suspicious/noExplicitAny: optional query params not reflected in generated strict type
      } as any,
    }),
    enabled: bookId > 0 && chapterNumber > 0 && Boolean(explanationType), // Only fetch when valid parameters
  });

  return {
    ...query,
    data:
      query.data && 'explanation' in query.data
        ? // biome-ignore lint/suspicious/noExplicitAny: generated response union type requires cast for transformer
          transformExplanationResponse(query.data as any)
        : null,
  };
};

// Export reading mode hooks
export { useBibleExplanation };

export const useBibleSummary = (
  bookId: number,
  chapterNumber: number,
  _queryKey?: unknown,
  options?: { enabled?: boolean; language?: string }
) => {
  return useBibleChapterExplanation(
    bookId,
    chapterNumber,
    'summary',
    options?.language,
    undefined,
    options?.enabled
  );
};

export const useBibleByLine = (
  bookId: number,
  chapterNumber: number,
  _queryKey?: unknown,
  options?: { enabled?: boolean; language?: string }
) => {
  return useBibleChapterExplanation(
    bookId,
    chapterNumber,
    'byline',
    options?.language,
    undefined,
    options?.enabled
  );
};

export const useBibleDetailed = (
  bookId: number,
  chapterNumber: number,
  _queryKey?: unknown,
  options?: { enabled?: boolean; language?: string }
) => {
  return useBibleChapterExplanation(
    bookId,
    chapterNumber,
    'detailed',
    options?.language,
    undefined,
    options?.enabled
  );
};

// Prefetch hooks for next/previous chapters (with cross-book + explanation prefetch)
export const usePrefetchNextChapter = (
  bookId: number,
  currentChapter: number,
  totalChapters: number
) => {
  const queryClient = useQueryClient();
  const preferredLanguage = usePreferredLanguage();

  useEffect(() => {
    let nextBookId = bookId;
    let nextChapter = currentChapter + 1;

    if (nextChapter > totalChapters) {
      // Cross-book: go to chapter 1 of the next book
      const currentIndex = BIBLE_BOOKS.findIndex((b) => b.id === bookId);
      if (currentIndex >= 0 && currentIndex < BIBLE_BOOKS.length - 1) {
        nextBookId = BIBLE_BOOKS[currentIndex + 1].id;
        nextChapter = 1;
      } else {
        return; // At the very end of the Bible
      }
    }

    // Prefetch chapter text
    queryClient.prefetchQuery(
      getBibleBookByBookIdByChapterNumberOptions({
        path: { bookId: String(nextBookId), chapterNumber: String(nextChapter) },
      })
    );

    // Prefetch summary explanation
    queryClient.prefetchQuery(
      getBibleBookExplanationByBookIdByChapterNumberOptions({
        path: { bookId: String(nextBookId), chapterNumber: String(nextChapter) },
        // biome-ignore lint/suspicious/noExplicitAny: optional query params not reflected in generated strict type
        query: { explanationType: 'summary', lang: preferredLanguage } as any,
      })
    );
  }, [queryClient, bookId, currentChapter, totalChapters, preferredLanguage]);
};

export const usePrefetchPreviousChapter = (bookId: number, currentChapter: number) => {
  const queryClient = useQueryClient();
  const preferredLanguage = usePreferredLanguage();

  useEffect(() => {
    let prevBookId = bookId;
    let prevChapter = currentChapter - 1;

    if (prevChapter < 1) {
      // Cross-book: go to last chapter of the previous book
      const currentIndex = BIBLE_BOOKS.findIndex((b) => b.id === bookId);
      if (currentIndex > 0) {
        const prevBook = BIBLE_BOOKS[currentIndex - 1];
        prevBookId = prevBook.id;
        prevChapter = prevBook.chapterCount;
      } else {
        return; // At the very beginning of the Bible
      }
    }

    // Prefetch chapter text
    queryClient.prefetchQuery(
      getBibleBookByBookIdByChapterNumberOptions({
        path: { bookId: String(prevBookId), chapterNumber: String(prevChapter) },
      })
    );

    // Prefetch summary explanation
    queryClient.prefetchQuery(
      getBibleBookExplanationByBookIdByChapterNumberOptions({
        path: { bookId: String(prevBookId), chapterNumber: String(prevChapter) },
        // biome-ignore lint/suspicious/noExplicitAny: optional query params not reflected in generated strict type
        query: { explanationType: 'summary', lang: preferredLanguage } as any,
      })
    );
  }, [queryClient, bookId, currentChapter, preferredLanguage]);
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
    // biome-ignore lint/suspicious/noExplicitAny: spreading caller-supplied query options
    ...(options as any), // Allow overriding options like enabled
  });

  // Extract topics array from response, defaulting to empty array
  // Use type assertion since TypeScript can't narrow the type through property check
  const topics: ApiTopicItem[] =
    query.data && typeof query.data === 'object' && 'topics' in query.data
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
    eventQuery.isError || prophecyQuery.isError || parableQuery.isError || themeQuery.isError;

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
  }, [isLoading, eventQuery.data, prophecyQuery.data, parableQuery.data, themeQuery.data]);

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
 * Tries local SQLite first if topics are downloaded, then falls back to remote API.
 * Returns topic info, references content, and all explanation types.
 */
export const useTopicById = (
  topicId: string,
  bibleVersion?: string,
  options?: { enabled?: boolean }
) => {
  const { downloadedTopicLanguages, downloadedBibleVersions } = useOfflineContext();
  const hasLocalTopics = downloadedTopicLanguages.length > 0;
  const effectiveVersion = bibleVersion || 'NASB1995';
  const canParseVerses = downloadedBibleVersions.includes(effectiveVersion);
  const preferredLanguage = usePreferredLanguage();

  const query = useQuery({
    queryKey: ['topic-by-id', topicId, bibleVersion, preferredLanguage],
    queryFn: async () => {
      // Try local first if topics are downloaded
      if (hasLocalTopics) {
        const topic = await getLocalTopic(topicId, preferredLanguage);
        if (topic) {
          // Fetch explanations and references in parallel
          const [explanations, refData] = await Promise.all([
            getLocalTopicExplanations(topicId, preferredLanguage),
            getLocalTopicReferences(topicId),
          ]);

          // Build explanation object with verse injection
          const explanationMap: Record<string, string> = {};
          for (const expl of explanations) {
            let text = expl.explanation;
            if (canParseVerses) {
              text = await parseAndInjectVerses(text, effectiveVersion, {
                includeReference: true,
                includeVerseNumbers: false,
              });
            }
            explanationMap[expl.type] = text;
          }

          // Process references content with verse injection
          let referencesContent: string | null = null;
          if (refData?.reference_content) {
            referencesContent = canParseVerses
              ? await parseAndInjectVerses(refData.reference_content, effectiveVersion, {
                  includeReference: true,
                  includeVerseNumbers: true,
                })
              : refData.reference_content;
          }

          return {
            topic: {
              topic_id: topic.topic_id,
              name: topic.name,
              description: topic.content,
              category: topic.category,
              sort_order: topic.sort_order,
              language_code: topic.language_code,
            },
            references: referencesContent ? { content: referencesContent } : null,
            explanation: {
              summary: explanationMap.summary || 'No summary explanation available.',
              byline: explanationMap.byline || 'No byline explanation available.',
              detailed: explanationMap.detailed || 'No detailed explanation available.',
            },
          };
        }
        // Topic not found locally — fall through to remote
      }

      // Remote fetch (also serves as fallback when local returns null)
      const options = getTopicsByIdOptions({
        path: { id: topicId },
        // biome-ignore lint/suspicious/noExplicitAny: optional query params not reflected in generated strict type
        query: bibleVersion ? ({ bible_version: bibleVersion } as any) : undefined,
      });

      if (!options.queryFn) {
        throw new Error('Query function not defined');
      }

      const response = await options.queryFn({
        queryKey: options.queryKey || [],
        meta: undefined,
        signal: new AbortController().signal,
        // biome-ignore lint/suspicious/noExplicitAny: React Query queryFn context shape not fully typed in generated client
      } as any);
      return response;
    },
    enabled: (options?.enabled ?? true) && Boolean(topicId),
  });

  return {
    ...query,
    data: query.data && 'topic' in query.data ? query.data : null,
  };
};

/**
 * Fetch topic Bible references (Offline Aware)
 * Tries local SQLite first (with verse injection), then falls back to remote API.
 */
export const useTopicReferences = (
  topicId: string,
  version?: string,
  options?: { enabled?: boolean }
) => {
  const { downloadedTopicLanguages, downloadedBibleVersions } = useOfflineContext();
  const hasLocalTopics = downloadedTopicLanguages.length > 0;
  const effectiveVersion = version || 'NASB1995';

  const query = useQuery({
    queryKey: ['topic-references', topicId, version],
    queryFn: async () => {
      if (hasLocalTopics) {
        const refData = await getLocalTopicReferences(topicId);
        if (refData?.reference_content) {
          // Parse and inject verses if Bible version is downloaded
          let content = refData.reference_content;
          if (downloadedBibleVersions.includes(effectiveVersion)) {
            content = await parseAndInjectVerses(content, effectiveVersion, {
              includeReference: true,
              includeVerseNumbers: true,
            });
          }
          return { references: { content } };
        }
        // No local references — fall through to remote
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
        signal: new AbortController().signal,
        // biome-ignore lint/suspicious/noExplicitAny: React Query queryFn context shape not fully typed in generated client
      } as any);
      return response;
    },
    enabled: (options?.enabled ?? true) && Boolean(topicId),
  });

  return {
    ...query,
    data: query.data && 'references' in query.data ? query.data.references : null,
  };
};

/**
 * Fetch topic explanation with verse placeholder replacement (Offline Aware)
 * Tries local SQLite first (from topic_explanations table), then falls back to remote API.
 */
export const useTopicExplanation = (
  topicId: string,
  type?: 'summary' | 'byline' | 'detailed',
  lang?: string,
  bibleVersion?: string,
  options?: { enabled?: boolean }
) => {
  const { downloadedTopicLanguages, downloadedBibleVersions } = useOfflineContext();
  const hasLocalTopics = downloadedTopicLanguages.length > 0;
  const effectiveVersion = bibleVersion || 'NASB1995';
  const explanationType = type || 'detailed';
  const preferredLanguage = usePreferredLanguage();
  const effectiveLang = lang || preferredLanguage;

  const query = useQuery({
    queryKey: ['topic-explanation', topicId, type, effectiveLang, bibleVersion],
    queryFn: async () => {
      if (hasLocalTopics) {
        const explanation = await getLocalTopicExplanation(topicId, explanationType, effectiveLang);
        if (explanation) {
          let content = explanation.explanation;
          if (downloadedBibleVersions.includes(effectiveVersion)) {
            content = await parseAndInjectVerses(content, effectiveVersion, {
              includeReference: true,
              includeVerseNumbers: false,
            });
          }

          return {
            explanation: {
              book_id: 0,
              chapter_number: 0,
              type: explanationType,
              explanation: content,
              explanation_id: 0,
              language_code: explanation.language_code,
            },
          };
        }
        // Explanation not found locally — fall through to remote
      }

      const options = getTopicsByIdExplanationOptions({
        path: { id: topicId },
        query: {
          ...(type && { type }),
          ...(lang && { lang }),
          ...(bibleVersion && { bible_version: bibleVersion }),
          // biome-ignore lint/suspicious/noExplicitAny: optional query params not reflected in generated strict type
        } as any,
      });

      if (!options.queryFn) {
        throw new Error('Query function not defined');
      }

      const response = await options.queryFn({
        queryKey: options.queryKey || [],
        meta: undefined,
        signal: new AbortController().signal,
        // biome-ignore lint/suspicious/noExplicitAny: React Query queryFn context shape not fully typed in generated client
      } as any);
      return response;
    },
    enabled: (options?.enabled ?? true) && Boolean(topicId),
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
        headers.Authorization = `Bearer ${accessToken}`;
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
        headers.Authorization = `Bearer ${accessToken}`;
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
