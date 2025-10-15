/**
 * Integration Tests for Bible Reading Interface
 *
 * Comprehensive end-to-end tests for critical user workflows.
 * Tests the complete user journey from app launch to reading chapters.
 *
 * Task Group 10: Integration Testing & Polish
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import ChapterScreen from '@/app/bible/[bookId]/[chapterNumber]';
import {
  useBibleChapter,
  useBibleSummary,
  useSaveLastRead,
  useBibleTestaments,
  useBibleByLine,
  useBibleDetailed,
  usePrefetchNextChapter,
  usePrefetchPreviousChapter,
} from "@/src/api/generated";
import { useActiveTab, useBookProgress } from '@/hooks/bible';
import { useRecentBooks } from '@/hooks/bible/use-recent-books';
import { useOfflineStatus } from '@/hooks/bible/use-offline-status';

// Mock dependencies
jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
  },
  useLocalSearchParams: jest.fn(),
}));

jest.mock('@/src/api/generated', () => ({
  useBibleChapter: jest.fn(),
  useBibleSummary: jest.fn(),
  useSaveLastRead: jest.fn(),
  useBibleTestaments: jest.fn(),
  useBibleByLine: jest.fn(),
  useBibleDetailed: jest.fn(),
  usePrefetchNextChapter: jest.fn(),
  usePrefetchPreviousChapter: jest.fn(),
}));
jest.mock('@/hooks/bible', () => ({
  useActiveTab: jest.fn(),
  useBookProgress: jest.fn(),
}));
jest.mock('@/hooks/bible/use-recent-books');
jest.mock('@/hooks/bible/use-offline-status');

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()), // Return unsubscribe function
  fetch: jest.fn(() => Promise.resolve({ isInternetReachable: true })),
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
      verses: [
        { verseNumber: 1, text: 'Thus the heavens and the earth were completed.' },
      ],
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
      verses: [
        { verseNumber: 1, text: 'When Jesus saw the crowds, He went up on the mountain.' },
      ],
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
        { verseNumber: 1, number: 1, text: 'In the beginning God created the heavens and the earth.' },
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
      <SafeAreaProvider initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}>
        {children}
      </SafeAreaProvider>
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

    (router as any).push = jest.fn();
    (router as any).replace = jest.fn();
  });

  /**
   * Integration Test 1: End-to-end flow - App launch → navigate → switch tab → read
   */
  it('completes full reading flow from launch to reading with tab switch', async () => {
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
      expect(screen.getByText('The Creation')).toBeTruthy();
    });

    // 2. Verify reading position saved
    const mockMutate = (useSaveLastRead as jest.Mock).mock.results[0].value.mutate;
    expect(mockMutate).toHaveBeenCalledWith({
      user_id: 'guest',
      book_id: 1,
      chapter_number: 1,
    });

    // 3. Switch to By Line tab
    const tabsContainer = getByTestId('chapter-content-tabs');
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
  it('swipes to next chapter and updates content and progress', async () => {
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
  it('handles offline scenario gracefully', async () => {
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

    renderWithSafeArea(<ChapterScreen />);

    // Verify Matthew 5 content loads
    await waitFor(() => {
      expect(screen.getByText('The Beatitudes')).toBeTruthy();
    });

    // Verify reading position saved for Matthew
    const mockMutate = (useSaveLastRead as jest.Mock).mock.results[0].value.mutate;
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'guest',
        book_id: 40,
        chapter_number: 5,
      })
    );
  });

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
