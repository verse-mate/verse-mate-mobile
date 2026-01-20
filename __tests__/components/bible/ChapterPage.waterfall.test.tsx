/**
 * Tests for ChapterPage dynamic tab loading (Task Group 6)
 *
 * These tests verify that:
 * 1. Tabs render when their data is available (not after fixed delay)
 * 2. There is no 2+ second delay before all tabs are visible
 * 3. Loading states display correctly during data fetch
 *
 * @see Spec: agent-os/specs/2026-01-19-chapter-view-state-refactor/spec.md (lines 55-59)
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react-native';
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

// Mock SkeletonLoader with testID for detection
jest.mock('@/components/bible/SkeletonLoader', () => ({
  SkeletonLoader: () => {
    const { Text } = require('react-native');
    return <Text testID="skeleton-loader">Loading...</Text>;
  },
}));

// Mock ChapterReader with testID for detection
// Use explanationsOnly prop to differentiate between bible view and explanation view
jest.mock('@/components/bible/ChapterReader', () => ({
  ChapterReader: ({
    chapter,
    activeTab,
    explanationsOnly,
  }: {
    chapter: { title: string };
    activeTab: string;
    explanationsOnly?: boolean;
  }) => {
    const { Text } = require('react-native');
    const viewType = explanationsOnly ? 'explanation' : 'bible';
    return <Text testID={`chapter-reader-${viewType}-${activeTab}`}>{chapter.title}</Text>;
  },
}));

// Mock modals
jest.mock('@/components/bible/NotesModal', () => ({
  NotesModal: () => null,
}));
jest.mock('@/components/bible/NoteViewModal', () => ({
  NoteViewModal: () => null,
}));
jest.mock('@/components/bible/NoteEditModal', () => ({
  NoteEditModal: () => null,
}));
jest.mock('@/components/bible/DeleteConfirmationModal', () => ({
  DeleteConfirmationModal: () => null,
}));
jest.mock('@/components/bible/NoteOptionsModal', () => ({
  NoteOptionsModal: () => null,
}));
jest.mock('@/components/bible/VerseMateTooltip', () => ({
  VerseMateTooltip: () => null,
}));
jest.mock('@/components/bible/BottomLogo', () => ({
  BottomLogo: () => null,
}));

const mockUseBibleChapter = useBibleChapter as jest.MockedFunction<typeof useBibleChapter>;
const mockUseBibleSummary = useBibleSummary as jest.MockedFunction<typeof useBibleSummary>;
const mockUseBibleByLine = useBibleByLine as jest.MockedFunction<typeof useBibleByLine>;
const mockUseBibleDetailed = useBibleDetailed as jest.MockedFunction<typeof useBibleDetailed>;

const mockChapter = {
  bookId: 1,
  chapterNumber: 1,
  bookName: 'Genesis',
  title: 'Genesis 1',
  testament: 'OT',
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

const createMockExplanation = (type: string) => ({
  bookId: 1,
  chapterNumber: 1,
  type,
  content: `${type} explanation content`,
  languageCode: 'en-US',
});

describe('ChapterPage Dynamic Tab Loading (Task Group 6)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const renderChapterPage = (
    bookId: number,
    chapterNumber: number,
    activeTab: ContentTabType = 'summary',
    activeView: 'bible' | 'explanations' = 'explanations'
  ) => {
    return render(
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
    );
  };

  it('should render tabs immediately when data is available (no fixed delay)', async () => {
    // Setup: All data immediately available
    mockUseBibleChapter.mockReturnValue({
      data: mockChapter,
      isLoading: false,
      isPlaceholderData: false,
      error: null,
      isError: false,
      isSuccess: true,
    } as ReturnType<typeof useBibleChapter>);

    mockUseBibleSummary.mockReturnValue({
      data: createMockExplanation('summary'),
      isLoading: false,
      error: null,
      isError: false,
      isSuccess: true,
    } as ReturnType<typeof useBibleSummary>);

    mockUseBibleByLine.mockReturnValue({
      data: createMockExplanation('byline'),
      isLoading: false,
      error: null,
      isError: false,
      isSuccess: true,
    } as ReturnType<typeof useBibleByLine>);

    mockUseBibleDetailed.mockReturnValue({
      data: createMockExplanation('detailed'),
      isLoading: false,
      error: null,
      isError: false,
      isSuccess: true,
    } as ReturnType<typeof useBibleDetailed>);

    renderChapterPage(1, 1, 'summary', 'explanations');

    // With query-state-based rendering, the active tab should render immediately
    // without waiting for any timeout
    // Using explanation-specific testID to avoid collision with bible view
    await waitFor(() => {
      expect(screen.getByTestId('chapter-reader-explanation-summary')).toBeTruthy();
    });

    // Verify no skeletons are shown when data is available
    expect(screen.queryByTestId('skeleton-loader')).toBeNull();
  });

  it('should render all tabs within 100ms when data is ready (no 2+ second delay)', async () => {
    // Setup: All data immediately available
    mockUseBibleChapter.mockReturnValue({
      data: mockChapter,
      isLoading: false,
      isPlaceholderData: false,
      error: null,
      isError: false,
      isSuccess: true,
    } as ReturnType<typeof useBibleChapter>);

    mockUseBibleSummary.mockReturnValue({
      data: createMockExplanation('summary'),
      isLoading: false,
      error: null,
      isError: false,
      isSuccess: true,
    } as ReturnType<typeof useBibleSummary>);

    mockUseBibleByLine.mockReturnValue({
      data: createMockExplanation('byline'),
      isLoading: false,
      error: null,
      isError: false,
      isSuccess: true,
    } as ReturnType<typeof useBibleByLine>);

    mockUseBibleDetailed.mockReturnValue({
      data: createMockExplanation('detailed'),
      isLoading: false,
      error: null,
      isError: false,
      isSuccess: true,
    } as ReturnType<typeof useBibleDetailed>);

    const startTime = Date.now();
    renderChapterPage(1, 1, 'summary', 'explanations');

    // All tabs should be rendered immediately when data is available
    // With query-state-based rendering, there should be no artificial delay
    await waitFor(
      () => {
        // Check that explanation tabs container exists and is visible
        // The byline and detailed tabs should be mounted (even if hidden) when data is ready
        const summaryTestId = 'chapter-page-scroll-1-1-summary';
        const bylineTestId = 'chapter-page-scroll-1-1-byline';
        const detailedTestId = 'chapter-page-scroll-1-1-detailed';

        expect(screen.getByTestId(summaryTestId)).toBeTruthy();
        expect(screen.getByTestId(bylineTestId)).toBeTruthy();
        expect(screen.getByTestId(detailedTestId)).toBeTruthy();
      },
      { timeout: 100 }
    );

    const elapsedTime = Date.now() - startTime;
    // Verify the rendering happened quickly (not waiting 2+ seconds)
    expect(elapsedTime).toBeLessThan(500);
  });

  it('should display loading state while data is being fetched', async () => {
    // Setup: Chapter loading, explanations not loaded yet
    mockUseBibleChapter.mockReturnValue({
      data: null,
      isLoading: true,
      isPlaceholderData: false,
      error: null,
      isError: false,
      isSuccess: false,
    } as ReturnType<typeof useBibleChapter>);

    mockUseBibleSummary.mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
      isError: false,
      isSuccess: false,
    } as ReturnType<typeof useBibleSummary>);

    mockUseBibleByLine.mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
      isError: false,
      isSuccess: false,
    } as ReturnType<typeof useBibleByLine>);

    mockUseBibleDetailed.mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
      isError: false,
      isSuccess: false,
    } as ReturnType<typeof useBibleDetailed>);

    renderChapterPage(1, 1, 'summary', 'bible');

    // When data is loading, skeleton should be visible
    await waitFor(() => {
      expect(screen.getByTestId('skeleton-loader')).toBeTruthy();
    });

    // ChapterReader should not be rendered while loading
    expect(screen.queryByTestId('chapter-reader-bible-summary')).toBeNull();
    expect(screen.queryByTestId('chapter-reader-explanation-summary')).toBeNull();
  });
});
