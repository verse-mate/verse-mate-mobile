/**
 * Analytics Service
 *
 * Thin wrapper over PostHog SDK providing type-safe analytics tracking.
 * Tracking is disabled when EXPO_PUBLIC_POSTHOG_KEY is not set.
 *
 * @see Spec: agent-os/specs/2025-12-15-posthog-product-analytics/spec.md
 */

import { getPostHogInstance } from './posthog-provider';
import type { AnalyticsEvent, EventProperties, UserProperties } from './types';

/**
 * Type for PostHog-compatible properties
 * PostHog accepts string, number, boolean, null, or nested objects/arrays of these
 */
type PostHogCompatibleValue =
  | string
  | number
  | boolean
  | null
  | PostHogCompatibleValue[]
  | { [key: string]: PostHogCompatibleValue };

type PostHogProperties = Record<string, PostHogCompatibleValue>;

/**
 * Analytics service singleton
 *
 * Provides type-safe methods for tracking events and identifying users.
 * Skips all tracking when PostHog is not initialized (no EXPO_PUBLIC_POSTHOG_KEY).
 */
export const analytics = {
  /**
   * Track an analytics event with typed properties
   *
   * @param event - The event name from AnalyticsEvent enum
   * @param properties - Typed properties for the event
   *
   * @example
   * ```ts
   * analytics.track(AnalyticsEvent.CHAPTER_VIEWED, {
   *   bookId: 1,
   *   chapterNumber: 1,
   *   bibleVersion: 'NASB1995'
   * });
   * ```
   */
  track<E extends AnalyticsEvent>(event: E, properties: EventProperties[E]): void {
    const posthog = getPostHogInstance();
    if (!posthog) {
      // No-op when PostHog is not initialized
      return;
    }

    // Cast properties to PostHog-compatible type
    // Our typed interfaces ensure correct properties at compile time
    posthog.capture(event, properties as unknown as PostHogProperties);
  },

  /**
   * Identify a user and set their properties
   *
   * @param userId - Unique user identifier
   * @param traits - User properties to set
   *
   * @example
   * ```ts
   * analytics.identify('user-123', {
   *   email: 'user@example.com',
   *   account_type: 'email',
   *   is_registered: true
   * });
   * ```
   */
  identify(userId: string, traits: UserProperties): void {
    const posthog = getPostHogInstance();
    if (!posthog) {
      // No-op when PostHog is not initialized
      return;
    }

    // Cast traits to PostHog-compatible type
    posthog.identify(userId, traits as unknown as PostHogProperties);
  },

  /**
   * Reset analytics state (called on logout)
   *
   * Clears the current user identity and creates a new anonymous ID.
   */
  reset(): void {
    const posthog = getPostHogInstance();
    if (!posthog) {
      // No-op when PostHog is not initialized
      return;
    }

    posthog.reset();
  },

  /**
   * Register super properties that are sent with every event
   *
   * Used to set properties like `platform: 'mobile'` that should
   * be included in all events automatically.
   *
   * @param properties - Properties to include with every event
   *
   * @example
   * ```ts
   * analytics.registerSuperProperties({ platform: 'mobile' });
   * ```
   */
  registerSuperProperties(properties: Record<string, string | number | boolean>): void {
    const posthog = getPostHogInstance();
    if (!posthog) {
      // No-op when PostHog is not initialized
      return;
    }

    // PostHog React Native SDK uses register() for super properties
    posthog.register(properties);
  },

  /**
   * Check if analytics is enabled
   *
   * Returns false when PostHog is not initialized (no EXPO_PUBLIC_POSTHOG_KEY).
   */
  isEnabled(): boolean {
    const posthog = getPostHogInstance();
    return posthog !== null;
  },
};
