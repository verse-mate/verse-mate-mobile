/**
 * useBookmarks Hook
 *
 * Manages bookmark state with optimistic UI updates and API synchronization.
 * Provides methods to add, remove, and check bookmark status for Bible chapters.
 *
 * @example
 * ```tsx
 * const {
 *   bookmarks,
 *   isBookmarked,
 *   addBookmark,
 *   removeBookmark,
 *   isFetchingBookmarks,
 *   isAddingBookmark,
 *   isRemovingBookmark
 * } = useBookmarks();
 *
 * // Check if chapter is bookmarked
 * const bookmarked = isBookmarked(1, 1); // Genesis 1
 *
 * // Add bookmark with optimistic update
 * await addBookmark(1, 1);
 *
 * // Remove bookmark with optimistic update
 * await removeBookmark(1, 1);
 * ```
 *
 * @see Spec: .agent-os/specs/2025-11-05-bookmark-chapters/spec.md
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { AnalyticsEvent, analytics } from '@/lib/analytics';
import {
  deleteBibleBookBookmarkRemoveMutation,
  getBibleBookBookmarksByUserIdOptions,
  getBibleBookBookmarksByUserIdQueryKey,
  postBibleBookBookmarkAddMutation,
} from '@/src/api/generated/@tanstack/react-query.gen';
import type {
  DeleteBibleBookBookmarkRemoveData,
  GetBibleBookBookmarksByUserIdResponse,
  PostBibleBookBookmarkAddData,
} from '@/src/api/generated/types.gen';

/**
 * Bookmark item type from API response
 */
export type Bookmark = GetBibleBookBookmarksByUserIdResponse['favorites'][number];

/**
 * Return type for useBookmarks hook
 */
export interface UseBookmarksResult {
  /** Array of bookmarked chapters */
  bookmarks: Bookmark[];
  /** Whether bookmarks are being fetched from API */
  isFetchingBookmarks: boolean;
  /** Whether a bookmark is being added */
  isAddingBookmark: boolean;
  /** Whether a bookmark is being removed */
  isRemovingBookmark: boolean;
  /** Check if a chapter is bookmarked */
  isBookmarked: (bookId: number, chapterNumber: number) => boolean;
  /** Add a bookmark with optimistic update */
  addBookmark: (bookId: number, chapterNumber: number) => Promise<void>;
  /** Remove a bookmark with optimistic update */
  removeBookmark: (bookId: number, chapterNumber: number) => Promise<void>;
  /** Manually refetch bookmarks from API */
  refetchBookmarks: () => Promise<void>;
}

/**
 * Hook to manage bookmark state with optimistic updates
 *
 * Features:
 * - Fetches bookmarks from API on mount
 * - Optimistic UI updates for instant feedback
 * - Automatic rollback on API failure
 * - Authentication checks before API calls
 * - Loading states for all operations
 *
 * @returns {UseBookmarksResult} Bookmark state and methods
 */
export function useBookmarks(): UseBookmarksResult {
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const queryClient = useQueryClient();

  // Create query options with user ID
  const queryOptions = useMemo(
    () => ({
      path: { user_id: user?.id || '' },
    }),
    [user?.id]
  );

  // Query key for bookmarks (use generated query key function)
  const bookmarksQueryKey = useMemo(
    () => getBibleBookBookmarksByUserIdQueryKey(queryOptions),
    [queryOptions]
  );

  // Fetch bookmarks from API
  const {
    data: bookmarksData,
    isFetching: isQueryFetching,
    refetch,
    dataUpdatedAt,
  } = useQuery({
    ...getBibleBookBookmarksByUserIdOptions(queryOptions),
    enabled: isAuthenticated && !!user?.id,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Extract bookmarks array from response
  const bookmarks = useMemo(() => bookmarksData?.favorites || [], [bookmarksData]);

  // Add bookmark mutation
  const addMutation = useMutation({
    ...postBibleBookBookmarkAddMutation(),
    onMutate: async (variables) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: bookmarksQueryKey });

      // Snapshot previous value for rollback
      const previousBookmarks =
        queryClient.getQueryData<GetBibleBookBookmarksByUserIdResponse>(bookmarksQueryKey);

      // Optimistically update to the new value
      if (previousBookmarks && variables.body) {
        const { book_id, chapter_number } = variables.body;

        // Check if bookmark already exists
        const exists = previousBookmarks.favorites.some(
          (b) => b.book_id === book_id && b.chapter_number === chapter_number
        );

        if (!exists) {
          // Add optimistic bookmark (favorite_id will be set by server)
          const optimisticBookmark: Bookmark = {
            favorite_id: Date.now(), // Temporary ID
            book_id,
            chapter_number,
            book_name: `Book ${book_id}`, // Will be updated from server response
          };

          queryClient.setQueryData<GetBibleBookBookmarksByUserIdResponse>(bookmarksQueryKey, {
            favorites: [...previousBookmarks.favorites, optimisticBookmark],
          });
        }
      }

      // Return context for rollback
      return { previousBookmarks };
    },
    onError: (error, _variables, context) => {
      // Rollback to previous state on error
      if (context?.previousBookmarks) {
        queryClient.setQueryData(bookmarksQueryKey, context.previousBookmarks);
      }
      console.error('Failed to add bookmark:', error);
    },
    onSuccess: (_data, variables) => {
      // Track analytics: BOOKMARK_ADDED event
      if (variables.body) {
        analytics.track(AnalyticsEvent.BOOKMARK_ADDED, {
          bookId: variables.body.book_id,
          chapterNumber: variables.body.chapter_number,
        });
      }

      // Refetch to get accurate server data (with correct favorite_id and book_name)
      queryClient.invalidateQueries({ queryKey: bookmarksQueryKey });
    },
  });

  // Remove bookmark mutation
  const removeMutation = useMutation({
    ...deleteBibleBookBookmarkRemoveMutation(),
    onMutate: async (variables) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: bookmarksQueryKey });

      // Snapshot previous value for rollback
      const previousBookmarks =
        queryClient.getQueryData<GetBibleBookBookmarksByUserIdResponse>(bookmarksQueryKey);

      // Optimistically update to the new value
      if (previousBookmarks && variables.query) {
        const { book_id, chapter_number } = variables.query;
        const bookIdNum = Number(book_id);
        const chapterNum = Number(chapter_number);

        queryClient.setQueryData<GetBibleBookBookmarksByUserIdResponse>(bookmarksQueryKey, {
          favorites: previousBookmarks.favorites.filter(
            (b) => !(b.book_id === bookIdNum && b.chapter_number === chapterNum)
          ),
        });
      }

      // Return context for rollback
      return { previousBookmarks };
    },
    onError: (error, _variables, context) => {
      // Rollback to previous state on error
      if (context?.previousBookmarks) {
        queryClient.setQueryData(bookmarksQueryKey, context.previousBookmarks);
      }
      console.error('Failed to remove bookmark:', error);
    },
    onSuccess: (_data, variables) => {
      // Track analytics: BOOKMARK_REMOVED event
      if (variables.query) {
        analytics.track(AnalyticsEvent.BOOKMARK_REMOVED, {
          bookId: Number(variables.query.book_id),
          chapterNumber: Number(variables.query.chapter_number),
        });
      }

      // Refetch to sync with server
      queryClient.invalidateQueries({ queryKey: bookmarksQueryKey });
    },
  });

  /**
   * Check if a chapter is bookmarked
   */
  const isBookmarked = useCallback(
    (bookId: number, chapterNumber: number): boolean => {
      return bookmarks.some((b) => b.book_id === bookId && b.chapter_number === chapterNumber);
    },
    [bookmarks]
  );

  /**
   * Add a bookmark with optimistic update
   */
  const addBookmark = useCallback(
    async (bookId: number, chapterNumber: number): Promise<void> => {
      // Check authentication
      if (!isAuthenticated || !user?.id) {
        console.error('User must be authenticated to add bookmarks');
        return;
      }

      // Call mutation
      await addMutation.mutateAsync({
        body: {
          user_id: user.id,
          book_id: bookId,
          chapter_number: chapterNumber,
        },
      } as PostBibleBookBookmarkAddData);
    },
    [isAuthenticated, user?.id, addMutation]
  );

  /**
   * Remove a bookmark with optimistic update
   */
  const removeBookmark = useCallback(
    async (bookId: number, chapterNumber: number): Promise<void> => {
      // Check authentication
      if (!isAuthenticated || !user?.id) {
        console.error('User must be authenticated to remove bookmarks');
        return;
      }

      // Call mutation
      await removeMutation.mutateAsync({
        query: {
          user_id: user.id,
          book_id: String(bookId),
          chapter_number: String(chapterNumber),
        },
      } as DeleteBibleBookBookmarkRemoveData);
    },
    [isAuthenticated, user?.id, removeMutation]
  );

  /**
   * Manually refetch bookmarks from API
   */
  const refetchBookmarks = useCallback(async (): Promise<void> => {
    if (isAuthenticated && user?.id) {
      await refetch();
    }
  }, [isAuthenticated, user?.id, refetch]);

  // Combine auth and query loading states
  // Loading if:
  // 1. Auth is still loading, OR
  // 2. Query is actively fetching, OR
  // 3. Auth is loaded but query hasn't fetched yet (dataUpdatedAt === 0)
  const isFetchingBookmarks =
    isAuthLoading || isQueryFetching || (isAuthenticated && dataUpdatedAt === 0);

  return {
    bookmarks,
    isFetchingBookmarks,
    isAddingBookmark: addMutation.isPending,
    isRemovingBookmark: removeMutation.isPending,
    isBookmarked,
    addBookmark,
    removeBookmark,
    refetchBookmarks,
  };
}
