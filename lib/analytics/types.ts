/**
 * Analytics Event Types
 *
 * Type definitions for PostHog analytics events.
 * All event names use UPPER_SNAKE_CASE convention.
 *
 * @see Spec: agent-os/specs/2025-12-15-posthog-product-analytics/spec.md
 * @see Spec: agent-os/specs/time-based-analytics/spec.md
 */

/**
 * Analytics event names enum
 * Uses UPPER_SNAKE_CASE convention for all event names
 */
export enum AnalyticsEvent {
  // Bible Reading Events
  CHAPTER_VIEWED = 'CHAPTER_VIEWED',
  VIEW_MODE_SWITCHED = 'VIEW_MODE_SWITCHED',
  EXPLANATION_TAB_CHANGED = 'EXPLANATION_TAB_CHANGED',

  // Feature Usage Events
  BOOKMARK_ADDED = 'BOOKMARK_ADDED',
  BOOKMARK_REMOVED = 'BOOKMARK_REMOVED',
  HIGHLIGHT_CREATED = 'HIGHLIGHT_CREATED',
  HIGHLIGHT_EDITED = 'HIGHLIGHT_EDITED',
  HIGHLIGHT_DELETED = 'HIGHLIGHT_DELETED',
  NOTE_CREATED = 'NOTE_CREATED',
  NOTE_EDITED = 'NOTE_EDITED',
  NOTE_DELETED = 'NOTE_DELETED',
  DICTIONARY_LOOKUP = 'DICTIONARY_LOOKUP',
  AUTO_HIGHLIGHT_SETTING_CHANGED = 'AUTO_HIGHLIGHT_SETTING_CHANGED',
  CHAPTER_SHARED = 'CHAPTER_SHARED',
  TOPIC_SHARED = 'TOPIC_SHARED',

  // AI Explanation Events
  VERSEMATE_TOOLTIP_OPENED = 'VERSEMATE_TOOLTIP_OPENED',
  AUTO_HIGHLIGHT_TOOLTIP_VIEWED = 'AUTO_HIGHLIGHT_TOOLTIP_VIEWED',

  // Authentication Events
  SIGNUP_COMPLETED = 'SIGNUP_COMPLETED',
  LOGIN_COMPLETED = 'LOGIN_COMPLETED',
  LOGOUT = 'LOGOUT',

  // Time-Based Analytics Events (Phase 2-3)
  CHAPTER_READING_DURATION = 'CHAPTER_READING_DURATION',
  VIEW_MODE_DURATION = 'VIEW_MODE_DURATION',
  TOOLTIP_READING_DURATION = 'TOOLTIP_READING_DURATION',
  CHAPTER_SCROLL_DEPTH = 'CHAPTER_SCROLL_DEPTH',
}

// ============================================================================
// Event Property Interfaces
// ============================================================================

/**
 * Bible Reading Event Properties
 */
export interface ChapterViewedProperties {
  bookId: number;
  chapterNumber: number;
  bibleVersion: string;
}

export interface ViewModeSwitchedProperties {
  mode: 'bible' | 'explanations';
}

export interface ExplanationTabChangedProperties {
  tab: 'summary' | 'byline' | 'detailed';
}

/**
 * Bookmark Event Properties
 */
export interface BookmarkAddedProperties {
  bookId: number;
  chapterNumber: number;
}

export interface BookmarkRemovedProperties {
  bookId: number;
  chapterNumber: number;
}

/**
 * Highlight Event Properties
 */
export interface HighlightCreatedProperties {
  bookId: number;
  chapterNumber: number;
  color: string;
}

export interface HighlightEditedProperties {
  highlightId: number;
  color: string;
}

export interface HighlightDeletedProperties {
  highlightId: number;
}

/**
 * Note Event Properties
 * Note: We never track note content for privacy
 */
export interface NoteCreatedProperties {
  bookId: number;
  chapterNumber: number;
}

export interface NoteEditedProperties {
  noteId: string;
}

export interface NoteDeletedProperties {
  noteId: string;
}

/**
 * Dictionary Event Properties
 */
export interface DictionaryLookupProperties {
  strongsNumber: string;
  language: 'greek' | 'hebrew';
}

/**
 * Auto-Highlight Setting Event Properties
 */
export interface AutoHighlightSettingChangedProperties {
  settingId: string;
  enabled: boolean;
}

/**
 * Share Event Properties
 */
export interface ChapterSharedProperties {
  bookId: number;
  chapterNumber: number;
}

export interface TopicSharedProperties {
  category: string;
  topicSlug: string;
}

/**
 * AI Explanation Event Properties
 */
export interface VersemateTooltipOpenedProperties {
  bookId: number;
  chapterNumber: number;
  verseNumber: number;
}

export interface AutoHighlightTooltipViewedProperties {
  bookId: number;
  chapterNumber: number;
}

/**
 * Authentication Event Properties
 */
export type AuthMethod = 'email' | 'google' | 'apple';

export interface SignupCompletedProperties {
  method: AuthMethod;
}

export interface LoginCompletedProperties {
  method: AuthMethod;
}

// Logout has no properties
export type LogoutProperties = Record<string, never>;

// ============================================================================
// Time-Based Analytics Event Properties (Phase 2-3)
// ============================================================================

/**
 * Chapter Reading Duration Event Properties
 * Fired when user exits a chapter, tracks total reading time
 */
export interface ChapterReadingDurationProperties {
  /** Total reading time in seconds */
  duration_seconds: number;
  /** Book ID (1-66) */
  bookId: number;
  /** Chapter number */
  chapterNumber: number;
  /** Bible version (e.g., 'NASB1995') */
  bibleVersion: string;
}

/**
 * View Mode Duration Event Properties
 * Fired when user switches view mode or exits chapter
 */
export interface ViewModeDurationProperties {
  /** View mode that was active ('bible' | 'explanations') */
  viewMode: 'bible' | 'explanations';
  /** Time spent in this mode in seconds */
  duration_seconds: number;
  /** Book ID (1-66) */
  bookId: number;
  /** Chapter number */
  chapterNumber: number;
  /** Bible version (e.g., 'NASB1995') */
  bibleVersion: string;
}

/**
 * Tooltip Reading Duration Event Properties
 * Fired when tooltip closes (with 3-second minimum threshold)
 */
export interface TooltipReadingDurationProperties {
  /** Time tooltip was open in seconds */
  duration_seconds: number;
  /** Book ID */
  bookId: number;
  /** Chapter number */
  chapterNumber: number;
  /** Verse number */
  verseNumber: number;
}

/**
 * Chapter Scroll Depth Event Properties
 * Fired on chapter exit with maximum scroll depth reached
 */
export interface ChapterScrollDepthProperties {
  /** Maximum scroll depth as percentage (0-100) */
  maxScrollDepthPercent: number;
  /** Book ID */
  bookId: number;
  /** Chapter number */
  chapterNumber: number;
  /** Bible version (e.g., 'NASB1995') */
  bibleVersion: string;
}

// ============================================================================
// Event Properties Type Map
// ============================================================================

/**
 * Maps each AnalyticsEvent to its corresponding properties type
 * Enables type-safe tracking calls
 */
export interface EventProperties {
  [AnalyticsEvent.CHAPTER_VIEWED]: ChapterViewedProperties;
  [AnalyticsEvent.VIEW_MODE_SWITCHED]: ViewModeSwitchedProperties;
  [AnalyticsEvent.EXPLANATION_TAB_CHANGED]: ExplanationTabChangedProperties;
  [AnalyticsEvent.BOOKMARK_ADDED]: BookmarkAddedProperties;
  [AnalyticsEvent.BOOKMARK_REMOVED]: BookmarkRemovedProperties;
  [AnalyticsEvent.HIGHLIGHT_CREATED]: HighlightCreatedProperties;
  [AnalyticsEvent.HIGHLIGHT_EDITED]: HighlightEditedProperties;
  [AnalyticsEvent.HIGHLIGHT_DELETED]: HighlightDeletedProperties;
  [AnalyticsEvent.NOTE_CREATED]: NoteCreatedProperties;
  [AnalyticsEvent.NOTE_EDITED]: NoteEditedProperties;
  [AnalyticsEvent.NOTE_DELETED]: NoteDeletedProperties;
  [AnalyticsEvent.DICTIONARY_LOOKUP]: DictionaryLookupProperties;
  [AnalyticsEvent.AUTO_HIGHLIGHT_SETTING_CHANGED]: AutoHighlightSettingChangedProperties;
  [AnalyticsEvent.CHAPTER_SHARED]: ChapterSharedProperties;
  [AnalyticsEvent.TOPIC_SHARED]: TopicSharedProperties;
  [AnalyticsEvent.VERSEMATE_TOOLTIP_OPENED]: VersemateTooltipOpenedProperties;
  [AnalyticsEvent.AUTO_HIGHLIGHT_TOOLTIP_VIEWED]: AutoHighlightTooltipViewedProperties;
  [AnalyticsEvent.SIGNUP_COMPLETED]: SignupCompletedProperties;
  [AnalyticsEvent.LOGIN_COMPLETED]: LoginCompletedProperties;
  [AnalyticsEvent.LOGOUT]: LogoutProperties;
  // Time-Based Analytics Events
  [AnalyticsEvent.CHAPTER_READING_DURATION]: ChapterReadingDurationProperties;
  [AnalyticsEvent.VIEW_MODE_DURATION]: ViewModeDurationProperties;
  [AnalyticsEvent.TOOLTIP_READING_DURATION]: TooltipReadingDurationProperties;
  [AnalyticsEvent.CHAPTER_SCROLL_DEPTH]: ChapterScrollDepthProperties;
}

// ============================================================================
// User Properties
// ============================================================================

/**
 * User properties for PostHog identify calls
 * These are person properties that persist across sessions
 */
export interface UserProperties {
  /** User's preferred Bible version (e.g., 'NASB1995', 'KJV') */
  preferred_bible_version?: string;
  /** User's theme preference ('light' | 'dark' | 'system') */
  theme_preference?: string;
  /** User's language setting from device locale */
  language_setting?: string;
  /** User's country from device locale (e.g., 'US', 'BR') */
  country?: string;
  /** Authentication method used ('email' | 'google' | 'apple') */
  account_type?: AuthMethod;
  /** Whether user is registered (false for anonymous, true for logged in) */
  is_registered?: boolean;
  /** Email address (already captured by PostHog identify) */
  email?: string;
  /** First name */
  firstName?: string;
  /** Last name */
  lastName?: string;

  // ============================================================================
  // Time-Based User Properties (Phase 1)
  // ============================================================================

  /**
   * Timestamp of user's last login (ISO 8601 format)
   * Set on login(), loginWithSSO() - NOT on restoreSession()
   * @example '2025-12-15T10:30:00.000Z'
   */
  last_login_at?: string;

  /**
   * Timestamp of when user was first seen (ISO 8601 format)
   * Set using $set_once on first app launch - never overwritten
   * @example '2025-12-01T00:00:00.000Z'
   */
  first_seen_at?: string;

  /**
   * Timestamp of when user was last seen (ISO 8601 format)
   * Updated on every app session
   * @example '2025-12-15T10:30:00.000Z'
   */
  last_seen_at?: string;

  // ============================================================================
  // Streak Tracking User Properties (Phase 3)
  // ============================================================================

  /**
   * Number of consecutive days the user has opened the app
   * Increments when app opened on consecutive day, resets to 1 if gap
   */
  current_streak?: number;

  /**
   * Date of last app activity (YYYY-MM-DD format)
   * Used to calculate streak continuity
   * @example '2025-12-15'
   */
  last_active_date?: string;
}
