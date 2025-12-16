/**
 * useChapterReadingDuration Hook Tests
 *
 * Tests for chapter reading duration tracking:
 * - Duration tracking starts on chapter entry
 * - Duration tracking pauses when app backgrounds (AppState listener)
 * - Duration tracking resumes when app foregrounds
 * - CHAPTER_READING_DURATION event fires on chapter exit with correct properties
 * - Duration resets on chapter navigation
 *
 * @see Spec: agent-os/specs/time-based-analytics/spec.md
 * @see Task Group 2: Chapter Reading Duration Tracking
 */

import { act, renderHook } from '@testing-library/react-native';
import { AppState, type AppStateStatus, type NativeEventSubscription } from 'react-native';
import { useChapterReadingDuration } from '@/hooks/bible/use-chapter-reading-duration';
import { AnalyticsEvent, analytics } from '@/lib/analytics';

// Mock analytics
jest.mock('@/lib/analytics', () => ({
  analytics: {
    track: jest.fn(),
  },
  AnalyticsEvent: {
    CHAPTER_READING_DURATION: 'CHAPTER_READING_DURATION',
  },
}));

const mockAnalytics = analytics as jest.Mocked<typeof analytics>;

// Track AppState listener callbacks
let appStateCallback: ((state: AppStateStatus) => void) | null = null;
const mockRemove = jest.fn();

// Spy on AppState.addEventListener
jest
  .spyOn(AppState, 'addEventListener')
  .mockImplementation((event: string, callback: (state: AppStateStatus) => void) => {
    if (event === 'change') {
      appStateCallback = callback;
    }
    return { remove: mockRemove } as NativeEventSubscription;
  });

// Helper to trigger AppState change
const triggerAppStateChange = (state: AppStateStatus) => {
  if (appStateCallback) {
    appStateCallback(state);
  }
};

describe('useChapterReadingDuration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    appStateCallback = null;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // Test 1: Duration tracking starts on mount
  it('should start tracking duration on mount', () => {
    const { unmount } = renderHook(() => useChapterReadingDuration(1, 1, 'NASB1995'));

    // Advance time by 5 seconds
    act(() => {
      jest.advanceTimersByTime(5000);
    });

    // Unmount to trigger event
    unmount();

    // Verify CHAPTER_READING_DURATION event was fired
    expect(mockAnalytics.track).toHaveBeenCalledWith(
      AnalyticsEvent.CHAPTER_READING_DURATION,
      expect.objectContaining({
        bookId: 1,
        chapterNumber: 1,
        bibleVersion: 'NASB1995',
        duration_seconds: expect.any(Number),
      })
    );

    // Duration should be approximately 5 seconds
    const trackCall = mockAnalytics.track.mock.calls[0];
    const properties = trackCall[1] as { duration_seconds: number };
    expect(properties.duration_seconds).toBeGreaterThanOrEqual(5);
  });

  // Test 2: Duration tracking pauses when app backgrounds
  it('should pause tracking when app goes to background', () => {
    const { unmount } = renderHook(() => useChapterReadingDuration(1, 1, 'NASB1995'));

    // Advance time by 3 seconds
    act(() => {
      jest.advanceTimersByTime(3000);
    });

    // Simulate app going to background
    act(() => {
      triggerAppStateChange('background');
    });

    // Advance time by 10 seconds while in background (should not count)
    act(() => {
      jest.advanceTimersByTime(10000);
    });

    // Unmount to trigger event
    unmount();

    // Duration should be approximately 3 seconds (not 13)
    expect(mockAnalytics.track).toHaveBeenCalled();
    const trackCall = mockAnalytics.track.mock.calls[0];
    const properties = trackCall[1] as { duration_seconds: number };
    expect(properties.duration_seconds).toBeLessThan(5);
  });

  // Test 3: Duration tracking resumes when app foregrounds
  it('should resume tracking when app returns from background', () => {
    const { unmount } = renderHook(() => useChapterReadingDuration(1, 1, 'NASB1995'));

    // Advance time by 3 seconds
    act(() => {
      jest.advanceTimersByTime(3000);
    });

    // Go to background
    act(() => {
      triggerAppStateChange('background');
    });

    // Time passes while in background (10 seconds)
    act(() => {
      jest.advanceTimersByTime(10000);
    });

    // Return to foreground
    act(() => {
      triggerAppStateChange('active');
    });

    // Read for another 2 seconds
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    unmount();

    // Duration should be approximately 5 seconds (3 + 2, not including background time)
    expect(mockAnalytics.track).toHaveBeenCalled();
    const trackCall = mockAnalytics.track.mock.calls[0];
    const properties = trackCall[1] as { duration_seconds: number };
    expect(properties.duration_seconds).toBeGreaterThanOrEqual(4);
    expect(properties.duration_seconds).toBeLessThan(8);
  });

  // Test 4: Event fires with correct chapter properties
  it('should fire event with correct bookId, chapterNumber, and bibleVersion', () => {
    const { unmount } = renderHook(() => useChapterReadingDuration(42, 3, 'KJV'));

    act(() => {
      jest.advanceTimersByTime(2000);
    });

    unmount();

    expect(mockAnalytics.track).toHaveBeenCalledWith(
      AnalyticsEvent.CHAPTER_READING_DURATION,
      expect.objectContaining({
        bookId: 42,
        chapterNumber: 3,
        bibleVersion: 'KJV',
      })
    );
  });

  // Test 5: Very short visits should still be tracked (no threshold)
  it('should track even very short visits', () => {
    const { unmount } = renderHook(() => useChapterReadingDuration(1, 1, 'NASB1995'));

    // Advance time by only 500ms
    act(() => {
      jest.advanceTimersByTime(500);
    });

    unmount();

    // Event should still fire
    expect(mockAnalytics.track).toHaveBeenCalled();
  });
});
