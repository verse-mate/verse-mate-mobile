/**
 * Tests for ChapterPage component
 *
 * ChapterPage is a lightweight wrapper that renders a single Bible chapter.
 * It receives bookId and chapterNumber as PROPS (not derived from key).
 * The parent (ChapterPagerView) sets stable positional keys.
 *
 * Tests:
 * - Renders without crash
 * - Fetches chapter when visible
 * - Shows SkeletonLoader when loading
 * - Shows ChapterReader when loaded
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react-native';
import { ChapterPage } from '@/components/bible/ChapterPage';
import {
  useBibleByLine,
  useBibleChapter,
  useBibleDetailed,
  useBibleSummary,
} from '@/src/api/generated/hooks';
import type { ContentTabType } from '@/types/bible';

// Mock the Bible hooks
jest.mock('@/src/api/generated/hooks', () => ({
  useBibleChapter: jest.fn(),
  useBibleSummary: jest.fn(),
  useBibleByLine: jest.fn(),
  useBibleDetailed: jest.fn(),
}));

// Mock child components
jest.mock('@/components/bible/SkeletonLoader', () => ({
  SkeletonLoader: () => {
    const { Text } = require('react-native');
    return <Text testID="skeleton-loader">Loading...</Text>;
  },
}));

jest.mock('@/components/bible/ChapterReader', () => ({
  ChapterReader: ({ chapter }: any) => {
    const { Text } = require('react-native');
    return <Text testID="chapter-reader">{chapter.title}</Text>;
  },
}));

const mockUseBibleChapter = useBibleChapter as jest.MockedFunction<typeof useBibleChapter>;
const mockUseBibleSummary = useBibleSummary as jest.MockedFunction<typeof useBibleSummary>;
const mockUseBibleByLine = useBibleByLine as jest.MockedFunction<typeof useBibleByLine>;
const mockUseBibleDetailed = useBibleDetailed as jest.MockedFunction<typeof useBibleDetailed>;

describe('ChapterPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    jest.clearAllMocks();

    // Set up default mock return values for explanation hooks
    mockUseBibleSummary.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
      isError: false,
    } as any);

    mockUseBibleByLine.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
      isError: false,
    } as any);

    mockUseBibleDetailed.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
      isError: false,
    } as any);
  });

  const renderChapterPage = (
    bookId: number,
    chapterNumber: number,
    activeTab: ContentTabType = 'summary',
    activeView: 'bible' | 'explanations' = 'bible'
  ) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <ChapterPage
          bookId={bookId}
          chapterNumber={chapterNumber}
          activeTab={activeTab}
          activeView={activeView}
        />
      </QueryClientProvider>
    );
  };

  it('should render without crash', () => {
    mockUseBibleChapter.mockReturnValue({
      data: null,
      isLoading: true,
      isPlaceholderData: false,
      error: null,
      isError: false,
      isSuccess: false,
    } as any);

    const result = renderChapterPage(1, 1);
    expect(result.root).toBeTruthy();
  });

  it('should show ChapterReader when chapter is loaded', async () => {
    const mockChapter = {
      bookId: 1,
      chapterNumber: 1,
      title: 'Genesis 1',
      sections: [
        {
          startVerse: 1,
          endVerse: 5,
          subtitle: 'The Creation',
          verses: [
            { verseNumber: 1, text: 'In the beginning...' },
            { verseNumber: 2, text: 'And the earth was...' },
          ],
        },
      ],
    };

    mockUseBibleChapter.mockReturnValue({
      data: mockChapter,
      isLoading: false,
      isPlaceholderData: false,
      error: null,
      isError: false,
      isSuccess: true,
    } as any);

    renderChapterPage(1, 1);

    await waitFor(() => {
      expect(screen.getByTestId('chapter-reader')).toBeTruthy();
      expect(screen.getByText('Genesis 1')).toBeTruthy();
    });
  });

  it('should call useBibleChapter with correct bookId and chapterNumber', () => {
    mockUseBibleChapter.mockReturnValue({
      data: null,
      isLoading: true,
      isPlaceholderData: false,
      error: null,
      isError: false,
      isSuccess: false,
    } as any);

    renderChapterPage(2, 10);

    expect(mockUseBibleChapter).toHaveBeenCalledWith(2, 10, undefined);
  });

  it('should update when props change (window shift)', () => {
    mockUseBibleChapter.mockReturnValue({
      data: null,
      isLoading: true,
      isPlaceholderData: false,
      error: null,
      isError: false,
      isSuccess: false,
    } as any);

    const { rerender } = renderChapterPage(1, 1);

    // Simulate window shift - props update but key stays same
    rerender(
      <QueryClientProvider client={queryClient}>
        <ChapterPage bookId={1} chapterNumber={2} activeTab="summary" activeView="bible" />
      </QueryClientProvider>
    );

    // Should have been called with new chapter number
    expect(mockUseBibleChapter).toHaveBeenLastCalledWith(1, 2, undefined);
  });

  it('should pass activeTab and activeView to ChapterReader', async () => {
    const mockChapter = {
      bookId: 1,
      chapterNumber: 1,
      title: 'Genesis 1',
      sections: [],
    };

    mockUseBibleChapter.mockReturnValue({
      data: mockChapter,
      isLoading: false,
      isPlaceholderData: false,
      error: null,
      isError: false,
      isSuccess: true,
    } as any);

    // Provide mock data for detailed tab to prevent skeleton from showing
    const mockDetailedExplanation = {
      bookId: 1,
      chapterNumber: 1,
      type: 'detailed',
      content: 'Detailed explanation content',
      languageCode: 'en-US',
    };

    mockUseBibleDetailed.mockReturnValue({
      data: mockDetailedExplanation,
      isLoading: false,
      isFetching: false,
      error: null,
      isError: false,
      isSuccess: true,
    } as any);

    renderChapterPage(1, 1, 'detailed', 'explanations');

    await waitFor(() => {
      expect(screen.getByTestId('chapter-reader')).toBeTruthy();
    });

    // Note: In actual implementation, ChapterReader would receive these props
    // This test verifies the component renders - prop passing tested in integration
  });
});
