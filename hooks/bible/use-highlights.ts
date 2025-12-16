/**
 * useHighlights Hook
 *
 * Manages highlight state with optimistic UI updates and API synchronization.
 * Provides methods to add, update color, delete, and fetch highlights for Bible verses.
 *
 * @example
 * ```tsx
 * const {
 *   allHighlights,
 *   chapterHighlights,
 *   isHighlighted,
 *   addHighlight,
 *   updateHighlightColor,
 *   deleteHighlight,
 *   isFetchingHighlights,
 *   isAddingHighlight,
 *   isUpdatingHighlight,
 *   isDeletingHighlight
 * } = useHighlights({ bookId: 1, chapterNumber: 1 });
 *
 * // Check if verse range is highlighted
 * const highlighted = isHighlighted(1, 1, 0, 50);
 *
 * // Add highlight with optimistic update
 * await addHighlight({
 *   bookId: 1,
 *   chapterNumber: 1,
 *   startVerse: 1,
 *   endVerse: 2,
 *   color: 'yellow',
 *   startChar: 0,
 *   endChar: 100,
 *   selectedText: 'In the beginning...'
 * });
 *
 * // Update highlight color with optimistic update
 * await updateHighlightColor(highlightId, 'green');
 *
 * // Delete highlight with optimistic update
 * await deleteHighlight(highlightId);
 * ```
 *
 * @see Spec: .agent-os/specs/2025-11-06-highlight-feature/spec.md
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import type { HighlightColor } from '@/constants/highlight-colors';
import { useAuth } from '@/contexts/AuthContext';
import { AnalyticsEvent, analytics } from '@/lib/analytics';
import {
  deleteBibleHighlightByHighlightIdMutation,
  getBibleHighlightsByUserIdByBookIdByChapterNumberOptions,
  getBibleHighlightsByUserIdByBookIdByChapterNumberQueryKey,
  getBibleHighlightsByUserIdOptions,
  getBibleHighlightsByUserIdQueryKey,
  postBibleHighlightAddMutation,
  putBibleHighlightByHighlightIdMutation,
} from '@/src/api/generated/@tanstack/react-query.gen';
import type {
  DeleteBibleHighlightByHighlightIdData,
  GetBibleHighlightsByUserIdByBookIdByChapterNumberResponse,
  GetBibleHighlightsByUserIdResponse,
  PostBibleHighlightAddData,
  PutBibleHighlightByHighlightIdData,
} from '@/src/api/generated/types.gen';

/**
 * Highlight item type from API response
 */
export type Highlight = GetBibleHighlightsByUserIdResponse['highlights'][number];

/**
 * Re-export HighlightColor type for convenience
 */
export type { HighlightColor };

/**
 * Parameters for adding a new highlight
 */
export interface AddHighlightParams {
  bookId: number;
  chapterNumber: number;
  startVerse: number;
  endVerse: number;
  color: HighlightColor;
  startChar?: number;
  endChar?: number;
  selectedText?: string;
}

/**
 * Hook options for chapter-specific queries
 */
export interface UseHighlightsOptions {
  bookId?: number;
  chapterNumber?: number;
}

/**
 * Return type for useHighlights hook
 */
export interface UseHighlightsResult {
  /** Array of all user highlights (fetched when no chapter specified) */
  allHighlights: Highlight[];
  /** Array of chapter-specific highlights (fetched when chapter specified) */
  chapterHighlights: Highlight[];
  /** Whether highlights are being fetched from API */
  isFetchingHighlights: boolean;
  /** Whether a highlight is being added */
  isAddingHighlight: boolean;
  /** Whether a highlight is being updated */
  isUpdatingHighlight: boolean;
  /** Whether a highlight is being deleted */
  isDeletingHighlight: boolean;
  /** Check if a verse range has a highlight */
  isHighlighted: (
    startVerse: number,
    endVerse: number,
    startChar?: number,
    endChar?: number
  ) => boolean;
  /** Add a highlight with optimistic update */
  addHighlight: (params: AddHighlightParams) => Promise<void>;
  /** Update highlight color with optimistic update */
  updateHighlightColor: (highlightId: number, color: HighlightColor) => Promise<void>;
  /** Delete highlight with optimistic update */
  deleteHighlight: (highlightId: number) => Promise<void>;
  /** Manually refetch highlights from API */
  refetchHighlights: () => Promise<void>;
}

/**
 * Hook to manage highlight state with optimistic updates
 *
 * Features:
 * - Fetches highlights from API on mount
 * - Supports both all-highlights and chapter-specific queries
 * - Optimistic UI updates for instant feedback
 * - Automatic rollback on API failure (especially overlap errors)
 * - Authentication checks before API calls
 * - Loading states for all operations
 *
 * @param options - Optional chapter filter (bookId, chapterNumber)
 * @returns {UseHighlightsResult} Highlight state and methods
 */
export function useHighlights(options?: UseHighlightsOptions): UseHighlightsResult {
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const queryClient = useQueryClient();

  const { bookId, chapterNumber } = options || {};

  // Determine which query to use based on options
  const fetchAllHighlights = !bookId || !chapterNumber;

  // Query options for all highlights
  const allHighlightsQueryOptions = useMemo(
    () => ({
      path: { user_id: user?.id || '' },
    }),
    [user?.id]
  );

  // Query options for chapter-specific highlights
  const chapterHighlightsQueryOptions = useMemo(
    () => ({
      path: {
        user_id: user?.id || '',
        book_id: bookId || 0,
        chapter_number: chapterNumber || 0,
      },
    }),
    [user?.id, bookId, chapterNumber]
  );

  // Query key for all highlights
  const allHighlightsQueryKey = useMemo(
    () => getBibleHighlightsByUserIdQueryKey(allHighlightsQueryOptions),
    [allHighlightsQueryOptions]
  );

  // Query key for chapter-specific highlights
  const chapterHighlightsQueryKey = useMemo(
    () => getBibleHighlightsByUserIdByBookIdByChapterNumberQueryKey(chapterHighlightsQueryOptions),
    [chapterHighlightsQueryOptions]
  );

  // Fetch all highlights
  const {
    data: allHighlightsData,
    isFetching: isAllFetching,
    refetch: refetchAll,
  } = useQuery({
    ...getBibleHighlightsByUserIdOptions(allHighlightsQueryOptions),
    enabled: isAuthenticated && !!user?.id && fetchAllHighlights,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Fetch chapter-specific highlights
  const {
    data: chapterHighlightsData,
    isFetching: isChapterFetching,
    refetch: refetchChapter,
  } = useQuery({
    ...getBibleHighlightsByUserIdByBookIdByChapterNumberOptions(chapterHighlightsQueryOptions),
    enabled: isAuthenticated && !!user?.id && !fetchAllHighlights && !!bookId && !!chapterNumber,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Extract highlights arrays from responses
  const allHighlights = useMemo(() => allHighlightsData?.highlights || [], [allHighlightsData]);
  const chapterHighlights = useMemo(
    () => chapterHighlightsData?.highlights || [],
    [chapterHighlightsData]
  );

  // Add highlight mutation
  const addMutation = useMutation({
    ...postBibleHighlightAddMutation(),
    onMutate: async (variables) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: allHighlightsQueryKey });
      await queryClient.cancelQueries({ queryKey: chapterHighlightsQueryKey });

      // Snapshot previous value for rollback
      const previousAllHighlights =
        queryClient.getQueryData<GetBibleHighlightsByUserIdResponse>(allHighlightsQueryKey);
      const previousChapterHighlights =
        queryClient.getQueryData<GetBibleHighlightsByUserIdByBookIdByChapterNumberResponse>(
          chapterHighlightsQueryKey
        );

      // Optimistically update to the new value
      if (variables.body) {
        const {
          book_id,
          chapter_number,
          start_verse,
          end_verse,
          color,
          start_char,
          end_char,
          selected_text,
        } = variables.body;

        // Create optimistic highlight (highlight_id will be set by server)
        const optimisticHighlight: Highlight = {
          highlight_id: Date.now(), // Temporary ID
          user_id: variables.body.user_id,
          chapter_id: book_id * 1000 + chapter_number, // Approximate chapter_id
          book_id,
          chapter_number,
          start_verse,
          end_verse,
          color: color || 'yellow',
          start_char: start_char ?? null,
          end_char: end_char ?? null,
          selected_text: selected_text ?? null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        // Update all highlights cache if fetching all
        if (previousAllHighlights && fetchAllHighlights) {
          queryClient.setQueryData<GetBibleHighlightsByUserIdResponse>(allHighlightsQueryKey, {
            highlights: [...previousAllHighlights.highlights, optimisticHighlight],
          });
        }

        // Update chapter highlights cache if fetching chapter
        if (
          previousChapterHighlights &&
          !fetchAllHighlights &&
          bookId === book_id &&
          chapterNumber === chapter_number
        ) {
          queryClient.setQueryData<GetBibleHighlightsByUserIdByBookIdByChapterNumberResponse>(
            chapterHighlightsQueryKey,
            {
              highlights: [...previousChapterHighlights.highlights, optimisticHighlight],
            }
          );
        }
      }

      // Return context for rollback
      return { previousAllHighlights, previousChapterHighlights };
    },
    onError: (error, _variables, context) => {
      // Rollback to previous state on error (especially overlap errors)
      if (context?.previousAllHighlights) {
        queryClient.setQueryData(allHighlightsQueryKey, context.previousAllHighlights);
      }
      if (context?.previousChapterHighlights) {
        queryClient.setQueryData(chapterHighlightsQueryKey, context.previousChapterHighlights);
      }
      console.error('Failed to add highlight:', error);

      // Re-throw error for component to handle (especially overlap errors)
      throw error;
    },
    onSuccess: (_data, variables) => {
      // Track analytics: HIGHLIGHT_CREATED event
      if (variables.body) {
        analytics.track(AnalyticsEvent.HIGHLIGHT_CREATED, {
          bookId: variables.body.book_id,
          chapterNumber: variables.body.chapter_number,
          color: variables.body.color || 'yellow',
        });
      }

      // Refetch to get accurate server data (with correct highlight_id and chapter_id)
      queryClient.invalidateQueries({ queryKey: allHighlightsQueryKey });
      queryClient.invalidateQueries({ queryKey: chapterHighlightsQueryKey });
    },
  });

  // Update highlight color mutation
  const updateMutation = useMutation({
    ...putBibleHighlightByHighlightIdMutation(),
    onMutate: async (variables) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: allHighlightsQueryKey });
      await queryClient.cancelQueries({ queryKey: chapterHighlightsQueryKey });

      // Snapshot previous value for rollback
      const previousAllHighlights =
        queryClient.getQueryData<GetBibleHighlightsByUserIdResponse>(allHighlightsQueryKey);
      const previousChapterHighlights =
        queryClient.getQueryData<GetBibleHighlightsByUserIdByBookIdByChapterNumberResponse>(
          chapterHighlightsQueryKey
        );

      // Optimistically update color
      if (variables.body && variables.path) {
        const { highlight_id } = variables.path;
        const { color } = variables.body;

        // Update all highlights cache
        if (previousAllHighlights) {
          queryClient.setQueryData<GetBibleHighlightsByUserIdResponse>(allHighlightsQueryKey, {
            highlights: previousAllHighlights.highlights.map((h) =>
              h.highlight_id === highlight_id
                ? { ...h, color, updated_at: new Date().toISOString() }
                : h
            ),
          });
        }

        // Update chapter highlights cache
        if (previousChapterHighlights) {
          queryClient.setQueryData<GetBibleHighlightsByUserIdByBookIdByChapterNumberResponse>(
            chapterHighlightsQueryKey,
            {
              highlights: previousChapterHighlights.highlights.map((h) =>
                h.highlight_id === highlight_id
                  ? { ...h, color, updated_at: new Date().toISOString() }
                  : h
              ),
            }
          );
        }
      }

      // Return context for rollback
      return { previousAllHighlights, previousChapterHighlights };
    },
    onError: (error, _variables, context) => {
      // Rollback to previous state on error
      if (context?.previousAllHighlights) {
        queryClient.setQueryData(allHighlightsQueryKey, context.previousAllHighlights);
      }
      if (context?.previousChapterHighlights) {
        queryClient.setQueryData(chapterHighlightsQueryKey, context.previousChapterHighlights);
      }
      console.error('Failed to update highlight color:', error);
    },
    onSuccess: (_data, variables) => {
      // Track analytics: HIGHLIGHT_EDITED event
      if (variables.body && variables.path) {
        analytics.track(AnalyticsEvent.HIGHLIGHT_EDITED, {
          highlightId: variables.path.highlight_id,
          color: variables.body.color || 'yellow',
        });
      }

      // Refetch to sync with server
      queryClient.invalidateQueries({ queryKey: allHighlightsQueryKey });
      queryClient.invalidateQueries({ queryKey: chapterHighlightsQueryKey });
    },
  });

  // Delete highlight mutation
  const deleteMutation = useMutation({
    ...deleteBibleHighlightByHighlightIdMutation(),
    onMutate: async (variables) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: allHighlightsQueryKey });
      await queryClient.cancelQueries({ queryKey: chapterHighlightsQueryKey });

      // Snapshot previous value for rollback
      const previousAllHighlights =
        queryClient.getQueryData<GetBibleHighlightsByUserIdResponse>(allHighlightsQueryKey);
      const previousChapterHighlights =
        queryClient.getQueryData<GetBibleHighlightsByUserIdByBookIdByChapterNumberResponse>(
          chapterHighlightsQueryKey
        );

      // Optimistically remove highlight
      if (variables.path) {
        const { highlight_id } = variables.path;

        // Update all highlights cache
        if (previousAllHighlights) {
          queryClient.setQueryData<GetBibleHighlightsByUserIdResponse>(allHighlightsQueryKey, {
            highlights: previousAllHighlights.highlights.filter(
              (h) => h.highlight_id !== highlight_id
            ),
          });
        }

        // Update chapter highlights cache
        if (previousChapterHighlights) {
          queryClient.setQueryData<GetBibleHighlightsByUserIdByBookIdByChapterNumberResponse>(
            chapterHighlightsQueryKey,
            {
              highlights: previousChapterHighlights.highlights.filter(
                (h) => h.highlight_id !== highlight_id
              ),
            }
          );
        }
      }

      // Return context for rollback
      return { previousAllHighlights, previousChapterHighlights };
    },
    onError: (error, _variables, context) => {
      // Rollback to previous state on error
      if (context?.previousAllHighlights) {
        queryClient.setQueryData(allHighlightsQueryKey, context.previousAllHighlights);
      }
      if (context?.previousChapterHighlights) {
        queryClient.setQueryData(chapterHighlightsQueryKey, context.previousChapterHighlights);
      }
      console.error('Failed to delete highlight:', error);
    },
    onSuccess: (_data, variables) => {
      // Track analytics: HIGHLIGHT_DELETED event
      if (variables.path) {
        analytics.track(AnalyticsEvent.HIGHLIGHT_DELETED, {
          highlightId: variables.path.highlight_id,
        });
      }

      // Refetch to sync with server
      queryClient.invalidateQueries({ queryKey: allHighlightsQueryKey });
      queryClient.invalidateQueries({ queryKey: chapterHighlightsQueryKey });
    },
  });

  /**
   * Check if a verse range has a highlight
   */
  const isHighlighted = useCallback(
    (startVerse: number, endVerse: number, startChar?: number, endChar?: number): boolean => {
      const highlights = fetchAllHighlights ? allHighlights : chapterHighlights;

      return highlights.some((h) => {
        // Check verse range overlap
        const verseOverlap = h.start_verse <= endVerse && h.end_verse >= startVerse;

        if (!verseOverlap) return false;

        // If character positions are specified, only consider highlights with character positions
        if (startChar !== undefined && endChar !== undefined) {
          // If highlight doesn't have character positions, it doesn't match character-level query
          if (h.start_char === null || h.end_char === null) return false;

          // Check character overlap
          return (h.start_char as number) <= endChar && (h.end_char as number) >= startChar;
        }

        // For verse-level queries (no character positions), any verse overlap matches
        return true;
      });
    },
    [allHighlights, chapterHighlights, fetchAllHighlights]
  );

  /**
   * Add a highlight with optimistic update
   */
  const addHighlight = useCallback(
    async (params: AddHighlightParams): Promise<void> => {
      // Check authentication
      if (!isAuthenticated || !user?.id) {
        console.error('User must be authenticated to add highlights');
        return;
      }

      await addMutation.mutateAsync({
        body: {
          user_id: user.id,
          book_id: params.bookId,
          chapter_number: params.chapterNumber,
          start_verse: params.startVerse,
          end_verse: params.endVerse,
          color: params.color,
          start_char: params.startChar,
          end_char: params.endChar,
          selected_text: params.selectedText,
        },
      });
    },
    [isAuthenticated, user?.id, addMutation]
  );

  /**
   * Update highlight color with optimistic update
   */
  const updateHighlightColor = useCallback(
    async (highlightId: number, color: HighlightColor): Promise<void> => {
      // Check authentication
      if (!isAuthenticated || !user?.id) {
        console.error('User must be authenticated to update highlights');
        return;
      }

      // Call mutation
      await updateMutation.mutateAsync({
        path: {
          highlight_id: highlightId,
        },
        body: {
          user_id: user.id,
          color,
        },
      } as PutBibleHighlightByHighlightIdData);
    },
    [isAuthenticated, user?.id, updateMutation]
  );

  /**
   * Delete highlight with optimistic update
   */
  const deleteHighlight = useCallback(
    async (highlightId: number): Promise<void> => {
      // Check authentication
      if (!isAuthenticated || !user?.id) {
        console.error('User must be authenticated to delete highlights');
        return;
      }

      // Call mutation
      await deleteMutation.mutateAsync({
        path: {
          highlight_id: highlightId,
        },
      } as DeleteBibleHighlightByHighlightIdData);
    },
    [isAuthenticated, user?.id, deleteMutation]
  );

  /**
   * Manually refetch highlights from API
   */
  const refetchHighlights = useCallback(async (): Promise<void> => {
    if (isAuthenticated && user?.id) {
      if (fetchAllHighlights) {
        await refetchAll();
      } else {
        await refetchChapter();
      }
    }
  }, [isAuthenticated, user?.id, fetchAllHighlights, refetchAll, refetchChapter]);

  // Combine auth and query loading states
  const isFetchingHighlights =
    isAuthLoading || (fetchAllHighlights ? isAllFetching : isChapterFetching);

  return {
    allHighlights,
    chapterHighlights,
    isFetchingHighlights,
    isAddingHighlight: addMutation.isPending,
    isUpdatingHighlight: updateMutation.isPending,
    isDeletingHighlight: deleteMutation.isPending,
    isHighlighted,
    addHighlight,
    updateHighlightColor,
    deleteHighlight,
    refetchHighlights,
  };
}
