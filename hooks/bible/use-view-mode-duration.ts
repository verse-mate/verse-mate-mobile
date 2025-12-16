/**
 * useViewModeDuration Hook
 *
 * Tracks time spent in each view mode (Bible vs Explanations).
 * Fires VIEW_MODE_DURATION event when view mode changes or on unmount.
 *
 * @see Spec: agent-os/specs/time-based-analytics/spec.md
 * @see Task Group 3: View Mode Time Tracking
 *
 * @example
 * ```tsx
 * // In chapter screen component
 * useViewModeDuration(activeView, bookId, chapterNumber, bibleVersion);
 * // Event fires automatically when view mode changes or component unmounts
 * ```
 */

import { useEffect, useRef } from 'react';
import { AnalyticsEvent, analytics } from '@/lib/analytics';

/**
 * View mode type
 */
type ViewMode = 'bible' | 'explanations';

/**
 * Hook to track view mode duration
 *
 * @param viewMode - Current view mode ('bible' or 'explanations')
 * @param bookId - The book ID (1-66)
 * @param chapterNumber - The chapter number
 * @param bibleVersion - The Bible version string (e.g., 'NASB1995')
 */
export function useViewModeDuration(
  viewMode: ViewMode,
  bookId: number,
  chapterNumber: number,
  bibleVersion: string
): void {
  // Track when the current view mode session started
  const sessionStartRef = useRef<number>(Date.now());
  // Track the previous view mode to detect changes
  const previousViewModeRef = useRef<ViewMode>(viewMode);
  // Track context info at the time of the session start
  const contextRef = useRef({ bookId, chapterNumber, bibleVersion });

  // Update context ref when props change
  useEffect(() => {
    contextRef.current = { bookId, chapterNumber, bibleVersion };
  }, [bookId, chapterNumber, bibleVersion]);

  // Track view mode changes
  useEffect(() => {
    // If view mode changed, fire event for previous view mode duration
    if (viewMode !== previousViewModeRef.current) {
      const durationMs = Date.now() - sessionStartRef.current;
      const durationSeconds = Math.floor(durationMs / 1000);

      // Fire event for the previous view mode
      analytics.track(AnalyticsEvent.VIEW_MODE_DURATION, {
        viewMode: previousViewModeRef.current,
        duration_seconds: durationSeconds,
        bookId: contextRef.current.bookId,
        chapterNumber: contextRef.current.chapterNumber,
        bibleVersion: contextRef.current.bibleVersion,
      });

      // Reset for new view mode
      previousViewModeRef.current = viewMode;
      sessionStartRef.current = Date.now();
    }
  }, [viewMode]);

  // Fire event on unmount for current view mode
  useEffect(() => {
    return () => {
      const durationMs = Date.now() - sessionStartRef.current;
      const durationSeconds = Math.floor(durationMs / 1000);

      analytics.track(AnalyticsEvent.VIEW_MODE_DURATION, {
        viewMode: previousViewModeRef.current,
        duration_seconds: durationSeconds,
        bookId: contextRef.current.bookId,
        chapterNumber: contextRef.current.chapterNumber,
        bibleVersion: contextRef.current.bibleVersion,
      });
    };
  }, []);
}
