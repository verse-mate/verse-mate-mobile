/**
 * Auto-Highlights Type Definitions
 *
 * Types for AI-generated Bible verse highlights organized by themes.
 * Based on backend implementation from PR #112.
 */

import type { HighlightColor } from '@/constants/highlight-colors';

/**
 * Auto-generated highlight from AI analysis
 * Represents a verse or verse range marked with a specific theme
 */
export interface AutoHighlight {
  /** Unique identifier for this auto-highlight */
  auto_highlight_id: number;
  /** Theme ID this highlight belongs to */
  theme_id: number;
  /** Theme name (e.g., "Key Verses", "Promises from God") */
  theme_name: string;
  /** Theme color key */
  theme_color: HighlightColor;
  /** Book ID */
  book_id: number;
  /** Chapter number */
  chapter_number: number;
  /** Starting verse number (inclusive) */
  start_verse: number;
  /** Ending verse number (inclusive) */
  end_verse: number;
  /** AI-assigned relevance score (1-5, where 1 is most relevant) */
  relevance_score: number;
  /** Timestamp when created */
  created_at: string;
}

/**
 * Highlight theme definition
 * System-defined categories for auto-highlights
 */
export interface HighlightTheme {
  /** Unique theme identifier */
  theme_id: number;
  /** Theme name */
  name: string;
  /** Default color for this theme */
  color: HighlightColor;
  /** Theme description */
  description: string | null;
  /** Priority order (lower = higher priority) */
  priority: number;
  /** Whether theme is active system-wide */
  is_active: boolean;
}

/**
 * User's preferences for a specific theme
 * Controls visibility and filtering per theme
 */
export interface UserThemePreference {
  /** Theme ID */
  theme_id: number;
  /** Theme name */
  theme_name: string;
  /** Theme color */
  theme_color: HighlightColor;
  /** Theme description */
  theme_description: string | null;
  /** Whether user has enabled this theme */
  is_enabled: boolean;
  /** User's custom color override (if any) */
  custom_color: HighlightColor | null;
  /** Relevance threshold (1-5, only show highlights with score <= this) */
  relevance_threshold: number;
}

/**
 * API response for auto-highlights endpoint
 */
export interface GetAutoHighlightsResponse {
  success: boolean;
  data: AutoHighlight[];
}

/**
 * API response for highlight themes endpoint
 */
export interface GetHighlightThemesResponse {
  success: boolean;
  data: HighlightTheme[];
}

/**
 * API response for user theme preferences endpoint
 */
export interface GetUserThemePreferencesResponse {
  success: boolean;
  data: UserThemePreference[];
}

/**
 * Request body for updating theme preference
 */
export interface UpdateThemePreferenceRequest {
  /** Enable/disable theme */
  is_enabled?: boolean;
  /** Custom color override */
  custom_color?: HighlightColor;
  /** Relevance threshold (1-5) */
  relevance_threshold?: number;
}
