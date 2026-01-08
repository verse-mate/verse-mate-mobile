/**
 * Integration Tests for Topic Swipe Navigation
 *
 * Tests for the refactored TopicDetailScreen with TopicPagerView integration.
 * Covers: swipe navigation, FAB buttons, edge behavior, and route updates.
 *
 * @see app/topics/[topicId].tsx
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams } from 'expo-router';
import type React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import TopicDetailScreen from '@/app/topics/[topicId]';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { useActiveTab, useLastReadPosition } from '@/hooks/bible';
import { useAllTopics, useTopicById, useTopicReferences, useTopicsSearch } from '@/src/api';

// Mock dependencies
jest.mock('expo-router', () => ({
  useNavigation: jest.fn(() => ({})),
  useLocalSearchParams: jest.fn(),
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(() => true),
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

jest.mock('@/src/api', () => ({
  useTopicById: jest.fn(),
  useTopicReferences: jest.fn(),
  useTopicsSearch: jest.fn(),
  useAllTopics: jest.fn(),
}));

jest.mock('@/hooks/bible', () => {
  const React = require('react');
  return {
    useActiveTab: jest.fn(),
    useLastReadPosition: jest.fn(),
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

// Mock TopicPagerView to track ref usage
const mockSetPage = jest.fn();
const mockGoNext = jest.fn();
const mockGoPrevious = jest.fn();

// Center index constant from TopicPagerView (7-page window)
const _CENTER_INDEX = 3;

jest.mock('@/components/topics/TopicPagerView', () => {
  const React = require('react');

  const MockTopicPagerView = React.forwardRef((_props: any, ref: any) => {
    const { View, Text } = require('react-native');

    React.useImperativeHandle(ref, () => ({
      setPage: mockSetPage,
      goNext: mockGoNext,
      goPrevious: mockGoPrevious,
    }));

    return (
      <View testID="topic-pager-view">
        <Text>Mock TopicPagerView</Text>
      </View>
    );
  });

  MockTopicPagerView.displayName = 'TopicPagerView';

  return {
    TopicPagerView: MockTopicPagerView,
  };
});

// Mock topic data
const mockTopicData = {
  topic: {
    topic_id: 'topic-uuid-003',
    name: 'The Flood',
    description: "Noah's flood",
    category: 'EVENT',
  },
  explanation: {
    summary: 'A summary of the flood',
    byline: 'A byline explanation',
    detailed: 'A detailed explanation',
  },
};

// Mock references data
const mockReferencesData = {
  content: '## Genesis\n**1**The waters increased...',
};

// Mock sorted topics for navigation
const mockSortedTopics = [
  { topic_id: 'topic-uuid-001', name: 'Creation', sort_order: 1, category: 'EVENT' },
  { topic_id: 'topic-uuid-002', name: 'The Fall', sort_order: 2, category: 'EVENT' },
  { topic_id: 'topic-uuid-003', name: 'The Flood', sort_order: 3, category: 'EVENT' },
  { topic_id: 'topic-uuid-004', name: 'Tower of Babel', sort_order: 4, category: 'EVENT' },
  { topic_id: 'topic-uuid-005', name: 'Call of Abraham', sort_order: 5, category: 'EVENT' },
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

describe('TopicDetailScreen - PagerView Integration', () => {
  let mockSavePosition: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    mockSavePosition = jest.fn();

    // Default mock implementations
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      topicId: 'topic-uuid-003',
      category: 'EVENT',
    });

    (useActiveTab as jest.Mock).mockReturnValue({
      activeTab: 'summary',
      setActiveTab: jest.fn(),
      isLoading: false,
      error: null,
    });

    (useLastReadPosition as jest.Mock).mockReturnValue({
      lastPosition: null,
      savePosition: mockSavePosition,
      clearPosition: jest.fn(),
      isLoading: false,
      error: null,
    });

    (useTopicById as jest.Mock).mockReturnValue({
      data: mockTopicData,
      isLoading: false,
      error: null,
    });

    (useTopicReferences as jest.Mock).mockReturnValue({
      data: mockReferencesData,
      isLoading: false,
      error: null,
    });

    (useTopicsSearch as jest.Mock).mockReturnValue({
      data: mockSortedTopics,
      isLoading: false,
      error: null,
    });

    // Mock useAllTopics for global topic navigation (circular navigation)
    (useAllTopics as jest.Mock).mockReturnValue({
      data: mockSortedTopics,
      isLoading: false,
      isError: false,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  /**
   * Test 1: Renders with TopicPagerView component
   */
  it('renders with TopicPagerView instead of plain ScrollView', async () => {
    const { getByTestId } = renderWithProviders(<TopicDetailScreen />);

    await waitFor(() => {
      // Should render TopicPagerView (with specific testID)
      expect(getByTestId('topic-pager-view')).toBeTruthy();
    });
  });

  /**
   * Test 2: FAB button press triggers pagerRef.goNext()
   */
  it('calls pagerRef.goNext when next button is pressed', async () => {
    // Middle topic (The Flood) - can navigate both ways
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      topicId: 'topic-uuid-003',
      category: 'EVENT',
    });

    const { getByTestId } = renderWithProviders(<TopicDetailScreen />);

    await waitFor(() => {
      const nextButton = getByTestId('next-chapter-button');
      fireEvent.press(nextButton);
    });

    // Should call goNext for relative position navigation
    expect(mockGoNext).toHaveBeenCalled();
  });

  /**
   * Test 3: Circular navigation - next button enabled at last topic
   */
  it('enables next button at last topic (circular navigation wraps to first)', async () => {
    // Last topic (Call of Abraham) - with circular navigation, can go to next (wraps to first)
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      topicId: 'topic-uuid-005',
      category: 'EVENT',
    });

    const { getByTestId } = renderWithProviders(<TopicDetailScreen />);

    await waitFor(() => {
      // Next button should be enabled at last topic (circular navigation)
      expect(getByTestId('next-chapter-button')).not.toBeDisabled();
    });

    // Press next button - should call goNext
    const nextButton = getByTestId('next-chapter-button');
    fireEvent.press(nextButton);

    // goNext should have been called for relative position navigation
    expect(mockGoNext).toHaveBeenCalled();
  });

  /**
   * Test 4: Reading position saved to AsyncStorage after navigation
   */
  it('saves reading position to AsyncStorage after component mounts', async () => {
    renderWithProviders(<TopicDetailScreen />);

    // Wait for effect to run
    await waitFor(() => {
      expect(mockSavePosition).toHaveBeenCalledWith({
        type: 'topic',
        topicId: 'topic-uuid-003',
        topicCategory: 'EVENT',
        activeTab: 'summary',
        activeView: 'bible',
      });
    });
  });

  describe('Button Navigation via PagerView ref', () => {
    /**
     * Test 5: Previous button calls pagerRef.goPrevious()
     */
    it('calls pagerRef.goPrevious when previous button is pressed', async () => {
      // Middle topic (The Flood) - can navigate both ways
      (useLocalSearchParams as jest.Mock).mockReturnValue({
        topicId: 'topic-uuid-003',
        category: 'EVENT',
      });

      const { getByTestId } = renderWithProviders(<TopicDetailScreen />);

      await waitFor(() => {
        const prevButton = getByTestId('previous-chapter-button');
        fireEvent.press(prevButton);
      });

      // Should call goPrevious for relative position navigation
      expect(mockGoPrevious).toHaveBeenCalled();
    });

    /**
     * Test 6: Haptic feedback fires on valid navigation
     */
    it('triggers medium impact haptic on valid next button press', async () => {
      (useLocalSearchParams as jest.Mock).mockReturnValue({
        topicId: 'topic-uuid-003',
        category: 'EVENT',
      });

      const { getByTestId } = renderWithProviders(<TopicDetailScreen />);

      await waitFor(() => {
        const nextButton = getByTestId('next-chapter-button');
        fireEvent.press(nextButton);
      });

      // Should trigger medium impact haptic
      expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Medium);
    });

    /**
     * Test 7: Previous button enabled for first topic (circular navigation)
     */
    it('enables previous button for first topic (circular navigation wraps to last)', async () => {
      // First topic (Creation) - with circular navigation, can go to previous (wraps to last)
      (useLocalSearchParams as jest.Mock).mockReturnValue({
        topicId: 'topic-uuid-001',
        category: 'EVENT',
      });

      const { getByTestId } = renderWithProviders(<TopicDetailScreen />);

      await waitFor(() => {
        // Both buttons should be enabled (circular navigation)
        expect(getByTestId('previous-chapter-button')).not.toBeDisabled();
        expect(getByTestId('next-chapter-button')).not.toBeDisabled();
      });

      // Press previous button - should call goPrevious
      const prevButton = getByTestId('previous-chapter-button');
      fireEvent.press(prevButton);

      // goPrevious should have been called for relative position navigation
      expect(mockGoPrevious).toHaveBeenCalled();
    });
  });

  describe('Header and UI elements', () => {
    /**
     * Test 8: Header displays topic name
     */
    it('displays topic name in header', async () => {
      const { getByTestId } = renderWithProviders(<TopicDetailScreen />);

      await waitFor(() => {
        const header = getByTestId('topic-header');
        expect(header).toBeTruthy();
      });
    });

    /**
     * Test 9: View mode switching works
     */
    it('switches between Bible and Explanations view modes', async () => {
      const { getByTestId, queryByTestId } = renderWithProviders(<TopicDetailScreen />);

      // Initially in Bible view, tabs should NOT be visible
      expect(queryByTestId('chapter-content-tabs')).toBeNull();

      const bibleToggle = getByTestId('bible-view-toggle');
      const insightToggle = getByTestId('insight-view-toggle');

      // Switch to explanations view
      fireEvent.press(insightToggle);

      // Tabs should appear
      await waitFor(() => {
        expect(getByTestId('chapter-content-tabs')).toBeTruthy();
      });

      // Switch back to Bible view
      fireEvent.press(bibleToggle);

      // Tabs should not be visible
      await waitFor(() => {
        expect(queryByTestId('chapter-content-tabs')).toBeNull();
      });
    });
  });
});
