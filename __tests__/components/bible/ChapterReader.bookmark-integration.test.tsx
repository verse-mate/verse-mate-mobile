/**
 * ChapterReader Bookmark Integration Tests (Task Group 4.1)
 *
 * Tests bookmark toggle integration in chapter reading screen.
 * Focused tests for critical bookmark behaviors only.
 *
 * Test coverage:
 * 1. Bookmark toggle renders in title row
 * 2. Bookmark toggle is pressable and not disabled
 * 3. Bookmark toggle is visible for unauthenticated users
 *
 * @see Task Group 4.1
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ChapterReader } from '@/components/bible/ChapterReader';
import { useAuth } from '@/contexts/AuthContext';
import { BibleInteractionProvider } from '@/contexts/BibleInteractionContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ToastProvider } from '@/contexts/ToastContext';
// Import mocked modules
import { useBookmarks } from '@/hooks/bible/use-bookmarks';
import { useHighlights } from '@/hooks/bible/use-highlights';
import { useNotes } from '@/hooks/bible/use-notes';
import type { ChapterContent } from '@/types/bible';

// Mock dependencies
jest.mock('@/hooks/bible/use-bookmarks');
jest.mock('@/hooks/bible/use-highlights');
jest.mock('@/hooks/bible/use-notes');
jest.mock('@/contexts/AuthContext');
jest.mock('expo-haptics');

// Mock Safe Area Context
jest.mock('react-native-safe-area-context', () => {
  return {
    SafeAreaProvider: jest.fn(({ children }) => children),
    SafeAreaView: jest.fn(({ children }) => children),
    useSafeAreaInsets: jest.fn(() => ({ top: 0, right: 0, bottom: 0, left: 0 })),
  };
});

// Mock functions
const mockUseBookmarks = useBookmarks as jest.MockedFunction<typeof useBookmarks>;
const mockUseHighlights = useHighlights as jest.MockedFunction<typeof useHighlights>;
const mockUseNotes = useNotes as jest.MockedFunction<typeof useNotes>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

// Sample chapter data for testing
const mockChapter: ChapterContent = {
  bookId: 1,
  bookName: 'Genesis',
  chapterNumber: 1,
  title: 'Genesis 1',
  testament: 'Old Testament',
  sections: [
    {
      subtitle: 'The Creation',
      startVerse: 1,
      endVerse: 31,
      verses: [
        {
          number: 1,
          verseNumber: 1,
          text: 'In the beginning God created the heavens and the earth.',
        },
        {
          number: 2,
          verseNumber: 2,
          text: 'The earth was formless and void, and darkness was over the surface of the deep, and the Spirit of God was moving over the surface of the waters.',
        },
      ],
    },
  ],
};

describe('ChapterReader - Bookmark Integration', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create a fresh QueryClient for each test
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    // Default mock: authenticated user
    mockUseAuth.mockReturnValue({
      user: {
        id: 'test-user-123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        is_admin: false,
        preferred_language: 'en',
      },
      isAuthenticated: true,
      isLoading: false,
      login: jest.fn(),
      signup: jest.fn(),
      logout: jest.fn(),
      loginWithSSO: jest.fn(),
      restoreSession: jest.fn(),
      refreshTokens: jest.fn(),
    });

    // Default mock: no bookmarks
    mockUseBookmarks.mockReturnValue({
      bookmarks: [],
      isBookmarked: jest.fn().mockReturnValue(false),
      addBookmark: jest.fn().mockResolvedValue(undefined),
      removeBookmark: jest.fn().mockResolvedValue(undefined),
      refetchBookmarks: jest.fn(),
      isFetchingBookmarks: false,
      isAddingBookmark: false,
      isRemovingBookmark: false,
    });

    // Default mock: no highlights
    mockUseHighlights.mockReturnValue({
      allHighlights: [],
      chapterHighlights: [],
      isHighlighted: jest.fn().mockReturnValue(false),
      addHighlight: jest.fn().mockResolvedValue(undefined),
      updateHighlightColor: jest.fn().mockResolvedValue(undefined),
      deleteHighlight: jest.fn().mockResolvedValue(undefined),
      refetchHighlights: jest.fn(),
      isFetchingHighlights: false,
      isAddingHighlight: false,
      isUpdatingHighlight: false,
      isDeletingHighlight: false,
    });

    // Default mock: notes hook
    mockUseNotes.mockReturnValue({
      notes: [],
      addNote: jest.fn().mockResolvedValue(undefined),
      updateNote: jest.fn().mockResolvedValue(undefined),
      deleteNote: jest.fn().mockResolvedValue(undefined),
      getNotesByChapter: jest.fn().mockReturnValue([]),
      hasNotes: jest.fn().mockReturnValue(false),
      refetchNotes: jest.fn(),
      isAddingNote: false,
      isUpdatingNote: false,
      isDeletingNote: false,
      isFetchingNotes: false,
    });
  });

  // Helper to wrap components with QueryClientProvider
  const renderWithProvider = (ui: ReactNode) => {
    return render(
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <ToastProvider>
              <BibleInteractionProvider
                bookId={mockChapter.bookId}
                chapterNumber={mockChapter.chapterNumber}
                bookName={mockChapter.bookName}
              >
                {ui}
              </BibleInteractionProvider>
            </ToastProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    );
  };

  // Test 1: Bookmark toggle renders in title row
  test('renders bookmark toggle in title row', () => {
    renderWithProvider(
      <ChapterReader chapter={mockChapter} activeTab="summary" explanationsOnly={false} />
    );

    // Check that bookmark toggle exists
    const bookmarkToggle = screen.getByTestId('bookmark-toggle-1-1');
    expect(bookmarkToggle).toBeTruthy();

    // Check that chapter title exists
    const chapterTitle = screen.getByText('Genesis 1');
    expect(chapterTitle).toBeTruthy();
  });

  // Test 2: Bookmark toggle is pressable and responds to press
  test('bookmark toggle is pressable and not disabled', () => {
    const { getByTestId } = renderWithProvider(
      <ChapterReader chapter={mockChapter} activeTab="summary" explanationsOnly={false} />
    );

    const bookmarkToggle = getByTestId('bookmark-toggle-1-1');

    // Verify bookmark toggle is not disabled
    expect(bookmarkToggle.props.disabled).toBeFalsy();

    // Verify bookmark toggle responds to press (no error thrown)
    expect(() => fireEvent.press(bookmarkToggle)).not.toThrow();
  });

  // Test 3: Bookmark toggle visible for unauthenticated users
  test('bookmark toggle is visible when user is not authenticated', () => {
    // Mock unauthenticated user
    mockUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      login: jest.fn(),
      signup: jest.fn(),
      logout: jest.fn(),
      loginWithSSO: jest.fn(),
      restoreSession: jest.fn(),
      refreshTokens: jest.fn(),
    });

    const { queryByTestId } = renderWithProvider(
      <ChapterReader chapter={mockChapter} activeTab="summary" explanationsOnly={false} />
    );

    // Bookmark toggle should be visible (navigates to bookmarks screen on press)
    const bookmarkToggle = queryByTestId('bookmark-toggle-1-1');
    expect(bookmarkToggle).toBeTruthy();
  });
});
