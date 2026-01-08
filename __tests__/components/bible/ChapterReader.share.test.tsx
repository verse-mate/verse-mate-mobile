/**
 * Tests for ChapterReader Share Functionality
 *
 * Focused tests for share button and share handler in ChapterReader component.
 * Tests cover critical behaviors without exhaustive edge case coverage.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { createMockBookmarksResult } from '@/__tests__/utils/mock-bookmarks';
import { ChapterReader } from '@/components/bible/ChapterReader';
import { useAuth } from '@/contexts/AuthContext';
import { BibleInteractionProvider } from '@/contexts/BibleInteractionContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ToastProvider } from '@/contexts/ToastContext';
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
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: jest.fn(({ children }) => children),
  SafeAreaView: jest.fn(({ children }) => children),
  useSafeAreaInsets: jest.fn(() => ({ top: 0, right: 0, bottom: 0, left: 0 })),
}));

// Mock functions
const mockUseBookmarks = useBookmarks as jest.MockedFunction<typeof useBookmarks>;
const mockUseHighlights = useHighlights as jest.MockedFunction<typeof useHighlights>;
const mockUseNotes = useNotes as jest.MockedFunction<typeof useNotes>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

// Create a test query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

// Mock environment variable
process.env.EXPO_PUBLIC_WEB_URL = 'https://app.versemate.org';

// Test wrapper with required providers
const TestWrapper: React.FC<{
  children: React.ReactNode;
  bookId: number;
  chapterNumber: number;
  bookName: string;
}> = ({ children, bookId, chapterNumber, bookName }) => (
  <SafeAreaProvider>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ToastProvider>
          <BibleInteractionProvider
            bookId={bookId}
            chapterNumber={chapterNumber}
            bookName={bookName}
          >
            {children}
          </BibleInteractionProvider>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </SafeAreaProvider>
);

describe('ChapterReader Share Functionality (removed)', () => {
  const mockChapter: ChapterContent = {
    bookId: 43,
    bookName: 'John',
    chapterNumber: 3,
    title: 'John 3',
    testament: 'NT',
    sections: [
      {
        subtitle: 'Jesus Teaches Nicodemus',
        startVerse: 1,
        endVerse: 21,
        verses: [
          { number: 1, verseNumber: 1, text: 'Now there was a Pharisee, a man named Nicodemus...' },
          { number: 2, verseNumber: 2, text: 'He came to Jesus at night and said...' },
        ],
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock authenticated user
    mockUseAuth.mockReturnValue({
      user: {
        id: 'test-user',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        is_admin: false,
        preferred_language: 'en',
        imageSrc: undefined,
        hasPassword: true,
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

    // Mock bookmarks
    mockUseBookmarks.mockReturnValue(createMockBookmarksResult());

    // Mock highlights
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

    // Mock notes
    mockUseNotes.mockReturnValue({
      notes: [],
      addNote: jest.fn().mockResolvedValue(undefined),
      updateNote: jest.fn().mockResolvedValue(undefined),
      deleteNote: jest.fn().mockResolvedValue(undefined),
      getNotesByChapter: jest.fn().mockReturnValue([]),
      hasNotes: jest.fn().mockReturnValue(false),
      refetchNotes: jest.fn(),
      isFetchingNotes: false,
      isAddingNote: false,
      isUpdatingNote: false,
      isDeletingNote: false,
    });
  });

  it('does not render share button in ChapterReader', () => {
    render(
      <TestWrapper
        bookId={mockChapter.bookId}
        chapterNumber={mockChapter.chapterNumber}
        bookName={mockChapter.bookName}
      >
        <ChapterReader chapter={mockChapter} activeTab="summary" />
      </TestWrapper>
    );

    // Share button has been removed per product decision
    expect(screen.queryByTestId('share-button')).toBeNull();
  });
  // Share-related behaviors are deprecated; remaining tests assert absence only.
});
