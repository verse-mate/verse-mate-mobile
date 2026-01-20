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
 * @note ChapterPagerView now requires ChapterNavigationProvider as it uses context
 *       for navigation state instead of onPageChange callback.
 *
 * @see Spec: agent-os/specs/circular-bible-navigation/spec.md
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { ChapterPagerView } from '@/components/bible/ChapterPagerView';
import {
  ChapterNavigationProvider,
  useChapterNavigation,
} from '@/contexts/ChapterNavigationContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { useBibleTestaments } from '@/src/api';
import { getMockBook, mockTestamentBooks } from '../../mocks/data/bible-books.data';

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

// Helper component to capture context values
function ContextCapture({
  onCapture,
}: {
  onCapture: (value: ReturnType<typeof useChapterNavigation>) => void;
}) {
  const contextValue = useChapterNavigation();
  React.useEffect(() => {
    onCapture(contextValue);
  });
  return null;
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

  /**
   * Helper to get book name from mock data
   */
  const getBookName = (bookId: number): string => {
    const book = getMockBook(bookId);
    return book?.name ?? 'Unknown';
  };

  const renderPagerView = (initialBookId: number = 1, initialChapter: number = 1) => {
    const initialBookName = getBookName(initialBookId);
    let capturedContext: ReturnType<typeof useChapterNavigation> | undefined;

    const result = render(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <ChapterNavigationProvider
            initialBookId={initialBookId}
            initialChapter={initialChapter}
            initialBookName={initialBookName}
          >
            <ChapterPagerView
              initialBookId={initialBookId}
              initialChapter={initialChapter}
              activeTab="summary"
              activeView="bible"
            />
            <ContextCapture
              onCapture={(value) => {
                capturedContext = value;
              }}
            />
          </ChapterNavigationProvider>
        </ThemeProvider>
      </QueryClientProvider>
    );

    return { ...result, getContext: () => capturedContext };
  };

  describe('getChapterForPosition circular wrapping', () => {
    it('should render Revelation 22 for positions before Genesis 1 (absoluteIndex -1)', () => {
      // Genesis 1 at center (index 3) means position 0 would be at absoluteIndex -3
      // Position 2 would be at absoluteIndex -1
      renderPagerView(1, 1);

      // At Genesis 1 centered, positions 0, 1, 2 would have negative absolute indices
      // These should now wrap to Revelation 22, 21, 20 (the last chapters)
      // Position 0: absoluteIndex = 0 + (0 - 3) = -3 -> should wrap to 1186 (Rev 20)
      // Position 1: absoluteIndex = 0 + (1 - 3) = -2 -> should wrap to 1187 (Rev 21)
      // Position 2: absoluteIndex = 0 + (2 - 3) = -1 -> should wrap to 1188 (Rev 22)
      expect(screen.getByTestId('chapter-page-66-22')).toBeTruthy();
      expect(screen.getByTestId('chapter-page-66-21')).toBeTruthy();
      expect(screen.getByTestId('chapter-page-66-20')).toBeTruthy();
    });

    it('should render Genesis 1 for positions after Revelation 22 (absoluteIndex 1189)', () => {
      // Revelation 22 at center means positions 4, 5, 6 would have indices > 1188
      renderPagerView(66, 22);

      // At Revelation 22 centered (index 1188), positions 4, 5, 6 would exceed max
      // Position 4: absoluteIndex = 1188 + (4 - 3) = 1189 -> should wrap to 0 (Gen 1)
      // Position 5: absoluteIndex = 1188 + (5 - 3) = 1190 -> should wrap to 1 (Gen 2)
      // Position 6: absoluteIndex = 1188 + (6 - 3) = 1191 -> should wrap to 2 (Gen 3)
      expect(screen.getByTestId('chapter-page-1-1')).toBeTruthy();
      expect(screen.getByTestId('chapter-page-1-2')).toBeTruthy();
      expect(screen.getByTestId('chapter-page-1-3')).toBeTruthy();
    });
  });

  describe('boundary pages not rendered for circular navigation', () => {
    it('should NOT render boundary pages when at Genesis 1', () => {
      renderPagerView(1, 1);

      // Boundary pages should NOT be present - only actual chapter content
      expect(screen.queryByTestId('chapter-page-boundary-0')).toBeNull();
      expect(screen.queryByTestId('chapter-page-boundary-1')).toBeNull();
      expect(screen.queryByTestId('chapter-page-boundary-2')).toBeNull();
      expect(screen.queryByTestId('swipe-boundary-start')).toBeNull();
      expect(screen.queryByTestId('swipe-boundary-end')).toBeNull();
    });

    it('should NOT render boundary pages when at Revelation 22', () => {
      renderPagerView(66, 22);

      // Boundary pages should NOT be present - only actual chapter content
      expect(screen.queryByTestId('chapter-page-boundary-4')).toBeNull();
      expect(screen.queryByTestId('chapter-page-boundary-5')).toBeNull();
      expect(screen.queryByTestId('chapter-page-boundary-6')).toBeNull();
      expect(screen.queryByTestId('swipe-boundary-start')).toBeNull();
      expect(screen.queryByTestId('swipe-boundary-end')).toBeNull();
    });
  });

  describe('normal cross-book navigation still works', () => {
    it('should render correct chapters around Genesis 50 to Exodus 1 boundary', () => {
      renderPagerView(1, 50);

      // Window around Genesis 50 should show:
      // - Genesis 47, 48, 49, 50 (center), Exodus 1, 2, 3
      expect(screen.getByTestId('chapter-page-1-47')).toBeTruthy();
      expect(screen.getByTestId('chapter-page-1-48')).toBeTruthy();
      expect(screen.getByTestId('chapter-page-1-49')).toBeTruthy();
      expect(screen.getByTestId('chapter-page-1-50')).toBeTruthy();
      expect(screen.getByTestId('chapter-page-2-1')).toBeTruthy();
      expect(screen.getByTestId('chapter-page-2-2')).toBeTruthy();
      expect(screen.getByTestId('chapter-page-2-3')).toBeTruthy();
    });
  });

  describe('handlePageSelected circular navigation', () => {
    it('should trigger haptic feedback on circular navigation from Genesis 1 backward', async () => {
      renderPagerView(1, 1);

      // Verify capturedOnPageSelected is set
      expect(capturedOnPageSelected).not.toBeNull();

      // Simulate swiping to position 0 (would be out of bounds without circular nav)
      act(() => {
        capturedOnPageSelected?.({ nativeEvent: { position: 0 } });
      });

      // Haptic feedback should be triggered for all page changes
      await waitFor(() => {
        expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Medium);
      });
    });

    it('should trigger haptic feedback on circular navigation from Revelation 22 forward', async () => {
      renderPagerView(66, 22);

      expect(capturedOnPageSelected).not.toBeNull();

      // Simulate swiping to position 6 (would be out of bounds without circular nav)
      act(() => {
        capturedOnPageSelected?.({ nativeEvent: { position: 6 } });
      });

      // Haptic feedback should be triggered
      await waitFor(() => {
        expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Medium);
      });
    });

    it('should update context with circular wrapped chapter when swiping at boundary', async () => {
      jest.useFakeTimers();
      const { getContext } = renderPagerView(1, 1);

      expect(capturedOnPageSelected).not.toBeNull();

      // Simulate swiping to position 0 (edge position at Genesis 1)
      // This should wrap to Revelation 20 (the chapter at position 0 is -3 from center)
      act(() => {
        capturedOnPageSelected?.({ nativeEvent: { position: 0 } });
      });

      // Haptics should fire immediately
      expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Medium);

      // Advance timers to trigger the context update
      await act(async () => {
        jest.advanceTimersByTime(100);
      });

      // Context should be updated with the wrapped chapter (Revelation 20)
      // absoluteIndex = 0 + (0 - 3) = -3 -> wraps to 1186 which is Revelation 20
      expect(getContext()?.currentBookId).toBe(66);
      expect(getContext()?.currentChapter).toBe(20);

      jest.useRealTimers();
    });
  });

  describe('circular window rendering verification', () => {
    it('should render 7 pages with only chapter content at all positions', () => {
      renderPagerView(1, 1);

      // All 7 pager page containers should exist
      for (let i = 0; i < 7; i++) {
        expect(screen.getByTestId(`pager-page-${i}`)).toBeTruthy();
      }

      // Only chapter pages should be rendered, no boundary indicators
      expect(screen.queryByTestId('swipe-boundary-start')).toBeNull();
      expect(screen.queryByTestId('swipe-boundary-end')).toBeNull();
    });
  });
});
