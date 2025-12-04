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
import {
  getAutoHighlights,
  getDefaultAutoHighlightsEnabled,
  getHighlightThemes,
  getUserThemePreferences,
} from '@/lib/api/auto-highlights';
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
 * - Applies per-theme relevance thresholds (respects admin_override)
 *
 * For logged-out users:
 * - Checks global default enabled setting
 * - Uses theme default relevance thresholds
 *
 * @param params - Hook parameters
 * @returns Auto-highlights data and loading state
 */
export function useAutoHighlights({
  bookId,
  chapterNumber,
}: UseAutoHighlightsParams): UseAutoHighlightsReturn {
  const { user } = useAuth();

  // Fetch global default enabled setting (only for logged-out users)
  const { data: defaultEnabledData } = useQuery({
    queryKey: ['auto-highlights-default-enabled'],
    queryFn: async () => {
      const response = await getDefaultAutoHighlightsEnabled();
      return response.data?.default_enabled ?? false;
    },
    enabled: !user?.id, // Only fetch for logged-out users
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  // Fetch themes (only for logged-out users, to get default relevance thresholds)
  const { data: themesData } = useQuery({
    queryKey: ['highlight-themes'],
    queryFn: async () => {
      const response = await getHighlightThemes();
      return response.data || [];
    },
    enabled: !user?.id, // Only fetch for logged-out users
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

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
    queryKey: [
      'auto-highlights',
      bookId,
      chapterNumber,
      preferencesData,
      themesData,
      defaultEnabledData,
    ],
    queryFn: async () => {
      if (!bookId || !chapterNumber) return [];

      // For logged-out users, check if auto-highlights are enabled globally
      if (!user?.id && !defaultEnabledData) {
        return [];
      }

      // Build query parameters based on user preferences or theme defaults
      let themeIds: number[] = [];
      const themeRelevanceMap: Record<number, number> = {};

      if (user?.id && preferencesData && Array.isArray(preferencesData)) {
        // Logged-in user: use their preferences
        const enabledPreferences = preferencesData.filter((p) => p.is_enabled);

        themeIds = enabledPreferences.map((p) => p.theme_id);

        // If user has explicitly disabled all themes, return empty highlights
        if (themeIds.length === 0 && enabledPreferences.length === 0) {
          return [];
        }

        // Build per-theme relevance map
        // Use custom relevance only if admin_override is true, otherwise use theme default
        for (const pref of enabledPreferences) {
          themeRelevanceMap[pref.theme_id] = pref.admin_override
            ? pref.relevance_threshold
            : pref.default_relevance_threshold;
        }
      } else if (!user?.id && themesData && Array.isArray(themesData)) {
        // Logged-out user: use theme defaults
        const activeThemes = themesData.filter((t) => t.is_active);

        themeIds = activeThemes.map((t) => t.theme_id);

        // Build per-theme relevance map using default thresholds
        for (const theme of activeThemes) {
          themeRelevanceMap[theme.theme_id] = theme.default_relevance_threshold || 3;
        }
      }

      // Build theme_relevance parameter: "theme_id:relevance,theme_id:relevance"
      const themeRelevancePairs = Object.entries(themeRelevanceMap)
        .map(([themeId, relevance]) => `${themeId}:${relevance}`)
        .join(',');

      const response = await getAutoHighlights(bookId, chapterNumber, {
        themeIds: themeIds,
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
