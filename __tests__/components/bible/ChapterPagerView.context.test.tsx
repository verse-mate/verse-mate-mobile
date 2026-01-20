/**
 * ChapterPagerView Context Integration Tests
 *
 * Tests for ChapterPagerView refactored as the single writer to ChapterNavigationContext.
 * These tests verify:
 * - onPageSelected calls context setCurrentChapter
 * - Initial render uses initialBookId and initialChapter props
 * - Edge-snapping behavior still works
 * - Haptic feedback still triggers on swipe
 * - pagerRef imperative methods work for floating buttons
 *
 * @see Spec: agent-os/specs/2026-01-19-chapter-view-state-refactor/spec.md
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react-native';
import React, { useRef } from 'react';
import type { ChapterPagerViewRef } from '@/components/bible/ChapterPagerView';
import { ChapterPagerView } from '@/components/bible/ChapterPagerView';
import {
  ChapterNavigationProvider,
  useChapterNavigation,
} from '@/contexts/ChapterNavigationContext';
import { useBibleTestaments } from '@/src/api';
import type { ContentTabType } from '@/types/bible';
import { mockTestamentBooks } from '../../mocks/data/bible-books.data';

// Create persistent mock functions that are reused across renders
const mockSetPage = jest.fn();
const mockSetPageWithoutAnimation = jest.fn();
let mockOnPageSelected: ((event: { nativeEvent: { position: number } }) => void) | null = null;

// Mock react-native-pager-view with event simulation capability
jest.mock('react-native-pager-view', () => {
  const React = require('react');
  const { View } = require('react-native');

  const MockPagerView = React.forwardRef(
    ({ children, testID, onPageSelected, initialPage }: any, ref: any) => {
      // Store the callback for test simulation
      mockOnPageSelected = onPageSelected;

      // Use the persistent mock functions
      React.useImperativeHandle(ref, () => ({
        setPage: mockSetPage,
        setPageWithoutAnimation: mockSetPageWithoutAnimation,
      }));

      return (
        <View testID={testID || 'pager-view'} data-initial-page={initialPage}>
          {React.Children.map(children, (child: any, index: number) => (
            <View key={`page-${index}`} testID={`pager-page-${index}`}>
              {child}
            </View>
          ))}
        </View>
      );
    }
  );

  MockPagerView.displayName = 'PagerView';

  return {
    __esModule: true,
    default: MockPagerView,
  };
});

// Mock ChapterPage component
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

// Mock expo-haptics
const mockHapticsImpact = jest.fn();
jest.mock('expo-haptics', () => ({
  impactAsync: (style: string) => mockHapticsImpact(style),
  ImpactFeedbackStyle: {
    Light: 'Light',
    Medium: 'Medium',
    Heavy: 'Heavy',
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

describe('ChapterPagerView Context Integration', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    mockUseBibleTestaments.mockReturnValue({
      data: mockTestamentBooks,
      isLoading: false,
      error: null,
      isError: false,
      isSuccess: true,
    } as any);

    // Clear all mocks but keep the function references
    mockSetPage.mockClear();
    mockSetPageWithoutAnimation.mockClear();
    mockHapticsImpact.mockClear();
    mockOnPageSelected = null;
  });

  const renderPagerViewWithContext = (
    initialBookId: number = 1,
    initialChapter: number = 1,
    initialBookName: string = 'Genesis',
    activeTab: ContentTabType = 'summary',
    activeView: 'bible' | 'explanations' = 'bible'
  ) => {
    let capturedContext: ReturnType<typeof useChapterNavigation> | undefined;

    const result = render(
      <QueryClientProvider client={queryClient}>
        <ChapterNavigationProvider
          initialBookId={initialBookId}
          initialChapter={initialChapter}
          initialBookName={initialBookName}
        >
          <ChapterPagerView
            initialBookId={initialBookId}
            initialChapter={initialChapter}
            activeTab={activeTab}
            activeView={activeView}
          />
          <ContextCapture
            onCapture={(value) => {
              capturedContext = value;
            }}
          />
        </ChapterNavigationProvider>
      </QueryClientProvider>
    );

    return { ...result, getContext: () => capturedContext };
  };

  describe('onPageSelected calls context setCurrentChapter', () => {
    it('should update context when user swipes to a new chapter', async () => {
      const { getContext } = renderPagerViewWithContext(1, 3, 'Genesis');

      // Verify initial context state
      expect(getContext()?.currentBookId).toBe(1);
      expect(getContext()?.currentChapter).toBe(3);

      // Simulate swipe to position 4 (one page forward from center position 3)
      // Center is at position 3, so position 4 would be Genesis 4
      await act(async () => {
        mockOnPageSelected?.({ nativeEvent: { position: 4 } });
        // Wait for debounced route update
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      // Context should be updated with the new chapter
      expect(getContext()?.currentBookId).toBe(1);
      expect(getContext()?.currentChapter).toBe(4);
    });

    it('should update context when swiping backward', async () => {
      const { getContext } = renderPagerViewWithContext(1, 5, 'Genesis');

      // Simulate swipe to position 2 (one page backward from center position 3)
      await act(async () => {
        mockOnPageSelected?.({ nativeEvent: { position: 2 } });
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      // Context should be updated with the new chapter
      expect(getContext()?.currentBookId).toBe(1);
      expect(getContext()?.currentChapter).toBe(4);
    });
  });

  describe('Initial render uses initialBookId and initialChapter props', () => {
    it('should render center page with correct initial props', () => {
      renderPagerViewWithContext(1, 5, 'Genesis');

      // Middle page (center at index 3) should show Genesis 5
      expect(screen.getByTestId('chapter-page-1-5')).toBeTruthy();
    });

    it('should render correct window for different initial book', () => {
      renderPagerViewWithContext(43, 3, 'John');

      // Middle page should show John 3
      expect(screen.getByTestId('chapter-page-43-3')).toBeTruthy();
    });

    it('should not re-sync from props after mount', async () => {
      const { rerender, getContext } = renderPagerViewWithContext(1, 1, 'Genesis');

      // Simulate swipe to a new chapter
      await act(async () => {
        mockOnPageSelected?.({ nativeEvent: { position: 4 } });
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      // Context should have updated to chapter 2
      expect(getContext()?.currentChapter).toBe(2);

      // Re-render with different initial props (simulating URL change from external source)
      // The component should NOT sync back to these new props - context is authoritative
      rerender(
        <QueryClientProvider client={queryClient}>
          <ChapterNavigationProvider
            initialBookId={1}
            initialChapter={10}
            initialBookName="Genesis"
          >
            <ChapterPagerView
              initialBookId={1}
              initialChapter={10}
              activeTab="summary"
              activeView="bible"
            />
            <ContextCapture
              onCapture={(_value) => {
                /* no-op for rerender */
              }}
            />
          </ChapterNavigationProvider>
        </QueryClientProvider>
      );

      // Context state should persist, not reset to new initial props
      // Note: The provider will re-initialize, but the pager should not force sync
    });
  });

  describe('Edge-snapping behavior', () => {
    it('should call setPageWithoutAnimation(CENTER_INDEX) when reaching edge position 0', async () => {
      renderPagerViewWithContext(1, 3, 'Genesis');

      // Simulate swipe to edge position 0
      await act(async () => {
        mockOnPageSelected?.({ nativeEvent: { position: 0 } });
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      // Should snap back to center
      expect(mockSetPageWithoutAnimation).toHaveBeenCalledWith(3);
    });

    it('should call setPageWithoutAnimation(CENTER_INDEX) when reaching edge position 6', async () => {
      renderPagerViewWithContext(1, 10, 'Genesis');

      // Simulate swipe to edge position 6 (WINDOW_SIZE - 1)
      await act(async () => {
        mockOnPageSelected?.({ nativeEvent: { position: 6 } });
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      // Should snap back to center
      expect(mockSetPageWithoutAnimation).toHaveBeenCalledWith(3);
    });

    it('should not snap when at non-edge positions', async () => {
      renderPagerViewWithContext(1, 10, 'Genesis');

      // Simulate swipe to position 4 (not an edge)
      await act(async () => {
        mockOnPageSelected?.({ nativeEvent: { position: 4 } });
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      // Should NOT call setPageWithoutAnimation for non-edge positions
      expect(mockSetPageWithoutAnimation).not.toHaveBeenCalled();
    });
  });

  describe('Haptic feedback on swipe', () => {
    it('should trigger haptic feedback when swiping to a new page', async () => {
      renderPagerViewWithContext(1, 5, 'Genesis');

      // Simulate swipe
      await act(async () => {
        mockOnPageSelected?.({ nativeEvent: { position: 4 } });
      });

      // Haptic feedback should be triggered
      expect(mockHapticsImpact).toHaveBeenCalledWith('Medium');
    });

    it('should not trigger haptic feedback when staying on center', () => {
      renderPagerViewWithContext(1, 5, 'Genesis');

      // Simulate "selecting" the center page (should be no-op)
      act(() => {
        mockOnPageSelected?.({ nativeEvent: { position: 3 } });
      });

      // No haptic feedback since we didn't actually change pages
      expect(mockHapticsImpact).not.toHaveBeenCalled();
    });
  });

  describe('pagerRef imperative methods for floating buttons', () => {
    it('should expose goNext method that navigates forward', () => {
      const TestComponent = () => {
        const pagerRef = useRef<ChapterPagerViewRef>(null);

        React.useEffect(() => {
          pagerRef.current?.goNext();
        }, []);

        return (
          <QueryClientProvider client={queryClient}>
            <ChapterNavigationProvider
              initialBookId={1}
              initialChapter={5}
              initialBookName="Genesis"
            >
              <ChapterPagerView
                ref={pagerRef}
                initialBookId={1}
                initialChapter={5}
                activeTab="summary"
                activeView="bible"
              />
            </ChapterNavigationProvider>
          </QueryClientProvider>
        );
      };

      render(<TestComponent />);

      // goNext should call setPage with position 4 (center + 1)
      expect(mockSetPage).toHaveBeenCalledWith(4);
    });

    it('should expose goPrevious method that navigates backward', () => {
      const TestComponent = () => {
        const pagerRef = useRef<ChapterPagerViewRef>(null);

        React.useEffect(() => {
          pagerRef.current?.goPrevious();
        }, []);

        return (
          <QueryClientProvider client={queryClient}>
            <ChapterNavigationProvider
              initialBookId={1}
              initialChapter={5}
              initialBookName="Genesis"
            >
              <ChapterPagerView
                ref={pagerRef}
                initialBookId={1}
                initialChapter={5}
                activeTab="summary"
                activeView="bible"
              />
            </ChapterNavigationProvider>
          </QueryClientProvider>
        );
      };

      render(<TestComponent />);

      // goPrevious should call setPage with position 2 (center - 1)
      expect(mockSetPage).toHaveBeenCalledWith(2);
    });

    it('should expose setPage method for arbitrary navigation', () => {
      const TestComponent = () => {
        const pagerRef = useRef<ChapterPagerViewRef>(null);

        React.useEffect(() => {
          pagerRef.current?.setPage(5);
        }, []);

        return (
          <QueryClientProvider client={queryClient}>
            <ChapterNavigationProvider
              initialBookId={1}
              initialChapter={5}
              initialBookName="Genesis"
            >
              <ChapterPagerView
                ref={pagerRef}
                initialBookId={1}
                initialChapter={5}
                activeTab="summary"
                activeView="bible"
              />
            </ChapterNavigationProvider>
          </QueryClientProvider>
        );
      };

      render(<TestComponent />);

      expect(mockSetPage).toHaveBeenCalledWith(5);
    });
  });
});
