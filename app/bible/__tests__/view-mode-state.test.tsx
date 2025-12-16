/**
 * View Mode State Tests
 *
 * Tests for activeView state management in ChapterScreen
 * - Default view is 'bible'
 * - Switching to 'explanations' updates state
 * - Switching back to 'bible' updates state
 * - View state is independent of tab state
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';
import type React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { useActiveTab, useActiveView, useBookProgress, useRecentBooks } from '@/hooks/bible';
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
import ChapterScreen from '../[bookId]/[chapterNumber]';

// Mock expo-router
jest.mock('expo-router', () => ({
  useLocalSearchParams: jest.fn(),
  router: {
    push: jest.fn(),
    replace: jest.fn(),
  },
}));

// Mock AuthContext
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(() => ({
    isAuthenticated: false,
    user: null,
    isLoading: false,
    login: jest.fn(),
    logout: jest.fn(),
    signup: jest.fn(),
  })),
}));

// Mock API hooks
jest.mock('@/src/api', () => ({
  useBibleChapter: jest.fn(),
  useSaveLastRead: jest.fn(),
  useBibleTestaments: jest.fn(),
  useBibleSummary: jest.fn(),
  useBibleByLine: jest.fn(),
  useBibleDetailed: jest.fn(),
  usePrefetchNextChapter: jest.fn(),
  usePrefetchPreviousChapter: jest.fn(),
  useTopicsSearch: jest.fn(),
}));

// Mock custom hooks from '@/hooks/bible'
jest.mock('@/hooks/bible', () => {
  const original = jest.requireActual('@/hooks/bible');
  return {
    ...original,
    useActiveTab: jest.fn(),
    useBookProgress: jest.fn(),
    useLastReadPosition: jest.fn(),
    useRecentBooks: jest.fn(),
  };
});

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
      verses: [{ verseNumber: 1, text: 'In the beginning God created the heavens and the earth.' }],
    },
  ],
};

// Mock book metadata
const mockBooksMetadata = [{ id: 1, name: 'Genesis', chapterCount: 50, testament: 'OT' as const }];

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

describe('ChapterScreen - View Mode State', () => {
  beforeEach(() => {
    jest.clearAllMocks();

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
      progress: { percentage: 2, currentChapter: 1, totalChapters: 50 },
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
  });

  it('should default to bible view on mount', async () => {
    renderWithProviders(<ChapterScreen />);

    // Wait for component to load
    await waitFor(() => {
      expect(screen.queryByTestId('chapter-header')).toBeTruthy();
    });

    // Bible view icon should be gold (active)
    const bibleIcon = screen.queryByTestId('bible-view-toggle');
    expect(bibleIcon).toBeTruthy();

    // Tabs should NOT be visible in bible view
    const tabs = screen.queryByTestId('chapter-content-tabs');
    expect(tabs).toBeNull();
  });

  it('should switch to explanations view when explanations icon is pressed', async () => {
    renderWithProviders(<ChapterScreen />);

    await waitFor(() => {
      expect(screen.queryByTestId('chapter-header')).toBeTruthy();
    });

    // Find and press explanations view icon
    const explanationsIcon = screen.getByTestId('commentary-view-toggle');
    fireEvent.press(explanationsIcon);

    // Wait for state update
    await waitFor(() => {
      // Tabs should now be visible
      expect(screen.queryByTestId('chapter-content-tabs')).toBeTruthy();
    });
  });

  it('should switch back to bible view when bible icon is pressed', async () => {
    renderWithProviders(<ChapterScreen />);

    await waitFor(() => {
      expect(screen.queryByTestId('chapter-header')).toBeTruthy();
    });

    // Switch to explanations first
    const explanationsIcon = screen.getByTestId('commentary-view-toggle');
    fireEvent.press(explanationsIcon);

    await waitFor(() => {
      expect(screen.queryByTestId('chapter-content-tabs')).toBeTruthy();
    });

    // Switch back to bible view
    const bibleIcon = screen.getByTestId('bible-view-toggle');
    fireEvent.press(bibleIcon);

    await waitFor(() => {
      // Tabs should be hidden again
      expect(screen.queryByTestId('chapter-content-tabs')).toBeNull();
    });
  });

  it('should maintain view state independent of tab state', async () => {
    renderWithProviders(<ChapterScreen />);

    await waitFor(() => {
      expect(screen.queryByTestId('chapter-header')).toBeTruthy();
    });

    // Switch to explanations
    const explanationsIcon = screen.getByTestId('commentary-view-toggle');
    fireEvent.press(explanationsIcon);

    await waitFor(() => {
      expect(screen.queryByTestId('chapter-content-tabs')).toBeTruthy();
    });

    // Change tab to 'byline'
    const bylineTab = screen.getByTestId('tab-byline');
    fireEvent.press(bylineTab);

    // View should still be 'explanations' (tabs still visible)
    expect(screen.queryByTestId('chapter-content-tabs')).toBeTruthy();

    // Switch back to bible view
    const bibleIcon = screen.getByTestId('bible-view-toggle');
    fireEvent.press(bibleIcon);

    await waitFor(() => {
      // Tabs should be hidden even though tab state is 'byline'
      expect(screen.queryByTestId('chapter-content-tabs')).toBeNull();
    });
  });
});
