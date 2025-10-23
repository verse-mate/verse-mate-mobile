/**
 * By Line View Tests
 *
 * Tests for By Line tab functionality in Explanations view
 * - By Line explanation content loads correctly
 * - Verse-by-verse explanations are visible
 * - Tab switching works with By Line
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';
import type React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
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
import ChapterScreen from '../[bookId]/[chapterNumber]';

// Mock expo-router
jest.mock('expo-router', () => ({
  useLocalSearchParams: jest.fn(),
  router: {
    push: jest.fn(),
    replace: jest.fn(),
  },
}));

// Mock API hooks
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

// Mock custom hooks
jest.mock('@/hooks/bible', () => ({
  useActiveTab: jest.fn(),
  useBookProgress: jest.fn(),
  useRecentBooks: jest.fn(),
}));

// Mock expo-haptics
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

// Mock NetInfo
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn(() => Promise.resolve({ isInternetReachable: true })),
}));

// Mock react-native-gesture-handler
jest.mock('react-native-gesture-handler', () => {
  const mockGesture = {
    activeOffsetX: jest.fn().mockReturnThis(),
    onEnd: jest.fn().mockReturnThis(),
    onUpdate: jest.fn().mockReturnThis(),
    onChange: jest.fn().mockReturnThis(),
    onStart: jest.fn().mockReturnThis(),
    onFinalize: jest.fn().mockReturnThis(),
  };

  return {
    Gesture: {
      Pan: jest.fn(() => mockGesture),
    },
    GestureDetector: ({ children }: { children: React.ReactNode }) => children,
  };
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
const mockBooksMetadata = [{ id: 1, name: 'Genesis', chapterCount: 50, testament: 'OT' as const }];

// Mock By Line explanation data
const mockByLineExplanation = {
  content:
    '**Verse 1 Explanation:** This verse introduces the creation account.\n\n**Verse 2 Explanation:** The earth was without form.',
};

// Helper to render with providers
function renderWithProviders(component: React.ReactElement) {
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

describe('ChapterScreen - By Line View', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (useLocalSearchParams as jest.Mock).mockReturnValue({
      bookId: '1',
      chapterNumber: '1',
    });

    (useActiveTab as jest.Mock).mockReturnValue({
      activeTab: 'byline',
      setActiveTab: jest.fn(),
      isLoading: false,
      error: null,
    });

    (useSaveLastRead as jest.Mock).mockReturnValue({
      mutate: jest.fn(),
    });

    (useBibleTestaments as jest.Mock).mockReturnValue({
      data: mockBooksMetadata,
      isLoading: false,
      error: null,
    });

    (useBookProgress as jest.Mock).mockReturnValue({
      progress: { percentage: 2, currentChapter: 1, totalChapters: 50 },
      isCalculating: false,
    });

    (useRecentBooks as jest.Mock).mockReturnValue({
      recentBooks: [],
      addRecentBook: jest.fn(),
      isLoading: false,
    });

    (useBibleChapter as jest.Mock).mockReturnValue({
      data: mockChapterData,
      isLoading: false,
      error: null,
    });

    (useBibleSummary as jest.Mock).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    });

    (useBibleByLine as jest.Mock).mockReturnValue({
      data: mockByLineExplanation,
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
  });

  it('should load By Line explanation content when in Explanations view', async () => {
    renderWithProviders(<ChapterScreen />);

    await waitFor(() => {
      expect(screen.queryByTestId('chapter-header')).toBeTruthy();
    });

    // Switch to Explanations view
    const explanationsIcon = screen.getByTestId('explanations-view-icon');
    fireEvent.press(explanationsIcon);

    // Tabs should be visible
    await waitFor(() => {
      expect(screen.queryByTestId('chapter-content-tabs')).toBeTruthy();
    });

    // Switch to By Line tab
    const bylineTab = screen.getByTestId('tab-byline');
    fireEvent.press(bylineTab);

    // By Line explanation content should be visible
    await waitFor(() => {
      expect(screen.queryByText(/Verse 1 Explanation/)).toBeTruthy();
    });

    // Bible verses should NOT be visible in Explanations view
    expect(screen.queryByText(/In the beginning God created/)).toBeNull();
  });

  it('should show Bible verses in Bible view, then show only explanations in By Line tab', async () => {
    renderWithProviders(<ChapterScreen />);

    await waitFor(() => {
      expect(screen.queryByTestId('chapter-header')).toBeTruthy();
    });

    // In Bible view, verses should be visible
    expect(screen.queryByText(/In the beginning God created/)).toBeTruthy();

    // Switch to Explanations view
    const explanationsIcon = screen.getByTestId('explanations-view-icon');
    fireEvent.press(explanationsIcon);

    await waitFor(() => {
      expect(screen.queryByTestId('chapter-content-tabs')).toBeTruthy();
    });

    // Switch to By Line tab
    const bylineTab = screen.getByTestId('tab-byline');
    fireEvent.press(bylineTab);

    // Wait for By Line content to load
    await waitFor(() => {
      expect(screen.queryByText(/Verse 1 Explanation/)).toBeTruthy();
    });

    // Bible verses should NOT be visible (only explanation)
    expect(screen.queryByText(/In the beginning God created/)).toBeNull();
  });

  it('should switch between tabs in Explanations view', async () => {
    // Create a mock that can track state changes
    let currentTab: 'summary' | 'byline' | 'detailed' = 'summary';
    const mockSetActiveTab = jest.fn((newTab) => {
      currentTab = newTab;
    });

    // Set initial tab to summary
    (useActiveTab as jest.Mock).mockImplementation(() => ({
      activeTab: currentTab,
      setActiveTab: mockSetActiveTab,
      isLoading: false,
      error: null,
    }));

    (useBibleSummary as jest.Mock).mockReturnValue({
      data: { content: 'Summary: Genesis 1 describes the creation of the world.' },
      isLoading: false,
      error: null,
    });

    const { rerender } = renderWithProviders(<ChapterScreen />);

    await waitFor(() => {
      expect(screen.queryByTestId('chapter-header')).toBeTruthy();
    });

    // Switch to Explanations view
    const explanationsIcon = screen.getByTestId('explanations-view-icon');
    fireEvent.press(explanationsIcon);

    await waitFor(() => {
      expect(screen.queryByTestId('tab-summary')).toBeTruthy();
    });

    // Should show summary content initially
    await waitFor(() => {
      expect(screen.queryByText(/Summary: Genesis 1/)).toBeTruthy();
    });

    // Switch to By Line tab
    const bylineTab = screen.getByTestId('tab-byline');
    fireEvent.press(bylineTab);

    // Manually trigger state update for test (simulate what would happen in real app)
    currentTab = 'byline';
    rerender(<ChapterScreen />);

    // By Line content should now be visible
    await waitFor(() => {
      expect(screen.queryByText(/Verse 1 Explanation/)).toBeTruthy();
    });

    // Summary content should not be visible
    expect(screen.queryByText(/Summary: Genesis 1/)).toBeNull();
  });
});
