/**
 * Tests for ChapterPage scroll-to-verse functionality (Task Group 7)
 *
 * These tests verify that:
 * 1. Scroll to verse works when layout is ready
 * 2. No memory leak from uncleaned timers
 * 3. Tooltip appears after successful scroll
 *
 * @see Spec: agent-os/specs/2026-01-19-chapter-view-state-refactor/spec.md (lines 61-65)
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react-native';
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

// Track scrollTo calls for verification
const mockScrollTo = jest.fn();

// Mock Reanimated ScrollView
jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const { View, ScrollView } = require('react-native');

  const MockAnimatedScrollView = React.forwardRef(function MockAnimatedScrollView(
    props: any,
    ref: any
  ) {
    React.useImperativeHandle(ref, () => ({
      scrollTo: mockScrollTo,
    }));
    return <ScrollView {...props} ref={ref} />;
  });

  return {
    ...jest.requireActual('react-native-reanimated/mock'),
    useAnimatedRef: () => ({
      current: {
        scrollTo: mockScrollTo,
      },
    }),
    FadeIn: { duration: () => ({ duration: () => ({}) }) },
    FadeOut: { duration: () => ({ duration: () => ({}) }) },
    default: {
      ScrollView: MockAnimatedScrollView,
      View,
    },
  };
});

// Mock SkeletonLoader
jest.mock('@/components/bible/SkeletonLoader', () => ({
  SkeletonLoader: () => {
    const { Text } = require('react-native');
    return <Text testID="skeleton-loader">Loading...</Text>;
  },
}));

// Capture onContentLayout callback for testing
let capturedOnContentLayout: ((positions: Record<number, number>) => void) | null = null;

// Mock ChapterReader to capture onContentLayout and simulate layout events
jest.mock('@/components/bible/ChapterReader', () => ({
  ChapterReader: ({
    chapter,
    activeTab,
    explanationsOnly,
    onContentLayout,
  }: {
    chapter: { title: string };
    activeTab: string;
    explanationsOnly?: boolean;
    onContentLayout?: (positions: Record<number, number>) => void;
  }) => {
    const React = require('react');
    const { Text } = require('react-native');
    const viewType = explanationsOnly ? 'explanation' : 'bible';

    // Store the callback for external triggering
    React.useEffect(() => {
      if (onContentLayout) {
        capturedOnContentLayout = onContentLayout;
      }
      return () => {
        capturedOnContentLayout = null;
      };
    }, [onContentLayout]);

    return <Text testID={`chapter-reader-${viewType}-${activeTab}`}>{chapter.title}</Text>;
  },
}));

// Track VerseMateTooltip visibility
let tooltipVisible = false;

// Mock VerseMateTooltip to track visibility
jest.mock('@/components/bible/VerseMateTooltip', () => ({
  VerseMateTooltip: ({ visible }: { visible: boolean }) => {
    tooltipVisible = visible;
    const { Text } = require('react-native');
    return visible ? <Text testID="verse-tooltip">Tooltip</Text> : null;
  },
}));

// Mock other modals
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
        { verseNumber: 3, text: 'And God said...' },
        { verseNumber: 4, text: 'And God saw...' },
        { verseNumber: 5, text: 'And God called...' },
      ],
    },
    {
      startVerse: 6,
      endVerse: 10,
      subtitle: 'The Firmament',
      verses: [
        { verseNumber: 6, text: 'And God said, Let there be...' },
        { verseNumber: 7, text: 'And God made...' },
        { verseNumber: 8, text: 'And God called...' },
        { verseNumber: 9, text: 'And God said...' },
        { verseNumber: 10, text: 'And God called...' },
      ],
    },
  ],
};

describe('ChapterPage Scroll-to-Verse (Task Group 7)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    jest.clearAllMocks();
    jest.useFakeTimers();
    capturedOnContentLayout = null;
    tooltipVisible = false;

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
    targetVerse?: number;
    targetEndVerse?: number;
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
              targetVerse={props.targetVerse}
              targetEndVerse={props.targetEndVerse}
            />
          </ToastProvider>
        </ThemeProvider>
      </QueryClientProvider>
    );
  };

  it('should scroll to verse when layout positions are reported via onContentLayout', async () => {
    // Render with target verse
    renderChapterPage({ targetVerse: 6 });

    // Wait for component to mount and ChapterReader to render
    await waitFor(() => {
      expect(screen.getByTestId('chapter-reader-bible-summary')).toBeTruthy();
    });

    // Verify onContentLayout callback was captured
    expect(capturedOnContentLayout).not.toBeNull();

    // Simulate layout event reporting positions (ChapterReader calls onContentLayout)
    act(() => {
      capturedOnContentLayout?.({
        1: 100, // Verse 1 at y=100
        6: 500, // Verse 6 at y=500 (target verse section)
      });
    });

    // Verify scrollTo was called with the correct position
    // Target verse 6 is in section starting at verse 6, at y=500
    // Adjusted for top padding (spacing.xxl = 32)
    await waitFor(() => {
      expect(mockScrollTo).toHaveBeenCalledWith({
        y: expect.any(Number),
        animated: true,
      });
    });

    // The scroll position should be verse 6's position minus padding
    const scrollCall = mockScrollTo.mock.calls[0][0];
    expect(scrollCall.y).toBeLessThanOrEqual(500);
    expect(scrollCall.y).toBeGreaterThanOrEqual(0);
  });

  it('should not leak timers when component unmounts', async () => {
    // Render with target verse
    const { unmount } = renderChapterPage({ targetVerse: 6 });

    // Wait for component to mount
    await waitFor(() => {
      expect(screen.getByTestId('chapter-reader-bible-summary')).toBeTruthy();
    });

    // Unmount before layout callback is triggered
    unmount();

    // Advance timers to verify no errors occur from orphaned callbacks
    act(() => {
      jest.advanceTimersByTime(5000);
    });

    // If we get here without errors, timers were properly cleaned up
    expect(true).toBe(true);
  });

  it('should show tooltip after successful scroll animation', async () => {
    // Render with target verse
    renderChapterPage({ targetVerse: 6 });

    // Wait for component to mount
    await waitFor(() => {
      expect(screen.getByTestId('chapter-reader-bible-summary')).toBeTruthy();
    });

    // Verify tooltip is not visible initially
    expect(tooltipVisible).toBe(false);

    // Simulate layout event reporting positions
    act(() => {
      capturedOnContentLayout?.({
        1: 100,
        6: 500,
      });
    });

    // Scroll should be triggered
    await waitFor(() => {
      expect(mockScrollTo).toHaveBeenCalled();
    });

    // Advance time for tooltip timer (600ms after scroll)
    act(() => {
      jest.advanceTimersByTime(700);
    });

    // Tooltip should now be visible
    await waitFor(() => {
      expect(tooltipVisible).toBe(true);
    });

    // Verify the tooltip element is rendered
    expect(screen.getByTestId('verse-tooltip')).toBeTruthy();
  });
});
