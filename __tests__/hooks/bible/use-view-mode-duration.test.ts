/**
 * useViewModeDuration Hook Tests
 *
 * Tests for view mode duration tracking:
 * - Tracks time spent in 'bible' vs 'explanations' view mode
 * - Fires VIEW_MODE_DURATION event when view mode changes
 * - Fires VIEW_MODE_DURATION event on unmount (chapter exit)
 * - Includes correct view mode and bookId/chapterNumber in event
 *
 * @see Spec: agent-os/specs/time-based-analytics/spec.md
 * @see Task Group 3: View Mode Time Tracking
 */

import { act, renderHook } from '@testing-library/react-native';
import { useViewModeDuration } from '@/hooks/bible/use-view-mode-duration';
import { AnalyticsEvent, analytics } from '@/lib/analytics';

// Mock analytics
jest.mock('@/lib/analytics', () => ({
  analytics: {
    track: jest.fn(),
  },
  AnalyticsEvent: {
    VIEW_MODE_DURATION: 'VIEW_MODE_DURATION',
  },
}));

const mockAnalytics = analytics as jest.Mocked<typeof analytics>;

describe('useViewModeDuration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // Test 1: Fires event when view mode changes
  it('should fire VIEW_MODE_DURATION event when view mode changes', () => {
    const { rerender } = renderHook<void, { viewMode: 'bible' | 'explanations' }>(
      ({ viewMode }) => useViewModeDuration(viewMode, 1, 1, 'NASB1995'),
      {
        initialProps: { viewMode: 'bible' },
      }
    );

    // Spend 5 seconds in bible view
    act(() => {
      jest.advanceTimersByTime(5000);
    });

    // Switch to explanations view
    rerender({ viewMode: 'explanations' });

    // Verify VIEW_MODE_DURATION event was fired for bible view
    expect(mockAnalytics.track).toHaveBeenCalledWith(
      AnalyticsEvent.VIEW_MODE_DURATION,
      expect.objectContaining({
        viewMode: 'bible',
        duration_seconds: expect.any(Number),
        bookId: 1,
        chapterNumber: 1,
        bibleVersion: 'NASB1995',
      })
    );
  });

  // Test 2: Fires event on unmount with final view mode duration
  it('should fire VIEW_MODE_DURATION event on unmount', () => {
    const { unmount } = renderHook(() => useViewModeDuration('bible', 1, 1, 'NASB1995'));

    // Spend 3 seconds in bible view
    act(() => {
      jest.advanceTimersByTime(3000);
    });

    // Unmount
    unmount();

    // Verify VIEW_MODE_DURATION event was fired
    expect(mockAnalytics.track).toHaveBeenCalledWith(
      AnalyticsEvent.VIEW_MODE_DURATION,
      expect.objectContaining({
        viewMode: 'bible',
        duration_seconds: expect.any(Number),
      })
    );
  });

  // Test 3: Tracks explanations view mode correctly
  it('should track explanations view mode correctly', () => {
    const { unmount } = renderHook(() => useViewModeDuration('explanations', 42, 3, 'KJV'));

    act(() => {
      jest.advanceTimersByTime(10000);
    });

    unmount();

    expect(mockAnalytics.track).toHaveBeenCalledWith(
      AnalyticsEvent.VIEW_MODE_DURATION,
      expect.objectContaining({
        viewMode: 'explanations',
        bookId: 42,
        chapterNumber: 3,
        bibleVersion: 'KJV',
      })
    );
  });

  // Test 4: Tracks multiple view mode switches
  it('should track multiple view mode switches', () => {
    const { rerender, unmount } = renderHook<void, { viewMode: 'bible' | 'explanations' }>(
      ({ viewMode }) => useViewModeDuration(viewMode, 1, 1, 'NASB1995'),
      {
        initialProps: { viewMode: 'bible' },
      }
    );

    // 5 seconds in bible view
    act(() => {
      jest.advanceTimersByTime(5000);
    });

    // Switch to explanations
    rerender({ viewMode: 'explanations' });

    // 3 seconds in explanations view
    act(() => {
      jest.advanceTimersByTime(3000);
    });

    // Switch back to bible
    rerender({ viewMode: 'bible' });

    // 2 seconds in bible view
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    unmount();

    // Should have fired 3 events total:
    // 1. bible view (5s) when switched to explanations
    // 2. explanations view (3s) when switched back to bible
    // 3. bible view (2s) on unmount
    expect(mockAnalytics.track).toHaveBeenCalledTimes(3);
  });
});
