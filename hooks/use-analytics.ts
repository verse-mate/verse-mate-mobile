/**
 * useAnalytics Hook
 *
 * Provides component-level access to analytics functionality.
 * Internally uses the analytics service singleton.
 *
 * @see Spec: agent-os/specs/2025-12-15-posthog-product-analytics/spec.md
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { track, identify, isEnabled } = useAnalytics();
 *
 *   const handleAction = () => {
 *     track(AnalyticsEvent.BOOKMARK_ADDED, { bookId: 1, chapterNumber: 1 });
 *   };
 *
 *   return <Button onPress={handleAction}>Add Bookmark</Button>;
 * }
 * ```
 */

import { useMemo } from 'react';
import { analytics } from '@/lib/analytics/analytics';
import type { AnalyticsEvent, EventProperties, UserProperties } from '@/lib/analytics/types';

/**
 * Return type for useAnalytics hook
 */
export interface UseAnalyticsResult {
  /**
   * Track an analytics event with typed properties
   */
  track: <E extends AnalyticsEvent>(event: E, properties: EventProperties[E]) => void;

  /**
   * Identify a user and set their properties
   */
  identify: (userId: string, traits: UserProperties) => void;

  /**
   * Reset analytics state (for logout)
   */
  reset: () => void;

  /**
   * Whether analytics is enabled (false when EXPO_PUBLIC_POSTHOG_KEY is not set)
   */
  isEnabled: boolean;
}

/**
 * Hook to access analytics functionality in components
 *
 * Features:
 * - Type-safe event tracking
 * - User identification
 * - PostHog key detection
 *
 * @returns {UseAnalyticsResult} Analytics methods and state
 */
export function useAnalytics(): UseAnalyticsResult {
  // Memoize the return value to prevent unnecessary re-renders
  // Note: isEnabled is computed from PostHog initialization state
  return useMemo(
    () => ({
      track: analytics.track.bind(analytics),
      identify: analytics.identify.bind(analytics),
      reset: analytics.reset.bind(analytics),
      isEnabled: analytics.isEnabled(),
    }),
    []
  );
}
