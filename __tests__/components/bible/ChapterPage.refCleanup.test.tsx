/**
 * Tests for ChapterPage ref mirror cleanup (Task Group 9)
 *
 * These tests verify that:
 * 1. Verse visibility tracking still works after ref removal
 * 2. No regressions in scroll-based visibility detection
 * 3. ChapterPage renders correctly without visibleYRangeRef
 *
 * @see Spec: agent-os/specs/2026-01-19-chapter-view-state-refactor/spec.md (lines 67-71)
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
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

// Mock SkeletonLoader
jest.mock('@/components/bible/SkeletonLoader', () => ({
  SkeletonLoader: () => {
    const { Text } = require('react-native');
    return <Text testID="skeleton-loader">Loading...</Text>;
  },
}));

// Track TextVisibilityContext values
let capturedVisibleYRange: { startY: number; endY: number } | null = null;

// Mock ChapterReader to capture TextVisibilityContext
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
    const React = require('react');
    const { Text } = require('react-native');
    const { useTextVisibility } = require('@/contexts/TextVisibilityContext');

    const { visibleYRange } = useTextVisibility();

    // Store the visibility context value for test assertions
    React.useEffect(() => {
      capturedVisibleYRange = visibleYRange;
    }, [visibleYRange]);

    const viewType = explanationsOnly ? 'explanation' : 'bible';
    return (
      <Text testID={`chapter-reader-${viewType}-${activeTab}`}>
        {chapter.title} - Visible:{' '}
        {visibleYRange ? `${visibleYRange.startY}-${visibleYRange.endY}` : 'null'}
      </Text>
    );
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

describe('ChapterPage Ref Cleanup (Task Group 9)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    jest.clearAllMocks();
    jest.useFakeTimers();
    capturedVisibleYRange = null;

    // Setup default mock return values
    mockUseBibleChapter.mockReturnValue({
      data: mockChapter,
      isLoading: false,
      isPlaceholderData: false,
      error: null,
      isError: false,
      isSuccess: true,
    } as ReturnType<typeof useBibleChapter>);

    mockUseBibleSummary.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
      isError: false,
      isSuccess: false,
    } as ReturnType<typeof useBibleSummary>);

    mockUseBibleByLine.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
      isError: false,
      isSuccess: false,
    } as ReturnType<typeof useBibleByLine>);

    mockUseBibleDetailed.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
      isError: false,
      isSuccess: false,
    } as ReturnType<typeof useBibleDetailed>);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const renderChapterPage = (props: {
    bookId?: number;
    chapterNumber?: number;
    activeTab?: ContentTabType;
    activeView?: 'bible' | 'explanations';
  }) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <ToastProvider>
            <ChapterPage
              bookId={props.bookId ?? 1}
              chapterNumber={props.chapterNumber ?? 1}
              activeTab={props.activeTab ?? 'summary'}
              activeView={props.activeView ?? 'bible'}
            />
          </ToastProvider>
        </ThemeProvider>
      </QueryClientProvider>
    );
  };

  it('should track verse visibility via state after scroll (no ref required)', async () => {
    // Render the component
    renderChapterPage({ activeView: 'bible' });

    // Wait for component to mount and render
    await waitFor(() => {
      expect(screen.getByTestId('chapter-reader-bible-summary')).toBeTruthy();
    });

    // Initially, visibleYRange should be null
    expect(capturedVisibleYRange).toBeNull();

    // Find the scroll view and simulate a scroll event
    const scrollView = screen.getByTestId('chapter-page-scroll-1-1-bible');

    // Simulate scroll event with scroll position data
    fireEvent.scroll(scrollView, {
      nativeEvent: {
        contentOffset: { x: 0, y: 100 },
        contentSize: { width: 400, height: 2000 },
        layoutMeasurement: { width: 400, height: 800 },
      },
    });

    // The visibility state update is debounced (150ms)
    // Advance timers to trigger the debounced state update
    act(() => {
      jest.advanceTimersByTime(200);
    });

    // Now the context should have the updated visible range
    await waitFor(() => {
      expect(capturedVisibleYRange).not.toBeNull();
    });

    // Verify the visible range matches the scroll event data
    expect(capturedVisibleYRange?.startY).toBe(100);
    expect(capturedVisibleYRange?.endY).toBe(900); // 100 + 800 viewport height
  });

  it('should update visibility detection on subsequent scrolls (state-based)', async () => {
    renderChapterPage({ activeView: 'bible' });

    await waitFor(() => {
      expect(screen.getByTestId('chapter-reader-bible-summary')).toBeTruthy();
    });

    const scrollView = screen.getByTestId('chapter-page-scroll-1-1-bible');

    // First scroll
    fireEvent.scroll(scrollView, {
      nativeEvent: {
        contentOffset: { x: 0, y: 0 },
        contentSize: { width: 400, height: 2000 },
        layoutMeasurement: { width: 400, height: 800 },
      },
    });

    act(() => {
      jest.advanceTimersByTime(200);
    });

    await waitFor(() => {
      expect(capturedVisibleYRange?.startY).toBe(0);
    });

    // Second scroll - scroll down
    fireEvent.scroll(scrollView, {
      nativeEvent: {
        contentOffset: { x: 0, y: 500 },
        contentSize: { width: 400, height: 2000 },
        layoutMeasurement: { width: 400, height: 800 },
      },
    });

    act(() => {
      jest.advanceTimersByTime(200);
    });

    // Verify visibility range updated to reflect new scroll position
    await waitFor(() => {
      expect(capturedVisibleYRange?.startY).toBe(500);
      expect(capturedVisibleYRange?.endY).toBe(1300); // 500 + 800
    });
  });

  it('should render ChapterPage correctly and provide visibility context', async () => {
    renderChapterPage({ activeView: 'bible' });

    // Verify component renders without errors
    await waitFor(() => {
      expect(screen.getByTestId('chapter-reader-bible-summary')).toBeTruthy();
    });

    // Verify scroll view is present
    const scrollView = screen.getByTestId('chapter-page-scroll-1-1-bible');
    expect(scrollView).toBeTruthy();

    // Simulate scroll and verify context is properly provided
    fireEvent.scroll(scrollView, {
      nativeEvent: {
        contentOffset: { x: 0, y: 200 },
        contentSize: { width: 400, height: 2000 },
        layoutMeasurement: { width: 400, height: 600 },
      },
    });

    act(() => {
      jest.advanceTimersByTime(200);
    });

    // The visibility context should be accessible to child components
    await waitFor(() => {
      expect(capturedVisibleYRange).toEqual({
        startY: 200,
        endY: 800, // 200 + 600 viewport height
      });
    });
  });
});
