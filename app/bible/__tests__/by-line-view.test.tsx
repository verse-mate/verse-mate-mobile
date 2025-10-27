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

  it.skip('should load By Line explanation content when in Explanations view with By Line tab active', async () => {
    // Mock the component to be in explanations view with byline tab
    (useActiveView as any).mockReturnValue({
      activeView: 'explanations',
      setActiveView: jest.fn(),
      isLoading: false,
      error: null,
    });

    (useActiveTab as jest.Mock).mockReturnValue({
      activeTab: 'byline',
      setActiveTab: jest.fn(),
      isLoading: false,
      error: null,
    });

    renderWithProviders(<ChapterScreen />);

    // Wait for component to render
    await waitFor(() => {
      expect(screen.queryByTestId('chapter-header')).toBeTruthy();
    });

    // Tabs should be visible in explanations view
    expect(screen.queryByTestId('chapter-content-tabs')).toBeTruthy();

    // By Line explanation content should be visible
    await waitFor(() => {
      // Use queryAllByText since PagerView renders multiple instances
      const matches = screen.queryAllByText(/Verse 1 Explanation/);
      expect(matches.length).toBeGreaterThan(0);
    });
  });

  it.skip('should show Bible verses in Bible view but not in Explanations By Line view', async () => {
    // Test 1: Bible view shows verses
    (useActiveView as any).mockReturnValue({
      activeView: 'bible',
      setActiveView: jest.fn(),
      isLoading: false,
      error: null,
    });

    const { unmount } = renderWithProviders(<ChapterScreen />);

    await waitFor(() => {
      expect(screen.queryByTestId('chapter-header')).toBeTruthy();
    });

    // In Bible view, verses should be visible (using queryAllByText for PagerView multiple pages)
    await waitFor(() => {
      const matches = screen.queryAllByText(/In the beginning God created/);
      expect(matches.length).toBeGreaterThan(0);
    });

    unmount();

    // Test 2: Explanations view with By Line tab does NOT show verses
    (useActiveView as any).mockReturnValue({
      activeView: 'explanations',
      setActiveView: jest.fn(),
      isLoading: false,
      error: null,
    });

    (useActiveTab as jest.Mock).mockReturnValue({
      activeTab: 'byline',
      setActiveTab: jest.fn(),
      isLoading: false,
      error: null,
    });

    renderWithProviders(<ChapterScreen />);

    await waitFor(() => {
      expect(screen.queryByTestId('chapter-header')).toBeTruthy();
    });

    // By Line explanation should be visible
    await waitFor(() => {
      const explanations = screen.queryAllByText(/Verse 1 Explanation/);
      expect(explanations.length).toBeGreaterThan(0);
    });

    // Bible verses should NOT be visible in explanations view
    expect(screen.queryByText(/In the beginning God created/)).toBeNull();
  });

  it.skip('should render different content for different tabs in Explanations view', async () => {
    // Test 1: Summary tab shows summary content
    (useActiveView as any).mockReturnValue({
      activeView: 'explanations',
      setActiveView: jest.fn(),
      isLoading: false,
      error: null,
    });

    (useActiveTab as jest.Mock).mockReturnValue({
      activeTab: 'summary',
      setActiveTab: jest.fn(),
      isLoading: false,
      error: null,
    });

    (useBibleSummary as jest.Mock).mockReturnValue({
      data: { content: 'Summary: Genesis 1 describes the creation of the world.' },
      isLoading: false,
      error: null,
    });

    const { unmount } = renderWithProviders(<ChapterScreen />);

    await waitFor(() => {
      expect(screen.queryByTestId('chapter-header')).toBeTruthy();
    });

    // Tabs should be visible
    expect(screen.queryByTestId('tab-summary')).toBeTruthy();

    // Should show summary content
    await waitFor(() => {
      const matches = screen.queryAllByText(/Summary: Genesis 1/);
      expect(matches.length).toBeGreaterThan(0);
    });

    unmount();

    // Test 2: By Line tab shows by-line content
    (useActiveTab as jest.Mock).mockReturnValue({
      activeTab: 'byline',
      setActiveTab: jest.fn(),
      isLoading: false,
      error: null,
    });

    renderWithProviders(<ChapterScreen />);

    await waitFor(() => {
      expect(screen.queryByTestId('chapter-header')).toBeTruthy();
    });

    // By Line content should be visible
    await waitFor(() => {
      const matches = screen.queryAllByText(/Verse 1 Explanation/);
      expect(matches.length).toBeGreaterThan(0);
    });

    // Summary content should not be visible
    expect(screen.queryByText(/Summary: Genesis 1/)).toBeNull();
  });
});
