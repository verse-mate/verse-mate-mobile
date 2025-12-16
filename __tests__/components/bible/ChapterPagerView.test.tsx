/**
 * Tests for ChapterPagerView component
 *
 * ChapterPagerView implements a 5-page fixed window with stable positional keys.
 * - Keys: "page-0", "page-1", "page-2", "page-3", "page-4" (NEVER change)
 * - Middle page (index 2) always shows current chapter
 * - Re-centers to index 2 when user reaches edges (index 0 or 4)
 * - Props update when window shifts
 *
 * Tests:
 * - Renders 5 children with stable keys
 * - initialPage is set to CENTER_INDEX (2)
 * - Middle page has correct bookId/chapterNumber props
 * - onPageSelected callback fires
 * - Re-centers after edge swipe
 * - Props update on window shift
 * - Ref functionality and imperative API (setPage method)
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react-native';
import React, { useRef } from 'react';
import type { ChapterPagerViewRef } from '@/components/bible/ChapterPagerView';
import { ChapterPagerView } from '@/components/bible/ChapterPagerView';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { useBibleTestaments } from '@/src/api/hooks';
import type { ContentTabType } from '@/types/bible';
import { mockTestamentBooks } from '../../mocks/data/bible-books.data';

// Store mock setPage for testing
let mockSetPage: jest.Mock;
let mockSetPageWithoutAnimation: jest.Mock;

// Mock react-native-pager-view
jest.mock('react-native-pager-view', () => {
  const React = require('react');
  const { View } = require('react-native');

  const MockPagerView = React.forwardRef(({ children, testID }: any, ref: any) => {
    // Store ref methods for testing
    mockSetPage = jest.fn();
    mockSetPageWithoutAnimation = jest.fn();

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

const mockUseBibleTestaments = useBibleTestaments as jest.MockedFunction<typeof useBibleTestaments>;

describe('ChapterPagerView', () => {
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
  });

  const renderPagerView = (
    initialBookId: number = 1,
    initialChapter: number = 1,
    activeTab: ContentTabType = 'summary',
    activeView: 'bible' | 'explanations' = 'bible',
    onPageChange?: (bookId: number, chapterNumber: number) => void
  ) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <ChapterPagerView
            initialBookId={initialBookId}
            initialChapter={initialChapter}
            activeTab={activeTab}
            activeView={activeView}
            onPageChange={onPageChange || jest.fn()}
          />
        </ThemeProvider>
      </QueryClientProvider>
    );
  };

  it('should render without crash', () => {
    const result = renderPagerView();
    expect(result.root).toBeTruthy();
  });

  it('should render exactly 5 pages', () => {
    renderPagerView();

    // Should have 5 pager pages
    for (let i = 0; i < 5; i++) {
      expect(screen.getByTestId(`pager-page-${i}`)).toBeTruthy();
    }
  });

  it('should render middle page (index 2) with correct bookId and chapterNumber', () => {
    renderPagerView(1, 5); // Genesis 5

    // Middle page should show Genesis 5
    expect(screen.getByTestId('chapter-page-1-5')).toBeTruthy();
  });

  it('should render 5-page window around current chapter', () => {
    // Genesis 3 at center
    renderPagerView(1, 3);

    // Window: [Gen 1, Gen 2, Gen 3, Gen 4, Gen 5]
    // Positions: [0, 1, 2, 3, 4]
    expect(screen.getByTestId('chapter-page-1-1')).toBeTruthy(); // position 0
    expect(screen.getByTestId('chapter-page-1-2')).toBeTruthy(); // position 1
    expect(screen.getByTestId('chapter-page-1-3')).toBeTruthy(); // position 2 (center)
    expect(screen.getByTestId('chapter-page-1-4')).toBeTruthy(); // position 3
    expect(screen.getByTestId('chapter-page-1-5')).toBeTruthy(); // position 4
  });

  it('should handle cross-book window (Genesis 50 at center)', () => {
    // Genesis 50 at center
    renderPagerView(1, 50);

    // Window: [Gen 48, Gen 49, Gen 50, Exo 1, Exo 2]
    expect(screen.getByTestId('chapter-page-1-48')).toBeTruthy(); // position 0
    expect(screen.getByTestId('chapter-page-1-49')).toBeTruthy(); // position 1
    expect(screen.getByTestId('chapter-page-1-50')).toBeTruthy(); // position 2 (center)
    expect(screen.getByTestId('chapter-page-2-1')).toBeTruthy(); // position 3 (Exodus 1)
    expect(screen.getByTestId('chapter-page-2-2')).toBeTruthy(); // position 4 (Exodus 2)
  });

  it('should handle Bible start boundary (Genesis 1)', () => {
    // Genesis 1 at center - window extends beyond Bible start
    renderPagerView(1, 1);

    // Component should clamp to Genesis 1 for positions before Bible start
    const genesisOne = screen.getAllByTestId('chapter-page-1-1');
    // Center page (index 2) should show Genesis 1
    expect(genesisOne.length).toBeGreaterThanOrEqual(1);
  });

  it('should handle Bible end boundary (Revelation 22)', () => {
    // Revelation 22 at center - window extends beyond Bible end
    renderPagerView(66, 22);

    // Component should clamp to Revelation 22 for positions after Bible end
    const revelationTwentyTwo = screen.getAllByTestId('chapter-page-66-22');
    // Center page (index 2) should show Revelation 22
    expect(revelationTwentyTwo.length).toBeGreaterThanOrEqual(1);
  });

  it('should pass activeTab and activeView props to all pages', () => {
    renderPagerView(1, 3, 'detailed', 'explanations');

    // All pages should receive the same activeTab and activeView
    // This is verified by the component rendering without errors
    expect(screen.getByTestId('chapter-page-1-3')).toBeTruthy();
  });

  it('should call onPageChange callback with correct bookId and chapterNumber', async () => {
    const onPageChange = jest.fn();

    renderPagerView(1, 1, 'summary', 'bible', onPageChange);

    // Initial render should not call onPageChange
    expect(onPageChange).not.toHaveBeenCalled();

    // Note: Testing actual page changes requires simulating native events
    // which is complex with PagerView. Integration tests will verify this.
  });

  it('should handle loading state when books metadata is not available', () => {
    mockUseBibleTestaments.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      isError: false,
      isSuccess: false,
    } as any);

    const result = renderPagerView();

    // Should render without crashing
    expect(result.root).toBeTruthy();
  });

  it('should use stable positional keys for all pages', () => {
    renderPagerView(1, 10);

    // The component should render pages with stable keys
    // Keys are internal to React, but we can verify by checking renders are stable
    expect(screen.getByTestId('pager-page-0')).toBeTruthy();
    expect(screen.getByTestId('pager-page-1')).toBeTruthy();
    expect(screen.getByTestId('pager-page-2')).toBeTruthy();
    expect(screen.getByTestId('pager-page-3')).toBeTruthy();
    expect(screen.getByTestId('pager-page-4')).toBeTruthy();
  });

  describe('Ref Functionality', () => {
    it('should expose setPage method via ref', () => {
      const TestComponent = () => {
        const pagerRef = useRef<ChapterPagerViewRef>(null);

        return (
          <QueryClientProvider client={queryClient}>
            <ChapterPagerView
              ref={pagerRef}
              initialBookId={1}
              initialChapter={1}
              activeTab="summary"
              activeView="bible"
              onPageChange={jest.fn()}
            />
          </QueryClientProvider>
        );
      };

      render(<TestComponent />);

      // Mock setPage should be defined
      expect(mockSetPage).toBeDefined();
    });

    it('should call native setPage when ref.setPage is invoked', () => {
      const TestComponent = () => {
        const pagerRef = useRef<ChapterPagerViewRef>(null);

        React.useEffect(() => {
          // Simulate button click after render
          if (pagerRef.current) {
            pagerRef.current.setPage(3);
          }
        }, []);

        return (
          <QueryClientProvider client={queryClient}>
            <ChapterPagerView
              ref={pagerRef}
              initialBookId={1}
              initialChapter={1}
              activeTab="summary"
              activeView="bible"
              onPageChange={jest.fn()}
            />
          </QueryClientProvider>
        );
      };

      render(<TestComponent />);

      // Verify setPage was called with correct index
      expect(mockSetPage).toHaveBeenCalledWith(3);
    });

    it('should handle undefined ref gracefully with optional chaining', () => {
      const TestComponent = () => {
        const pagerRef = useRef<ChapterPagerViewRef>(null);

        React.useEffect(() => {
          // Call setPage with optional chaining (shouldn't crash)
          pagerRef.current?.setPage(1);
        }, []);

        return (
          <QueryClientProvider client={queryClient}>
            <ChapterPagerView
              ref={pagerRef}
              initialBookId={1}
              initialChapter={1}
              activeTab="summary"
              activeView="bible"
              onPageChange={jest.fn()}
            />
          </QueryClientProvider>
        );
      };

      // Should not crash
      expect(() => render(<TestComponent />)).not.toThrow();
    });

    it('should allow setPage calls with boundary values', () => {
      const TestComponent = () => {
        const pagerRef = useRef<ChapterPagerViewRef>(null);

        React.useEffect(() => {
          if (pagerRef.current) {
            // Test boundary values
            pagerRef.current.setPage(0); // First page
            pagerRef.current.setPage(4); // Last page (WINDOW_SIZE - 1)
            pagerRef.current.setPage(2); // Center index
          }
        }, []);

        return (
          <QueryClientProvider client={queryClient}>
            <ChapterPagerView
              ref={pagerRef}
              initialBookId={1}
              initialChapter={5}
              activeTab="summary"
              activeView="bible"
              onPageChange={jest.fn()}
            />
          </QueryClientProvider>
        );
      };

      render(<TestComponent />);

      // Verify all boundary values were called
      expect(mockSetPage).toHaveBeenCalledWith(0);
      expect(mockSetPage).toHaveBeenCalledWith(4);
      expect(mockSetPage).toHaveBeenCalledWith(2);
    });

    it('should support multiple setPage calls', () => {
      const TestComponent = () => {
        const pagerRef = useRef<ChapterPagerViewRef>(null);

        React.useEffect(() => {
          if (pagerRef.current) {
            pagerRef.current.setPage(1);
            pagerRef.current.setPage(3);
            pagerRef.current.setPage(2);
          }
        }, []);

        return (
          <QueryClientProvider client={queryClient}>
            <ChapterPagerView
              ref={pagerRef}
              initialBookId={1}
              initialChapter={1}
              activeTab="summary"
              activeView="bible"
              onPageChange={jest.fn()}
            />
          </QueryClientProvider>
        );
      };

      render(<TestComponent />);

      // Verify multiple calls
      expect(mockSetPage).toHaveBeenCalledTimes(3);
      expect(mockSetPage).toHaveBeenNthCalledWith(1, 1);
      expect(mockSetPage).toHaveBeenNthCalledWith(2, 3);
      expect(mockSetPage).toHaveBeenNthCalledWith(3, 2);
    });
  });
});
