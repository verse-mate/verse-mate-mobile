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
jest.mock('@/hooks/bible', () => {
  const React = require('react');
  return {
    useActiveTab: jest.fn(),
    useActiveView: jest.fn(() => {
      const [activeView, setActiveView] = React.useState('bible');
      return { activeView, setActiveView, isLoading: false, error: null };
    }),
    useBookProgress: jest.fn(),
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
  });

  it('should default to bible view on mount', async () => {
    renderWithProviders(<ChapterScreen />);

    // Wait for component to load
    await waitFor(() => {
      expect(screen.queryByTestId('chapter-header')).toBeTruthy();
    });

    // Bible view icon should be gold (active)
    const bibleIcon = screen.queryByTestId('bible-view-icon');
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
    const explanationsIcon = screen.getByTestId('explanations-view-icon');
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
    const explanationsIcon = screen.getByTestId('explanations-view-icon');
    fireEvent.press(explanationsIcon);

    await waitFor(() => {
      expect(screen.queryByTestId('chapter-content-tabs')).toBeTruthy();
    });

    // Switch back to bible view
    const bibleIcon = screen.getByTestId('bible-view-icon');
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
    const explanationsIcon = screen.getByTestId('explanations-view-icon');
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
    const bibleIcon = screen.getByTestId('bible-view-icon');
    fireEvent.press(bibleIcon);

    await waitFor(() => {
      // Tabs should be hidden even though tab state is 'byline'
      expect(screen.queryByTestId('chapter-content-tabs')).toBeNull();
    });
  });
});
