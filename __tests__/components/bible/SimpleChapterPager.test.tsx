/**
 * Tests for SimpleChapterPager Component
 *
 * SimpleChapterPager is the V3 replacement for ChapterPagerView.
 * It uses a 3-page window (previous, current, next) instead of 7 pages.
 *
 * Key differences from ChapterPagerView:
 * - Only 3 pages: [prev, current, next] instead of 7-page window
 * - No recentering logic - uses key prop to force remount on navigation
 * - Boundary pages at Genesis 1 (start) and Revelation 22 (end)
 * - Linear navigation only (no circular wrap in MVP)
 *
 * Tests:
 * - Renders 3 pages (previous, current, next)
 * - Initial page is center (index 1)
 * - Calls onChapterChange with correct values on page change
 * - Renders boundary page when at Genesis 1 (previous page)
 * - Renders boundary page when at Revelation 22 (next page)
 * - Key prop changes when center chapter changes (forces remount)
 *
 * @see Spec: agent-os/specs/2026-02-01-chapter-header-slide-sync-v3/spec.md
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
// Import component after mocks
import { SimpleChapterPager } from '@/components/bible/SimpleChapterPager';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { mockTestamentBooks } from '../../mocks/data/bible-books.data';

// Store mock callbacks for testing
let mockOnPageSelected: ((event: { nativeEvent: { position: number } }) => void) | undefined;
let mockInitialPage: number | undefined;

// Mock react-native-pager-view
jest.mock('react-native-pager-view', () => {
  const React = require('react');
  const { View } = require('react-native');

  const MockPagerView = React.forwardRef(
    ({ children, testID, onPageSelected, initialPage }: any, ref: any) => {
      // Store for testing
      mockOnPageSelected = onPageSelected;
      mockInitialPage = initialPage;

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
    }
  );

  MockPagerView.displayName = 'PagerView';

  return {
    __esModule: true,
    default: MockPagerView,
  };
});

/**
 * Test wrapper with required providers
 */
function TestWrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>{children}</ThemeProvider>
    </QueryClientProvider>
  );
}

/**
 * Mock render function for chapter pages
 */
const mockRenderChapterPage = jest.fn((bookId: number, chapter: number) => {
  const { Text } = require('react-native');
  return <Text testID={`chapter-content-${bookId}-${chapter}`}>Chapter {chapter}</Text>;
});

describe('SimpleChapterPager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOnPageSelected = undefined;
    mockInitialPage = undefined;
  });

  /**
   * Test 1: Renders 3 pages (previous, current, next)
   */
  it('renders 3 pages (previous, current, next)', () => {
    render(
      <TestWrapper>
        <SimpleChapterPager
          bookId={1}
          chapterNumber={5}
          bookName="Genesis"
          booksMetadata={mockTestamentBooks}
          onChapterChange={jest.fn()}
          renderChapterPage={mockRenderChapterPage}
        />
      </TestWrapper>
    );

    // Should render exactly 3 pager pages
    expect(screen.getByTestId('pager-page-0')).toBeTruthy();
    expect(screen.getByTestId('pager-page-1')).toBeTruthy();
    expect(screen.getByTestId('pager-page-2')).toBeTruthy();

    // Should not have a 4th page
    expect(screen.queryByTestId('pager-page-3')).toBeNull();
  });

  /**
   * Test 2: Initial page is center (index 1)
   */
  it('sets initial page to center (index 1)', () => {
    render(
      <TestWrapper>
        <SimpleChapterPager
          bookId={1}
          chapterNumber={5}
          bookName="Genesis"
          booksMetadata={mockTestamentBooks}
          onChapterChange={jest.fn()}
          renderChapterPage={mockRenderChapterPage}
        />
      </TestWrapper>
    );

    // Initial page should be 1 (center)
    expect(mockInitialPage).toBe(1);
  });

  /**
   * Test 3: Calls onChapterChange with correct values on page change
   */
  it('calls onChapterChange with correct values when swiping to next chapter', () => {
    const mockOnChapterChange = jest.fn();

    render(
      <TestWrapper>
        <SimpleChapterPager
          bookId={1}
          chapterNumber={5}
          bookName="Genesis"
          booksMetadata={mockTestamentBooks}
          onChapterChange={mockOnChapterChange}
          renderChapterPage={mockRenderChapterPage}
        />
      </TestWrapper>
    );

    // Simulate swipe to next page (index 2)
    if (mockOnPageSelected) {
      mockOnPageSelected({ nativeEvent: { position: 2 } });
    }

    // Should call onChapterChange with next chapter (Genesis 6)
    expect(mockOnChapterChange).toHaveBeenCalledWith(1, 6);
  });

  /**
   * Test 3b: Calls onChapterChange when swiping to previous chapter
   */
  it('calls onChapterChange with correct values when swiping to previous chapter', () => {
    const mockOnChapterChange = jest.fn();

    render(
      <TestWrapper>
        <SimpleChapterPager
          bookId={1}
          chapterNumber={5}
          bookName="Genesis"
          booksMetadata={mockTestamentBooks}
          onChapterChange={mockOnChapterChange}
          renderChapterPage={mockRenderChapterPage}
        />
      </TestWrapper>
    );

    // Simulate swipe to previous page (index 0)
    if (mockOnPageSelected) {
      mockOnPageSelected({ nativeEvent: { position: 0 } });
    }

    // Should call onChapterChange with previous chapter (Genesis 4)
    expect(mockOnChapterChange).toHaveBeenCalledWith(1, 4);
  });

  /**
   * Test 4: Renders only 2 pages when at Genesis 1 (no previous page)
   *
   * At the start of the Bible, there's no previous chapter, so only
   * [current, next] pages are rendered (no boundary page).
   */
  it('renders only 2 pages when at Genesis 1 (no previous page exists)', () => {
    render(
      <TestWrapper>
        <SimpleChapterPager
          bookId={1}
          chapterNumber={1}
          bookName="Genesis"
          booksMetadata={mockTestamentBooks}
          onChapterChange={jest.fn()}
          renderChapterPage={mockRenderChapterPage}
        />
      </TestWrapper>
    );

    // Page 0 should be current chapter (Genesis 1)
    expect(screen.getByTestId('chapter-content-1-1')).toBeTruthy();

    // Page 1 should be next chapter (Genesis 2)
    expect(screen.getByTestId('chapter-content-1-2')).toBeTruthy();

    // No boundary page should exist
    expect(screen.queryByTestId('boundary-page-start')).toBeNull();

    // Only 2 pages total (pager-page-0 and pager-page-1)
    expect(screen.queryByTestId('pager-page-2')).toBeNull();
  });

  /**
   * Test 5: Renders only 2 pages when at Revelation 22 (no next page)
   *
   * At the end of the Bible, there's no next chapter, so only
   * [prev, current] pages are rendered (no boundary page).
   */
  it('renders only 2 pages when at Revelation 22 (no next page exists)', () => {
    render(
      <TestWrapper>
        <SimpleChapterPager
          bookId={66}
          chapterNumber={22}
          bookName="Revelation"
          booksMetadata={mockTestamentBooks}
          onChapterChange={jest.fn()}
          renderChapterPage={mockRenderChapterPage}
        />
      </TestWrapper>
    );

    // Page 0 should be previous chapter (Revelation 21)
    expect(screen.getByTestId('chapter-content-66-21')).toBeTruthy();

    // Page 1 should be current chapter (Revelation 22)
    expect(screen.getByTestId('chapter-content-66-22')).toBeTruthy();

    // No boundary page should exist
    expect(screen.queryByTestId('boundary-page-end')).toBeNull();

    // Only 2 pages total (pager-page-0 and pager-page-1)
    expect(screen.queryByTestId('pager-page-2')).toBeNull();
  });

  /**
   * Test 6: Does NOT call onChapterChange when swiping to boundary at Genesis 1
   */
  it('does not call onChapterChange when swiping to boundary at Genesis 1', () => {
    const mockOnChapterChange = jest.fn();

    render(
      <TestWrapper>
        <SimpleChapterPager
          bookId={1}
          chapterNumber={1}
          bookName="Genesis"
          booksMetadata={mockTestamentBooks}
          onChapterChange={mockOnChapterChange}
          renderChapterPage={mockRenderChapterPage}
        />
      </TestWrapper>
    );

    // Simulate swipe to boundary page (index 0)
    if (mockOnPageSelected) {
      mockOnPageSelected({ nativeEvent: { position: 0 } });
    }

    // Should NOT call onChapterChange (boundary page)
    expect(mockOnChapterChange).not.toHaveBeenCalled();
  });

  /**
   * Test 7: Does NOT call onChapterChange when swiping to boundary at Revelation 22
   */
  it('does not call onChapterChange when swiping to boundary at Revelation 22', () => {
    const mockOnChapterChange = jest.fn();

    render(
      <TestWrapper>
        <SimpleChapterPager
          bookId={66}
          chapterNumber={22}
          bookName="Revelation"
          booksMetadata={mockTestamentBooks}
          onChapterChange={mockOnChapterChange}
          renderChapterPage={mockRenderChapterPage}
        />
      </TestWrapper>
    );

    // Simulate swipe to boundary page (index 2)
    if (mockOnPageSelected) {
      mockOnPageSelected({ nativeEvent: { position: 2 } });
    }

    // Should NOT call onChapterChange (boundary page)
    expect(mockOnChapterChange).not.toHaveBeenCalled();
  });
});
