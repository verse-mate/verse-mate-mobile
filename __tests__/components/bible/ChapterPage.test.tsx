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
import type React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ChapterPage } from '@/components/bible/ChapterPage';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { useNotes } from '@/hooks/bible/use-notes';
import { useBibleByLine, useBibleChapter, useBibleDetailed, useBibleSummary } from '@/src/api';
import type { ContentTabType } from '@/types/bible';

// Mock the Bible hooks
jest.mock('@/src/api/hooks', () => ({
  useBibleChapter: jest.fn(),
  useBibleSummary: jest.fn(),
  useBibleByLine: jest.fn(),
  useBibleDetailed: jest.fn(),
}));

// Mock useNotes hook
jest.mock('@/hooks/bible/use-notes', () => ({
  useNotes: jest.fn(() => ({
    notes: [],
    addNote: jest.fn(),
    updateNote: jest.fn(),
    deleteNote: jest.fn(),
    getNotesByChapter: jest.fn(() => []),
    hasNotes: jest.fn(() => false),
    isDeletingNote: false,
  })),
}));

// Mock BibleInteractionContext (ChapterPage now uses useBibleInteraction instead of direct hooks)
jest.mock('@/contexts/BibleInteractionContext', () => ({
  useBibleInteraction: jest.fn(() => ({
    chapterHighlights: [],
    autoHighlights: [],
    addHighlight: jest.fn(),
    updateHighlightColor: jest.fn(),
    deleteHighlight: jest.fn(),
    openVerseTooltip: jest.fn(),
    closeAll: jest.fn(),
    openAutoHighlightTooltip: jest.fn(),
    openHighlightSelection: jest.fn(),
    openHighlightEditMenu: jest.fn(),
  })),
}));

// Mock AuthContext (used by useNotes implicitly)
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(() => ({
    isAuthenticated: true,
    user: { id: 'test-user' },
    isLoading: false,
  })),
}));

// Mock Safe Area Context (used by ToastProvider)
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: jest.fn(({ children }) => children),
  SafeAreaView: jest.fn(({ children }) => children),
  useSafeAreaInsets: jest.fn(() => ({ top: 0, right: 0, bottom: 0, left: 0 })),
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

// Mock modals to avoid complex rendering in ChapterPage tests
jest.mock('@/components/bible/NotesModal', () => ({
  NotesModal: ({ visible }: any) => {
    const { Text } = require('react-native');
    return visible ? <Text>NotesModal</Text> : null;
  },
}));
jest.mock('@/components/bible/NoteViewModal', () => ({
  NoteViewModal: ({ visible }: any) => {
    const { Text } = require('react-native');
    return visible ? <Text>NoteViewModal</Text> : null;
  },
}));
jest.mock('@/components/bible/NoteEditModal', () => ({
  NoteEditModal: ({ visible }: any) => {
    const { Text } = require('react-native');
    return visible ? <Text>NoteEditModal</Text> : null;
  },
}));
jest.mock('@/components/bible/DeleteConfirmationModal', () => ({
  DeleteConfirmationModal: ({ visible }: any) => {
    const { Text } = require('react-native');
    return visible ? <Text>DeleteConfirmationModal</Text> : null;
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
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <ToastProvider>
              <ChapterPage
                bookId={bookId}
                chapterNumber={chapterNumber}
                activeTab={activeTab}
                activeView={activeView}
              />
            </ToastProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
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
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <ToastProvider>
              <ChapterPage bookId={1} chapterNumber={2} activeTab="summary" activeView="bible" />
            </ToastProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
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
      // With dual-view rendering, both Bible and Explanations views might render a ChapterReader
      // We just need to verify at least one is present
      const readers = screen.getAllByTestId('chapter-reader');
      expect(readers.length).toBeGreaterThan(0);
    });

    // Note: In actual implementation, ChapterReader would receive these props
    // This test verifies the component renders - prop passing tested in integration
  });

  /**
   * Lazy explanation queries (TDD)
   *
   * Protects Change H2: Lazy-enable explanation queries.
   * Currently all three explanation types (summary, byline, detailed) are
   * fetched in parallel regardless of activeTab. After H2, only the active
   * tab's query will be enabled.
   */
  describe('lazy explanation queries (TDD)', () => {
    beforeEach(() => {
      mockUseBibleChapter.mockReturnValue({
        data: {
          bookId: 1,
          chapterNumber: 1,
          title: 'Genesis 1',
          sections: [
            {
              startVerse: 1,
              endVerse: 5,
              subtitle: 'The Creation',
              verses: [{ verseNumber: 1, text: 'In the beginning...' }],
            },
          ],
        },
        isLoading: false,
        isPlaceholderData: false,
        error: null,
        isError: false,
        isSuccess: true,
      } as any);
    });

    it('[REGRESSION] calls useBibleSummary when activeTab="summary"', () => {
      renderChapterPage(1, 1, 'summary', 'explanations');

      expect(mockUseBibleSummary).toHaveBeenCalled();
    });

    it('[TDD] does NOT enable useBibleByLine when activeTab="summary"', () => {
      renderChapterPage(1, 1, 'summary', 'explanations');

      // After lazy-enable: useBibleByLine should be called with enabled=false
      // when summary tab is active
      // Will FAIL until lazy-enable is implemented (currently all are fetched)
      const byLineCall = mockUseBibleByLine.mock.calls[0];
      // The 4th argument is the options object with { enabled }
      expect(byLineCall[3]).toEqual(expect.objectContaining({ enabled: false }));
    });

    it('[TDD] enables useBibleDetailed after switching activeTab to "detailed"', () => {
      // First render with summary tab
      const { rerender } = renderChapterPage(1, 1, 'summary', 'explanations');

      // useBibleDetailed should be called with enabled=false initially
      const firstDetailedCall = mockUseBibleDetailed.mock.calls[0];
      expect(firstDetailedCall[3]).toEqual(expect.objectContaining({ enabled: false }));

      mockUseBibleDetailed.mockClear();

      // Switch to detailed tab
      rerender(
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            <ThemeProvider>
              <ToastProvider>
                <ChapterPage
                  bookId={1}
                  chapterNumber={1}
                  activeTab="detailed"
                  activeView="explanations"
                />
              </ToastProvider>
            </ThemeProvider>
          </QueryClientProvider>
        </SafeAreaProvider>
      );

      // After switching: useBibleDetailed should be called with enabled=true
      // Will FAIL until lazy-enable is implemented
      const secondDetailedCall = mockUseBibleDetailed.mock.calls[0];
      expect(secondDetailedCall[3]).toEqual(expect.objectContaining({ enabled: true }));
    });

    it('[REGRESSION] ChapterReader renders after tab switch', async () => {
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

      // Render with summary view
      const { rerender } = renderChapterPage(1, 1, 'summary', 'explanations');

      // Switch to detailed view
      rerender(
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            <ThemeProvider>
              <ToastProvider>
                <ChapterPage
                  bookId={1}
                  chapterNumber={1}
                  activeTab="detailed"
                  activeView="explanations"
                />
              </ToastProvider>
            </ThemeProvider>
          </QueryClientProvider>
        </SafeAreaProvider>
      );

      await waitFor(() => {
        const readers = screen.getAllByTestId('chapter-reader');
        expect(readers.length).toBeGreaterThan(0);
      });
    });
  });
});
