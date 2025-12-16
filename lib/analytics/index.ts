/**
 * Analytics Module Barrel Export
 *
 * Provides a clean API for importing analytics functionality.
 *
 * @example
 * ```ts
 * import { analytics, AnalyticsEvent } from '@/lib/analytics';
 *
 * analytics.track(AnalyticsEvent.CHAPTER_VIEWED, {
 *   bookId: 1,
 *   chapterNumber: 1,
 *   bibleVersion: 'NASB1995'
 * });
 * ```
 */

// Analytics service
export { analytics } from './analytics';

// PostHog provider
export { AppPostHogProvider, getPostHogInstance } from './posthog-provider';

// Types
export {
  AnalyticsEvent,
  type AutoHighlightSettingChangedProperties,
  type AutoHighlightTooltipViewedProperties,
  type AuthMethod,
  type BookmarkAddedProperties,
  type BookmarkRemovedProperties,
  type ChapterSharedProperties,
  type ChapterViewedProperties,
  type DictionaryLookupProperties,
  type EventProperties,
  type ExplanationTabChangedProperties,
  type HighlightCreatedProperties,
  type HighlightDeletedProperties,
  type HighlightEditedProperties,
  type LoginCompletedProperties,
  type LogoutProperties,
  type NoteCreatedProperties,
  type NoteDeletedProperties,
  type NoteEditedProperties,
  type SignupCompletedProperties,
  type TopicSharedProperties,
  type UserProperties,
  type VersemateTooltipOpenedProperties,
  type ViewModeSwitchedProperties,
} from './types';
