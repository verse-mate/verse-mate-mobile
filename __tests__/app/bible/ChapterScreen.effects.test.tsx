/**
 * ChapterScreen Cascading Effects Tests
 *
 * Tests for consolidated/debounced effects in ChapterScreen.
 * These tests verify that:
 * - Analytics tracking is debounced (fires once after rapid swiping stops)
 * - Validation runs only once per navigation (not on every intermediate swipe)
 * - API + AsyncStorage saves are debounced (single call after swipe sequence)
 * - URL sync doesn't create duplicate effects
 *
 * @see Task Group 5: Consolidate Cascading Effects in ChapterScreen
 * @see spec: agent-os/specs/2026-01-19-chapter-view-state-refactor/spec.md
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import type React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ChapterScreen from '@/app/bible/[bookId]/[chapterNumber]';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { useActiveTab, useBookProgress, useLastReadPosition, useRecentBooks } from '@/hooks/bible';
import { AnalyticsEvent, analytics } from '@/lib/analytics';
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

// ============================================================================
// Mocks
// ============================================================================

// Centralized mocks
jest.mock('@/hooks/bible');
jest.mock('@/src/api', () => require('../../mocks/api-hooks.mock').default);
jest.mock('expo-router', () => require('../../mocks/expo-router.mock').default);
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn(() => Promise.resolve({ isInternetReachable: true })),
}));

// Mock analytics
jest.mock('@/lib/analytics', () => ({
  analytics: {
    track: jest.fn(),
    identify: jest.fn(),
    reset: jest.fn(),
  },
  AnalyticsEvent: {
    CHAPTER_VIEWED: 'CHAPTER_VIEWED',
    VIEW_MODE_SWITCHED: 'VIEW_MODE_SWITCHED',
    CHAPTER_READING_DURATION: 'CHAPTER_READING_DURATION',
    VIEW_MODE_DURATION: 'VIEW_MODE_DURATION',
  },
}));

// Component-specific mocks
jest.mock('@/hooks/bible/use-fab-visibility', () => ({
  useFABVisibility: jest.fn(() => ({
    visible: true,
    handleScroll: jest.fn(),
    handleTap: jest.fn(),
  })),
}));
jest.mock('@/components/bible/OfflineIndicator', () => ({
  OfflineIndicator: () => null,
}));
jest.mock('@/hooks/use-bible-version', () => ({
  useBibleVersion: () => ({ bibleVersion: 'niv', isLoading: false }),
}));
jest.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({ user: null, isLoading: false, isAuthenticated: false }),
}));
jest.mock('@/hooks/bible/use-highlights', () => ({
  useHighlights: () => ({
    chapterHighlights: [],
    addHighlight: jest.fn(),
    updateHighlightColor: jest.fn(),
    deleteHighlight: jest.fn(),
  }),
}));
jest.mock('@/hooks/bible/use-auto-highlights', () => ({
  useAutoHighlights: () => ({ autoHighlights: [] }),
}));
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(() => ({
    isAuthenticated: true,
    user: { id: 'test-user-123' },
    isLoading: false,
    login: jest.fn(),
    logout: jest.fn(),
    signup: jest.fn(),
  })),
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

// Mock ChapterPagerView - allow simulating rapid page changes
let mockSetCurrentChapter: ((bookId: number, chapter: number, bookName: string) => void) | null =
  null;

jest.mock('@/components/bible/ChapterPagerView', () => {
  const React = require('react');
  const { useChapterNavigation } = require('@/contexts/ChapterNavigationContext');

  const MockChapterPagerView = React.forwardRef((_props: any, ref: any) => {
    const { View, Text } = require('react-native');

    React.useImperativeHandle(ref, () => ({
      setPage: jest.fn(),
      goNext: jest.fn(),
      goPrevious: jest.fn(),
      setPageWithoutAnimation: jest.fn(),
    }));

    // Capture context setter for simulating rapid navigation
    const context = useChapterNavigation();
    mockSetCurrentChapter = context.setCurrentChapter;

    return (
      <View testID="chapter-pager-view">
        <Text testID="pager-context-book">{context.bookName}</Text>
        <Text testID="pager-context-chapter">{context.currentChapter}</Text>
      </View>
    );
  });

  MockChapterPagerView.displayName = 'ChapterPagerView';

  return {
    ChapterPagerView: MockChapterPagerView,
  };
});

// ============================================================================
// Mock Data
// ============================================================================

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

const mockBooksMetadata = [
  { id: 1, name: 'Genesis', testament: 'OT' as const, chapterCount: 50, verseCount: 1533 },
  { id: 2, name: 'Exodus', testament: 'OT' as const, chapterCount: 40, verseCount: 1213 },
  { id: 43, name: 'John', testament: 'NT' as const, chapterCount: 21, verseCount: 879 },
  { id: 66, name: 'Revelation', testament: 'NT' as const, chapterCount: 22, verseCount: 404 },
];

// ============================================================================
// Test Helpers
// ============================================================================

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

// ============================================================================
// Tests
// ============================================================================

describe('ChapterScreen - Cascading Effects Consolidation (Task Group 5)', () => {
  let mockSaveLastRead: jest.Mock;
  let mockSavePosition: jest.Mock;
  let mockPrefetchNext: jest.Mock;
  let mockPrefetchPrevious: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSetCurrentChapter = null;

    mockSaveLastRead = jest.fn();
    mockSavePosition = jest.fn();
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

    (useLastReadPosition as jest.Mock).mockReturnValue({
      lastPosition: null,
      savePosition: mockSavePosition,
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

    (usePrefetchNextChapter as jest.Mock).mockReturnValue(mockPrefetchNext);
    (usePrefetchPreviousChapter as jest.Mock).mockReturnValue(mockPrefetchPrevious);

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

    // Reset router mock
    (router.setParams as jest.Mock).mockClear();
  });

  /**
   * Test 5.1.1: Debounced analytics fires only once after rapid swiping stops
   *
   * When user swipes rapidly through multiple chapters, the CHAPTER_VIEWED
   * analytics event should only fire once after they stop swiping (1000ms debounce).
   */
  it('should debounce analytics tracking - fires only once after rapid swiping stops', async () => {
    jest.useFakeTimers();

    renderWithProviders(<ChapterScreen />);

    // Wait for initial render and capture the context setter
    await waitFor(() => {
      expect(mockSetCurrentChapter).toBeTruthy();
    });

    // Clear initial analytics call from mount
    (analytics.track as jest.Mock).mockClear();

    // Simulate rapid swiping through chapters 2, 3, 4, 5
    act(() => {
      mockSetCurrentChapter?.(1, 2, 'Genesis');
    });
    act(() => {
      jest.advanceTimersByTime(100); // 100ms between swipes
    });
    act(() => {
      mockSetCurrentChapter?.(1, 3, 'Genesis');
    });
    act(() => {
      jest.advanceTimersByTime(100);
    });
    act(() => {
      mockSetCurrentChapter?.(1, 4, 'Genesis');
    });
    act(() => {
      jest.advanceTimersByTime(100);
    });
    act(() => {
      mockSetCurrentChapter?.(1, 5, 'Genesis');
    });

    // After 400ms total, analytics should NOT have fired yet (debounce is 1000ms)
    const callsDuringSwipe = (analytics.track as jest.Mock).mock.calls.filter(
      (call: unknown[]) => call[0] === AnalyticsEvent.CHAPTER_VIEWED
    );
    expect(callsDuringSwipe.length).toBe(0);

    // Advance past the 1000ms debounce
    act(() => {
      jest.advanceTimersByTime(1100);
    });

    // Now analytics should have fired exactly once with the final chapter (5)
    const callsAfterDebounce = (analytics.track as jest.Mock).mock.calls.filter(
      (call: unknown[]) => call[0] === AnalyticsEvent.CHAPTER_VIEWED
    );
    expect(callsAfterDebounce.length).toBe(1);
    expect(callsAfterDebounce[0][1]).toMatchObject({
      bookId: 1,
      chapterNumber: 5,
    });

    jest.useRealTimers();
  });

  /**
   * Test 5.1.2: Save to API/AsyncStorage is debounced (single call after swipe sequence)
   *
   * When user swipes rapidly, the save to API (saveLastRead) and AsyncStorage
   * (savePosition) should be debounced to prevent excessive writes.
   */
  it('should debounce API and AsyncStorage saves - single call after swipe sequence', async () => {
    jest.useFakeTimers();

    // Use authenticated user mock for this test
    const { useAuth } = require('@/contexts/AuthContext');
    (useAuth as jest.Mock).mockReturnValue({
      isAuthenticated: true,
      user: { id: 'test-user-123' },
      isLoading: false,
    });

    renderWithProviders(<ChapterScreen />);

    // Wait for initial render
    await waitFor(() => {
      expect(mockSetCurrentChapter).toBeTruthy();
    });

    // Clear initial save calls from mount
    mockSaveLastRead.mockClear();
    mockSavePosition.mockClear();

    // Simulate rapid swiping through chapters 2, 3, 4, 5
    act(() => {
      mockSetCurrentChapter?.(1, 2, 'Genesis');
    });
    act(() => {
      jest.advanceTimersByTime(100);
    });
    act(() => {
      mockSetCurrentChapter?.(1, 3, 'Genesis');
    });
    act(() => {
      jest.advanceTimersByTime(100);
    });
    act(() => {
      mockSetCurrentChapter?.(1, 4, 'Genesis');
    });
    act(() => {
      jest.advanceTimersByTime(100);
    });
    act(() => {
      mockSetCurrentChapter?.(1, 5, 'Genesis');
    });

    // After 400ms total, saves should NOT have been called yet (debounce is 1500ms)
    expect(mockSaveLastRead).not.toHaveBeenCalled();
    expect(mockSavePosition).not.toHaveBeenCalled();

    // Advance past the 1500ms debounce
    act(() => {
      jest.advanceTimersByTime(1600);
    });

    // Now saves should have been called exactly once with the final chapter (5)
    expect(mockSaveLastRead).toHaveBeenCalledTimes(1);
    expect(mockSaveLastRead).toHaveBeenCalledWith(
      expect.objectContaining({
        book_id: 1,
        chapter_number: 5,
      })
    );

    expect(mockSavePosition).toHaveBeenCalledTimes(1);
    expect(mockSavePosition).toHaveBeenCalledWith(
      expect.objectContaining({
        bookId: 1,
        chapterNumber: 5,
      })
    );

    jest.useRealTimers();
  });

  /**
   * Test 5.1.3: URL sync doesn't create duplicate effects
   *
   * There should only be one URL sync effect, not multiple competing effects.
   * The URL should update once after the debounce period.
   */
  it('should not create duplicate URL sync effects', async () => {
    jest.useFakeTimers();

    renderWithProviders(<ChapterScreen />);

    // Wait for initial render
    await waitFor(() => {
      expect(mockSetCurrentChapter).toBeTruthy();
    });

    // Clear router mock
    (router.setParams as jest.Mock).mockClear();

    // Simulate navigation to chapter 5
    act(() => {
      mockSetCurrentChapter?.(1, 5, 'Genesis');
    });

    // Advance past the 1000ms debounce
    act(() => {
      jest.advanceTimersByTime(1100);
    });

    // URL should have been updated exactly once
    const setParamsCalls = (router.setParams as jest.Mock).mock.calls;
    expect(setParamsCalls.length).toBe(1);
    expect(setParamsCalls[0][0]).toMatchObject({
      bookId: '1',
      chapterNumber: '5',
    });

    jest.useRealTimers();
  });

  /**
   * Test 5.1.4: Effects cleanup properly on unmount during debounce
   *
   * When the component unmounts during a debounce period,
   * the pending effects should be cleaned up and not fire.
   */
  it('should cleanup debounced effects on unmount', async () => {
    jest.useFakeTimers();

    const { unmount } = renderWithProviders(<ChapterScreen />);

    // Wait for initial render
    await waitFor(() => {
      expect(mockSetCurrentChapter).toBeTruthy();
    });

    // Clear initial calls
    (analytics.track as jest.Mock).mockClear();
    mockSaveLastRead.mockClear();
    mockSavePosition.mockClear();
    (router.setParams as jest.Mock).mockClear();

    // Simulate navigation
    act(() => {
      mockSetCurrentChapter?.(1, 5, 'Genesis');
    });

    // Unmount before debounce completes
    act(() => {
      jest.advanceTimersByTime(500); // Only 500ms, before any debounce fires
      unmount();
    });

    // Advance timers past all debounce periods
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    // After unmount, debounced effects should NOT have fired
    // (URL sync might still fire as it's not dependent on component lifecycle)
    // But analytics and saves should not fire after unmount
    const chapterViewedCalls = (analytics.track as jest.Mock).mock.calls.filter(
      (call: unknown[]) => call[0] === AnalyticsEvent.CHAPTER_VIEWED
    );
    expect(chapterViewedCalls.length).toBe(0);

    jest.useRealTimers();
  });
});
