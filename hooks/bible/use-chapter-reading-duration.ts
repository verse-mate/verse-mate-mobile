/**
 * useChapterReadingDuration Hook
 *
 * Tracks time spent reading each Bible chapter with AppState awareness.
 * Pauses tracking when app goes to background, resumes when returning.
 * Fires CHAPTER_READING_DURATION event on unmount (chapter exit).
 *
 * @see Spec: agent-os/specs/time-based-analytics/spec.md
 * @see Task Group 2: Chapter Reading Duration Tracking
 *
 * @example
 * ```tsx
 * // In chapter screen component
 * useChapterReadingDuration(bookId, chapterNumber, bibleVersion);
 * // Event fires automatically when component unmounts
 * ```
 */

import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { AnalyticsEvent, analytics } from '@/lib/analytics';

/**
 * Hook to track chapter reading duration with AppState awareness
 *
 * @param bookId - The book ID (1-66)
 * @param chapterNumber - The chapter number
 * @param bibleVersion - The Bible version string (e.g., 'NASB1995')
 */
export function useChapterReadingDuration(
  bookId: number,
  chapterNumber: number,
  bibleVersion: string
): void {
  // Track accumulated reading time (in milliseconds)
  const accumulatedTimeRef = useRef<number>(0);
  // Track when the current reading session started
  const sessionStartRef = useRef<number>(Date.now());
  // Track whether we're currently in foreground
  const isActiveRef = useRef<boolean>(true);
  // Track the chapter info for the event (capture at mount time)
  const chapterInfoRef = useRef({ bookId, chapterNumber, bibleVersion });

  // Update chapter info ref when props change
  useEffect(() => {
    chapterInfoRef.current = { bookId, chapterNumber, bibleVersion };
  }, [bookId, chapterNumber, bibleVersion]);

  useEffect(() => {
    // Reset tracking when chapter changes
    accumulatedTimeRef.current = 0;
    sessionStartRef.current = Date.now();
    isActiveRef.current = true;

    /**
     * Handle AppState changes (background/foreground)
     */
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'background' && isActiveRef.current) {
        // App going to background - pause tracking
        // Add elapsed time since last session start
        const elapsedSinceStart = Date.now() - sessionStartRef.current;
        accumulatedTimeRef.current += elapsedSinceStart;
        isActiveRef.current = false;
      } else if (nextState === 'active' && !isActiveRef.current) {
        // App returning to foreground - resume tracking
        sessionStartRef.current = Date.now();
        isActiveRef.current = true;
      }
    };

    // Subscribe to AppState changes
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    // Cleanup function - fires event when component unmounts
    return () => {
      subscription.remove();

      // Calculate final duration
      let totalDurationMs = accumulatedTimeRef.current;

      // If we're still active, add the current session time
      if (isActiveRef.current) {
        totalDurationMs += Date.now() - sessionStartRef.current;
      }

      const durationSeconds = Math.floor(totalDurationMs / 1000);

      // Fire the analytics event
      analytics.track(AnalyticsEvent.CHAPTER_READING_DURATION, {
        duration_seconds: durationSeconds,
        bookId: chapterInfoRef.current.bookId,
        chapterNumber: chapterInfoRef.current.chapterNumber,
        bibleVersion: chapterInfoRef.current.bibleVersion,
      });
    };
  }, [bookId, chapterNumber, bibleVersion]);
}
