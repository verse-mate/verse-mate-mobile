/**
 * Tests for Topic Detail Screen
 *
 * Tests cover:
 * - Topic detail rendering
 * - References and explanations display
 * - Tab switching (summary, byline, detailed)
 * - Navigation (previous/next topic)
 * - Loading states
 * - Error states
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import type React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import TopicDetailScreen from '@/app/topics/[topicId]';
import { useActiveTab } from '@/hooks/bible';
import {
  useTopicById,
  useTopicExplanation,
  useTopicReferences,
  useTopicsSearch,
} from '@/src/api/generated';

// Mock dependencies
jest.mock('expo-router', () => ({
  useLocalSearchParams: jest.fn(),
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(),
  },
}));

jest.mock('@/src/api/generated', () => ({
  useTopicById: jest.fn(),
  useTopicReferences: jest.fn(),
  useTopicExplanation: jest.fn(),
  useTopicsSearch: jest.fn(),
  useBibleTestaments: jest.fn(),
}));

jest.mock('@/hooks/bible', () => ({
  useActiveTab: jest.fn(),
}));

jest.mock('@/hooks/bible/use-recent-books', () => ({
  useRecentBooks: jest.fn(),
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
  },
  NotificationFeedbackType: {
    Error: 'error',
  },
}));

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn(() => Promise.resolve({ isInternetReachable: true })),
}));

// Mock topic data
const mockTopicData = {
  topic: {
    topic_id: 'event-1',
    name: 'The Creation',
    description: 'God creates the heavens and the earth',
    category: 'EVENT',
    sort_order: 1,
  },
};

const mockReferences = {
  content: '## Genesis 1:1-31\n\nIn the beginning God created the heavens and the earth.',
};

const mockSummaryExplanation = {
  explanation:
    'The Creation account describes how God created the universe in six days and rested on the seventh.',
};

const mockBylineExplanation = {
  explanation:
    '**Day 1:** Light\n**Day 2:** Sky\n**Day 3:** Land and plants\n**Day 4:** Sun, moon, stars\n**Day 5:** Sea creatures and birds\n**Day 6:** Land animals and humans\n**Day 7:** Rest',
};

const mockDetailedExplanation = {
  explanation:
    '# The Creation Account\n\nGod created everything in six days:\n\n1. Light and darkness\n2. Sky and waters\n3. Land, seas, and vegetation\n4. Sun, moon, and stars\n5. Sea creatures and birds\n6. Land animals and humans\n\nOn the seventh day, God rested.',
};

// Mock category topics for navigation
const mockCategoryTopics = [
  {
    topic_id: 'event-0',
    name: 'Previous Topic',
    category: 'EVENT',
    sort_order: 0,
  },
  {
    topic_id: 'event-1',
    name: 'The Creation',
    category: 'EVENT',
    sort_order: 1,
  },
  {
    topic_id: 'event-2',
    name: 'The Flood',
    category: 'EVENT',
    sort_order: 2,
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

describe('TopicDetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementations
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      topicId: 'event-1',
      category: 'EVENT',
    });

    (useActiveTab as jest.Mock).mockReturnValue({
      activeTab: 'summary',
      setActiveTab: jest.fn(),
      isLoading: false,
      error: null,
    });

    (useTopicById as jest.Mock).mockReturnValue({
      data: mockTopicData,
      isLoading: false,
      error: null,
    });

    (useTopicReferences as jest.Mock).mockReturnValue({
      data: mockReferences,
      isLoading: false,
      error: null,
    });

    (useTopicExplanation as jest.Mock).mockReturnValue({
      data: mockSummaryExplanation,
      isLoading: false,
      error: null,
    });

    (useTopicsSearch as jest.Mock).mockReturnValue({
      data: mockCategoryTopics,
      isLoading: false,
      error: null,
    });

    // Mock useBibleTestaments for BibleNavigationModal
    const { useBibleTestaments } = require('@/src/api/generated');
    (useBibleTestaments as jest.Mock).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });

    // Mock useRecentBooks for BibleNavigationModal
    const { useRecentBooks } = require('@/hooks/bible/use-recent-books');
    (useRecentBooks as jest.Mock).mockReturnValue({
      recentBooks: [],
      addRecentBook: jest.fn(),
      isLoading: false,
    });

    (router.canGoBack as jest.Mock).mockReturnValue(true);
  });

  describe('Topic Rendering', () => {
    it('should render topic title and description', async () => {
      renderWithProviders(<TopicDetailScreen />);

      await waitFor(() => {
        expect(screen.getAllByText('The Creation').length).toBeGreaterThan(0);
        expect(screen.getByText('God creates the heavens and the earth')).toBeTruthy();
      });
    });

    it('should render Bible references section', async () => {
      renderWithProviders(<TopicDetailScreen />);

      await waitFor(() => {
        expect(screen.getByText('Bible References')).toBeTruthy();
        expect(
          screen.getByText('In the beginning God created the heavens and the earth.')
        ).toBeTruthy();
      });
    });

    it('should render summary explanation by default', async () => {
      renderWithProviders(<TopicDetailScreen />);

      await waitFor(() => {
        expect(screen.getByText('Summary Explanation')).toBeTruthy();
        expect(
          screen.getByText(
            'The Creation account describes how God created the universe in six days and rested on the seventh.'
          )
        ).toBeTruthy();
      });
    });
  });

  describe('Tab Switching', () => {
    it('should switch to byline explanation when byline tab is selected', async () => {
      const mockSetActiveTab = jest.fn();
      (useActiveTab as jest.Mock).mockReturnValue({
        activeTab: 'byline',
        setActiveTab: mockSetActiveTab,
        isLoading: false,
        error: null,
      });

      (useTopicExplanation as jest.Mock).mockReturnValue({
        data: mockBylineExplanation,
        isLoading: false,
        error: null,
      });

      renderWithProviders(<TopicDetailScreen />);

      await waitFor(() => {
        expect(screen.getByText('By Line Explanation')).toBeTruthy();
      });
    });

    it('should switch to detailed explanation when detailed tab is selected', async () => {
      const mockSetActiveTab = jest.fn();
      (useActiveTab as jest.Mock).mockReturnValue({
        activeTab: 'detailed',
        setActiveTab: mockSetActiveTab,
        isLoading: false,
        error: null,
      });

      (useTopicExplanation as jest.Mock).mockReturnValue({
        data: mockDetailedExplanation,
        isLoading: false,
        error: null,
      });

      renderWithProviders(<TopicDetailScreen />);

      await waitFor(() => {
        expect(screen.getByText('Detailed Explanation')).toBeTruthy();
      });
    });
  });

  describe('Navigation', () => {
    it('should navigate to previous topic when previous button is pressed', async () => {
      renderWithProviders(<TopicDetailScreen />);

      await waitFor(() => {
        expect(screen.getAllByText('The Creation').length).toBeGreaterThan(0);
      });

      // Find and press previous button (uses "Previous chapter" label from FloatingActionButtons)
      const prevButton = screen.getByLabelText('Previous chapter');
      fireEvent.press(prevButton);

      // Should navigate to previous topic
      expect(router.push).toHaveBeenCalledWith({
        pathname: '/topics/[topicId]',
        params: { topicId: 'event-0', category: 'EVENT' },
      });
    });

    it('should navigate to next topic when next button is pressed', async () => {
      renderWithProviders(<TopicDetailScreen />);

      await waitFor(() => {
        expect(screen.getAllByText('The Creation').length).toBeGreaterThan(0);
      });

      // Find and press next button (uses "Next chapter" label from FloatingActionButtons)
      const nextButton = screen.getByLabelText('Next chapter');
      fireEvent.press(nextButton);

      // Should navigate to next topic
      expect(router.push).toHaveBeenCalledWith({
        pathname: '/topics/[topicId]',
        params: { topicId: 'event-2', category: 'EVENT' },
      });
    });

    it('should navigate back when back button is pressed', async () => {
      renderWithProviders(<TopicDetailScreen />);

      await waitFor(() => {
        expect(screen.getAllByText('The Creation').length).toBeGreaterThan(0);
      });

      // Find and press back button
      const backButton = screen.getByLabelText('Go back');
      fireEvent.press(backButton);

      // Should navigate back
      expect(router.back).toHaveBeenCalled();
    });
  });

  describe('Loading States', () => {
    it('should show skeleton loader while topic is loading', () => {
      (useTopicById as jest.Mock).mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
      });

      renderWithProviders(<TopicDetailScreen />);

      expect(screen.getByText('Loading...')).toBeTruthy();
    });

    it('should show loading indicator while explanation is loading', async () => {
      (useTopicExplanation as jest.Mock).mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
      });

      renderWithProviders(<TopicDetailScreen />);

      await waitFor(() => {
        expect(screen.getByText('Loading summary explanation...')).toBeTruthy();
      });
    });
  });

  describe('Error States', () => {
    it('should show error message when topic fails to load', () => {
      (useTopicById as jest.Mock).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error('Failed to load topic'),
      });

      renderWithProviders(<TopicDetailScreen />);

      expect(screen.getByText('Error')).toBeTruthy();
      expect(screen.getByText('Failed to load topic')).toBeTruthy();
    });

    it('should show "Go Back" button on error', () => {
      (useTopicById as jest.Mock).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error('Failed to load topic'),
      });

      renderWithProviders(<TopicDetailScreen />);

      const goBackButton = screen.getByText('Go Back');
      expect(goBackButton).toBeTruthy();

      fireEvent.press(goBackButton);
      expect(router.back).toHaveBeenCalled();
    });

    it('should show empty state when explanation is not available', async () => {
      (useTopicExplanation as jest.Mock).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: null,
      });

      renderWithProviders(<TopicDetailScreen />);

      await waitFor(() => {
        expect(
          screen.getByText('No summary explanation available for this topic yet.')
        ).toBeTruthy();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle topic without description', async () => {
      (useTopicById as jest.Mock).mockReturnValue({
        data: {
          topic: {
            topic_id: 'event-1',
            name: 'The Creation',
            description: '',
            category: 'EVENT',
            sort_order: 1,
          },
        },
        isLoading: false,
        error: null,
      });

      renderWithProviders(<TopicDetailScreen />);

      await waitFor(() => {
        expect(screen.getAllByText('The Creation').length).toBeGreaterThan(0);
      });

      // Description should not be rendered
      expect(screen.queryByText('God creates the heavens and the earth')).toBeNull();
    });

    it('should disable previous button when on first topic', async () => {
      // Mock current topic as first in list
      (useLocalSearchParams as jest.Mock).mockReturnValue({
        topicId: 'event-0',
        category: 'EVENT',
      });

      (useTopicById as jest.Mock).mockReturnValue({
        data: {
          topic: {
            topic_id: 'event-0',
            name: 'Previous Topic',
            category: 'EVENT',
            sort_order: 0,
          },
        },
        isLoading: false,
        error: null,
      });

      renderWithProviders(<TopicDetailScreen />);

      await waitFor(() => {
        expect(screen.getAllByText('Previous Topic').length).toBeGreaterThan(0);
      });

      // Previous button should not be visible (uses "Previous chapter" label from FloatingActionButtons)
      const prevButton = screen.queryByLabelText('Previous chapter');
      expect(prevButton).toBeNull();
    });

    it('should disable next button when on last topic', async () => {
      // Mock current topic as last in list
      (useLocalSearchParams as jest.Mock).mockReturnValue({
        topicId: 'event-2',
        category: 'EVENT',
      });

      (useTopicById as jest.Mock).mockReturnValue({
        data: {
          topic: {
            topic_id: 'event-2',
            name: 'The Flood',
            category: 'EVENT',
            sort_order: 2,
          },
        },
        isLoading: false,
        error: null,
      });

      renderWithProviders(<TopicDetailScreen />);

      await waitFor(() => {
        expect(screen.getAllByText('The Flood').length).toBeGreaterThan(0);
      });

      // Next button should not be visible (uses "Next chapter" label from FloatingActionButtons)
      const nextButton = screen.queryByLabelText('Next chapter');
      expect(nextButton).toBeNull();
    });
  });
});
