/**
 * React Query Hooks for Bible API
 *
 * Custom hooks for fetching Bible data with caching and state management
 */

import { useQuery, useMutation, useQueryClient, type UseQueryOptions, type UseMutationOptions } from '@tanstack/react-query';
import { bibleApiClient } from './client';
import type {
  GetBibleBooksResponse,
  GetBibleTestamentsResponse,
  GetBibleChapterResponse,
  GetBibleExplanationResponse,
  SaveLastReadRequest,
  GetLastReadRequest,
  GetLastReadResponse,
  BookMetadata,
  ChapterContent,
  ExplanationContent,
  ContentTabType,
  BibleVersion,
  BibleBook,
} from './types';
import {
  transformTestamentBook,
  transformChapterResponse,
  transformExplanationResponse,
} from './types';

// ============================================================================
// Query Keys
// ============================================================================

export const bibleKeys = {
  all: ['bible'] as const,
  books: () => [...bibleKeys.all, 'books'] as const,
  testaments: () => [...bibleKeys.all, 'testaments'] as const,
  chapter: (bookId: number, chapterNumber: number, versionKey?: string) =>
    [...bibleKeys.all, 'chapter', bookId, chapterNumber, versionKey] as const,
  explanation: (
    bookId: number,
    chapterNumber: number,
    type: ContentTabType,
    versionKey?: string
  ) => [...bibleKeys.all, 'explanation', bookId, chapterNumber, type, versionKey] as const,
  lastRead: (userId: string) => [...bibleKeys.all, 'lastRead', userId] as const,
};

// ============================================================================
// Book & Testament Hooks
// ============================================================================

/**
 * Get all Bible books with metadata
 *
 * WARNING: This endpoint returns ALL chapters and verses (~10MB).
 * Consider using useBibleTestaments() instead for book metadata only.
 */
export function useBibleBooks(
  options?: Omit<UseQueryOptions<BibleBook[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: bibleKeys.books(),
    queryFn: async () => {
      const { data } = await bibleApiClient.get<GetBibleBooksResponse>('/bible/books');
      return data.books;
    },
    staleTime: 1000 * 60 * 60 * 24, // 24 hours (books don't change)
    gcTime: 1000 * 60 * 60 * 24 * 7, // 7 days
    ...options,
  });
}

/**
 * Get all Bible books with metadata (lightweight)
 *
 * Returns book metadata without verse content.
 * Recommended over useBibleBooks() for navigation/selection UI.
 */
export function useBibleTestaments(
  options?: Omit<UseQueryOptions<BookMetadata[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: bibleKeys.testaments(),
    queryFn: async () => {
      const { data } = await bibleApiClient.get<GetBibleTestamentsResponse>('/bible/testaments');
      return data.testaments.keys.map(transformTestamentBook);
    },
    staleTime: 1000 * 60 * 60 * 24, // 24 hours (books don't change)
    gcTime: 1000 * 60 * 60 * 24 * 7, // 7 days
    ...options,
  });
}

// ============================================================================
// Chapter Content Hooks
// ============================================================================

/**
 * Get a single Bible chapter with verses and subtitles
 *
 * @param bookId - Book ID (1-66)
 * @param chapterNumber - Chapter number
 * @param versionKey - Optional Bible version (e.g., "NASB", "NIV")
 */
export function useBibleChapter(
  bookId: number,
  chapterNumber: number,
  versionKey?: BibleVersion,
  options?: Omit<UseQueryOptions<ChapterContent>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: bibleKeys.chapter(bookId, chapterNumber, versionKey),
    queryFn: async () => {
      const { data } = await bibleApiClient.get<GetBibleChapterResponse>(
        `/bible/book/${bookId}/${chapterNumber}`,
        {
          params: { versionKey },
        }
      );
      return transformChapterResponse(data);
    },
    enabled: bookId > 0 && chapterNumber > 0,
    staleTime: 1000 * 60 * 60, // 1 hour
    gcTime: 1000 * 60 * 60 * 24, // 24 hours
    ...options,
  });
}

// ============================================================================
// Explanation/Commentary Hooks
// ============================================================================

/**
 * Get AI-generated explanation for a chapter
 *
 * @param bookId - Book ID (1-66)
 * @param chapterNumber - Chapter number
 * @param type - Explanation type ('summary', 'byline', 'detailed')
 * @param versionKey - Optional Bible version
 */
export function useBibleExplanation(
  bookId: number,
  chapterNumber: number,
  type: ContentTabType,
  versionKey?: BibleVersion,
  options?: Omit<UseQueryOptions<ExplanationContent>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: bibleKeys.explanation(bookId, chapterNumber, type, versionKey),
    queryFn: async () => {
      const { data} = await bibleApiClient.get<GetBibleExplanationResponse>(
        `/bible/book/explanation/${bookId}/${chapterNumber}`,
        {
          params: {
            explanationType: type,
            versionKey,
          },
        }
      );
      return transformExplanationResponse(data);
    },
    enabled: bookId > 0 && chapterNumber > 0 && !!type,
    staleTime: 1000 * 60 * 60, // 1 hour
    gcTime: 1000 * 60 * 60 * 24, // 24 hours
    ...options,
  });
}

/**
 * Get Summary explanation (tab: Summary)
 */
export function useBibleSummary(
  bookId: number,
  chapterNumber: number,
  versionKey?: BibleVersion,
  options?: Omit<UseQueryOptions<ExplanationContent>, 'queryKey' | 'queryFn'>
) {
  return useBibleExplanation(bookId, chapterNumber, 'summary', versionKey, options);
}

/**
 * Get By Line explanation (tab: By Line)
 */
export function useBibleByLine(
  bookId: number,
  chapterNumber: number,
  versionKey?: BibleVersion,
  options?: Omit<UseQueryOptions<ExplanationContent>, 'queryKey' | 'queryFn'>
) {
  return useBibleExplanation(bookId, chapterNumber, 'byline', versionKey, options);
}

/**
 * Get Detailed explanation (tab: Detailed)
 */
export function useBibleDetailed(
  bookId: number,
  chapterNumber: number,
  versionKey?: BibleVersion,
  options?: Omit<UseQueryOptions<ExplanationContent>, 'queryKey' | 'queryFn'>
) {
  return useBibleExplanation(bookId, chapterNumber, 'detailed', versionKey, options);
}

// ============================================================================
// Reading Position Hooks
// ============================================================================

/**
 * Save user's last read position
 */
export function useSaveLastRead(
  options?: UseMutationOptions<void, Error, SaveLastReadRequest>
) {
  return useMutation({
    mutationFn: async (request: SaveLastReadRequest) => {
      await bibleApiClient.post('/bible/book/chapter/save-last-read', request);
    },
    ...options,
  });
}

/**
 * Get user's last read position
 */
export function useLastRead(
  userId: string,
  options?: Omit<UseQueryOptions<GetLastReadResponse | null>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: bibleKeys.lastRead(userId),
    queryFn: async () => {
      try {
        const { data } = await bibleApiClient.post<GetLastReadResponse>(
          '/bible/book/chapter/last-read',
          { user_id: userId }
        );
        return data;
      } catch (error) {
        // Return null if no last read position found
        return null;
      }
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
    ...options,
  });
}

// ============================================================================
// Prefetch Helpers
// ============================================================================

/**
 * Prefetch next chapter for faster navigation
 */
export function usePrefetchNextChapter(
  bookId: number,
  chapterNumber: number,
  totalChapters: number,
  versionKey?: BibleVersion
) {
  const queryClient = useQueryClient();

  return () => {
    if (chapterNumber < totalChapters) {
      // Prefetch next chapter in same book
      queryClient.prefetchQuery({
        queryKey: bibleKeys.chapter(bookId, chapterNumber + 1, versionKey),
        queryFn: async () => {
          const { data } = await bibleApiClient.get<GetBibleChapterResponse>(
            `/bible/book/${bookId}/${chapterNumber + 1}`,
            { params: { versionKey } }
          );
          return transformChapterResponse(data);
        },
      });
    }
  };
}

/**
 * Prefetch previous chapter for faster navigation
 */
export function usePrefetchPreviousChapter(
  bookId: number,
  chapterNumber: number,
  versionKey?: BibleVersion
) {
  const queryClient = useQueryClient();

  return () => {
    if (chapterNumber > 1) {
      // Prefetch previous chapter in same book
      queryClient.prefetchQuery({
        queryKey: bibleKeys.chapter(bookId, chapterNumber - 1, versionKey),
        queryFn: async () => {
          const { data } = await bibleApiClient.get<GetBibleChapterResponse>(
            `/bible/book/${bookId}/${chapterNumber - 1}`,
            { params: { versionKey } }
          );
          return transformChapterResponse(data);
        },
      });
    }
  };
}
