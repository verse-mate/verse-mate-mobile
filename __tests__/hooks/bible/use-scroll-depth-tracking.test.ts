/**
 * useScrollDepthTracking Hook Tests
 *
 * Tests for scroll depth tracking:
 * - Tracks maximum scroll depth percentage during chapter reading
 * - Fires CHAPTER_SCROLL_DEPTH event on unmount
 * - Updates max depth as user scrolls
 * - Includes correct chapter reference in event
 *
 * @see Spec: agent-os/specs/time-based-analytics/spec.md
 * @see Task Group 6: Scroll Depth Tracking
 */

import { act, renderHook } from '@testing-library/react-native';
import { useScrollDepthTracking } from '@/hooks/bible/use-scroll-depth-tracking';
import { AnalyticsEvent, analytics } from '@/lib/analytics';

// Mock analytics
jest.mock('@/lib/analytics', () => ({
  analytics: {
    track: jest.fn(),
  },
  AnalyticsEvent: {
    CHAPTER_SCROLL_DEPTH: 'CHAPTER_SCROLL_DEPTH',
  },
}));

const mockAnalytics = analytics as jest.Mocked<typeof analytics>;

describe('useScrollDepthTracking', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Test 1: Fires event on unmount with max scroll depth
  it('should fire CHAPTER_SCROLL_DEPTH event on unmount', () => {
    const { result, unmount } = renderHook(() => useScrollDepthTracking(1, 1, 'NASB1995'));

    // Simulate scroll to 50%
    act(() => {
      result.current.handleScroll(50);
    });

    unmount();

    expect(mockAnalytics.track).toHaveBeenCalledWith(
      AnalyticsEvent.CHAPTER_SCROLL_DEPTH,
      expect.objectContaining({
        maxScrollDepthPercent: 50,
        bookId: 1,
        chapterNumber: 1,
        bibleVersion: 'NASB1995',
      })
    );
  });

  // Test 2: Tracks maximum scroll depth (not current)
  it('should track maximum scroll depth reached', () => {
    const { result, unmount } = renderHook(() => useScrollDepthTracking(1, 1, 'NASB1995'));

    // Scroll to 75%
    act(() => {
      result.current.handleScroll(75);
    });

    // Scroll back to 25%
    act(() => {
      result.current.handleScroll(25);
    });

    unmount();

    // Max should still be 75%
    expect(mockAnalytics.track).toHaveBeenCalledWith(
      AnalyticsEvent.CHAPTER_SCROLL_DEPTH,
      expect.objectContaining({
        maxScrollDepthPercent: 75,
      })
    );
  });

  // Test 3: Updates max depth as user scrolls further
  it('should update max depth when user scrolls further', () => {
    const { result, unmount } = renderHook(() => useScrollDepthTracking(1, 1, 'NASB1995'));

    // Scroll to 25%
    act(() => {
      result.current.handleScroll(25);
    });

    // Scroll to 50%
    act(() => {
      result.current.handleScroll(50);
    });

    // Scroll to 100%
    act(() => {
      result.current.handleScroll(100);
    });

    unmount();

    expect(mockAnalytics.track).toHaveBeenCalledWith(
      AnalyticsEvent.CHAPTER_SCROLL_DEPTH,
      expect.objectContaining({
        maxScrollDepthPercent: 100,
      })
    );
  });

  // Test 4: Includes correct chapter reference
  it('should include correct bookId, chapterNumber, and bibleVersion', () => {
    const { result, unmount } = renderHook(() => useScrollDepthTracking(42, 5, 'KJV'));

    act(() => {
      result.current.handleScroll(80);
    });

    unmount();

    expect(mockAnalytics.track).toHaveBeenCalledWith(
      AnalyticsEvent.CHAPTER_SCROLL_DEPTH,
      expect.objectContaining({
        bookId: 42,
        chapterNumber: 5,
        bibleVersion: 'KJV',
      })
    );
  });
});
