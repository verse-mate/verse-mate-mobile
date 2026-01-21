/**
 * ChapterPagerView Context Integration Tests
 *
 * Tests for Task Group 2: ChapterPagerView Context Integration
 * - Tests that handlePageSelected updates context with correct bookId, chapter, and bookName
 * - Tests bookName is extracted from booksMetadata using getChapterFromPageIndex result
 * - Tests context update happens synchronously (no setTimeout for context)
 * - Tests haptic feedback still fires on swipe completion
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render } from '@testing-library/react-native';
import React from 'react';
import { ChapterPagerView } from '@/components/bible/ChapterPagerView';
import {
  type ChapterNavigationContextType,
  ChapterNavigationProvider,
  useChapterNavigation,
} from '@/contexts/ChapterNavigationContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { useBibleTestaments } from '@/src/api';
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

// Mock expo-haptics to verify haptic feedback
const mockImpactAsync = jest.fn();
jest.mock('expo-haptics', () => ({
  impactAsync: (...args: any[]) => mockImpactAsync(...args),
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
  },
}));

const mockUseBibleTestaments = useBibleTestaments as jest.MockedFunction<typeof useBibleTestaments>;

/**
 * Helper component to read and expose context values for testing
 */
function ContextReader({
  onContextUpdate,
}: {
  onContextUpdate: (context: ChapterNavigationContextType) => void;
}) {
  const context = useChapterNavigation();
  React.useEffect(() => {
    onContextUpdate(context);
  }, [context, onContextUpdate]);
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

  const renderPagerViewWithContext = (
    initialBookId: number = 1,
    initialChapter: number = 1,
    initialBookName: string = 'Genesis',
    activeTab: ContentTabType = 'summary',
    activeView: 'bible' | 'explanations' = 'bible',
    onContextUpdate?: (context: ChapterNavigationContextType) => void,
    onJumpToChapter?: (bookId: number, chapter: number) => void,
    onPageChange?: (bookId: number, chapterNumber: number) => void
  ) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <ChapterNavigationProvider
            initialBookId={initialBookId}
            initialChapter={initialChapter}
            initialBookName={initialBookName}
            onJumpToChapter={onJumpToChapter || jest.fn()}
          >
            {onContextUpdate && <ContextReader onContextUpdate={onContextUpdate} />}
            <ChapterPagerView
              initialBookId={initialBookId}
              initialChapter={initialChapter}
              activeTab={activeTab}
              activeView={activeView}
              onPageChange={onPageChange || jest.fn()}
            />
          </ChapterNavigationProvider>
        </ThemeProvider>
      </QueryClientProvider>
    );
  };

  it('should update context with correct bookId, chapter, and bookName when page is selected', async () => {
    // Track context updates - use object to avoid closure issues
    const contextState = { value: null as ChapterNavigationContextType | null };
    const handleContextUpdate = jest.fn((ctx: ChapterNavigationContextType) => {
      contextState.value = ctx;
    });

    // Start at Genesis 3 (center index)
    renderPagerViewWithContext(1, 3, 'Genesis', 'summary', 'bible', handleContextUpdate);

    // Verify initial context
    expect(contextState.value).not.toBeNull();
    expect(contextState.value!.currentBookId).toBe(1);
    expect(contextState.value!.currentChapter).toBe(3);
    expect(contextState.value!.bookName).toBe('Genesis');

    // Simulate swipe to next page (position 3 -> position 4, which is Genesis 4)
    // With center at position 2 and initial chapter 3:
    // position 0 = Gen 1, position 1 = Gen 2, position 2 = Gen 3 (center), position 3 = Gen 4, position 4 = Gen 5
    expect(capturedOnPageSelected).not.toBeNull();

    await act(async () => {
      capturedOnPageSelected!({ nativeEvent: { position: 3 } });
    });

    // Context should be updated synchronously
    expect(contextState.value!.currentBookId).toBe(1);
    expect(contextState.value!.currentChapter).toBe(4);
    expect(contextState.value!.bookName).toBe('Genesis');
  });

  it('should extract bookName from booksMetadata using getChapterFromPageIndex result', async () => {
    const contextState = { value: null as ChapterNavigationContextType | null };
    const handleContextUpdate = jest.fn((ctx: ChapterNavigationContextType) => {
      contextState.value = ctx;
    });

    // Start at Genesis 50 so swiping forward goes to Exodus
    renderPagerViewWithContext(1, 50, 'Genesis', 'summary', 'bible', handleContextUpdate);

    expect(contextState.value!.bookName).toBe('Genesis');

    // Simulate swipe to edge position (position 4) which should be Exodus 2
    // Window at Genesis 50 center: [Gen 48, Gen 49, Gen 50, Exo 1, Exo 2]
    await act(async () => {
      capturedOnPageSelected!({ nativeEvent: { position: 4 } });
    });

    // Context should have Exodus book name extracted from booksMetadata
    expect(contextState.value!.currentBookId).toBe(2);
    expect(contextState.value!.currentChapter).toBe(2);
    expect(contextState.value!.bookName).toBe('Exodus');
  });

  it('should update context synchronously without setTimeout delay', async () => {
    let contextUpdateTime: number | null = null;
    const contextState = {
      value: null as ChapterNavigationContextType | null,
      previousChapter: -1,
    };

    const handleContextUpdate = jest.fn((ctx: ChapterNavigationContextType) => {
      // Only track timing after initial render
      if (contextState.previousChapter > 0 && ctx.currentChapter !== contextState.previousChapter) {
        contextUpdateTime = Date.now();
      }
      contextState.previousChapter = ctx.currentChapter;
      contextState.value = ctx;
    });

    renderPagerViewWithContext(1, 3, 'Genesis', 'summary', 'bible', handleContextUpdate);

    const beforeSwipe = Date.now();

    await act(async () => {
      capturedOnPageSelected!({ nativeEvent: { position: 3 } });
    });

    // Context should update within the same synchronous execution
    // (not after 75ms setTimeout delay)
    // Allow for small timing variations in test environment
    if (contextUpdateTime !== null) {
      const timeDiff = contextUpdateTime - beforeSwipe;
      // Should be nearly instant (less than 50ms)
      expect(timeDiff).toBeLessThan(50);
    }

    // Verify context actually updated
    expect(contextState.value!.currentChapter).toBe(4);
  });

  it('should fire haptic feedback on swipe completion', async () => {
    renderPagerViewWithContext(1, 3, 'Genesis');

    expect(mockImpactAsync).not.toHaveBeenCalled();

    // Simulate page selection
    await act(async () => {
      capturedOnPageSelected!({ nativeEvent: { position: 3 } });
    });

    // Haptic feedback should have been triggered
    expect(mockImpactAsync).toHaveBeenCalledTimes(1);
    expect(mockImpactAsync).toHaveBeenCalledWith('medium');
  });

  it('should update context correctly when swiping backward', async () => {
    const contextState = { value: null as ChapterNavigationContextType | null };
    const handleContextUpdate = jest.fn((ctx: ChapterNavigationContextType) => {
      contextState.value = ctx;
    });

    // Start at Genesis 5
    renderPagerViewWithContext(1, 5, 'Genesis', 'summary', 'bible', handleContextUpdate);

    expect(contextState.value!.currentChapter).toBe(5);

    // Simulate swipe backward to position 1 (Genesis 4)
    // Window: [Gen 3, Gen 4, Gen 5, Gen 6, Gen 7]
    await act(async () => {
      capturedOnPageSelected!({ nativeEvent: { position: 1 } });
    });

    expect(contextState.value!.currentBookId).toBe(1);
    expect(contextState.value!.currentChapter).toBe(4);
    expect(contextState.value!.bookName).toBe('Genesis');
  });

  it('should still call onPageChange callback for URL sync', async () => {
    const onPageChange = jest.fn();

    renderPagerViewWithContext(
      1,
      3,
      'Genesis',
      'summary',
      'bible',
      undefined,
      undefined,
      onPageChange
    );

    // Simulate page selection
    await act(async () => {
      capturedOnPageSelected!({ nativeEvent: { position: 3 } });
    });

    // Wait for the delayed onPageChange call (75ms)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    // onPageChange should still be called for URL sync
    expect(onPageChange).toHaveBeenCalledWith(1, 4);
  });
});
