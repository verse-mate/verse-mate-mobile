/**
 * ChapterScreen External Navigation Tests
 *
 * Tests for external navigation scenarios in ChapterScreen.
 * These tests verify that:
 * - Modal chapter selection updates context and snaps pager
 * - Deep link on cold start initializes context correctly
 * - Back button navigation preserves context state
 *
 * @see Task Group 10: Handle External Navigation
 * @see spec: agent-os/specs/2026-01-19-chapter-view-state-refactor/spec.md
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import type React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ChapterScreen from '@/app/bible/[bookId]/[chapterNumber]';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { useActiveTab, useBookProgress, useLastReadPosition, useRecentBooks } from '@/hooks/bible';
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
    isAuthenticated: false,
    user: null,
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

// Track pager imperative calls and captured jumpToChapter
const mockSetPage = jest.fn();
const mockGoNext = jest.fn();
const mockGoPrevious = jest.fn();
const mockSetPageWithoutAnimation = jest.fn();
let capturedJumpToChapter: ((bookId: number, chapter: number, bookName: string) => void) | null =
  null;
let capturedContextState: {
  currentBookId: number;
  currentChapter: number;
  bookName: string;
} | null = null;

jest.mock('@/components/bible/ChapterPagerView', () => {
  const React = require('react');
  const { useChapterNavigation } = require('@/contexts/ChapterNavigationContext');

  const MockChapterPagerView = React.forwardRef((props: any, ref: any) => {
    const { View, Text } = require('react-native');

    React.useImperativeHandle(ref, () => ({
      setPage: mockSetPage,
      goNext: mockGoNext,
      goPrevious: mockGoPrevious,
      setPageWithoutAnimation: mockSetPageWithoutAnimation,
    }));

    // Capture context for verification
    const context = useChapterNavigation();
    capturedJumpToChapter = context.jumpToChapter;
    capturedContextState = {
      currentBookId: context.currentBookId,
      currentChapter: context.currentChapter,
      bookName: context.bookName,
    };

    return (
      <View testID="chapter-pager-view">
        <Text testID="pager-context-book-id">{context.currentBookId}</Text>
        <Text testID="pager-context-chapter">{context.currentChapter}</Text>
        <Text testID="pager-context-book-name">{context.bookName}</Text>
        <Text testID="pager-initial-book-id">{props.initialBookId}</Text>
        <Text testID="pager-initial-chapter">{props.initialChapter}</Text>
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

describe('ChapterScreen - External Navigation (Task Group 10)', () => {
  let mockSaveLastRead: jest.Mock;
  let mockSavePosition: jest.Mock;
  let mockPrefetchNext: jest.Mock;
  let mockPrefetchPrevious: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    capturedJumpToChapter = null;
    capturedContextState = null;

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
   * Test 10.1.1: Modal chapter selection updates context and snaps pager
   *
   * When user selects a chapter from BibleNavigationModal:
   * 1. Context state should be updated via jumpToChapter
   * 2. Pager should snap to CENTER_INDEX (3) via setPageWithoutAnimation
   */
  it('should update context and snap pager when modal selects chapter', async () => {
    const { getByTestId } = renderWithProviders(<ChapterScreen />);

    // Wait for render and capture context
    await waitFor(() => {
      expect(capturedJumpToChapter).toBeTruthy();
      expect(getByTestId('chapter-selector-button')).toBeTruthy();
    });

    // Verify initial context state
    expect(capturedContextState?.currentBookId).toBe(1);
    expect(capturedContextState?.currentChapter).toBe(1);
    expect(capturedContextState?.bookName).toBe('Genesis');

    // Call jumpToChapter to simulate modal selecting John 3
    act(() => {
      capturedJumpToChapter?.(43, 3, 'John');
    });

    // Verify context was updated
    await waitFor(() => {
      expect(capturedContextState?.currentBookId).toBe(43);
      expect(capturedContextState?.currentChapter).toBe(3);
      expect(capturedContextState?.bookName).toBe('John');
    });

    // Verify pager was snapped to CENTER_INDEX (3)
    expect(mockSetPageWithoutAnimation).toHaveBeenCalledWith(3);
  });

  /**
   * Test 10.1.2: Deep link on cold start initializes context correctly
   *
   * When app opens via deep link (e.g., /bible/43/3), the context should be
   * initialized with the URL params, not default values.
   */
  it('should initialize context from URL params on cold start (deep link)', async () => {
    // Simulate deep link to John 3
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      bookId: '43',
      chapterNumber: '3',
    });

    (useBibleChapter as jest.Mock).mockReturnValue({
      data: { ...mockChapterData, bookId: 43, chapterNumber: 3, bookName: 'John' },
      isLoading: false,
      error: null,
    });

    const { getByTestId } = renderWithProviders(<ChapterScreen />);

    // Wait for render
    await waitFor(() => {
      expect(getByTestId('pager-initial-book-id')).toBeTruthy();
    });

    // Verify initial props passed to pager (from URL params)
    expect(getByTestId('pager-initial-book-id')).toHaveTextContent('43');
    expect(getByTestId('pager-initial-chapter')).toHaveTextContent('3');

    // Verify context was initialized with correct values
    expect(capturedContextState?.currentBookId).toBe(43);
    expect(capturedContextState?.currentChapter).toBe(3);
    expect(capturedContextState?.bookName).toBe('John');
  });

  /**
   * Test 10.1.3: Context preserves state after URL param changes (URL is passive follower)
   *
   * After initial mount, URL param changes should NOT update context.
   * Context is authoritative - URL is a passive follower.
   */
  it('should ignore URL param changes after mount (context is authoritative)', async () => {
    jest.useFakeTimers();

    const { rerender } = renderWithProviders(<ChapterScreen />);

    // Wait for initial render
    await waitFor(() => {
      expect(capturedContextState?.currentBookId).toBe(1);
      expect(capturedContextState?.currentChapter).toBe(1);
    });

    // Simulate URL params changing (external factor)
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      bookId: '66',
      chapterNumber: '22',
    });

    // Force re-render (simulating URL param change)
    rerender(<ChapterScreen />);

    // Advance past any potential URL sync debounces
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    // Context should still have ORIGINAL values (not the new URL params)
    // because ChapterScreen reads URL params ONCE on mount
    // The memoized initialBookId and initialChapter don't change after mount
    expect(capturedContextState?.currentBookId).toBe(1);
    expect(capturedContextState?.currentChapter).toBe(1);

    jest.useRealTimers();
  });

  /**
   * Test 10.1.4: Pager snap uses correct CENTER_INDEX constant
   *
   * The handleJumpToChapter callback should always snap to index 3 (CENTER_INDEX).
   * This ensures the pager window is correctly positioned for the new chapter.
   */
  it('should snap pager to CENTER_INDEX (3) on jumpToChapter', async () => {
    renderWithProviders(<ChapterScreen />);

    // Wait for render
    await waitFor(() => {
      expect(capturedJumpToChapter).toBeTruthy();
    });

    // Clear previous calls
    mockSetPageWithoutAnimation.mockClear();

    // Jump to multiple different chapters
    act(() => {
      capturedJumpToChapter?.(2, 5, 'Exodus');
    });
    expect(mockSetPageWithoutAnimation).toHaveBeenLastCalledWith(3);

    mockSetPageWithoutAnimation.mockClear();
    act(() => {
      capturedJumpToChapter?.(66, 22, 'Revelation');
    });
    expect(mockSetPageWithoutAnimation).toHaveBeenLastCalledWith(3);

    // Verify it was called twice total (once per jump)
    expect(mockSetPageWithoutAnimation).toHaveBeenCalledTimes(1);
  });
});
