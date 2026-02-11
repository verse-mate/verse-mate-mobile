/**
 * Tests for Bible Chapter Screen
 *
 * Focused tests for the main chapter reading interface.
 * Tests core functionality: rendering, loading states, reading position persistence.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import type React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ChapterScreen from '@/app/bible/[bookId]/[chapterNumber]';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ToastProvider } from '@/contexts/ToastContext';
import {
  useActiveTab,
  useActiveView,
  useBookProgress,
  useChapterState,
  useRecentBooks,
} from '@/hooks/bible';
import {
  useBibleByLine,
  useBibleChapter,
  useBibleDetailed,
  useBibleSummary,
  useBibleTestaments,
  usePrefetchNextChapter,
  usePrefetchPreviousChapter,
  useSaveLastRead,
} from '@/src/api';

// Centralized mocks - see hooks/bible/__mocks__/index.ts and __tests__/mocks/
jest.mock('@/hooks/bible');
jest.mock('@/src/api', () => require('../../mocks/api-hooks.mock').default);
jest.mock('expo-router', () => require('../../mocks/expo-router.mock').default);
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn(() => Promise.resolve({ isInternetReachable: true })),
}));

// Component-specific mocks
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
const mockUseAuth = jest.fn<
  {
    isAuthenticated: boolean;
    user: { id: string; email: string; firstName: string; lastName: string } | null;
    isLoading: boolean;
    login: jest.Mock;
    logout: jest.Mock;
    signup: jest.Mock;
  },
  []
>(() => ({
  isAuthenticated: false,
  user: null,
  isLoading: false,
  login: jest.fn(),
  logout: jest.fn(),
  signup: jest.fn(),
}));
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

// Add Gesture.Simultaneous polyfill before tests
beforeAll(() => {
  const { Gesture } = require('react-native-gesture-handler');
  if (!Gesture.Simultaneous) {
    Gesture.Simultaneous = (...gestures: any[]) => gestures[0];
  }
});

// Mock chapter data
const mockChapterData = {
  bookId: 1,
  bookName: 'Genesis',
  chapterNumber: 1,
  title: 'Genesis 1',
  testament: 'OT' as const,
  sections: [
    {
      subtitle: 'The Creation',
      startVerse: 1,
      endVerse: 31,
      verses: [
        { verseNumber: 1, text: 'In the beginning God created the heavens and the earth.' },
        { verseNumber: 2, text: 'The earth was formless and void.' },
      ],
    },
  ],
};

// Mock book metadata
const mockBooksMetadata = [
  {
    id: 1,
    name: 'Genesis',
    testament: 'OT' as const,
    chapterCount: 50,
    verseCount: 1533,
  },
  {
    id: 2,
    name: 'Exodus',
    testament: 'OT' as const,
    chapterCount: 40,
    verseCount: 1213,
  },
];

// Helper to render with SafeAreaProvider and QueryClientProvider
function renderWithSafeArea(component: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <SafeAreaProvider
          initialMetrics={{
            frame: { x: 0, y: 0, width: 390, height: 844 },
            insets: { top: 47, left: 0, right: 0, bottom: 34 },
          }}
        >
          <ToastProvider>{children}</ToastProvider>
        </SafeAreaProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );

  return render(component, { wrapper: Wrapper });
}

describe('ChapterScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementations
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      bookId: '1',
      chapterNumber: '1',
    });

    // V3: useChapterState is the single source of truth for navigation
    (useChapterState as jest.Mock).mockReturnValue({
      bookId: 1,
      chapterNumber: 1,
      bookName: 'Genesis',
      navigateToChapter: jest.fn(),
      booksMetadata: mockBooksMetadata,
      totalChapters: 50,
    });

    (useActiveTab as jest.Mock).mockReturnValue({
      activeTab: 'summary',
      setActiveTab: jest.fn(),
      isLoading: false,
      error: null,
    });

    // useActiveView uses stateful mock defined in jest.mock above

    (useSaveLastRead as jest.Mock).mockReturnValue({
      mutate: jest.fn(),
    });

    (useBibleTestaments as jest.Mock).mockReturnValue({
      data: mockBooksMetadata,
      isLoading: false,
      error: null,
    });

    (useBookProgress as jest.Mock).mockReturnValue({
      progress: {
        percentage: 2,
        currentChapter: 1,
        totalChapters: 50,
      },
      isCalculating: false,
    });

    (useRecentBooks as jest.Mock).mockReturnValue({
      recentBooks: [],
      addRecentBook: jest.fn(),
      isLoading: false,
    });

    // Mock useLastReadPosition
    const { useLastReadPosition } = require('@/hooks/bible');
    (useLastReadPosition as jest.Mock).mockReturnValue({
      lastPosition: null,
      savePosition: jest.fn(),
      clearPosition: jest.fn(),
      isLoading: false,
      error: null,
    });

    (useBibleSummary as jest.Mock).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    });

    (useBibleByLine as jest.Mock).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    });

    (useBibleDetailed as jest.Mock).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    });

    (usePrefetchNextChapter as jest.Mock).mockReturnValue(jest.fn());
    (usePrefetchPreviousChapter as jest.Mock).mockReturnValue(jest.fn());

    (useBibleChapter as jest.Mock).mockReturnValue({
      data: mockChapterData,
      isLoading: false,
      error: null,
    });

    const { useTopicsSearch } = require('@/src/api');
    (useTopicsSearch as jest.Mock).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });
  });

  /**
   * Test 1: Screen renders with valid bookId/chapter params
   */
  it('renders chapter screen with valid params', async () => {
    (useBibleChapter as jest.Mock).mockReturnValue({
      data: mockChapterData,
      isLoading: false,
      error: null,
    });

    const { getByTestId } = renderWithSafeArea(<ChapterScreen />);

    await waitFor(() => {
      expect(getByTestId('chapter-header')).toBeTruthy();
      expect(screen.getAllByText('The Creation')[0]).toBeTruthy();
    });
  });

  /**
   * Test 2: Skeleton loader shows while loading
   */
  it('shows skeleton loader while loading chapter', () => {
    (useBibleChapter as jest.Mock).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });

    const { getByTestId } = renderWithSafeArea(<ChapterScreen />);

    expect(getByTestId('skeleton-loader')).toBeTruthy();
  });

  /**
   * Test 3: Chapter content displays after load
   */
  it('displays chapter content after loading completes', async () => {
    (useBibleChapter as jest.Mock).mockReturnValue({
      data: mockChapterData,
      isLoading: false,
      error: null,
    });

    renderWithSafeArea(<ChapterScreen />);

    await waitFor(() => {
      // Scroll view should be visible (using dynamic testID from ChapterPage)
      // Use getAllByTestId because PagerView renders multiple pages
      expect(screen.getAllByTestId('chapter-page-scroll-1-1-bible')[0]).toBeTruthy();
      // Section subtitle should be visible
      expect(screen.getAllByText('The Creation')[0]).toBeTruthy();
    });
  });

  /**
   * Test 4: Save reading position called on mount for authenticated users
   */
  it('calls save reading position on mount when user is authenticated', () => {
    const mockUserId = '550e8400-e29b-41d4-a716-446655440000';
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      user: { id: mockUserId, email: 'test@example.com', firstName: 'Test', lastName: 'User' },
      isLoading: false,
      login: jest.fn(),
      logout: jest.fn(),
      signup: jest.fn(),
    });

    const mockMutate = jest.fn();
    (useSaveLastRead as jest.Mock).mockReturnValue({
      mutate: mockMutate,
    });

    (useBibleChapter as jest.Mock).mockReturnValue({
      data: mockChapterData,
      isLoading: false,
      error: null,
    });

    renderWithSafeArea(<ChapterScreen />);

    // Verify save position was called with user's UUID
    expect(mockMutate).toHaveBeenCalledWith({
      user_id: mockUserId,
      book_id: 1,
      chapter_number: 1,
    });
  });

  /**
   * Test 4b: Save reading position NOT called for unauthenticated users
   */
  it('does not call save reading position when user is not authenticated', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      user: null,
      isLoading: false,
      login: jest.fn(),
      logout: jest.fn(),
      signup: jest.fn(),
    });

    const mockMutate = jest.fn();
    (useSaveLastRead as jest.Mock).mockReturnValue({
      mutate: mockMutate,
    });

    (useBibleChapter as jest.Mock).mockReturnValue({
      data: mockChapterData,
      isLoading: false,
      error: null,
    });

    renderWithSafeArea(<ChapterScreen />);

    // Verify save position was NOT called for unauthenticated user
    expect(mockMutate).not.toHaveBeenCalled();
  });

  /**
   * Test 5: Invalid bookId is handled by useChapterState (hook clamps to Genesis 1)
   */
  it('renders Genesis 1 when useChapterState clamps invalid bookId', () => {
    // useChapterState handles validation internally and returns clamped values
    (useChapterState as jest.Mock).mockReturnValue({
      bookId: 1,
      chapterNumber: 1,
      bookName: 'Genesis',
      navigateToChapter: jest.fn(),
      booksMetadata: mockBooksMetadata,
      totalChapters: 50,
    });

    (useBibleChapter as jest.Mock).mockReturnValue({
      data: mockChapterData,
      isLoading: false,
      error: null,
    });

    const { getByTestId } = renderWithSafeArea(<ChapterScreen />);

    // Should render Genesis 1 (hook already clamped the invalid bookId)
    expect(getByTestId('chapter-header')).toBeTruthy();
  });

  /**
   * Test 6: Header displays book and chapter title
   */
  it('displays header with book and chapter title', async () => {
    (useBibleChapter as jest.Mock).mockReturnValue({
      data: mockChapterData,
      isLoading: false,
      error: null,
    });

    const { getByTestId } = renderWithSafeArea(<ChapterScreen />);

    await waitFor(() => {
      const header = getByTestId('chapter-header');
      expect(header).toBeTruthy();
      // Use within to query only inside the header
      const headerText = within(header).getByText(/Genesis/);
      expect(headerText).toBeTruthy();
    });
  });
});
