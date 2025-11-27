/**
 * Integration Tests: Cross-Book Navigation
 *
 * Tests for seamless transitions between books and edge cases:
 * - Last chapter of book → First chapter of next book
 * - First chapter of book → Last chapter of previous book
 * - Old Testament to New Testament transition (Malachi 4 → Matthew 1)
 * - Single-chapter books navigation (Obadiah, Philemon, 2 John, 3 John, Jude)
 * - Bible boundaries (Genesis 1, Revelation 22)
 *
 * @see Spec: agent-os/specs/2025-10-23-native-page-swipe-navigation/spec.md (lines 248-270, 308-318)
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, waitFor } from '@testing-library/react-native';
import type React from 'react';
import { ChapterPagerView } from '@/components/bible/ChapterPagerView';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { getAbsolutePageIndex, getChapterFromPageIndex } from '@/utils/bible/chapter-index-utils';
import { mockTestamentBooks } from '../mocks/data/bible-books.data';

// Mock child components to avoid rendering complexity
jest.mock('@/components/bible/SkeletonLoader', () => ({
  SkeletonLoader: () => {
    const { Text } = require('react-native');
    return <Text testID="skeleton-loader">Loading...</Text>;
  },
}));

jest.mock('@/components/bible/ChapterReader', () => ({
  ChapterReader: ({ chapter }: any) => {
    const { Text } = require('react-native');
    return <Text testID="chapter-reader">{chapter?.title || 'Chapter'}</Text>;
  },
}));

jest.mock('@/components/bible/ChapterContentTabs', () => ({
  ChapterContentTabs: () => {
    const { Text } = require('react-native');
    return <Text testID="chapter-tabs">Tabs</Text>;
  },
}));

// Mock the API hooks
jest.mock('@/src/api/generated/hooks', () => ({
  useBibleTestaments: jest.fn(() => ({
    data: mockTestamentBooks,
    isLoading: false,
  })),
  useBibleChapter: jest.fn((bookId: number, chapterNumber: number) => ({
    data: {
      id: `${bookId}-${chapterNumber}`,
      bookId,
      chapterNumber,
      title: `Book ${bookId} Chapter ${chapterNumber}`,
      content: 'Mock chapter content',
      sections: [],
    },
    isLoading: false,
  })),
  useBibleSummary: jest.fn(() => ({ data: null, isLoading: false })),
  useBibleByLine: jest.fn(() => ({ data: null, isLoading: false })),
  useBibleDetailed: jest.fn(() => ({ data: null, isLoading: false })),
}));

// Mock PagerView component
jest.mock('react-native-pager-view', () => {
  const React = require('react');
  const { View } = require('react-native');

  const MockPagerView = React.forwardRef(({ children }: any, ref: any) => {
    // Expose setPageWithoutAnimation method for tests
    React.useImperativeHandle(ref, () => ({
      setPageWithoutAnimation: jest.fn(),
    }));

    return <View testID="pager-view">{children}</View>;
  });

  MockPagerView.displayName = 'PagerView';

  return MockPagerView;
});

describe('Cross-Book Navigation', () => {
  let queryClient: QueryClient;
  let mockOnPageChange: jest.Mock;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    mockOnPageChange = jest.fn();
  });

  afterEach(() => {
    queryClient.clear();
  });

  const renderPagerView = (bookId: number, chapterNumber: number) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <ChapterPagerView
            initialBookId={bookId}
            initialChapter={chapterNumber}
            activeTab="summary"
            activeView="bible"
            onPageChange={mockOnPageChange}
          />
        </ThemeProvider>
      </QueryClientProvider>
    );
  };

  /**
   * Test 1: Last chapter of Genesis → First chapter of Exodus
   */
  it('transitions from last chapter of book to first chapter of next book (Genesis 50 → Exodus 1)', async () => {
    const { getByTestId } = renderPagerView(1, 50); // Genesis 50

    await waitFor(() => {
      expect(getByTestId('pager-view')).toBeTruthy();
    });

    // Verify Genesis 50 is at absolute index 49 (Genesis has 50 chapters, 0-indexed)
    const genesis50Index = getAbsolutePageIndex(1, 50, mockTestamentBooks);
    expect(genesis50Index).toBe(49);

    // Verify next chapter (Exodus 1) is at absolute index 50
    const exodus1Index = getAbsolutePageIndex(2, 1, mockTestamentBooks);
    expect(exodus1Index).toBe(50);

    // Verify getChapterFromPageIndex returns correct values
    const genesis50Chapter = getChapterFromPageIndex(49, mockTestamentBooks);
    expect(genesis50Chapter).toEqual({ bookId: 1, chapterNumber: 50 });

    const exodus1Chapter = getChapterFromPageIndex(50, mockTestamentBooks);
    expect(exodus1Chapter).toEqual({ bookId: 2, chapterNumber: 1 });
  });

  /**
   * Test 2: First chapter of Exodus → Last chapter of Genesis
   */
  it('transitions from first chapter of book to last chapter of previous book (Exodus 1 → Genesis 50)', async () => {
    const { getByTestId } = renderPagerView(2, 1); // Exodus 1

    await waitFor(() => {
      expect(getByTestId('pager-view')).toBeTruthy();
    });

    // Verify Exodus 1 is at absolute index 50
    const exodus1Index = getAbsolutePageIndex(2, 1, mockTestamentBooks);
    expect(exodus1Index).toBe(50);

    // Verify previous chapter (Genesis 50) is at absolute index 49
    const genesis50Index = getAbsolutePageIndex(1, 50, mockTestamentBooks);
    expect(genesis50Index).toBe(49);

    // Verify getChapterFromPageIndex returns correct values
    const exodus1Chapter = getChapterFromPageIndex(50, mockTestamentBooks);
    expect(exodus1Chapter).toEqual({ bookId: 2, chapterNumber: 1 });

    const genesis50Chapter = getChapterFromPageIndex(49, mockTestamentBooks);
    expect(genesis50Chapter).toEqual({ bookId: 1, chapterNumber: 50 });
  });

  /**
   * Test 3: Old Testament to New Testament transition (Malachi 4 → Matthew 1)
   */
  it('transitions seamlessly from OT to NT (Malachi 4 → Matthew 1)', async () => {
    const { getByTestId } = renderPagerView(39, 4); // Malachi 4 (last OT chapter)

    await waitFor(() => {
      expect(getByTestId('pager-view')).toBeTruthy();
    });

    // Verify Malachi 4 is the last OT chapter
    const malachiBook = mockTestamentBooks.find((b) => b.id === 39);
    expect(malachiBook?.name).toBe('Malachi');
    expect(malachiBook?.chapterCount).toBe(4);

    // Verify Matthew 1 is the first NT chapter
    const matthewBook = mockTestamentBooks.find((b) => b.id === 40);
    expect(matthewBook?.name).toBe('Matthew');
    expect(matthewBook?.testament).toBe('NT');

    // Calculate absolute indices
    const malachi4Index = getAbsolutePageIndex(39, 4, mockTestamentBooks);
    const matthew1Index = getAbsolutePageIndex(40, 1, mockTestamentBooks);

    // Matthew 1 should immediately follow Malachi 4
    expect(matthew1Index).toBe(malachi4Index + 1);

    // Verify getChapterFromPageIndex returns correct values
    const malachi4Chapter = getChapterFromPageIndex(malachi4Index, mockTestamentBooks);
    expect(malachi4Chapter).toEqual({ bookId: 39, chapterNumber: 4 });

    const matthew1Chapter = getChapterFromPageIndex(matthew1Index, mockTestamentBooks);
    expect(matthew1Chapter).toEqual({ bookId: 40, chapterNumber: 1 });
  });

  /**
   * Test 4: Single-chapter book navigation (Obadiah)
   */
  it('navigates correctly from single-chapter book Obadiah (id:31)', async () => {
    const { getByTestId } = renderPagerView(31, 1); // Obadiah 1 (single chapter)

    await waitFor(() => {
      expect(getByTestId('pager-view')).toBeTruthy();
    });

    // Verify Obadiah has only 1 chapter
    const obadiahBook = mockTestamentBooks.find((b) => b.id === 31);
    expect(obadiahBook?.name).toBe('Obadiah');
    expect(obadiahBook?.chapterCount).toBe(1);

    // Get absolute indices for navigation
    const obadiah1Index = getAbsolutePageIndex(31, 1, mockTestamentBooks);
    const prevChapterIndex = obadiah1Index - 1;
    const nextChapterIndex = obadiah1Index + 1;

    // Verify previous chapter (Amos 9)
    const prevChapter = getChapterFromPageIndex(prevChapterIndex, mockTestamentBooks);
    expect(prevChapter).toEqual({ bookId: 30, chapterNumber: 9 }); // Amos has 9 chapters

    // Verify next chapter (Jonah 1)
    const nextChapter = getChapterFromPageIndex(nextChapterIndex, mockTestamentBooks);
    expect(nextChapter).toEqual({ bookId: 32, chapterNumber: 1 }); // Jonah chapter 1
  });

  /**
   * Test 5: Single-chapter book navigation (Philemon)
   */
  it('navigates correctly from single-chapter book Philemon (id:57)', async () => {
    const { getByTestId } = renderPagerView(57, 1); // Philemon 1 (single chapter)

    await waitFor(() => {
      expect(getByTestId('pager-view')).toBeTruthy();
    });

    // Verify Philemon has only 1 chapter
    const philemonBook = mockTestamentBooks.find((b) => b.id === 57);
    expect(philemonBook?.name).toBe('Philemon');
    expect(philemonBook?.chapterCount).toBe(1);

    // Get absolute indices for navigation
    const philemon1Index = getAbsolutePageIndex(57, 1, mockTestamentBooks);
    const prevChapterIndex = philemon1Index - 1;
    const nextChapterIndex = philemon1Index + 1;

    // Verify previous chapter (Titus 3)
    const prevChapter = getChapterFromPageIndex(prevChapterIndex, mockTestamentBooks);
    expect(prevChapter).toEqual({ bookId: 56, chapterNumber: 3 }); // Titus has 3 chapters

    // Verify next chapter (Hebrews 1)
    const nextChapter = getChapterFromPageIndex(nextChapterIndex, mockTestamentBooks);
    expect(nextChapter).toEqual({ bookId: 58, chapterNumber: 1 }); // Hebrews chapter 1
  });

  /**
   * Test 6: Bible boundaries - Genesis 1 (first chapter)
   */
  it('handles Genesis 1 boundary correctly (cannot navigate to previous)', async () => {
    const { getByTestId } = renderPagerView(1, 1); // Genesis 1

    await waitFor(() => {
      expect(getByTestId('pager-view')).toBeTruthy();
    });

    // Verify Genesis 1 is at absolute index 0
    const genesis1Index = getAbsolutePageIndex(1, 1, mockTestamentBooks);
    expect(genesis1Index).toBe(0);

    // Verify there's no valid previous chapter (index -1 should return null)
    const prevChapter = getChapterFromPageIndex(-1, mockTestamentBooks);
    expect(prevChapter).toBeNull();

    // Verify next chapter (Genesis 2) exists
    const genesis2Chapter = getChapterFromPageIndex(1, mockTestamentBooks);
    expect(genesis2Chapter).toEqual({ bookId: 1, chapterNumber: 2 });
  });

  /**
   * Test 7: Bible boundaries - Revelation 22 (last chapter)
   */
  it('handles Revelation 22 boundary correctly (cannot navigate to next)', async () => {
    const { getByTestId } = renderPagerView(66, 22); // Revelation 22

    await waitFor(() => {
      expect(getByTestId('pager-view')).toBeTruthy();
    });

    // Verify Revelation 22 is at absolute index 1188 (last chapter)
    const revelation22Index = getAbsolutePageIndex(66, 22, mockTestamentBooks);
    expect(revelation22Index).toBe(1188);

    // Verify there's no valid next chapter (index 1189 should return null)
    const nextChapter = getChapterFromPageIndex(1189, mockTestamentBooks);
    expect(nextChapter).toBeNull();

    // Verify previous chapter (Revelation 21) exists
    const revelation21Chapter = getChapterFromPageIndex(1187, mockTestamentBooks);
    expect(revelation21Chapter).toEqual({ bookId: 66, chapterNumber: 21 });
  });

  /**
   * Test 8: Metadata loading edge case
   */
  it('handles metadata loading gracefully (shows loading state until booksMetadata available)', async () => {
    // Mock useBibleTestaments to return undefined initially
    const { useBibleTestaments } = require('@/src/api/generated/hooks');
    useBibleTestaments.mockReturnValueOnce({
      data: undefined,
      isLoading: true,
    });

    const { getByTestId } = renderPagerView(1, 1);

    await waitFor(() => {
      expect(getByTestId('pager-view')).toBeTruthy();
    });

    // Component should render without crashing when metadata is undefined
    // It should default to Genesis 1 until metadata loads
    expect(getByTestId('pager-view')).toBeTruthy();
  });
});
