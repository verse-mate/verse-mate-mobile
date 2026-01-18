/**
 * Tests for TopicPagerView click/display synchronization
 *
 * Tests that clicking a topic, navigating via deep link, or using the back button
 * correctly displays the expected topic. This tests the fix for the sync bug
 * where the clicked topic did not match the displayed topic.
 *
 * The fix uses wrapCircularTopicIndex in the useEffect that handles external
 * topic changes, similar to the ChapterPagerView fix.
 *
 * @see Spec: agent-os/specs/fix-topic-swipe-navigation/spec.md
 * @see components/bible/ChapterPagerView.tsx - Reference implementation for the fix
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { TopicPagerView } from '@/components/topics/TopicPagerView';
import { ThemeProvider } from '@/contexts/ThemeContext';
import type { TopicListItem } from '@/types/topics';

// Store all setPageWithoutAnimation calls across renders
const setPageWithoutAnimationCalls: number[] = [];
let _capturedOnPageSelected: ((event: { nativeEvent: { position: number } }) => void) | null = null;

// Mock react-native-pager-view to capture onPageSelected callback
jest.mock('react-native-pager-view', () => {
  const React = require('react');
  const { View } = require('react-native');

  const MockPagerView = React.forwardRef(({ children, testID, onPageSelected }: any, ref: any) => {
    _capturedOnPageSelected = onPageSelected;

    React.useImperativeHandle(ref, () => ({
      setPage: jest.fn(),
      setPageWithoutAnimation: (index: number) => {
        setPageWithoutAnimationCalls.push(index);
      },
    }));

    return (
      <View testID={testID || 'pager-view'}>
        {React.Children.map(children, (child: any, index: number) => (
          <View key={`page-${index}`} testID={`pager-page-${index}`}>
            {child}
          </View>
        ))}
      </View>
    );
  });

  MockPagerView.displayName = 'PagerView';

  return {
    __esModule: true,
    default: MockPagerView,
  };
});

// Mock TopicPage component to track what topic is rendered
jest.mock('@/components/topics/TopicPage', () => ({
  TopicPage: ({ topicId }: any) => {
    const { Text } = require('react-native');
    return <Text testID={`topic-page-${topicId}`}>Topic {topicId}</Text>;
  },
}));

// Mock API hooks
jest.mock('@/src/api', () => ({
  useTopicById: jest.fn(() => ({ data: null, isLoading: false, error: null })),
  useTopicReferences: jest.fn(() => ({ data: null, isLoading: false, error: null })),
}));

// Mock AuthContext
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(() => ({
    isAuthenticated: false,
    user: null,
    isLoading: false,
  })),
}));

// Mock Haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
  },
}));

/**
 * Mock topic data for testing
 */
const mockAllTopics: TopicListItem[] = [
  { topic_id: 'event-001', name: 'Creation', sort_order: 1, category: 'EVENT' },
  { topic_id: 'event-002', name: 'The Fall', sort_order: 2, category: 'EVENT' },
  { topic_id: 'event-003', name: 'The Flood', sort_order: 3, category: 'EVENT' },
  { topic_id: 'prophecy-001', name: 'Messiah', sort_order: 1, category: 'PROPHECY' },
  { topic_id: 'prophecy-002', name: 'End Times', sort_order: 2, category: 'PROPHECY' },
  { topic_id: 'prophecy-003', name: 'Restoration', sort_order: 3, category: 'PROPHECY' },
  { topic_id: 'parable-001', name: 'Prodigal Son', sort_order: 1, category: 'PARABLE' },
  { topic_id: 'parable-002', name: 'Good Samaritan', sort_order: 2, category: 'PARABLE' },
  { topic_id: 'parable-003', name: 'Sower', sort_order: 3, category: 'PARABLE' },
  { topic_id: 'theme-001', name: 'Love', sort_order: 1, category: 'THEME' },
  { topic_id: 'theme-002', name: 'Faith', sort_order: 2, category: 'THEME' },
  { topic_id: 'theme-003', name: 'Grace', sort_order: 3, category: 'THEME' },
];

describe('TopicPagerView click/display sync', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    // Clear the calls array
    setPageWithoutAnimationCalls.length = 0;
    _capturedOnPageSelected = null;
  });

  const renderPagerView = (
    initialTopicId: string,
    sortedTopics: TopicListItem[] = mockAllTopics,
    onPageChange?: (topicId: string) => void
  ) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <TopicPagerView
            initialTopicId={initialTopicId}
            sortedTopics={sortedTopics}
            activeTab="summary"
            activeView="bible"
            onPageChange={onPageChange || jest.fn()}
          />
        </ThemeProvider>
      </QueryClientProvider>
    );
  };

  describe('external topic ID change sync (modal selection, deep link)', () => {
    it('should display the correct topic when initialTopicId changes externally', async () => {
      // Simulate a user clicking on a topic in a modal
      const { rerender } = renderPagerView('event-001');

      // Verify initial topic is displayed at center (position 3)
      expect(screen.getByTestId('topic-page-event-001')).toBeTruthy();

      // Clear calls from initial render
      setPageWithoutAnimationCalls.length = 0;

      // Simulate external change (like clicking in modal)
      rerender(
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <TopicPagerView
              initialTopicId="parable-002"
              sortedTopics={mockAllTopics}
              activeTab="summary"
              activeView="bible"
              onPageChange={jest.fn()}
            />
          </ThemeProvider>
        </QueryClientProvider>
      );

      // The new topic should be displayed
      await waitFor(() => {
        expect(screen.getByTestId('topic-page-parable-002')).toBeTruthy();
      });

      // setPageWithoutAnimation should have been called to re-center to CENTER_INDEX (3)
      expect(setPageWithoutAnimationCalls).toContain(3);
    });

    it('should handle deep link navigation to topic correctly', async () => {
      // Start with one topic
      const { rerender } = renderPagerView('prophecy-001');

      expect(screen.getByTestId('topic-page-prophecy-001')).toBeTruthy();

      // Simulate deep link changing the topic (like /topics/theme-003)
      rerender(
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <TopicPagerView
              initialTopicId="theme-003"
              sortedTopics={mockAllTopics}
              activeTab="summary"
              activeView="bible"
              onPageChange={jest.fn()}
            />
          </ThemeProvider>
        </QueryClientProvider>
      );

      // The deep-linked topic should be displayed
      await waitFor(() => {
        expect(screen.getByTestId('topic-page-theme-003')).toBeTruthy();
      });
    });

    it('should not re-center when same topic ID is set again', async () => {
      // This tests that lastProcessedRef prevents unnecessary re-centering
      const { rerender } = renderPagerView('event-001');

      // Clear calls from initial render
      setPageWithoutAnimationCalls.length = 0;

      // Re-render with same topic ID
      rerender(
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <TopicPagerView
              initialTopicId="event-001"
              sortedTopics={mockAllTopics}
              activeTab="summary"
              activeView="bible"
              onPageChange={jest.fn()}
            />
          </ThemeProvider>
        </QueryClientProvider>
      );

      // Should not have re-centered since topic didn't actually change
      // The useEffect skips when lastProcessedRef matches
      await waitFor(() => {
        expect(setPageWithoutAnimationCalls).toHaveLength(0);
      });
    });

    it('should handle rapid topic selection maintaining sync', async () => {
      jest.useFakeTimers();
      const { rerender } = renderPagerView('event-001');

      // Rapid topic selection simulation (like clicking multiple topics quickly)
      const topicsToSelect = ['prophecy-001', 'parable-001', 'theme-001', 'event-003'];

      for (const topicId of topicsToSelect) {
        rerender(
          <QueryClientProvider client={queryClient}>
            <ThemeProvider>
              <TopicPagerView
                initialTopicId={topicId}
                sortedTopics={mockAllTopics}
                activeTab="summary"
                activeView="bible"
                onPageChange={jest.fn()}
              />
            </ThemeProvider>
          </QueryClientProvider>
        );

        // Allow state updates
        act(() => {
          jest.advanceTimersByTime(10);
        });
      }

      // Final topic should be displayed
      await waitFor(() => {
        expect(screen.getByTestId('topic-page-event-003')).toBeTruthy();
      });

      jest.useRealTimers();
    });
  });
});
