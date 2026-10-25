/**
 * Scrolling an Insight tab must not move the Bible pane's paragraph window.
 *
 * Reported from the App Store build (iPad, reproducible on a phone): "sometimes when I go from
 * insight back to bible - it is black until I scroll. Then it lights up." The Bible reader renders
 * only the paragraphs near its own scroll position and draws exact-height placeholders for the
 * rest. That position reaches it as `visibleYRange`, and the Insight tabs' scroll handler wrote the
 * same state — so a few screens of By Line scrolling told the Bible reader it was looking a few
 * screens down, and on returning every paragraph near the top was a placeholder until the Bible
 * pane itself scrolled. "Sometimes", because past the end of the chapter's text the reader falls
 * back to drawing its first screen.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ChapterPage } from '@/components/bible/ChapterPage';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { useBibleByLine, useBibleChapter, useBibleSummary } from '@/src/api';

// Mock the Bible hooks
jest.mock('@/src/api/hooks', () => ({
  useBibleChapter: jest.fn(),
  useBibleSummary: jest.fn(),
  useBibleByLine: jest.fn(),
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

// Mock NetInfo so useOfflineStatus (now called inside TabContent for VER-39) can
// initialise without hitting the real native module. Mirrors the stub used in
// the other Bible-tree tests (chapterNumber.test.tsx, topic-swipe-integration.test.tsx).
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn(() => Promise.resolve({ isInternetReachable: true })),
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
  // A probe in place of the reader: prints the scroll range the reader would window against. Only the
  // Bible pane is wrapped in TextVisibilityContext, so the Insight copy always reads null here.
  ChapterReader: ({ explanationsOnly }: { explanationsOnly?: boolean }) => {
    const { Text } = require('react-native');
    const { useTextVisibility } = require('@/contexts/TextVisibilityContext');
    const { visibleYRange } = useTextVisibility();
    return (
      <Text testID={explanationsOnly ? 'reader-range-insight' : 'reader-range-bible'}>
        {visibleYRange ? `range:${visibleYRange.startY}` : 'range:none'}
      </Text>
    );
  },
}));

jest.mock('@/components/bible/StudyPanel', () => ({
  StudyPanel: () => {
    const { Text } = require('react-native');
    return <Text testID="study-panel">StudyPanel</Text>;
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

const CHAPTER = {
  bookId: 40,
  chapterNumber: 25,
  bookName: 'Matthew',
  title: 'Matthew 25',
  sections: [
    {
      startVerse: 1,
      endVerse: 2,
      subtitle: null,
      verses: [
        { verseNumber: 1, text: 'Then the kingdom of heaven will be comparable to ten virgins.' },
        { verseNumber: 2, text: 'Five of them were foolish, and five were prudent.' },
      ],
    },
  ],
};

function renderPage(activeView: 'bible' | 'explanations') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <ToastProvider>
            <ChapterPage
              bookId={40}
              chapterNumber={25}
              activeTab="byline"
              activeView={activeView}
            />
          </ToastProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

const scrollEvent = (y: number) => ({
  nativeEvent: {
    contentOffset: { x: 0, y },
    contentSize: { width: 400, height: 20000 },
    layoutMeasurement: { width: 400, height: 900 },
  },
});

describe('ChapterPage — Insight scroll vs the Bible window', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockUseBibleChapter.mockReturnValue({
      data: CHAPTER,
      isLoading: false,
      isPlaceholderData: false,
      error: null,
      isError: false,
      isSuccess: true,
    } as any);
    mockUseBibleSummary.mockReturnValue({ data: null, isLoading: false, error: null } as any);
    mockUseBibleByLine.mockReturnValue({
      data: { content: '# By Line\n\n## Matthew 25:1\n\nText.' },
      isLoading: false,
      error: null,
    } as any);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('leaves the Bible reader on its own position when By Line scrolls', () => {
    renderPage('explanations');
    // Insight panes mount in stages after the chapter settles.
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(screen.getByTestId('reader-range-bible').props.children).toBe('range:none');

    const byLine = screen.getByTestId('chapter-page-scroll-40-25-byline');
    fireEvent.scroll(byLine, scrollEvent(2400));
    // Past the 150ms debounce the old handler used before publishing the range.
    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(screen.getByTestId('reader-range-bible').props.children).toBe('range:none');
  });
});
