/**
 * useAutoHighlights Hook
 *
 * React Query hook for fetching and managing auto-generated Bible highlights.
 * Handles both logged-in (with preferences) and logged-out (default) users.
 *
 * @example
 * ```tsx
 * const { autoHighlights, isLoading } = useAutoHighlights({
 *   bookId: 1,
 *   chapterNumber: 1,
 * });
 * ```
 */

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { getAutoHighlights, getUserThemePreferences } from '@/lib/api/auto-highlights';
import type { AutoHighlight } from '@/types/auto-highlights';

interface UseAutoHighlightsParams {
  /** Book ID */
  bookId?: number;
  /** Chapter number */
  chapterNumber?: number;
}

interface UseAutoHighlightsReturn {
  /** Auto-highlights for the chapter (filtered by user preferences) */
  autoHighlights: AutoHighlight[];
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
}

/**
 * Fetch auto-highlights for a Bible chapter
 *
 * For logged-in users:
 * - Fetches user's theme preferences
 * - Filters auto-highlights by enabled themes
 * - Applies per-theme relevance thresholds
 *
 * For logged-out users:
 * - Shows all themes with default relevance threshold of 3
 *
 * @param params - Hook parameters
 * @returns Auto-highlights data and loading state
 */
export function useAutoHighlights({
  bookId,
  chapterNumber,
}: UseAutoHighlightsParams): UseAutoHighlightsReturn {
  const { user } = useAuth();

  // Fetch user theme preferences (only for logged-in users)
  const {
    data: preferencesData,
    isLoading: isLoadingPreferences,
    error: preferencesError,
  } = useQuery({
    queryKey: ['user-theme-preferences', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const response = await getUserThemePreferences();
      return response.data;
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  // Fetch auto-highlights for chapter
  const {
    data: autoHighlightsData,
    isLoading: isLoadingHighlights,
    error: highlightsError,
  } = useQuery({
    queryKey: ['auto-highlights', bookId, chapterNumber, preferencesData],
    queryFn: async () => {
      if (!bookId || !chapterNumber) return [];

      // Build query parameters based on user preferences
      let themeIds: number[] = [];
      const themeRelevanceMap: Record<number, number> = {};

      if (preferencesData && Array.isArray(preferencesData)) {
        // Logged-in user: use their preferences
        const enabledPreferences = preferencesData.filter((p) => p.is_enabled);

        themeIds = enabledPreferences.map((p) => p.theme_id);

        // Build per-theme relevance map
        for (const pref of enabledPreferences) {
          themeRelevanceMap[pref.theme_id] = pref.relevance_threshold;
        }
      }

      // Build theme_relevance parameter: "theme_id:relevance,theme_id:relevance"
      const themeRelevancePairs = Object.entries(themeRelevanceMap)
        .map(([themeId, relevance]) => `${themeId}:${relevance}`)
        .join(',');

      const response = await getAutoHighlights(bookId, chapterNumber, {
        themeIds: themeIds.length > 0 ? themeIds : undefined,
        themeRelevance: themeRelevancePairs || undefined,
      });

      return response.data || [];
    },
    enabled: !!bookId && !!chapterNumber,
    staleTime: 1000 * 60 * 10, // Cache for 10 minutes
  });

  const isLoading = user?.id ? isLoadingPreferences || isLoadingHighlights : isLoadingHighlights;
  const error = (preferencesError || highlightsError) as Error | null;

  return {
    autoHighlights: autoHighlightsData || [],
    isLoading,
    error,
  };
}
