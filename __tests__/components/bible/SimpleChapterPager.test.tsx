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
import { createRef, type ReactNode } from 'react';
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

  /**
   * Navigation without remount (TDD)
   *
   * Protects Change C2: Remove pager `key` prop.
   * Currently the parent uses a `key` prop to force remount on navigation.
   * After C2, navigation updates props instead, keeping the component instance.
   */
  describe('navigation without remount (TDD)', () => {
    it('[REGRESSION] pager ref exposes setPage method', () => {
      const ref = createRef<{ setPage: (index: number) => void }>();

      render(
        <TestWrapper>
          <SimpleChapterPager
            ref={ref}
            bookId={1}
            chapterNumber={5}
            bookName="Genesis"
            booksMetadata={mockTestamentBooks}
            onChapterChange={jest.fn()}
            renderChapterPage={mockRenderChapterPage}
          />
        </TestWrapper>
      );

      expect(ref.current).not.toBeNull();
      expect(typeof ref.current?.setPage).toBe('function');
    });

    it('[TDD] pages array updates when chapterNumber prop changes (no remount)', () => {
      const { rerender } = render(
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

      // At chapter 5: pages should be [4, 5, 6]
      expect(screen.getByTestId('chapter-content-1-4')).toBeTruthy();
      expect(screen.getByTestId('chapter-content-1-5')).toBeTruthy();
      expect(screen.getByTestId('chapter-content-1-6')).toBeTruthy();

      // Rerender same instance with chapter 6 (prop change, no remount)
      rerender(
        <TestWrapper>
          <SimpleChapterPager
            bookId={1}
            chapterNumber={6}
            bookName="Genesis"
            booksMetadata={mockTestamentBooks}
            onChapterChange={jest.fn()}
            renderChapterPage={mockRenderChapterPage}
          />
        </TestWrapper>
      );

      // At chapter 6: pages should be [5, 6, 7]
      // This verifies the component updates its page window via props
      // (baseline for removing the parent's key-based remount in C2)
      expect(screen.getByTestId('chapter-content-1-5')).toBeTruthy();
      expect(screen.getByTestId('chapter-content-1-6')).toBeTruthy();
      expect(screen.getByTestId('chapter-content-1-7')).toBeTruthy();
    });

    it('[TDD] onChapterChange fires correctly across multiple sequential navigations', () => {
      const mockOnChapterChange = jest.fn();

      const { rerender } = render(
        <TestWrapper>
          <SimpleChapterPager
            bookId={1}
            chapterNumber={3}
            bookName="Genesis"
            booksMetadata={mockTestamentBooks}
            onChapterChange={mockOnChapterChange}
            renderChapterPage={mockRenderChapterPage}
          />
        </TestWrapper>
      );

      // Simulate swipe to next (position 2 = next chapter)
      if (mockOnPageSelected) {
        mockOnPageSelected({ nativeEvent: { position: 2 } });
      }
      expect(mockOnChapterChange).toHaveBeenCalledWith(1, 4);

      // Rerender with updated chapter (simulating parent state update)
      rerender(
        <TestWrapper>
          <SimpleChapterPager
            bookId={1}
            chapterNumber={4}
            bookName="Genesis"
            booksMetadata={mockTestamentBooks}
            onChapterChange={mockOnChapterChange}
            renderChapterPage={mockRenderChapterPage}
          />
        </TestWrapper>
      );

      // Simulate another swipe to next
      if (mockOnPageSelected) {
        mockOnPageSelected({ nativeEvent: { position: 2 } });
      }

      // Should fire with chapter 5 — verifies the callback references
      // the updated pages array after prop change (not stale closure)
      expect(mockOnChapterChange).toHaveBeenCalledTimes(2);
      expect(mockOnChapterChange).toHaveBeenLastCalledWith(1, 5);
    });

    it('[REGRESSION] 3-page window renders at boundary after rerender', () => {
      const { rerender } = render(
        <TestWrapper>
          <SimpleChapterPager
            bookId={66}
            chapterNumber={21}
            bookName="Revelation"
            booksMetadata={mockTestamentBooks}
            onChapterChange={jest.fn()}
            renderChapterPage={mockRenderChapterPage}
          />
        </TestWrapper>
      );

      // At Revelation 21: should have 3 pages [20, 21, 22]
      expect(screen.getByTestId('chapter-content-66-20')).toBeTruthy();
      expect(screen.getByTestId('chapter-content-66-21')).toBeTruthy();
      expect(screen.getByTestId('chapter-content-66-22')).toBeTruthy();

      // Rerender at Revelation 22 (absolute last chapter of the Bible)
      rerender(
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

      // At chapter 22 (last): only 2 pages [21, 22], no next page
      expect(screen.getByTestId('chapter-content-66-21')).toBeTruthy();
      expect(screen.getByTestId('chapter-content-66-22')).toBeTruthy();
      expect(screen.queryByTestId('pager-page-2')).toBeNull();
    });
  });
});
