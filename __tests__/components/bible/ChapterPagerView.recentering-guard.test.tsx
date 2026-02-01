/**
 * Tests for ChapterPagerView recentering guard behavior
 *
 * Tests that the isRecenteringRef guard flag correctly prevents intermediate
 * callbacks from being processed during edge recentering operations.
 *
 * The guard flag is critical for preventing the "backwards swipe glitch"
 * where rapid swiping at edges causes the header to briefly show wrong chapters
 * (e.g., 3 -> 4 -> 5 -> 6 -> 5 -> 6 -> 7 instead of smooth progression).
 *
 * Key behaviors tested:
 * - Guard flag prevents ALL processing in handlePageSelected during recentering
 * - Guard flag is set true BEFORE setPageWithoutAnimation is called
 * - Guard flag is reset to false after requestAnimationFrame callback
 * - Normal (non-edge) page selections are not blocked by guard
 *
 * @see Spec: agent-os/specs/2026-02-01-chapter-header-slide-sync-v2/spec.md
 * @see Task Group 2: Add Recentering Guard Flag to ChapterPagerView
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, waitFor } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { ChapterPagerView } from '@/components/bible/ChapterPagerView';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { useBibleTestaments } from '@/src/api';
import { mockTestamentBooks } from '../../mocks/data/bible-books.data';

// Store mock functions for PagerView - initialized before mock is created
const mockSetPage = jest.fn();
const mockSetPageWithoutAnimation = jest.fn();
let capturedOnPageSelected: ((event: { nativeEvent: { position: number } }) => void) | null = null;

// Mock react-native-pager-view to capture onPageSelected callback
jest.mock('react-native-pager-view', () => {
  const React = require('react');
  const { View } = require('react-native');

  const MockPagerView = React.forwardRef(({ children, testID, onPageSelected }: any, ref: any) => {
    // Capture the onPageSelected callback so we can trigger it in tests
    capturedOnPageSelected = onPageSelected;

    React.useImperativeHandle(ref, () => ({
      setPage: mockSetPage,
      setPageWithoutAnimation: mockSetPageWithoutAnimation,
    }));

    return (
      <View testID={testID || 'pager-view'}>
        {React.Children.map(children, (child: any, index: number) => (
          <View key={`page-${index}`} testID={`pager-page-${index}`}>
            {child}
          </View>
        ))}
      </View>
    );
  });

  MockPagerView.displayName = 'PagerView';

  return {
    __esModule: true,
    default: MockPagerView,
  };
});

// Mock ChapterPage component to track what chapter is rendered
jest.mock('@/components/bible/ChapterPage', () => ({
  ChapterPage: ({ bookId, chapterNumber }: any) => {
    const { Text } = require('react-native');
    return (
      <Text testID={`chapter-page-${bookId}-${chapterNumber}`}>
        Book {bookId} Chapter {chapterNumber}
      </Text>
    );
  },
}));

// Mock useBibleTestaments hook
jest.mock('@/src/api/hooks', () => ({
  useBibleTestaments: jest.fn(),
}));

// Mock Haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
  },
}));

const mockUseBibleTestaments = useBibleTestaments as jest.MockedFunction<typeof useBibleTestaments>;

describe('ChapterPagerView recentering guard behavior', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    // Mock useBibleTestaments to return mock books
    mockUseBibleTestaments.mockReturnValue({
      data: mockTestamentBooks,
      isLoading: false,
      error: null,
      isError: false,
      isSuccess: true,
    } as any);

    // Reset mock functions before each test
    mockSetPage.mockClear();
    mockSetPageWithoutAnimation.mockClear();
    (Haptics.impactAsync as jest.Mock).mockClear();
    capturedOnPageSelected = null;
  });

  const renderPagerView = (
    initialBookId: number = 1,
    initialChapter: number = 1,
    onPageChange?: (bookId: number, chapterNumber: number) => void
  ) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <ChapterPagerView
            initialBookId={initialBookId}
            initialChapter={initialChapter}
            activeTab="summary"
            activeView="bible"
            onPageChange={onPageChange || jest.fn()}
          />
        </ThemeProvider>
      </QueryClientProvider>
    );
  };

  describe('guard flag prevents processing during recentering', () => {
    it('should block intermediate callbacks during edge recentering at position 0', async () => {
      jest.useFakeTimers();
      const onPageChange = jest.fn();
      // Start at Genesis 1 - position 0 is an edge position
      renderPagerView(1, 1, onPageChange);

      expect(capturedOnPageSelected).not.toBeNull();

      // First, swipe to edge position 0 (triggers recentering)
      act(() => {
        capturedOnPageSelected?.({ nativeEvent: { position: 0 } });
      });

      // setPageWithoutAnimation should be called to recenter
      expect(mockSetPageWithoutAnimation).toHaveBeenCalledWith(3); // CENTER_INDEX

      // Haptics fires once for the initial edge swipe
      expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);

      // Clear mocks to track subsequent calls
      mockSetPageWithoutAnimation.mockClear();
      (Haptics.impactAsync as jest.Mock).mockClear();

      // Simulate intermediate callback during recentering (e.g., page 2 callback)
      // This should be BLOCKED by the guard flag
      act(() => {
        capturedOnPageSelected?.({ nativeEvent: { position: 2 } });
      });

      // No additional haptics should fire during recentering (guard is active)
      expect(Haptics.impactAsync).not.toHaveBeenCalled();

      // Complete the requestAnimationFrame to reset the guard
      act(() => {
        jest.runAllTimers();
      });

      jest.useRealTimers();
    });

    it('should block intermediate callbacks during edge recentering at position 6', async () => {
      jest.useFakeTimers();
      const onPageChange = jest.fn();
      // Start at Genesis 1 - position 6 (far right edge) should trigger recentering
      renderPagerView(1, 1, onPageChange);

      expect(capturedOnPageSelected).not.toBeNull();

      // Swipe to edge position 6 (triggers recentering)
      act(() => {
        capturedOnPageSelected?.({ nativeEvent: { position: 6 } });
      });

      // setPageWithoutAnimation should be called to recenter
      expect(mockSetPageWithoutAnimation).toHaveBeenCalledWith(3); // CENTER_INDEX

      // Haptics fires once for the initial edge swipe
      expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);

      // Clear mocks to track subsequent calls
      mockSetPageWithoutAnimation.mockClear();
      (Haptics.impactAsync as jest.Mock).mockClear();

      // Simulate intermediate callback during recentering
      act(() => {
        capturedOnPageSelected?.({ nativeEvent: { position: 4 } });
      });

      // No additional haptics should fire during recentering (guard is active)
      expect(Haptics.impactAsync).not.toHaveBeenCalled();

      // Complete the requestAnimationFrame
      act(() => {
        jest.runAllTimers();
      });

      jest.useRealTimers();
    });

    it('should reset guard flag after requestAnimationFrame callback', async () => {
      jest.useFakeTimers();
      const onPageChange = jest.fn();
      renderPagerView(1, 1, onPageChange);

      expect(capturedOnPageSelected).not.toBeNull();

      // Swipe to edge position 0 (triggers recentering)
      act(() => {
        capturedOnPageSelected?.({ nativeEvent: { position: 0 } });
      });

      // setPageWithoutAnimation called
      expect(mockSetPageWithoutAnimation).toHaveBeenCalledWith(3);
      mockSetPageWithoutAnimation.mockClear();
      (Haptics.impactAsync as jest.Mock).mockClear();

      // Before requestAnimationFrame completes, intermediate callbacks should be blocked
      act(() => {
        capturedOnPageSelected?.({ nativeEvent: { position: 2 } });
      });
      expect(Haptics.impactAsync).not.toHaveBeenCalled();

      // Complete the requestAnimationFrame
      act(() => {
        jest.runAllTimers();
      });

      // Now normal navigation should work again
      // Swipe to position 4 (non-edge)
      act(() => {
        capturedOnPageSelected?.({ nativeEvent: { position: 4 } });
      });

      // Haptics should fire for the new navigation after guard is reset
      expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Medium);

      jest.useRealTimers();
    });
  });

  describe('normal navigation not blocked by guard', () => {
    it('should process non-edge page selections normally (guard is false)', async () => {
      jest.useFakeTimers();
      const onPageChange = jest.fn();
      renderPagerView(1, 10, onPageChange); // Start at Genesis 10, plenty of room

      expect(capturedOnPageSelected).not.toBeNull();

      // Swipe to position 4 (non-edge position)
      act(() => {
        capturedOnPageSelected?.({ nativeEvent: { position: 4 } });
      });

      // Haptics should fire
      expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Medium);

      // setPageWithoutAnimation should NOT be called (not at edge)
      expect(mockSetPageWithoutAnimation).not.toHaveBeenCalled();

      // Advance timers to trigger onPageChange
      act(() => {
        jest.advanceTimersByTime(100);
      });

      // onPageChange should be called with the correct chapter
      await waitFor(() => {
        expect(onPageChange).toHaveBeenCalledWith(1, 11); // Genesis 11 (one position forward)
      });

      jest.useRealTimers();
    });

    it('should handle multiple consecutive non-edge swipes without guard blocking', async () => {
      jest.useFakeTimers();
      const onPageChange = jest.fn();
      renderPagerView(1, 20, onPageChange); // Start at Genesis 20, plenty of room

      expect(capturedOnPageSelected).not.toBeNull();

      // Simulate multiple consecutive swipes at non-edge positions
      const positions = [4, 5, 4, 5];

      for (const pos of positions) {
        act(() => {
          capturedOnPageSelected?.({ nativeEvent: { position: pos } });
        });
        act(() => {
          jest.advanceTimersByTime(100);
        });
      }

      // Haptics should fire for each swipe
      expect(Haptics.impactAsync).toHaveBeenCalledTimes(4);

      // No recentering should have occurred
      expect(mockSetPageWithoutAnimation).not.toHaveBeenCalled();

      jest.useRealTimers();
    });
  });

  describe('rapid swiping backwards glitch prevention', () => {
    it('should prevent multiple haptic feedback during rapid edge recentering', async () => {
      jest.useFakeTimers();
      const onPageChange = jest.fn();
      renderPagerView(1, 1, onPageChange);

      expect(capturedOnPageSelected).not.toBeNull();

      // First swipe to edge position 6
      act(() => {
        capturedOnPageSelected?.({ nativeEvent: { position: 6 } });
      });

      // Should trigger recentering and haptic
      expect(mockSetPageWithoutAnimation).toHaveBeenCalledWith(3);
      expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);

      mockSetPageWithoutAnimation.mockClear();
      (Haptics.impactAsync as jest.Mock).mockClear();

      // Simulate intermediate callbacks that would occur during recentering
      // These all should be blocked by the guard
      act(() => {
        capturedOnPageSelected?.({ nativeEvent: { position: 5 } }); // Intermediate
      });
      act(() => {
        capturedOnPageSelected?.({ nativeEvent: { position: 4 } }); // Intermediate
      });
      act(() => {
        capturedOnPageSelected?.({ nativeEvent: { position: 3 } }); // CENTER - also blocked since guard is active
      });

      // No haptics should fire during these intermediate callbacks
      expect(Haptics.impactAsync).not.toHaveBeenCalled();

      // Complete the recentering
      act(() => {
        jest.runAllTimers();
      });

      jest.useRealTimers();
    });
  });
});
