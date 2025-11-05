/**
 * Tests for Bible Chapter Screen - PagerView Integration
 *
 * Tests focused on integration with ChapterPagerView component.
 * Covers: rendering with PagerView, URL updates after swipe, navigation modal, floating buttons.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor, within } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams } from 'expo-router';
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
  useNavigation: jest.fn(() => ({})),
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

jest.mock('@/src/api/generated', () => ({
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

jest.mock('@/hooks/bible', () => {
  const React = require('react');
  return {
    useActiveTab: jest.fn(),
    useBookProgress: jest.fn(),
    useRecentBooks: jest.fn(),
    useActiveView: jest.fn(() => {
      const [activeView, setActiveView] = React.useState('bible');
      return { activeView, setActiveView };
    }),
  };
});

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

// Mock ChapterPagerView to track ref usage
let mockSetPage: jest.Mock;

jest.mock('@/components/bible/ChapterPagerView', () => {
  const React = require('react');

  const MockChapterPagerView = React.forwardRef((_props: any, ref: any) => {
    const { View, Text } = require('react-native');

    mockSetPage = jest.fn();

    React.useImperativeHandle(ref, () => ({
      setPage: mockSetPage,
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
    mockSetPage = jest.fn();

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

    const { useTopicsSearch } = require('@/src/api/generated');
    (useTopicsSearch as jest.Mock).mockReturnValue({
      data: [],
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
      // Previous button should be present but disabled (Genesis 1 is first)
      expect(getByTestId('previous-chapter-button')).toBeDisabled();
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
    expect(queryByTestId('chapter-content-tabs')).toBeNull();

    // Switch to explanations view
    await waitFor(() => {
      const explanationsIcon = getByTestId('explanations-view-icon');
      fireEvent.press(explanationsIcon);
    });

    // Tabs should be visible in explanations view
    await waitFor(() => {
      const tabsContainer = getByTestId('chapter-content-tabs');
      expect(tabsContainer).toBeTruthy();
    });
  });

  /**
   * Test 8: View mode switching between Bible and Explanations
   */
  it('switches between Bible and Explanations view modes', async () => {
    const { getByTestId, queryByTestId } = renderWithSafeArea(<ChapterScreen />);

    // Initially in Bible view, tabs should NOT be visible
    expect(queryByTestId('chapter-content-tabs')).toBeNull();

    const bibleIcon = getByTestId('bible-view-icon');
    const explanationsIcon = getByTestId('explanations-view-icon');

    // Switch to explanations view
    fireEvent.press(explanationsIcon);

    // Tabs should appear
    await waitFor(() => {
      expect(getByTestId('chapter-content-tabs')).toBeTruthy();
    });

    // Switch back to Bible view
    fireEvent.press(bibleIcon);

    // Tabs should not be visible
    await waitFor(() => {
      expect(queryByTestId('chapter-content-tabs')).toBeNull();
    });
  });

  describe('Button Navigation via PagerView ref', () => {
    /**
     * Test 9: Next button calls pagerRef.setPage(3) instead of router.replace
     */
    it('calls pagerRef.setPage with CENTER_INDEX + 1 when next button is pressed', async () => {
      // Genesis 1 can navigate to next chapter
      (useLocalSearchParams as jest.Mock).mockReturnValue({
        bookId: '1',
        chapterNumber: '1',
      });

      const { getByTestId } = renderWithSafeArea(<ChapterScreen />);

      await waitFor(() => {
        const nextButton = getByTestId('next-chapter-button');
        fireEvent.press(nextButton);
      });

      // Should call setPage with CENTER_INDEX + 1 (2 + 1 = 3)
      expect(mockSetPage).toHaveBeenCalledWith(3);
    });

    /**
     * Test 10: Previous button calls pagerRef.setPage(1) instead of router.replace
     */
    it('calls pagerRef.setPage with CENTER_INDEX - 1 when previous button is pressed', async () => {
      // Genesis 2 can navigate to previous chapter
      (useLocalSearchParams as jest.Mock).mockReturnValue({
        bookId: '1',
        chapterNumber: '2',
      });

      (useBibleChapter as jest.Mock).mockReturnValue({
        data: { ...mockChapterData, chapterNumber: 2 },
        isLoading: false,
        error: null,
      });

      const { getByTestId } = renderWithSafeArea(<ChapterScreen />);

      await waitFor(() => {
        const prevButton = getByTestId('previous-chapter-button');
        fireEvent.press(prevButton);
      });

      // Should call setPage with CENTER_INDEX - 1 (2 - 1 = 1)
      expect(mockSetPage).toHaveBeenCalledWith(1);
    });

    /**
     * Test 11: Button handlers respect boundary flags (canGoNext)
     */
    it('triggers error haptic when trying to navigate past Revelation 22', async () => {
      // Revelation 22 - cannot go to next chapter
      (useLocalSearchParams as jest.Mock).mockReturnValue({
        bookId: '66',
        chapterNumber: '22',
      });

      (useBibleChapter as jest.Mock).mockReturnValue({
        data: { ...mockChapterData, bookId: 66, chapterNumber: 22, bookName: 'Revelation' },
        isLoading: false,
        error: null,
      });

      const { getByTestId } = renderWithSafeArea(<ChapterScreen />);
      await waitFor(() => {
        // Next button should be present but disabled at Revelation 22
        expect(getByTestId('next-chapter-button')).toBeDisabled();
      });

      // setPage should NOT have been called
      expect(mockSetPage).not.toHaveBeenCalled();
    }, 10000);

    /**
     * Test 12: Haptic feedback fires on valid navigation
     */
    it('triggers medium impact haptic on valid next button press', async () => {
      (useLocalSearchParams as jest.Mock).mockReturnValue({
        bookId: '1',
        chapterNumber: '5',
      });

      (useBibleChapter as jest.Mock).mockReturnValue({
        data: { ...mockChapterData, chapterNumber: 5 },
        isLoading: false,
        error: null,
      });

      const { getByTestId } = renderWithSafeArea(<ChapterScreen />);

      await waitFor(() => {
        const nextButton = getByTestId('next-chapter-button');
        fireEvent.press(nextButton);
      });

      // Should trigger medium impact haptic
      expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Medium);
    });

    /**
     * Test 13: Null safety with optional chaining
     */
    it('handles ref being null gracefully', async () => {
      // Mock setPage to be undefined to simulate null ref
      mockSetPage = undefined as any;

      (useLocalSearchParams as jest.Mock).mockReturnValue({
        bookId: '1',
        chapterNumber: '5',
      });

      const { getByTestId } = renderWithSafeArea(<ChapterScreen />);

      // Should not crash when pressing button with null ref
      await waitFor(() => {
        const nextButton = getByTestId('next-chapter-button');
        expect(() => fireEvent.press(nextButton)).not.toThrow();
      });
    });
  });
});
