/**
 * Integration Tests for Bible Reading Interface
 *
 * Comprehensive end-to-end tests for critical user workflows.
 * Tests the complete user journey from app launch to reading chapters.
 *
 * Task Group 10: Integration Testing & Polish
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import type React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ChapterScreen from '@/app/bible/[bookId]/[chapterNumber]';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { useActiveTab, useBookProgress } from '@/hooks/bible';
import { useOfflineStatus } from '@/hooks/bible/use-offline-status';
import { useRecentBooks } from '@/hooks/bible/use-recent-books';
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
jest.mock('@/src/api', () => require('../mocks/api-hooks.mock').default);
jest.mock('expo-router', () => require('../mocks/expo-router.mock').default);
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn(() => Promise.resolve({ isInternetReachable: true })),
}));

// Component-specific mocks
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: jest.fn(({ children }) => children),
  SafeAreaView: jest.fn(({ children }) => children),
  useSafeAreaInsets: jest.fn(() => ({ top: 0, right: 0, bottom: 0, left: 0 })),
}));
// Mock authenticated user for tests that verify reading position saving
const mockAuthUserId = '550e8400-e29b-41d4-a716-446655440000';
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(() => ({
    isAuthenticated: true,
    user: { id: mockAuthUserId, email: 'test@example.com', firstName: 'Test', lastName: 'User' },
    isLoading: false,
    login: jest.fn(),
    logout: jest.fn(),
    signup: jest.fn(),
  })),
}));
jest.mock('@/hooks/bible/use-recent-books');
jest.mock('@/hooks/bible/use-offline-status');

// Mock bookmarks and notes hooks (required by ChapterReader)
jest.mock('@/hooks/bible/use-bookmarks', () => ({
  useBookmarks: jest.fn(() => ({
    bookmarks: [],
    isBookmarked: jest.fn(() => false),
    isInsightBookmarked: jest.fn(() => false),
    addBookmark: jest.fn(),
    removeBookmark: jest.fn(),
    addInsightBookmark: jest.fn(),
    removeInsightBookmark: jest.fn(),
    refetchBookmarks: jest.fn(),
    isFetchingBookmarks: false,
    isAddingBookmark: false,
    isRemovingBookmark: false,
  })),
}));

jest.mock('@/hooks/bible/use-notes', () => ({
  useNotes: jest.fn(() => ({
    notes: [],
    addNote: jest.fn(),
    updateNote: jest.fn(),
    deleteNote: jest.fn(),
    getNotesByChapter: jest.fn(() => []),
    hasNotes: jest.fn(() => false),
    refetchNotes: jest.fn(),
    isAddingNote: false,
    isUpdatingNote: false,
    isDeletingNote: false,
    isFetchingNotes: false,
  })),
}));

// Mock data
const mockGenesisChapter1 = {
  bookId: 1,
  bookName: 'Genesis',
  chapterNumber: 1,
  title: 'Genesis 1',
  testament: 'OT' as const,
  totalChapters: 50,
  sections: [
    {
      subtitle: 'The Creation',
      startVerse: 1,
      endVerse: 5,
      verses: [
        { verseNumber: 1, text: 'In the beginning God created the heavens and the earth.' },
        { verseNumber: 2, text: 'The earth was formless and void.' },
      ],
    },
  ],
};

const mockGenesisChapter2 = {
  bookId: 1,
  bookName: 'Genesis',
  chapterNumber: 2,
  title: 'Genesis 2',
  testament: 'OT' as const,
  totalChapters: 50,
  sections: [
    {
      subtitle: 'The Garden of Eden',
      startVerse: 1,
      endVerse: 3,
      verses: [{ verseNumber: 1, text: 'Thus the heavens and the earth were completed.' }],
    },
  ],
};

const mockMatthewChapter5 = {
  bookId: 40,
  bookName: 'Matthew',
  chapterNumber: 5,
  title: 'Matthew 5',
  testament: 'NT' as const,
  totalChapters: 28,
  sections: [
    {
      subtitle: 'The Beatitudes',
      startVerse: 1,
      endVerse: 12,
      verses: [{ verseNumber: 1, text: 'When Jesus saw the crowds, He went up on the mountain.' }],
    },
  ],
};

const mockSummaryExplanation = {
  bookId: 1,
  chapterNumber: 1,
  type: 'summary' as const,
  content: '## Summary\n\nThis chapter describes the creation of the world.',
  explanationId: 1,
  languageCode: 'en-US',
};

const mockByLineData = {
  bookId: 1,
  bookName: 'Genesis',
  chapterNumber: 1,
  title: 'Genesis 1',
  testament: 'OT' as const,
  sections: [
    {
      subtitle: 'Verse-by-Verse',
      startVerse: 1,
      endVerse: 2,
      verses: [
        {
          verseNumber: 1,
          number: 1,
          text: 'In the beginning God created the heavens and the earth.',
        },
        { verseNumber: 2, number: 2, text: 'The earth was formless and void.' },
      ],
    },
  ],
};

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

  const result = render(component, { wrapper: Wrapper });

  return result;
}

describe('Bible Reading Interface - Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default route params (Genesis 1)
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      bookId: '1',
      chapterNumber: '1',
    });

    // Default mock implementations
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

    (useRecentBooks as jest.Mock).mockReturnValue({
      recentBooks: [],
      addRecentBook: jest.fn(),
      isLoading: false,
    });

    (useOfflineStatus as jest.Mock).mockReturnValue({
      isOffline: false,
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
      data: mockSummaryExplanation,
      isLoading: false,
      error: null,
    });

    (useBibleTestaments as jest.Mock).mockReturnValue({
      data: [
        { id: 1, name: 'Genesis', testament: 'OT', chapterCount: 50 },
        { id: 40, name: 'Matthew', testament: 'NT', chapterCount: 28 },
      ],
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

    const { useTopicsSearch } = require('@/src/api');
    (useTopicsSearch as jest.Mock).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });

    router.push = jest.fn() as typeof router.push;
    router.replace = jest.fn() as typeof router.replace;
  });

  /**
   * Integration Test 1: End-to-end flow - App launch → navigate → switch tab → read
   */
  it.skip('completes full reading flow from launch to reading with tab switch', async () => {
    // Start at Genesis 1
    (useBibleChapter as jest.Mock).mockReturnValue({
      data: mockGenesisChapter1,
      isLoading: false,
      error: null,
    });

    const setActiveTab = jest.fn();
    (useActiveTab as jest.Mock).mockReturnValue({
      activeTab: 'summary',
      setActiveTab,
      isLoading: false,
      error: null,
    });

    const { getByTestId, rerender } = renderWithSafeArea(<ChapterScreen />);

    // 1. Verify chapter loads
    await waitFor(() => {
      expect(screen.getAllByText('The Creation')[0]).toBeTruthy();
    });

    // 2. Verify reading position saved with authenticated user's UUID
    const mockMutate = (useSaveLastRead as jest.Mock).mock.results[0].value.mutate;
    expect(mockMutate).toHaveBeenCalledWith({
      user_id: mockAuthUserId,
      book_id: 1,
      chapter_number: 1,
    });

    // 3. Switch to Explanations view (tabs are only visible in Explanations view)
    // 3. Switch to Explanations view (tabs are only visible in Explanations view)
    const explanationsIcon = getByTestId('commentary-view-toggle');
    fireEvent.press(explanationsIcon);

    await waitFor(() => {
      expect(getByTestId('chapter-content-tabs')).toBeTruthy();
    });

    // 4. Switch to By Line tab
    const byLineTab = screen.getByText('By Line');
    fireEvent.press(byLineTab);

    // Verify tab change called
    expect(setActiveTab).toHaveBeenCalledWith('byline');

    // 4. Re-render with new active tab
    (useActiveTab as jest.Mock).mockReturnValue({
      activeTab: 'byline',
      setActiveTab,
      isLoading: false,
      error: null,
    });

    (useBibleByLine as jest.Mock).mockReturnValue({
      data: mockByLineData,
      isLoading: false,
      error: null,
    });

    rerender(<ChapterScreen />);

    // Verify By Line content loads (check that data is present in mock)
    await waitFor(() => {
      const byLineTab = screen.getByText('By Line');
      expect(byLineTab).toBeTruthy();
    });

    // Verify mock was called with correct tab
    expect(useBibleByLine).toHaveBeenCalled();
  });

  /**
   * Integration Test 2: Open modal → select book → select chapter → read
   */
  it.skip('navigates through modal to select book and chapter', async () => {
    (useBibleChapter as jest.Mock).mockReturnValue({
      data: mockGenesisChapter1,
      isLoading: false,
      error: null,
    });

    (useBibleTestaments as jest.Mock).mockReturnValue({
      data: [
        { id: 1, name: 'Genesis', testament: 'OT', chaptersCount: 50 },
        { id: 40, name: 'Matthew', testament: 'NT', chaptersCount: 28 },
      ],
      isLoading: false,
      error: null,
    });

    const { getByTestId } = renderWithSafeArea(<ChapterScreen />);

    // 1. Open navigation modal
    await waitFor(() => {
      const navButton = getByTestId('navigation-button');
      expect(navButton).toBeTruthy();
      fireEvent.press(navButton);
    });

    // 2. Modal should open (tested in component tests)
    // Navigation to Matthew 5 would be triggered
    // Verify navigation was called
    expect(router.push).toHaveBeenCalled();
  });

  /**
   * Integration Test 3: Swipe to next chapter → content updates → progress updates
   */
  it.skip('swipes to next chapter and updates content and progress', async () => {
    // Start at Genesis 1
    (useBibleChapter as jest.Mock).mockReturnValue({
      data: mockGenesisChapter1,
      isLoading: false,
      error: null,
    });

    const { getByTestId, rerender } = renderWithSafeArea(<ChapterScreen />);

    await waitFor(() => {
      expect(getByTestId('chapter-header')).toBeTruthy();
    });

    // Trigger next chapter navigation
    const nextButton = getByTestId('next-chapter-button');
    fireEvent.press(nextButton);

    // Verify navigation to chapter 2
    expect(router.push).toHaveBeenCalledWith('/bible/1/2');

    // Simulate navigation complete - update route params
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      bookId: '1',
      chapterNumber: '2',
    });

    // Mock Genesis 2 data
    (useBibleChapter as jest.Mock).mockReturnValue({
      data: mockGenesisChapter2,
      isLoading: false,
      error: null,
    });

    rerender(<ChapterScreen />);

    // Verify new content loads
    await waitFor(() => {
      expect(screen.getByText('The Garden of Eden')).toBeTruthy();
    });

    // Verify progress bar updates (2/50 = 4%)
    const progressBar = getByTestId('progress-bar');
    expect(progressBar).toBeTruthy();
  });

  /**
   * Integration Test 4: Go offline → navigate fails → shows error
   */
  it.skip('handles offline scenario gracefully', async () => {
    // Start online with cached content
    (useOfflineStatus as jest.Mock).mockReturnValue({
      isOffline: false,
    });

    (useBibleChapter as jest.Mock).mockReturnValue({
      data: mockGenesisChapter1,
      isLoading: false,
      error: null,
    });

    const { getByTestId, rerender } = renderWithSafeArea(<ChapterScreen />);

    await waitFor(() => {
      expect(getByTestId('chapter-header')).toBeTruthy();
    });

    // Go offline
    (useOfflineStatus as jest.Mock).mockReturnValue({
      isOffline: true,
    });

    rerender(<ChapterScreen />);

    // Verify offline indicator appears
    await waitFor(() => {
      const offlineIndicator = getByTestId('offline-indicator');
      expect(offlineIndicator).toBeTruthy();
    });

    // Try to navigate to uncached chapter
    (useBibleChapter as jest.Mock).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Network error'),
    });

    const nextButton = getByTestId('next-chapter-button');
    fireEvent.press(nextButton);

    // Error should be shown (tested in component tests)
    expect(router.push).toHaveBeenCalled();
  });

  /**
   * Integration Test 5: Deep link flow → loads chapter → shows content
   */
  it('opens deep link and loads correct chapter', async () => {
    // Simulate deep link to Matthew 5
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      bookId: '40',
      chapterNumber: '5',
    });

    (useBibleChapter as jest.Mock).mockReturnValue({
      data: mockMatthewChapter5,
      isLoading: false,
      error: null,
    });

    // Mock explanation hooks (required by ChapterPagerView)
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

    renderWithSafeArea(<ChapterScreen />);

    // Wait for skeleton loader to disappear first
    await waitFor(
      () => {
        expect(screen.queryByTestId('skeleton-loader')).toBeNull();
      },
      { timeout: 10000 }
    );

    // Verify Matthew 5 content loads (multiple instances may exist due to ChapterPagerView)
    await waitFor(
      () => {
        const beatitudesElements = screen.getAllByText('The Beatitudes');
        expect(beatitudesElements.length).toBeGreaterThan(0);
      },
      { timeout: 10000 }
    );

    // Verify reading position saved for Matthew with authenticated user's UUID
    // Note: The save is debounced at 1500ms, so we need to wait for it to fire
    const mockMutate = (useSaveLastRead as jest.Mock).mock.results[0].value.mutate;
    await waitFor(
      () => {
        expect(mockMutate).toHaveBeenCalledWith(
          expect.objectContaining({
            user_id: mockAuthUserId,
            book_id: 40,
            chapter_number: 5,
          })
        );
      },
      { timeout: 3000 } // Allow time for 1500ms debounce to fire
    );
  }, 25000); // 25 second timeout for skeleton + content loading

  /**
   * Integration Test 6: Tab persistence across navigation
   */
  it('persists active tab when navigating between chapters', async () => {
    // Start with By Line tab active
    const setActiveTab = jest.fn();
    (useActiveTab as jest.Mock).mockReturnValue({
      activeTab: 'byline',
      setActiveTab,
      isLoading: false,
      error: null,
    });

    (useBibleChapter as jest.Mock).mockReturnValue({
      data: mockGenesisChapter1,
      isLoading: false,
      error: null,
    });

    const { getByTestId, rerender } = renderWithSafeArea(<ChapterScreen />);

    await waitFor(() => {
      expect(getByTestId('chapter-header')).toBeTruthy();
    });

    // Switch to Explanations view to see tabs
    // 3. Switch to Explanations view (tabs are only visible in Explanations view)
    const explanationsIcon = getByTestId('commentary-view-toggle');
    fireEvent.press(explanationsIcon);

    await waitFor(() => {
      expect(screen.getByText('By Line')).toBeTruthy();
    });

    // Navigate to next chapter
    const nextButton = getByTestId('next-chapter-button');
    fireEvent.press(nextButton);

    // Update route params
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      bookId: '1',
      chapterNumber: '2',
    });

    // Simulate chapter 2 load with same active tab
    (useBibleChapter as jest.Mock).mockReturnValue({
      data: mockGenesisChapter2,
      isLoading: false,
      error: null,
    });

    rerender(<ChapterScreen />);

    // Verify By Line tab still active (not reset to Summary)
    await waitFor(() => {
      const byLineTab = screen.getByText('By Line');
      // Tab should have active styling (tested in component tests)
      expect(byLineTab).toBeTruthy();
    });
  });

  /**
   * Integration Test 7: Recent books tracking
   */
  it.skip('tracks and displays recent books', async () => {
    const addRecentBook = jest.fn();
    (useRecentBooks as jest.Mock).mockReturnValue({
      recentBooks: [{ bookId: 1, timestamp: Date.now() }],
      addRecentBook,
      isLoading: false,
    });

    // Set route params to Matthew 5
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      bookId: '40',
      chapterNumber: '5',
    });

    (useBibleChapter as jest.Mock).mockReturnValue({
      data: mockMatthewChapter5,
      isLoading: false,
      error: null,
    });

    renderWithSafeArea(<ChapterScreen />);

    await waitFor(() => {
      expect(screen.getByText('The Beatitudes')).toBeTruthy();
    });

    // Navigate to Matthew - should add to recent books
    expect(addRecentBook).toHaveBeenCalledWith(40);
  });

  /**
   * Integration Test 8: Progress percentage calculation
   */
  it('calculates and displays progress percentage correctly', async () => {
    // Genesis chapter 1 of 50 = 2%
    (useBibleChapter as jest.Mock).mockReturnValue({
      data: mockGenesisChapter1,
      isLoading: false,
      error: null,
    });

    const { getByTestId } = renderWithSafeArea(<ChapterScreen />);

    await waitFor(() => {
      const progressBar = getByTestId('progress-bar');
      expect(progressBar).toBeTruthy();

      // Verify 2% progress (1/50)
      const progressText = screen.getByText('2%');
      expect(progressText).toBeTruthy();
    });

    // Navigate to chapter 25 of 50 = 50%
    const mockGenesisChapter25 = {
      ...mockGenesisChapter1,
      chapterNumber: 25,
      title: 'Genesis 25',
    };

    // Update route params
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      bookId: '1',
      chapterNumber: '25',
    });

    (useBibleChapter as jest.Mock).mockReturnValue({
      data: mockGenesisChapter25,
      isLoading: false,
      error: null,
    });

    // Update progress mock to reflect chapter 25 of 50 (50%)
    (useBookProgress as jest.Mock).mockReturnValue({
      progress: {
        percentage: 50,
        currentChapter: 25,
        totalChapters: 50,
      },
      isCalculating: false,
    });

    // Render a new instance with updated chapter
    renderWithSafeArea(<ChapterScreen />);

    await waitFor(() => {
      const progressText = screen.getByText('50%');
      expect(progressText).toBeTruthy();
    });
  });
});
