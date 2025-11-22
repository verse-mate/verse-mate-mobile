/**
 * Auto-Highlights API Functions
 *
 * Manual API functions for auto-highlights feature.
 * These mirror the backend endpoints from PR #112.
 *
 * Once the feature is deployed and OpenAPI schema is updated,
 * these can be replaced with generated API client calls.
 */

import { authenticatedFetch } from '@/lib/api/authenticated-fetch';
import type {
  GetAutoHighlightsResponse,
  GetHighlightThemesResponse,
  GetUserThemePreferencesResponse,
  UpdateThemePreferenceRequest,
} from '@/types/auto-highlights';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://api.verse-mate.apegro.dev';

/**
 * Get auto-highlights for a specific chapter
 *
 * @param bookId - Book ID number
 * @param chapterNumber - Chapter number
 * @param options - Query parameters
 * @param options.themeIds - Optional array of theme IDs to filter by
 * @param options.themeRelevance - Optional per-theme relevance map (e.g., "1:3,2:2" means theme 1 with threshold 3, theme 2 with threshold 2)
 * @returns Auto-highlights for the chapter
 */
export async function getAutoHighlights(
  bookId: number,
  chapterNumber: number,
  options?: {
    themeIds?: number[];
    themeRelevance?: string;
  },
): Promise<GetAutoHighlightsResponse> {
  const queryParams = new URLSearchParams();

  if (options?.themeIds && options.themeIds.length > 0) {
    queryParams.append('themes', options.themeIds.join(','));
  }

  if (options?.themeRelevance) {
    queryParams.append('theme_relevance', options.themeRelevance);
  }

  const queryString = queryParams.toString();
  const url = `${BASE_URL}/bible/auto-highlights/${bookId}/${chapterNumber}${queryString ? `?${queryString}` : ''}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch auto-highlights: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get all available highlight themes
 * Public endpoint - no authentication required
 *
 * @returns List of active highlight themes
 */
export async function getHighlightThemes(): Promise<GetHighlightThemesResponse> {
  const url = `${BASE_URL}/bible/highlight-themes`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch highlight themes: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get user's theme preferences
 * Requires authentication
 *
 * Returns all themes with user's custom preferences applied.
 * If user hasn't set preferences, returns themes with default values.
 *
 * @returns User's theme preferences
 */
export async function getUserThemePreferences(): Promise<GetUserThemePreferencesResponse> {
  const url = `${BASE_URL}/bible/user/theme-preferences`;

  const response = await authenticatedFetch(url, {
    method: 'GET',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch user theme preferences: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Update user's preference for a specific theme
 * Requires authentication
 *
 * @param themeId - Theme ID to update
 * @param preferences - Preference updates
 */
export async function updateUserThemePreference(
  themeId: number,
  preferences: UpdateThemePreferenceRequest,
): Promise<{ success: boolean }> {
  const url = `${BASE_URL}/bible/user/theme-preferences/${themeId}`;

  const response = await authenticatedFetch(url, {
    method: 'PATCH',
    body: JSON.stringify(preferences),
  });

  if (!response.ok) {
    throw new Error(`Failed to update theme preference: ${response.statusText}`);
  }

  return response.json();
}
