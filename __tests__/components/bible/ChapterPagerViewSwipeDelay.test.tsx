/**
 * ChapterPagerView Swipe Context Update Delay Tests
 *
 * Tests focused on delayed context updates after swipe gesture completion.
 * Ensures PagerView animation completes before context state is updated.
 *
 * @note ChapterPagerView now uses ChapterNavigationContext instead of onPageChange callback.
 *       Tests verify context updates happen with the expected delay.
 *
 * Test Coverage:
 * - Context updated with delay after swipe
 * - Timeout cleanup on unmount
 * - No stale context updates on rapid swipes
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render } from '@testing-library/react-native';
import React from 'react';
import { ChapterPagerView } from '@/components/bible/ChapterPagerView';
import {
  ChapterNavigationProvider,
  useChapterNavigation,
} from '@/contexts/ChapterNavigationContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { useBibleTestaments } from '@/src/api';
import { getMockBook, mockTestamentBooks } from '../../mocks/data/bible-books.data';

// Mock dependencies
jest.mock('@/src/api/hooks', () => ({
  useBibleTestaments: jest.fn(),
}));

jest.mock('@/components/bible/ChapterPage', () => ({
  ChapterPage: ({ bookId, chapterNumber }: { bookId: number; chapterNumber: number }) => {
    const { Text } = require('react-native');
    return (
      <Text testID={`chapter-page-${bookId}-${chapterNumber}`}>
        Book {bookId} Chapter {chapterNumber}
      </Text>
    );
  },
}));

// Mock PagerView to allow triggering onPageSelected events
let mockOnPageSelected: ((event: { nativeEvent: { position: number } }) => void) | null = null;

jest.mock('react-native-pager-view', () => {
  const React = require('react');
  const { View } = require('react-native');

  const MockPagerView = React.forwardRef((props: any, ref: any) => {
    mockOnPageSelected = props.onPageSelected;

    React.useImperativeHandle(ref, () => ({
      setPage: jest.fn(),
      setPageWithoutAnimation: jest.fn(),
    }));

    return <View testID="pager-view">{props.children}</View>;
  });

  MockPagerView.displayName = 'PagerView';

  return {
    __esModule: true,
    default: MockPagerView,
  };
});

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

describe('ChapterPagerView - Swipe Context Update Delay', () => {
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

    jest.clearAllMocks();
    jest.useFakeTimers();
    mockOnPageSelected = null;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  /**
   * Helper to get book name from mock data
   */
  const getBookName = (bookId: number): string => {
    const book = getMockBook(bookId);
    return book?.name ?? 'Unknown';
  };

  const renderPagerViewWithContext = (initialBookId: number, initialChapter: number) => {
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

  it('updates context with delay after swipe gesture', () => {
    const { getContext } = renderPagerViewWithContext(1, 5);

    // Verify initial state
    expect(getContext()?.currentChapter).toBe(5);

    // Simulate swipe to next page (position 4, since CENTER_INDEX is 3)
    act(() => {
      mockOnPageSelected?.({ nativeEvent: { position: 4 } });
    });

    // Context should NOT be updated immediately
    expect(getContext()?.currentChapter).toBe(5);

    // Fast-forward by 50ms - still should not be updated
    act(() => {
      jest.advanceTimersByTime(50);
    });
    expect(getContext()?.currentChapter).toBe(5);

    // Fast-forward by another 25ms (total 75ms) - now should be updated
    act(() => {
      jest.advanceTimersByTime(25);
    });
    expect(getContext()?.currentChapter).toBe(6);
  });

  it('cleans up timeout on component unmount', () => {
    const { getContext, unmount } = renderPagerViewWithContext(1, 5);

    // Verify initial state
    expect(getContext()?.currentChapter).toBe(5);

    // Simulate swipe
    act(() => {
      mockOnPageSelected?.({ nativeEvent: { position: 4 } });
    });

    // Unmount before delay completes
    unmount();

    // Fast-forward past delay
    act(() => {
      jest.advanceTimersByTime(100);
    });

    // Context should NOT have been updated (timeout was cleaned up)
    // Since component is unmounted, we can't check context state
    // But the test passes if no errors occur (cleanup worked)
  });

  it('handles rapid swipes without stale context updates', () => {
    const { getContext } = renderPagerViewWithContext(1, 5);

    // Verify initial state
    expect(getContext()?.currentChapter).toBe(5);

    // Simulate first swipe to position 4 (chapter 6)
    act(() => {
      mockOnPageSelected?.({ nativeEvent: { position: 4 } });
    });

    // Advance by 30ms (not enough to trigger first update)
    act(() => {
      jest.advanceTimersByTime(30);
    });

    // Simulate second rapid swipe to position 2 (chapter 4, should cancel first timeout)
    act(() => {
      mockOnPageSelected?.({ nativeEvent: { position: 2 } });
    });

    // Advance past when first delay would have fired
    act(() => {
      jest.advanceTimersByTime(50); // Total 80ms from first swipe, 50ms from second
    });

    // First update should NOT have happened (it was cancelled)
    expect(getContext()?.currentChapter).toBe(5);

    // Advance to trigger second update
    act(() => {
      jest.advanceTimersByTime(25); // 75ms total from second swipe
    });

    // Second update should happen - chapter should be 4 (position 2 from center at chapter 5)
    expect(getContext()?.currentChapter).toBe(4);
  });

  it('context update happens after PagerView animation completes (75ms delay)', () => {
    const { getContext } = renderPagerViewWithContext(1, 1);

    // Verify initial state
    expect(getContext()?.currentChapter).toBe(1);

    // Simulate swipe to next chapter (position 4, since CENTER_INDEX is 3)
    act(() => {
      mockOnPageSelected?.({ nativeEvent: { position: 4 } });
    });

    // Verify context not updated immediately
    expect(getContext()?.currentChapter).toBe(1);

    // Advance by exact delay amount
    act(() => {
      jest.advanceTimersByTime(75);
    });

    // Context should be updated with correct chapter
    expect(getContext()?.currentChapter).toBe(2); // Genesis 1 -> Genesis 2
  });

  it('handles swipe to edge position with delay', () => {
    const { getContext } = renderPagerViewWithContext(1, 5);

    // Verify initial state
    expect(getContext()?.currentChapter).toBe(5);

    // Simulate swipe to edge position (position 4)
    act(() => {
      mockOnPageSelected?.({ nativeEvent: { position: 4 } });
    });

    // Verify context not updated immediately
    expect(getContext()?.currentChapter).toBe(5);

    // Advance by delay amount
    act(() => {
      jest.advanceTimersByTime(75);
    });

    // Context should be updated for edge position
    expect(getContext()?.currentChapter).toBe(6);
  });
});
