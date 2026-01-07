/**
 * Tests for Bible Chapter Screen - Circular FAB Navigation Behavior
 *
 * Tests that FAB buttons work correctly with circular navigation:
 * - Previous button navigates at Genesis 1 (no error haptic)
 * - Next button navigates at Revelation 22 (no error haptic)
 * - showPrevious and showNext props are always true
 * - Medium impact haptic for all navigation (never error notification)
 *
 * @see Spec: agent-os/specs/circular-bible-navigation/spec.md
 * @see Task Group 4: ChapterScreen FAB Behavior Updates
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams } from 'expo-router';
import type React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ChapterScreen from '@/app/bible/[bookId]/[chapterNumber]';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ToastProvider } from '@/contexts/ToastContext';
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
} from '@/src/api';

// Centralized mocks - see hooks/bible/__mocks__/index.ts and __tests__/mocks/
jest.mock('@/hooks/bible');
jest.mock('@/src/api', () => require('../../../mocks/api-hooks.mock').default);
jest.mock('expo-router', () => require('../../../mocks/expo-router.mock').default);
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

// Mock haptics - important for testing circular navigation behavior
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

// Mock ChapterPagerView to track ref usage
const mockSetPage = jest.fn();
const mockGoNext = jest.fn();
const mockGoPrevious = jest.fn();

jest.mock('@/components/bible/ChapterPagerView', () => {
  const React = require('react');

  const MockChapterPagerView = React.forwardRef((_props: any, ref: any) => {
    const { View, Text } = require('react-native');

    React.useImperativeHandle(ref, () => ({
      setPage: mockSetPage,
      goNext: mockGoNext,
      goPrevious: mockGoPrevious,
    }));

    return (
      <View testID="chapter-pager-view">
        <Text>Mock ChapterPagerView</Text>
      </View>
    );
  });

  MockChapterPagerView.displayName = 'ChapterPagerView';

  return {
    ChapterPagerView: MockChapterPagerView,
  };
});

// Mock chapter data for Genesis 1
const mockGenesisChapter1 = {
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

// Mock chapter data for Revelation 22
const mockRevelationChapter22 = {
  bookId: 66,
  bookName: 'Revelation',
  chapterNumber: 22,
  title: 'Revelation 22',
  testament: 'NT' as const,
  sections: [
    {
      subtitle: 'The River of Life',
      startVerse: 1,
      endVerse: 21,
      verses: [
        { verseNumber: 1, text: 'Then the angel showed me the river of the water of life.' },
      ],
    },
  ],
};

// Mock book metadata including Genesis and Revelation
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

describe('ChapterScreen - Circular FAB Navigation Behavior', () => {
  let mockSaveLastRead: jest.Mock;
  let mockPrefetchNext: jest.Mock;
  let mockPrefetchPrevious: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSaveLastRead = jest.fn();
    mockPrefetchNext = jest.fn();
    mockPrefetchPrevious = jest.fn();

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

    (usePrefetchNextChapter as jest.Mock).mockReturnValue(mockPrefetchNext);
    (usePrefetchPreviousChapter as jest.Mock).mockReturnValue(mockPrefetchPrevious);

    const { useTopicsSearch } = require('@/src/api');
    (useTopicsSearch as jest.Mock).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });
  });

  describe('FAB Previous button at Genesis 1 (Bible start)', () => {
    beforeEach(() => {
      (useLocalSearchParams as jest.Mock).mockReturnValue({
        bookId: '1',
        chapterNumber: '1',
      });

      (useBibleChapter as jest.Mock).mockReturnValue({
        data: mockGenesisChapter1,
        isLoading: false,
        error: null,
      });
    });

    it('should trigger navigation when Previous button is pressed at Genesis 1', async () => {
      const { getByTestId } = renderWithProviders(<ChapterScreen />);

      await waitFor(() => {
        const prevButton = getByTestId('previous-chapter-button');
        fireEvent.press(prevButton);
      });

      // With circular navigation, Previous button should trigger goPrevious
      expect(mockGoPrevious).toHaveBeenCalled();
    });

    it('should trigger medium haptic (not error) when Previous button is pressed at Genesis 1', async () => {
      const { getByTestId } = renderWithProviders(<ChapterScreen />);

      await waitFor(() => {
        const prevButton = getByTestId('previous-chapter-button');
        fireEvent.press(prevButton);
      });

      // Should trigger medium impact haptic for circular navigation
      expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Medium);
      // Should NOT trigger error notification haptic
      expect(Haptics.notificationAsync).not.toHaveBeenCalled();
    });

    it('should have Previous button enabled at Genesis 1 (showPrevious=true)', async () => {
      const { getByTestId } = renderWithProviders(<ChapterScreen />);

      await waitFor(() => {
        const prevButton = getByTestId('previous-chapter-button');
        // Button should be enabled (not disabled) for circular navigation
        expect(prevButton).not.toBeDisabled();
      });
    });
  });

  describe('FAB Next button at Revelation 22 (Bible end)', () => {
    beforeEach(() => {
      (useLocalSearchParams as jest.Mock).mockReturnValue({
        bookId: '66',
        chapterNumber: '22',
      });

      (useBibleChapter as jest.Mock).mockReturnValue({
        data: mockRevelationChapter22,
        isLoading: false,
        error: null,
      });
    });

    it('should trigger navigation when Next button is pressed at Revelation 22', async () => {
      const { getByTestId } = renderWithProviders(<ChapterScreen />);

      await waitFor(() => {
        const nextButton = getByTestId('next-chapter-button');
        fireEvent.press(nextButton);
      });

      // With circular navigation, Next button should trigger goNext
      expect(mockGoNext).toHaveBeenCalled();
    });

    it('should trigger medium haptic (not error) when Next button is pressed at Revelation 22', async () => {
      const { getByTestId } = renderWithProviders(<ChapterScreen />);

      await waitFor(() => {
        const nextButton = getByTestId('next-chapter-button');
        fireEvent.press(nextButton);
      });

      // Should trigger medium impact haptic for circular navigation
      expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Medium);
      // Should NOT trigger error notification haptic
      expect(Haptics.notificationAsync).not.toHaveBeenCalled();
    });

    it('should have Next button enabled at Revelation 22 (showNext=true)', async () => {
      const { getByTestId } = renderWithProviders(<ChapterScreen />);

      await waitFor(() => {
        const nextButton = getByTestId('next-chapter-button');
        // Button should be enabled (not disabled) for circular navigation
        expect(nextButton).not.toBeDisabled();
      });
    });
  });
});
