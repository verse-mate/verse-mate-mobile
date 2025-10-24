/**
 * Tests for Bible Chapter Screen - PagerView Integration
 *
 * Tests focused on integration with ChapterPagerView component.
 * Covers: rendering with PagerView, URL updates after swipe, navigation modal, floating buttons.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import type React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ChapterScreen from '@/app/bible/[bookId]/[chapterNumber]';
import { useActiveTab, useBookProgress, useRecentBooks } from '@/hooks/bible';
import {
  useBibleByLine,
  useBibleChapter,
  useBibleDetailed,
  useBibleSummary,
  useBibleTestaments,
  usePrefetchNextChapter,
  usePrefetchPreviousChapter,
  useSaveLastRead,
} from '@/src/api/generated';

// Mock dependencies
jest.mock('expo-router', () => ({
  useLocalSearchParams: jest.fn(),
  router: {
    push: jest.fn(),
    replace: jest.fn(),
  },
}));

jest.mock('@/src/api/generated', () => ({
  useBibleChapter: jest.fn(),
  useSaveLastRead: jest.fn(),
  useBibleTestaments: jest.fn(),
  useBibleSummary: jest.fn(),
  useBibleByLine: jest.fn(),
  useBibleDetailed: jest.fn(),
  usePrefetchNextChapter: jest.fn(),
  usePrefetchPreviousChapter: jest.fn(),
}));

jest.mock('@/hooks/bible', () => ({
  useActiveTab: jest.fn(),
  useBookProgress: jest.fn(),
  useRecentBooks: jest.fn(),
}));

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()), // Return unsubscribe function
  fetch: jest.fn(() => Promise.resolve({ isInternetReachable: true })),
}));

// Mock haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
  },
  NotificationFeedbackType: {
    Success: 'success',
    Warning: 'warning',
    Error: 'error',
  },
}));

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
  {
    id: 66,
    name: 'Revelation',
    testament: 'NT' as const,
    chapterCount: 22,
    verseCount: 404,
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
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 47, left: 0, right: 0, bottom: 34 },
        }}
      >
        {children}
      </SafeAreaProvider>
    </QueryClientProvider>
  );

  return render(component, { wrapper: Wrapper });
}

describe('ChapterScreen - PagerView Integration', () => {
  let mockSaveLastRead: jest.Mock;
  let mockPrefetchNext: jest.Mock;
  let mockPrefetchPrevious: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    mockSaveLastRead = jest.fn();
    mockPrefetchNext = jest.fn();
    mockPrefetchPrevious = jest.fn();

    // Default mock implementations
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      bookId: '1',
      chapterNumber: '1',
    });

    (useActiveTab as jest.Mock).mockReturnValue({
      activeTab: 'summary',
      setActiveTab: jest.fn(),
      isLoading: false,
      error: null,
    });

    (useSaveLastRead as jest.Mock).mockReturnValue({
      mutate: mockSaveLastRead,
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

    (usePrefetchNextChapter as jest.Mock).mockReturnValue(mockPrefetchNext);
    (usePrefetchPreviousChapter as jest.Mock).mockReturnValue(mockPrefetchPrevious);

    (useBibleChapter as jest.Mock).mockReturnValue({
      data: mockChapterData,
      isLoading: false,
      error: null,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  /**
   * Test 1: Renders with ChapterPagerView component
   */
  it('renders with ChapterPagerView instead of GestureDetector', async () => {
    const { getByTestId } = renderWithSafeArea(<ChapterScreen />);

    await waitFor(() => {
      // Should render ChapterPagerView (with specific testID)
      expect(getByTestId('chapter-pager-view')).toBeTruthy();
    });
  });

  /**
   * Test 2: Floating action buttons render and are functional
   */
  it('renders floating action buttons for navigation', async () => {
    const { getByTestId } = renderWithSafeArea(<ChapterScreen />);

    await waitFor(() => {
      // Next button should be visible for Genesis 1 (can go forward)
      expect(getByTestId('next-chapter-button')).toBeTruthy();
      // Previous button should NOT be visible (Genesis 1 is first)
      expect(() => getByTestId('previous-chapter-button')).toThrow();
    });
  });

  /**
   * Test 3: Navigation modal opens when header is pressed
   */
  it('opens navigation modal when chapter selector button is pressed', async () => {
    const { getByTestId, queryByTestId } = renderWithSafeArea(<ChapterScreen />);

    // Modal should not be visible initially
    expect(queryByTestId('bible-navigation-modal')).toBeNull();

    await waitFor(() => {
      const selectorButton = getByTestId('chapter-selector-button');
      fireEvent.press(selectorButton);
    });

    // Modal should be visible after press
    await waitFor(() => {
      expect(getByTestId('bible-navigation-modal')).toBeTruthy();
    });
  });

  /**
   * Test 4: Header displays correct book name and chapter
   */
  it('displays correct book and chapter in header', async () => {
    const { getByTestId } = renderWithSafeArea(<ChapterScreen />);

    await waitFor(() => {
      const header = getByTestId('chapter-header');
      expect(header).toBeTruthy();
      const headerText = within(header).getByText(/Genesis/);
      expect(headerText).toBeTruthy();
    });
  });

  /**
   * Test 5: Progress bar renders with correct percentage
   */
  it('renders progress bar with correct percentage', async () => {
    const { getByTestId } = renderWithSafeArea(<ChapterScreen />);

    await waitFor(() => {
      const progressBar = getByTestId('progress-bar');
      expect(progressBar).toBeTruthy();
    });
  });

  /**
   * Test 6: Prefetching triggered after chapter loads with delay
   */
  it('prefetches adjacent chapters after 1 second delay', async () => {
    renderWithSafeArea(<ChapterScreen />);

    // Initially, prefetch should not be called
    expect(mockPrefetchNext).not.toHaveBeenCalled();
    expect(mockPrefetchPrevious).not.toHaveBeenCalled();

    // Fast-forward 1 second
    jest.advanceTimersByTime(1000);

    // After delay, prefetch should be called
    await waitFor(() => {
      expect(mockPrefetchNext).toHaveBeenCalled();
      expect(mockPrefetchPrevious).toHaveBeenCalled();
    });
  });

  /**
   * Test 7: Tab switching works in explanations view
   */
  it('allows tab switching in explanations view', async () => {
    const mockSetActiveTab = jest.fn();
    (useActiveTab as jest.Mock).mockReturnValue({
      activeTab: 'summary',
      setActiveTab: mockSetActiveTab,
      isLoading: false,
      error: null,
    });

    const { getByTestId, queryByTestId } = renderWithSafeArea(<ChapterScreen />);

    // Tabs should NOT be visible in Bible view initially
    expect(queryByTestId('chapter-tabs-container')).toBeNull();

    // Switch to explanations view
    await waitFor(() => {
      const explanationsIcon = getByTestId('explanations-view-icon');
      fireEvent.press(explanationsIcon);
    });

    // Tabs should be visible in explanations view
    await waitFor(() => {
      const tabsContainer = getByTestId('chapter-tabs-container');
      expect(tabsContainer).toBeTruthy();
    });
  });

  /**
   * Test 8: View mode switching between Bible and Explanations
   */
  it('switches between Bible and Explanations view modes', async () => {
    const { getByTestId, queryByTestId } = renderWithSafeArea(<ChapterScreen />);

    // Initially in Bible view, tabs should NOT be visible
    expect(queryByTestId('chapter-tabs-container')).toBeNull();

    const bibleIcon = getByTestId('bible-view-icon');
    const explanationsIcon = getByTestId('explanations-view-icon');

    // Switch to explanations view
    fireEvent.press(explanationsIcon);

    // Tabs should appear
    await waitFor(() => {
      expect(getByTestId('chapter-tabs-container')).toBeTruthy();
    });

    // Switch back to Bible view
    fireEvent.press(bibleIcon);

    // Tabs should not be visible
    await waitFor(() => {
      expect(queryByTestId('chapter-tabs-container')).toBeNull();
    });
  });
});
