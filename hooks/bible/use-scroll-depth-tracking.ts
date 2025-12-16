/**
 * useScrollDepthTracking Hook
 *
 * Tracks maximum scroll depth reached during chapter reading.
 * Fires CHAPTER_SCROLL_DEPTH event on unmount with the max scroll percentage.
 *
 * @see Spec: agent-os/specs/time-based-analytics/spec.md
 * @see Task Group 6: Scroll Depth Tracking
 *
 * @example
 * ```tsx
 * const { handleScroll } = useScrollDepthTracking(bookId, chapterNumber, bibleVersion);
 *
 * // In ScrollView or FlatList onScroll handler:
 * const scrollPercent = (contentOffset.y / (contentSize.height - layoutHeight)) * 100;
 * handleScroll(scrollPercent);
 * ```
 */

import { useCallback, useEffect, useRef } from 'react';
import { AnalyticsEvent, analytics } from '@/lib/analytics';

/**
 * Return type for the useScrollDepthTracking hook
 */
interface ScrollDepthTrackingResult {
  /**
   * Call this function with the current scroll percentage (0-100)
   * when the user scrolls. The hook will track the maximum depth reached.
   */
  handleScroll: (scrollPercent: number) => void;
}

/**
 * Hook to track scroll depth during chapter reading
 *
 * @param bookId - The book ID (1-66)
 * @param chapterNumber - The chapter number
 * @param bibleVersion - The Bible version string (e.g., 'NASB1995')
 * @returns Object with handleScroll function to call on scroll events
 */
export function useScrollDepthTracking(
  bookId: number,
  chapterNumber: number,
  bibleVersion: string
): ScrollDepthTrackingResult {
  // Track maximum scroll depth reached (percentage 0-100)
  const maxScrollDepthRef = useRef<number>(0);
  // Track context info at the time of the session start
  const contextRef = useRef({ bookId, chapterNumber, bibleVersion });

  // Update context ref when props change
  useEffect(() => {
    contextRef.current = { bookId, chapterNumber, bibleVersion };
  }, [bookId, chapterNumber, bibleVersion]);

  // Reset max depth when chapter changes
  useEffect(() => {
    maxScrollDepthRef.current = 0;
  }, [bookId, chapterNumber]);

  /**
   * Handle scroll event - update max depth if current scroll is greater
   */
  const handleScroll = useCallback((scrollPercent: number) => {
    // Clamp scroll percent to 0-100
    const clampedPercent = Math.max(0, Math.min(100, scrollPercent));

    // Update max depth if current is greater
    if (clampedPercent > maxScrollDepthRef.current) {
      maxScrollDepthRef.current = clampedPercent;
    }
  }, []);

  // Fire event on unmount with max scroll depth
  useEffect(() => {
    return () => {
      analytics.track(AnalyticsEvent.CHAPTER_SCROLL_DEPTH, {
        maxScrollDepthPercent: Math.round(maxScrollDepthRef.current),
        bookId: contextRef.current.bookId,
        chapterNumber: contextRef.current.chapterNumber,
        bibleVersion: contextRef.current.bibleVersion,
      });
    };
  }, []);

  return { handleScroll };
}
