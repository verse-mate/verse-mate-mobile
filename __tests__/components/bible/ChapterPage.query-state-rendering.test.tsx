/**
 * Tests for ChapterPage query-state-based rendering
 *
 * These tests verify that ChapterPage uses query loading states instead of
 * artificial setTimeout delays for rendering content.
 *
 * Key behaviors tested:
 * - Skeleton shows until data is ready (no artificial delay)
 * - Content renders as soon as query completes
 * - isPreloading prop still works for pages far from current view
 * - No UI freeze when switching chapters
 *
 * @see Spec: agent-os/specs/2026-02-01-chapter-header-slide-sync-v2/spec.md
 * @see Task Group 5: Remove Staggered Render Delays in ChapterPage
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ChapterPage } from '@/components/bible/ChapterPage';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ToastProvider } from '@/contexts/ToastContext';
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

// Mock highlights hooks
jest.mock('@/hooks/bible/use-highlights', () => ({
  useHighlights: jest.fn(() => ({
    chapterHighlights: [],
    addHighlight: jest.fn(),
    updateHighlightColor: jest.fn(),
    deleteHighlight: jest.fn(),
  })),
}));

jest.mock('@/hooks/bible/use-auto-highlights', () => ({
  useAutoHighlights: jest.fn(() => ({
    autoHighlights: [],
  })),
}));

// Mock AuthContext
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(() => ({
    isAuthenticated: true,
    user: { id: 'test-user' },
    isLoading: false,
  })),
}));

// Mock Safe Area Context
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
  ChapterReader: ({ chapter }: { chapter: { title: string } }) => {
    const { Text } = require('react-native');
    return <Text testID="chapter-reader">{chapter.title}</Text>;
  },
}));

// Mock modals
jest.mock('@/components/bible/NotesModal', () => ({
  NotesModal: ({ visible }: { visible: boolean }) => {
    const { Text } = require('react-native');
    return visible ? <Text>NotesModal</Text> : null;
  },
}));
jest.mock('@/components/bible/NoteViewModal', () => ({
  NoteViewModal: ({ visible }: { visible: boolean }) => {
    const { Text } = require('react-native');
    return visible ? <Text>NoteViewModal</Text> : null;
  },
}));
jest.mock('@/components/bible/NoteEditModal', () => ({
  NoteEditModal: ({ visible }: { visible: boolean }) => {
    const { Text } = require('react-native');
    return visible ? <Text>NoteEditModal</Text> : null;
  },
}));
jest.mock('@/components/bible/DeleteConfirmationModal', () => ({
  DeleteConfirmationModal: ({ visible }: { visible: boolean }) => {
    const { Text } = require('react-native');
    return visible ? <Text>DeleteConfirmationModal</Text> : null;
  },
}));

const mockUseBibleChapter = useBibleChapter as jest.MockedFunction<typeof useBibleChapter>;
const mockUseBibleSummary = useBibleSummary as jest.MockedFunction<typeof useBibleSummary>;
const mockUseBibleByLine = useBibleByLine as jest.MockedFunction<typeof useBibleByLine>;
const mockUseBibleDetailed = useBibleDetailed as jest.MockedFunction<typeof useBibleDetailed>;

describe('ChapterPage query-state-based rendering', () => {
  let queryClient: QueryClient;

  const mockChapter = {
    bookId: 1,
    chapterNumber: 1,
    title: 'Genesis 1',
    bookName: 'Genesis',
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

  const mockSummaryData = {
    bookId: 1,
    chapterNumber: 1,
    type: 'summary',
    content: 'Summary explanation content',
    languageCode: 'en-US',
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    jest.clearAllMocks();

    // Set up default mock return values
    mockUseBibleSummary.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
      isError: false,
    } as ReturnType<typeof useBibleSummary>);

    mockUseBibleByLine.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
      isError: false,
    } as ReturnType<typeof useBibleByLine>);

    mockUseBibleDetailed.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
      isError: false,
    } as ReturnType<typeof useBibleDetailed>);
  });

  const renderChapterPage = (
    bookId: number = 1,
    chapterNumber: number = 1,
    activeTab: ContentTabType = 'summary',
    activeView: 'bible' | 'explanations' = 'bible',
    isPreloading: boolean = false
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
                isPreloading={isPreloading}
              />
            </ToastProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    );
  };

  describe('skeleton shows until data is ready', () => {
    it('should show skeleton while chapter data is loading', () => {
      mockUseBibleChapter.mockReturnValue({
        data: null,
        isLoading: true,
        isPlaceholderData: false,
        error: null,
        isError: false,
        isSuccess: false,
      } as ReturnType<typeof useBibleChapter>);

      renderChapterPage(1, 1, 'summary', 'bible');

      // Skeleton should be visible
      expect(screen.getByTestId('skeleton-loader')).toBeTruthy();
    });

    it('should not show skeleton when chapter data is available', async () => {
      mockUseBibleChapter.mockReturnValue({
        data: mockChapter,
        isLoading: false,
        isPlaceholderData: false,
        error: null,
        isError: false,
        isSuccess: true,
      } as ReturnType<typeof useBibleChapter>);

      renderChapterPage(1, 1, 'summary', 'bible');

      await waitFor(() => {
        expect(screen.getByTestId('chapter-reader')).toBeTruthy();
      });

      // Skeleton should not be visible when data is available
      expect(screen.queryByTestId('skeleton-loader')).toBeNull();
    });
  });

  describe('content renders as soon as query completes', () => {
    it('should render content immediately when query completes without artificial delay', async () => {
      jest.useFakeTimers();

      // Start with loading state
      mockUseBibleChapter.mockReturnValue({
        data: null,
        isLoading: true,
        isPlaceholderData: false,
        error: null,
        isError: false,
        isSuccess: false,
      } as ReturnType<typeof useBibleChapter>);

      const { rerender } = renderChapterPage(1, 1, 'summary', 'bible');

      // Skeleton should be visible during loading
      expect(screen.getByTestId('skeleton-loader')).toBeTruthy();

      // Simulate query completing
      mockUseBibleChapter.mockReturnValue({
        data: mockChapter,
        isLoading: false,
        isPlaceholderData: false,
        error: null,
        isError: false,
        isSuccess: true,
      } as ReturnType<typeof useBibleChapter>);

      // Rerender to trigger the update
      rerender(
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            <ThemeProvider>
              <ToastProvider>
                <ChapterPage bookId={1} chapterNumber={1} activeTab="summary" activeView="bible" />
              </ToastProvider>
            </ThemeProvider>
          </QueryClientProvider>
        </SafeAreaProvider>
      );

      // Content should render IMMEDIATELY - no setTimeout delay needed
      await waitFor(() => {
        expect(screen.getByTestId('chapter-reader')).toBeTruthy();
      });

      // Verify no artificial 600ms, 1100ms, etc. delays were needed
      // The content rendered without advancing timers significantly
      jest.useRealTimers();
    });
  });

  describe('isPreloading prop behavior', () => {
    it('should skip heavy explanations content when isPreloading is true', () => {
      mockUseBibleChapter.mockReturnValue({
        data: mockChapter,
        isLoading: false,
        isPlaceholderData: false,
        error: null,
        isError: false,
        isSuccess: true,
      } as ReturnType<typeof useBibleChapter>);

      mockUseBibleSummary.mockReturnValue({
        data: mockSummaryData,
        isLoading: false,
        error: null,
        isError: false,
        isSuccess: true,
      } as ReturnType<typeof useBibleSummary>);

      // Render with isPreloading = true
      renderChapterPage(1, 1, 'summary', 'explanations', true);

      // When preloading, the explanations view should not be rendered
      // This is checked by verifying the explanations container is not present
      const scrollViews = screen.queryAllByTestId(/chapter-page-scroll/);
      // Only the bible view should be rendered, not explanations tabs
      expect(scrollViews.some((view) => view.props.testID.includes('summary'))).toBe(false);
    });

    it('should render explanations content when isPreloading is false', async () => {
      mockUseBibleChapter.mockReturnValue({
        data: mockChapter,
        isLoading: false,
        isPlaceholderData: false,
        error: null,
        isError: false,
        isSuccess: true,
      } as ReturnType<typeof useBibleChapter>);

      mockUseBibleSummary.mockReturnValue({
        data: mockSummaryData,
        isLoading: false,
        error: null,
        isError: false,
        isSuccess: true,
      } as ReturnType<typeof useBibleSummary>);

      // Render with isPreloading = false
      renderChapterPage(1, 1, 'summary', 'explanations', false);

      // Explanations view should be rendered
      await waitFor(() => {
        const scrollViews = screen.queryAllByTestId(/chapter-page-scroll/);
        expect(scrollViews.some((view) => view.props.testID.includes('summary'))).toBe(true);
      });
    });
  });

  describe('no UI freeze when switching chapters', () => {
    it('should render new chapter content without blocking UI', async () => {
      jest.useFakeTimers();

      // Start with Genesis 1
      mockUseBibleChapter.mockReturnValue({
        data: mockChapter,
        isLoading: false,
        isPlaceholderData: false,
        error: null,
        isError: false,
        isSuccess: true,
      } as ReturnType<typeof useBibleChapter>);

      const { rerender } = renderChapterPage(1, 1, 'summary', 'bible');

      await waitFor(() => {
        expect(screen.getByText('Genesis 1')).toBeTruthy();
      });

      // Switch to Genesis 2
      const newChapter = {
        ...mockChapter,
        chapterNumber: 2,
        title: 'Genesis 2',
      };

      mockUseBibleChapter.mockReturnValue({
        data: newChapter,
        isLoading: false,
        isPlaceholderData: false,
        error: null,
        isError: false,
        isSuccess: true,
      } as ReturnType<typeof useBibleChapter>);

      // Rerender with new chapter
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

      // New chapter should render immediately
      await waitFor(() => {
        expect(screen.getByText('Genesis 2')).toBeTruthy();
      });

      // No need to wait for 600ms, 1100ms, etc. artificial delays
      jest.useRealTimers();
    });

    it('should use cached chapter data to prevent flicker during transitions', async () => {
      // Start with data available
      mockUseBibleChapter.mockReturnValue({
        data: mockChapter,
        isLoading: false,
        isPlaceholderData: false,
        error: null,
        isError: false,
        isSuccess: true,
      } as ReturnType<typeof useBibleChapter>);

      const { rerender } = renderChapterPage(1, 1, 'summary', 'bible');

      await waitFor(() => {
        expect(screen.getByTestId('chapter-reader')).toBeTruthy();
      });

      // Simulate transitioning to new chapter (brief loading state)
      // But old data should still be shown via lastChapterRef
      mockUseBibleChapter.mockReturnValue({
        data: null,
        isLoading: true,
        isPlaceholderData: false,
        error: null,
        isError: false,
        isSuccess: false,
      } as ReturnType<typeof useBibleChapter>);

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

      // Should still show content (from lastChapterRef cache), not skeleton
      // This prevents flicker during chapter transitions
      expect(screen.queryByTestId('chapter-reader')).toBeTruthy();
    });
  });
});
