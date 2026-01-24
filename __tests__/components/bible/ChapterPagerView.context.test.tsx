/**
 * ChapterPagerView Store Integration Tests
 *
 * Tests that ChapterPagerView correctly integrates with the chapter navigation store:
 * - Tests that handlePageSelected updates store with correct bookId, chapter, and bookName
 * - Tests bookName is extracted from booksMetadata using getChapterFromPageIndex result
 * - Tests store update happens synchronously (no setTimeout for store)
 * - Tests haptic feedback still fires on swipe completion
 * - Tests onPageChange callback still called for URL sync
 *
 * @see stores/chapter-navigation-store.ts
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render } from '@testing-library/react-native';
import type React from 'react';
import { ChapterPagerView } from '@/components/bible/ChapterPagerView';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { useBibleTestaments } from '@/src/api';
import { getSnapshot, initializeState, resetStore } from '@/stores/chapter-navigation-store';
import type { ContentTabType } from '@/types/bible';
import { mockTestamentBooks } from '../../mocks/data/bible-books.data';

// Store mock PagerView event handlers
let capturedOnPageSelected: ((event: { nativeEvent: { position: number } }) => void) | null = null;

// Mock react-native-pager-view to capture event handlers
jest.mock('react-native-pager-view', () => {
  const React = require('react');
  const { View } = require('react-native');

  const MockPagerView = React.forwardRef(({ children, onPageSelected, testID }: any, ref: any) => {
    // Capture the onPageSelected handler for testing
    capturedOnPageSelected = onPageSelected;

    React.useImperativeHandle(ref, () => ({
      setPage: jest.fn(),
      setPageWithoutAnimation: jest.fn(),
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
jest.mock('expo-haptics', () => ({
  __esModule: true,
  impactAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
  },
}));

// Create test wrapper with QueryClient and ThemeProvider
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });
}

interface TestWrapperProps {
  children: React.ReactNode;
}

function TestWrapper({ children }: TestWrapperProps) {
  const queryClient = createTestQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>{children}</ThemeProvider>
    </QueryClientProvider>
  );
}

/**
 * Render ChapterPagerView and initialize store
 */
function renderPagerView(
  initialBookId: number,
  initialChapter: number,
  initialBookName: string,
  activeTab: ContentTabType = 'summary',
  activeView: 'bible' | 'explanations' = 'bible',
  onPageChange: jest.Mock = jest.fn()
) {
  // Initialize store with provided values
  initializeState(initialBookId, initialChapter, initialBookName);

  // Mock useBibleTestaments to return book data
  (useBibleTestaments as jest.Mock).mockReturnValue({
    data: mockTestamentBooks,
    isLoading: false,
    error: null,
  });

  render(
    <TestWrapper>
      <ChapterPagerView
        initialBookId={initialBookId}
        initialChapter={initialChapter}
        activeTab={activeTab}
        activeView={activeView}
        onPageChange={onPageChange}
      />
    </TestWrapper>
  );
}

describe('ChapterPagerView Store Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    capturedOnPageSelected = null;
    resetStore();
  });

  afterEach(() => {
    jest.useRealTimers();
    resetStore();
  });

  it('should update store with correct values when page changes', async () => {
    renderPagerView(1, 3, 'Genesis');

    // Initial store state
    expect(getSnapshot().chapter).toBe(3);
    expect(getSnapshot().bookName).toBe('Genesis');

    // Simulate swipe to position 3 (Genesis 4)
    // Window at Genesis 3 center: [Gen 1, Gen 2, Gen 3, Gen 4, Gen 5]
    await act(async () => {
      capturedOnPageSelected!({ nativeEvent: { position: 3 } });
    });

    // Store should have updated values
    expect(getSnapshot().bookId).toBe(1);
    expect(getSnapshot().chapter).toBe(4);
    expect(getSnapshot().bookName).toBe('Genesis');
  });

  it('should extract bookName from booksMetadata when crossing book boundary', async () => {
    // Start at Genesis 50 (last chapter of Genesis)
    renderPagerView(1, 50, 'Genesis');

    expect(getSnapshot().bookName).toBe('Genesis');

    // Simulate swipe to edge position (position 4) which should be Exodus 2
    // Window at Genesis 50 center: [Gen 48, Gen 49, Gen 50, Exo 1, Exo 2]
    await act(async () => {
      capturedOnPageSelected!({ nativeEvent: { position: 4 } });
    });

    // Store should have Exodus book name extracted from booksMetadata
    expect(getSnapshot().bookId).toBe(2);
    expect(getSnapshot().chapter).toBe(2);
    expect(getSnapshot().bookName).toBe('Exodus');
  });

  it('should update store synchronously without setTimeout delay', async () => {
    renderPagerView(1, 3, 'Genesis');

    const beforeSwipe = Date.now();

    await act(async () => {
      capturedOnPageSelected!({ nativeEvent: { position: 3 } });
    });

    const afterSwipe = Date.now();

    // Store should update within the same synchronous execution
    // (not after 75ms setTimeout delay)
    const timeDiff = afterSwipe - beforeSwipe;
    // Should be nearly instant (less than 50ms in test environment)
    expect(timeDiff).toBeLessThan(50);

    // Verify store actually updated
    expect(getSnapshot().chapter).toBe(4);
  });

  it('should fire haptic feedback on swipe completion', async () => {
    // Get the mocked impactAsync function
    const Haptics = require('expo-haptics');

    renderPagerView(1, 3, 'Genesis');

    expect(Haptics.impactAsync).not.toHaveBeenCalled();

    // Simulate page selection
    await act(async () => {
      capturedOnPageSelected!({ nativeEvent: { position: 3 } });
    });

    // Haptic feedback should have been triggered
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
    expect(Haptics.impactAsync).toHaveBeenCalledWith('medium');
  });

  it('should update store correctly when swiping backward', async () => {
    // Start at Genesis 5
    renderPagerView(1, 5, 'Genesis');

    expect(getSnapshot().chapter).toBe(5);

    // Simulate swipe backward to position 1 (Genesis 4)
    // Window: [Gen 3, Gen 4, Gen 5, Gen 6, Gen 7]
    await act(async () => {
      capturedOnPageSelected!({ nativeEvent: { position: 1 } });
    });

    expect(getSnapshot().bookId).toBe(1);
    expect(getSnapshot().chapter).toBe(4);
    expect(getSnapshot().bookName).toBe('Genesis');
  });

  it('should still call onPageChange callback for URL sync', async () => {
    const onPageChange = jest.fn();

    renderPagerView(1, 3, 'Genesis', 'summary', 'bible', onPageChange);

    // Simulate page selection
    await act(async () => {
      capturedOnPageSelected!({ nativeEvent: { position: 3 } });
    });

    // Fast-forward timers to trigger the delayed onPageChange call (75ms)
    await act(async () => {
      jest.advanceTimersByTime(100);
    });

    // onPageChange should still be called for URL sync
    expect(onPageChange).toHaveBeenCalledWith(1, 4);
  });
});
