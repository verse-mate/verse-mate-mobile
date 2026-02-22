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
import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useOfflineContext } from '@/contexts/OfflineContext';
import { AnalyticsEvent, analytics } from '@/lib/analytics';
import {
  addLocalBookmark,
  addSyncAction,
  deleteLocalBookmarkByChapter,
  getLocalBookmarks,
} from '@/services/offline';
import {
  deleteBibleBookBookmarkRemoveMutation,
  getBibleBookBookmarksByUserIdOptions,
  getBibleBookBookmarksByUserIdQueryKey,
  postBibleBookBookmarkAddMutation,
} from '@/src/api/generated/@tanstack/react-query.gen';
import type {
  AugmentedBookmark,
  AugmentedBookmarksResponse,
} from '@/src/api/generated/types.augment';
import type {
  DeleteBibleBookBookmarkRemoveData,
  PostBibleBookBookmarkAddData,
} from '@/src/api/generated/types.gen';
import type { ContentTabType } from '@/types/bible';

/**
 * Bookmark item type from API response
 * Using augmented type to include insight_type field
 */
export type Bookmark = AugmentedBookmark;

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
  /** Check if an insight is bookmarked */
  isInsightBookmarked: (
    bookId: number,
    chapterNumber: number,
    insightType: ContentTabType
  ) => boolean;
  /** Add an insight bookmark with optimistic update */
  addInsightBookmark: (
    bookId: number,
    chapterNumber: number,
    insightType: ContentTabType
  ) => Promise<void>;
  /** Remove an insight bookmark with optimistic update */
  removeInsightBookmark: (
    bookId: number,
    chapterNumber: number,
    insightType: ContentTabType
  ) => Promise<void>;
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
  const { isUserDataSynced, isOnline } = useOfflineContext();
  const queryClient = useQueryClient();

  const isDeviceOffline = !isOnline;

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

  // Fetch bookmarks from API (disabled in offline mode)
  const {
    data: bookmarksData,
    isFetching: isQueryFetching,
    refetch,
    dataUpdatedAt,
  } = useQuery({
    ...getBibleBookBookmarksByUserIdOptions(queryOptions),
    enabled: isAuthenticated && !!user?.id && !isDeviceOffline,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Fetch bookmarks from local storage when offline or fallback
  const { data: localBookmarksData, isFetching: isLocalFetching } = useQuery({
    queryKey: ['local-bookmarks-offline-fallback'],
    queryFn: async () => {
      const localBookmarks = await getLocalBookmarks();
      return localBookmarks.map((b) => ({
        favorite_id: b.favorite_id,
        book_id: b.book_id,
        chapter_number: b.chapter_number,
        book_name: `Book ${b.book_id}`,
        insight_type: b.insight_type || null,
        created_at: b.created_at,
      }));
    },
    enabled: isDeviceOffline || isUserDataSynced,
    staleTime: Number.POSITIVE_INFINITY,
  });

  // Extract bookmarks array from response (offline or remote)
  const bookmarks = useMemo(() => {
    if (isDeviceOffline && localBookmarksData) {
      return localBookmarksData as Bookmark[];
    }
    return bookmarksData?.favorites || [];
  }, [isDeviceOffline, localBookmarksData, bookmarksData]);

  // Add bookmark mutation
  const addMutation = useMutation({
    ...postBibleBookBookmarkAddMutation(),
    mutationFn: async (variables) => {
      if (!isOnline) {
        if (!variables.body) throw new Error('Missing body');
        const { book_id, chapter_number, insight_type } = variables.body;
        const tempId = Date.now();
        const bookmark = {
          favorite_id: tempId,
          book_id,
          chapter_number,
          created_at: new Date().toISOString(),
          insight_type: insight_type || undefined,
        };

        await addLocalBookmark(bookmark);
        await addSyncAction('BOOKMARK', 'CREATE', variables.body);

        return {
          success: true,
          favorite: {
            ...bookmark,
            user_id: user?.id || '',
            book_name: `Book ${book_id}`,
            insight_type: insight_type || null,
          },
        };
      }
      // Context argument is optional in implementation but required by type
      const fn = postBibleBookBookmarkAddMutation().mutationFn;

      if (!fn) throw new Error('Mutation function missing');
      // biome-ignore lint/suspicious/noExplicitAny: context required by type
      return fn(variables, undefined as any);
    },
    onMutate: async (variables) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: bookmarksQueryKey });

      // Snapshot previous value for rollback
      const previousBookmarks =
        queryClient.getQueryData<AugmentedBookmarksResponse>(bookmarksQueryKey);

      // Optimistically update to the new value
      if (previousBookmarks && variables.body) {
        const { book_id, chapter_number, insight_type } = variables.body;

        // Check if bookmark already exists
        const exists = previousBookmarks.favorites.some((b) => {
          if (b.book_id !== book_id || b.chapter_number !== chapter_number) {
            return false;
          }
          // Normalize null/undefined/empty for comparison
          const storeInsightType = b.insight_type || undefined;
          const newInsightType = insight_type || undefined;
          return storeInsightType === newInsightType;
        });

        if (!exists) {
          // Add optimistic bookmark (favorite_id will be set by server)
          const optimisticBookmark: Bookmark = {
            favorite_id: Date.now(), // Temporary ID
            book_id,
            chapter_number,
            book_name: `Book ${book_id}`, // Will be updated from server response
            insight_type,
          };

          queryClient.setQueryData<AugmentedBookmarksResponse>(bookmarksQueryKey, {
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
      queryClient.invalidateQueries({ queryKey: ['local-bookmarks-offline-fallback'] });
    },
  });

  // Remove bookmark mutation
  const removeMutation = useMutation({
    ...deleteBibleBookBookmarkRemoveMutation(),
    mutationFn: async (variables) => {
      if (!isOnline) {
        if (!variables.query) throw new Error('Missing query');
        const { book_id, chapter_number, insight_type } = variables.query;

        await deleteLocalBookmarkByChapter(
          Number(book_id),
          Number(chapter_number),
          insight_type || undefined
        );
        await addSyncAction('BOOKMARK', 'DELETE', variables.query);

        return { success: true };
      }
      // Context argument is optional in implementation but required by type
      const fn = deleteBibleBookBookmarkRemoveMutation().mutationFn;

      if (!fn) throw new Error('Mutation function missing');
      // biome-ignore lint/suspicious/noExplicitAny: context required by type
      return fn(variables, undefined as any);
    },
    onMutate: async (variables) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: bookmarksQueryKey });

      // Snapshot previous value for rollback
      const previousBookmarks =
        queryClient.getQueryData<AugmentedBookmarksResponse>(bookmarksQueryKey);

      // Optimistically update to the new value
      if (previousBookmarks && variables.query) {
        const { book_id, chapter_number, insight_type } = variables.query;
        const bookIdNum = Number(book_id);
        const chapterNum = Number(chapter_number);

        queryClient.setQueryData<AugmentedBookmarksResponse>(bookmarksQueryKey, {
          favorites: previousBookmarks.favorites.filter((b) => {
            // Keep if book/chapter don't match
            if (b.book_id !== bookIdNum || b.chapter_number !== chapterNum) {
              return true;
            }

            // For insight_type, normalize null/undefined/empty before comparing
            const storeInsightType = b.insight_type || undefined;
            const removeInsightType = insight_type || undefined;

            // Remove if insight_type matches (including both being undefined)
            return storeInsightType !== removeInsightType;
          }),
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
      queryClient.invalidateQueries({ queryKey: ['local-bookmarks-offline-fallback'] });
    },
  });

  /**
   * Check if a chapter is bookmarked
   */
  const isBookmarked = (bookId: number, chapterNumber: number): boolean => {
    return bookmarks.some((b) => b.book_id === bookId && b.chapter_number === chapterNumber);
  };

  /**
   * Add a bookmark with optimistic update
   */
  const addBookmark = async (bookId: number, chapterNumber: number): Promise<void> => {
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
  };

  /**
   * Remove a bookmark with optimistic update
   */
  const removeBookmark = async (bookId: number, chapterNumber: number): Promise<void> => {
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
  };

  /**
   * Manually refetch bookmarks from API
   */
  const refetchBookmarks = async (): Promise<void> => {
    if (isAuthenticated && user?.id) {
      await refetch();
    }
  };

  /**
   * Check if an insight is bookmarked
   */
  const isInsightBookmarked = (
    bookId: number,
    chapterNumber: number,
    insightType: ContentTabType
  ): boolean => {
    return bookmarks.some(
      (b: Bookmark) =>
        b.book_id === bookId && b.chapter_number === chapterNumber && b.insight_type === insightType
    );
  };

  /**
   * Add an insight bookmark with optimistic update
   */
  const addInsightBookmark = async (
    bookId: number,
    chapterNumber: number,
    insightType: ContentTabType
  ): Promise<void> => {
    // Check authentication
    if (!isAuthenticated || !user?.id) {
      console.error('User must be authenticated to add insight bookmarks');
      return;
    }

    // Call mutation with insight_type
    await addMutation.mutateAsync({
      body: {
        user_id: user.id,
        book_id: bookId,
        chapter_number: chapterNumber,
        insight_type: insightType,
      },
    } as PostBibleBookBookmarkAddData);
  };

  /**
   * Remove an insight bookmark with optimistic update
   */
  const removeInsightBookmark = async (
    bookId: number,
    chapterNumber: number,
    insightType: ContentTabType
  ): Promise<void> => {
    // Check authentication
    if (!isAuthenticated || !user?.id) {
      console.error('User must be authenticated to remove insight bookmarks');
      return;
    }

    // Call mutation with insight_type
    await removeMutation.mutateAsync({
      query: {
        user_id: user.id,
        book_id: String(bookId),
        chapter_number: String(chapterNumber),
        insight_type: insightType,
      },
    } as DeleteBibleBookBookmarkRemoveData);
  };

  // Combine auth and query loading states
  // Loading if:
  // 1. Auth is still loading, OR
  // 2. Query is actively fetching (remote or local), OR
  // 3. Auth is loaded, we are online, but query hasn't fetched yet (dataUpdatedAt === 0)
  const isFetchingBookmarks =
    isAuthLoading ||
    isQueryFetching ||
    isLocalFetching ||
    (isAuthenticated && !isDeviceOffline && dataUpdatedAt === 0);

  return {
    bookmarks,
    isFetchingBookmarks,
    isAddingBookmark: addMutation.isPending,
    isRemovingBookmark: removeMutation.isPending,
    isBookmarked,
    addBookmark,
    removeBookmark,
    isInsightBookmarked,
    addInsightBookmark,
    removeInsightBookmark,
    refetchBookmarks,
  };
}
