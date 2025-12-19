/**
 * ChapterPagerView Swipe Route Update Delay Tests
 *
 * Tests focused on delayed route updates after swipe gesture completion.
 * Ensures PagerView animation completes before router.replace() is called.
 *
 * Test Coverage:
 * - onPageChange called with delay after swipe
 * - Timeout cleanup on unmount
 * - No stale route updates on rapid swipes
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';
import { ChapterPagerView } from '@/components/bible/ChapterPagerView';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { useBibleTestaments } from '@/src/api';
import { mockTestamentBooks } from '../../mocks/data/bible-books.data';

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

describe('ChapterPagerView - Swipe Route Update Delay', () => {
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
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('calls onPageChange with delay after swipe gesture', () => {
    const onPageChange = jest.fn();

    render(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <ChapterPagerView
            initialBookId={1}
            initialChapter={5}
            activeTab="summary"
            activeView="bible"
            onPageChange={onPageChange}
          />
        </ThemeProvider>
      </QueryClientProvider>
    );

    // Simulate swipe to next page (position 4, since CENTER_INDEX is 3)
    mockOnPageSelected?.({ nativeEvent: { position: 4 } });

    // onPageChange should NOT be called immediately
    expect(onPageChange).not.toHaveBeenCalled();

    // Fast-forward by 50ms - still should not be called
    jest.advanceTimersByTime(50);
    expect(onPageChange).not.toHaveBeenCalled();

    // Fast-forward by another 25ms (total 75ms) - now should be called
    jest.advanceTimersByTime(25);
    expect(onPageChange).toHaveBeenCalledTimes(1);
  });

  it('cleans up timeout on component unmount', () => {
    const onPageChange = jest.fn();

    const { unmount } = render(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <ChapterPagerView
            initialBookId={1}
            initialChapter={5}
            activeTab="summary"
            activeView="bible"
            onPageChange={onPageChange}
          />
        </ThemeProvider>
      </QueryClientProvider>
    );

    // Simulate swipe
    mockOnPageSelected?.({ nativeEvent: { position: 4 } });

    // Unmount before delay completes
    unmount();

    // Fast-forward past delay
    jest.advanceTimersByTime(100);

    // onPageChange should NOT be called (timeout was cleaned up)
    expect(onPageChange).not.toHaveBeenCalled();
  });
  it('handles rapid swipes without stale route updates', () => {
    const onPageChange = jest.fn();

    render(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <ChapterPagerView
            initialBookId={1}
            initialChapter={5}
            activeTab="summary"
            activeView="bible"
            onPageChange={onPageChange}
          />
        </ThemeProvider>
      </QueryClientProvider>
    );

    // Simulate first swipe to position 4
    mockOnPageSelected?.({ nativeEvent: { position: 4 } });

    // Advance by 30ms (not enough to trigger first callback)
    jest.advanceTimersByTime(30);

    // Simulate second rapid swipe to position 2 (should cancel first timeout)
    mockOnPageSelected?.({ nativeEvent: { position: 2 } });

    // Advance past when first delay would have fired
    jest.advanceTimersByTime(50); // Total 80ms from first swipe, 50ms from second

    // First callback should NOT have been called (it was cancelled)
    expect(onPageChange).not.toHaveBeenCalled();

    // Advance to trigger second callback
    jest.advanceTimersByTime(25); // 75ms total from second swipe

    // Second callback should be called (only this one)
    expect(onPageChange).toHaveBeenCalledTimes(1);
  });

  it('route update happens after PagerView animation completes (75ms delay)', () => {
    const onPageChange = jest.fn();

    render(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <ChapterPagerView
            initialBookId={1}
            initialChapter={1}
            activeTab="summary"
            activeView="bible"
            onPageChange={onPageChange}
          />
        </ThemeProvider>
      </QueryClientProvider>
    );

    // Simulate swipe to next chapter (position 4, since CENTER_INDEX is 3)
    mockOnPageSelected?.({ nativeEvent: { position: 4 } });

    // Verify callback not called immediately
    expect(onPageChange).not.toHaveBeenCalled();

    // Advance by exact delay amount
    jest.advanceTimersByTime(75);

    // Callback should be called with correct chapter
    expect(onPageChange).toHaveBeenCalledWith(1, 2); // Genesis 1 -> Genesis 2
  });

  it('handles swipe to edge position with delay', () => {
    const onPageChange = jest.fn();

    render(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <ChapterPagerView
            initialBookId={1}
            initialChapter={5}
            activeTab="summary"
            activeView="bible"
            onPageChange={onPageChange}
          />
        </ThemeProvider>
      </QueryClientProvider>
    );

    // Simulate swipe to edge position (position 4)
    mockOnPageSelected?.({ nativeEvent: { position: 4 } });

    // Verify callback not called immediately
    expect(onPageChange).not.toHaveBeenCalled();

    // Advance by delay amount
    jest.advanceTimersByTime(75);

    // Callback should be called for edge position
    expect(onPageChange).toHaveBeenCalledTimes(1);
  });
});
