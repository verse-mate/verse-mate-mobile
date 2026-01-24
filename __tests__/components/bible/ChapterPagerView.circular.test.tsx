/**
 * Tests for ChapterPagerView circular navigation behavior
 *
 * Tests that circular navigation at Bible boundaries works correctly:
 * - getChapterForPosition returns valid chapters for out-of-bounds indices
 * - Swiping backward from Genesis 1 shows Revelation 22 (circular navigation)
 * - Swiping forward from Revelation 22 shows Genesis 1 (circular navigation)
 * - Normal cross-book navigation continues to work
 * - Haptic feedback fires on circular navigation
 *
 * Note: Window size is now 5 pages with CENTER_INDEX = 2
 *
 * @see Spec: agent-os/specs/circular-bible-navigation/spec.md
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { ChapterPagerView } from '@/components/bible/ChapterPagerView';
import { ChapterNavigationProvider } from '@/contexts/ChapterNavigationContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { useBibleTestaments } from '@/src/api';
import { mockTestamentBooks } from '../../mocks/data/bible-books.data';

// Store mock functions for PagerView
let mockSetPage: jest.Mock;
let mockSetPageWithoutAnimation: jest.Mock;
let capturedOnPageSelected: ((event: { nativeEvent: { position: number } }) => void) | null = null;

// Mock react-native-pager-view to capture onPageSelected callback
jest.mock('react-native-pager-view', () => {
  const React = require('react');
  const { View } = require('react-native');

  const MockPagerView = React.forwardRef(({ children, testID, onPageSelected }: any, ref: any) => {
    // Store ref methods for testing
    mockSetPage = jest.fn();
    mockSetPageWithoutAnimation = jest.fn();

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

/**
 * Helper to get book name from mock data
 */
function getBookName(bookId: number): string {
  return mockTestamentBooks.find((b) => b.id === bookId)?.name || 'Unknown';
}

describe('ChapterPagerView circular navigation', () => {
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

    jest.clearAllMocks();
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
          <ChapterNavigationProvider
            initialBookId={initialBookId}
            initialChapter={initialChapter}
            initialBookName={getBookName(initialBookId)}
            onJumpToChapter={jest.fn()}
          >
            <ChapterPagerView
              initialBookId={initialBookId}
              initialChapter={initialChapter}
              activeTab="summary"
              activeView="bible"
              onPageChange={onPageChange || jest.fn()}
            />
          </ChapterNavigationProvider>
        </ThemeProvider>
      </QueryClientProvider>
    );
  };

  describe('getChapterForPosition circular wrapping', () => {
    it('should render Revelation 22 for positions before Genesis 1 (absoluteIndex -1)', () => {
      // Genesis 1 at center (index 2) means position 0 would be at absoluteIndex -2
      // Position 1 would be at absoluteIndex -1
      // With 5-page window and CENTER_INDEX = 2:
      // Position 0: absoluteIndex = 0 + (0 - 2) = -2 -> wraps to Rev 21
      // Position 1: absoluteIndex = 0 + (1 - 2) = -1 -> wraps to Rev 22
      renderPagerView(1, 1);

      // At Genesis 1 centered, positions 0, 1 would have negative absolute indices
      // These should now wrap to Revelation 22, 21 (the last chapters)
      expect(screen.getByTestId('chapter-page-66-22')).toBeTruthy();
      expect(screen.getByTestId('chapter-page-66-21')).toBeTruthy();
    });

    it('should render Genesis 1 for positions after Revelation 22 (absoluteIndex 1189)', () => {
      // Revelation 22 at center means positions 3, 4 would have indices > 1188
      // With 5-page window and CENTER_INDEX = 2:
      // Position 3: absoluteIndex = 1188 + (3 - 2) = 1189 -> wraps to Gen 1
      // Position 4: absoluteIndex = 1188 + (4 - 2) = 1190 -> wraps to Gen 2
      renderPagerView(66, 22);

      expect(screen.getByTestId('chapter-page-1-1')).toBeTruthy();
      expect(screen.getByTestId('chapter-page-1-2')).toBeTruthy();
    });
  });

  describe('boundary pages not rendered for circular navigation', () => {
    it('should NOT render boundary pages when at Genesis 1', () => {
      renderPagerView(1, 1);

      // Boundary pages should NOT be present - only actual chapter content
      expect(screen.queryByTestId('chapter-page-boundary-0')).toBeNull();
      expect(screen.queryByTestId('chapter-page-boundary-1')).toBeNull();
      expect(screen.queryByTestId('swipe-boundary-start')).toBeNull();
      expect(screen.queryByTestId('swipe-boundary-end')).toBeNull();
    });

    it('should NOT render boundary pages when at Revelation 22', () => {
      renderPagerView(66, 22);

      // Boundary pages should NOT be present - only actual chapter content
      expect(screen.queryByTestId('chapter-page-boundary-3')).toBeNull();
      expect(screen.queryByTestId('chapter-page-boundary-4')).toBeNull();
      expect(screen.queryByTestId('swipe-boundary-start')).toBeNull();
      expect(screen.queryByTestId('swipe-boundary-end')).toBeNull();
    });
  });

  describe('normal cross-book navigation still works', () => {
    it('should render correct chapters around Genesis 50 to Exodus 1 boundary', () => {
      renderPagerView(1, 50);

      // Window around Genesis 50 with 5-page window should show:
      // [Gen 48, Gen 49, Gen 50 (center), Exo 1, Exo 2]
      expect(screen.getByTestId('chapter-page-1-48')).toBeTruthy();
      expect(screen.getByTestId('chapter-page-1-49')).toBeTruthy();
      expect(screen.getByTestId('chapter-page-1-50')).toBeTruthy();
      expect(screen.getByTestId('chapter-page-2-1')).toBeTruthy();
      expect(screen.getByTestId('chapter-page-2-2')).toBeTruthy();
    });
  });

  describe('handlePageSelected circular navigation', () => {
    it('should trigger haptic feedback on circular navigation from Genesis 1 backward', async () => {
      const onPageChange = jest.fn();
      renderPagerView(1, 1, onPageChange);

      // Verify capturedOnPageSelected is set
      expect(capturedOnPageSelected).not.toBeNull();

      // Simulate swiping to position 0 (edge position, would be out of bounds without circular nav)
      act(() => {
        capturedOnPageSelected?.({ nativeEvent: { position: 0 } });
      });

      // Haptic feedback should be triggered for all page changes
      await waitFor(() => {
        expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Medium);
      });
    });

    it('should trigger haptic feedback on circular navigation from Revelation 22 forward', async () => {
      const onPageChange = jest.fn();
      renderPagerView(66, 22, onPageChange);

      expect(capturedOnPageSelected).not.toBeNull();

      // Simulate swiping to position 4 (edge position for 5-page window)
      act(() => {
        capturedOnPageSelected?.({ nativeEvent: { position: 4 } });
      });

      // Haptic feedback should be triggered
      await waitFor(() => {
        expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Medium);
      });
    });

    it('should call onPageChange with circular wrapped chapter when swiping at boundary', async () => {
      jest.useFakeTimers();
      const onPageChange = jest.fn();
      renderPagerView(1, 1, onPageChange);

      expect(capturedOnPageSelected).not.toBeNull();

      // Simulate swiping to position 0 (edge position at Genesis 1)
      // With 5-page window and CENTER_INDEX = 2:
      // absoluteIndex = 0 + (0 - 2) = -2 -> wraps to Rev 21
      act(() => {
        capturedOnPageSelected?.({ nativeEvent: { position: 0 } });
      });

      // Haptics should fire immediately
      expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Medium);

      // Advance timers to trigger the route update
      act(() => {
        jest.advanceTimersByTime(100);
      });

      // onPageChange should be called with the wrapped chapter
      // Position 0 is -2 from center, so it wraps to Rev 21
      await waitFor(() => {
        expect(onPageChange).toHaveBeenCalledWith(66, 21);
      });

      jest.useRealTimers();
    });
  });

  describe('circular window rendering verification', () => {
    it('should render 5 pages with only chapter content at all positions', () => {
      renderPagerView(1, 1);

      // All 5 pager page containers should exist (reduced from 7)
      for (let i = 0; i < 5; i++) {
        expect(screen.getByTestId(`pager-page-${i}`)).toBeTruthy();
      }

      // Only chapter pages should be rendered, no boundary indicators
      expect(screen.queryByTestId('swipe-boundary-start')).toBeNull();
      expect(screen.queryByTestId('swipe-boundary-end')).toBeNull();
    });
  });
});
