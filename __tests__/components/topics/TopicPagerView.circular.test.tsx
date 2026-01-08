/**
 * Tests for TopicPagerView circular navigation behavior
 *
 * Tests that circular navigation at global topic boundaries works correctly:
 * - getTopicForPosition returns valid topics for out-of-bounds indices
 * - Swiping backward from first topic shows last topic (circular navigation)
 * - Swiping forward from last topic shows first topic (circular navigation)
 * - Haptic feedback fires on circular navigation
 * - Boundary pages are never rendered
 *
 * @see Spec: agent-os/specs/fix-topic-swipe-navigation/spec.md
 * @see components/bible/ChapterPagerView.tsx - Reference implementation
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { TopicPagerView } from '@/components/topics/TopicPagerView';
import { ThemeProvider } from '@/contexts/ThemeContext';
import type { TopicListItem } from '@/types/topics';

// Store mock functions for PagerView
let mockSetPage: jest.Mock;
let mockSetPageWithoutAnimation: jest.Mock;
let capturedOnPageSelected: ((event: { nativeEvent: { position: number } }) => void) | null = null;

// Mock react-native-pager-view to capture onPageSelected callback
jest.mock('react-native-pager-view', () => {
  const React = require('react');
  const { View } = require('react-native');

  const MockPagerView = React.forwardRef(({ children, testID, onPageSelected }: any, ref: any) => {
    // Store ref methods for testing
    mockSetPage = jest.fn();
    mockSetPageWithoutAnimation = jest.fn();

    // Capture the onPageSelected callback so we can trigger it in tests
    capturedOnPageSelected = onPageSelected;

    React.useImperativeHandle(ref, () => ({
      setPage: mockSetPage,
      setPageWithoutAnimation: mockSetPageWithoutAnimation,
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
 * Mock topic data for testing - covers multiple categories to simulate global navigation
 * Topics sorted globally: EVENT (0-2), PROPHECY (3-5), PARABLE (6-8), THEME (9-11)
 */
const mockAllTopics: TopicListItem[] = [
  // EVENT topics (indices 0-2)
  { topic_id: 'event-001', name: 'Creation', sort_order: 1, category: 'EVENT' },
  { topic_id: 'event-002', name: 'The Fall', sort_order: 2, category: 'EVENT' },
  { topic_id: 'event-003', name: 'The Flood', sort_order: 3, category: 'EVENT' },
  // PROPHECY topics (indices 3-5)
  { topic_id: 'prophecy-001', name: 'Messiah', sort_order: 1, category: 'PROPHECY' },
  { topic_id: 'prophecy-002', name: 'End Times', sort_order: 2, category: 'PROPHECY' },
  { topic_id: 'prophecy-003', name: 'Restoration', sort_order: 3, category: 'PROPHECY' },
  // PARABLE topics (indices 6-8)
  { topic_id: 'parable-001', name: 'Prodigal Son', sort_order: 1, category: 'PARABLE' },
  { topic_id: 'parable-002', name: 'Good Samaritan', sort_order: 2, category: 'PARABLE' },
  { topic_id: 'parable-003', name: 'Sower', sort_order: 3, category: 'PARABLE' },
  // THEME topics (indices 9-11)
  { topic_id: 'theme-001', name: 'Love', sort_order: 1, category: 'THEME' },
  { topic_id: 'theme-002', name: 'Faith', sort_order: 2, category: 'THEME' },
  { topic_id: 'theme-003', name: 'Grace', sort_order: 3, category: 'THEME' },
];

describe('TopicPagerView circular navigation', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    jest.clearAllMocks();
    capturedOnPageSelected = null;
  });

  const renderPagerView = (
    initialTopicId: string = 'prophecy-001',
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

  describe('getTopicForPosition circular wrapping', () => {
    it('should render last topic for positions before first topic (absoluteIndex -1)', () => {
      // First topic (event-001) at center (index 3) means position 0 would be at absoluteIndex -3
      // Position 2 would be at absoluteIndex -1
      renderPagerView('event-001');

      // At first topic centered, positions 0, 1, 2 would have negative absolute indices
      // These should now wrap to the last topics (theme-003, theme-002, theme-001)
      // Position 0: absoluteIndex = 0 + (0 - 3) = -3 -> should wrap to index 9 (theme-001)
      // Position 1: absoluteIndex = 0 + (1 - 3) = -2 -> should wrap to index 10 (theme-002)
      // Position 2: absoluteIndex = 0 + (2 - 3) = -1 -> should wrap to index 11 (theme-003)
      expect(screen.getByTestId('topic-page-theme-001')).toBeTruthy();
      expect(screen.getByTestId('topic-page-theme-002')).toBeTruthy();
      expect(screen.getByTestId('topic-page-theme-003')).toBeTruthy();
    });

    it('should render first topic for positions after last topic (absoluteIndex > maxIndex)', () => {
      // Last topic (theme-003) at center means positions 4, 5, 6 would exceed max index
      renderPagerView('theme-003');

      // At last topic centered (index 11), positions 4, 5, 6 would exceed max
      // Position 4: absoluteIndex = 11 + (4 - 3) = 12 -> should wrap to 0 (event-001)
      // Position 5: absoluteIndex = 11 + (5 - 3) = 13 -> should wrap to 1 (event-002)
      // Position 6: absoluteIndex = 11 + (6 - 3) = 14 -> should wrap to 2 (event-003)
      expect(screen.getByTestId('topic-page-event-001')).toBeTruthy();
      expect(screen.getByTestId('topic-page-event-002')).toBeTruthy();
      expect(screen.getByTestId('topic-page-event-003')).toBeTruthy();
    });
  });

  describe('boundary pages not rendered for topic navigation', () => {
    it('should NOT render boundary pages when at first topic globally', () => {
      renderPagerView('event-001');

      // Boundary pages should NOT be present - only actual topic content
      expect(screen.queryByTestId('topic-page-boundary-0')).toBeNull();
      expect(screen.queryByTestId('topic-page-boundary-1')).toBeNull();
      expect(screen.queryByTestId('topic-page-boundary-2')).toBeNull();
      expect(screen.queryByTestId('swipe-boundary-start')).toBeNull();
      expect(screen.queryByTestId('swipe-boundary-end')).toBeNull();
    });

    it('should NOT render boundary pages when at last topic globally', () => {
      renderPagerView('theme-003');

      // Boundary pages should NOT be present - only actual topic content
      expect(screen.queryByTestId('topic-page-boundary-4')).toBeNull();
      expect(screen.queryByTestId('topic-page-boundary-5')).toBeNull();
      expect(screen.queryByTestId('topic-page-boundary-6')).toBeNull();
      expect(screen.queryByTestId('swipe-boundary-start')).toBeNull();
      expect(screen.queryByTestId('swipe-boundary-end')).toBeNull();
    });

    it('should render 7 pages with only topic content at all positions', () => {
      renderPagerView('event-001');

      // All 7 pager page containers should exist
      for (let i = 0; i < 7; i++) {
        expect(screen.getByTestId(`pager-page-${i}`)).toBeTruthy();
      }

      // Only topic pages should be rendered, no boundary indicators
      expect(screen.queryByTestId('swipe-boundary-start')).toBeNull();
      expect(screen.queryByTestId('swipe-boundary-end')).toBeNull();
    });
  });

  describe('haptic feedback on circular navigation', () => {
    it('should trigger haptic feedback on circular navigation from first topic backward', async () => {
      jest.useFakeTimers();
      const onPageChange = jest.fn();
      renderPagerView('event-001', mockAllTopics, onPageChange);

      // Verify capturedOnPageSelected is set
      expect(capturedOnPageSelected).not.toBeNull();

      // Simulate swiping to position 0 (edge position, would wrap to last topics)
      act(() => {
        capturedOnPageSelected?.({ nativeEvent: { position: 0 } });
      });

      // Haptic feedback should be triggered for all page changes
      await waitFor(() => {
        expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Medium);
      });

      jest.useRealTimers();
    });

    it('should trigger haptic feedback on circular navigation from last topic forward', async () => {
      jest.useFakeTimers();
      const onPageChange = jest.fn();
      renderPagerView('theme-003', mockAllTopics, onPageChange);

      expect(capturedOnPageSelected).not.toBeNull();

      // Simulate swiping to position 6 (edge position, would wrap to first topics)
      act(() => {
        capturedOnPageSelected?.({ nativeEvent: { position: 6 } });
      });

      // Haptic feedback should be triggered
      await waitFor(() => {
        expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Medium);
      });

      jest.useRealTimers();
    });

    it('should call onPageChange with circular wrapped topic when swiping at boundary', async () => {
      jest.useFakeTimers();
      const onPageChange = jest.fn();
      renderPagerView('event-001', mockAllTopics, onPageChange);

      expect(capturedOnPageSelected).not.toBeNull();

      // Simulate swiping to position 0 (edge position at first topic)
      // This should wrap to last topic area
      act(() => {
        capturedOnPageSelected?.({ nativeEvent: { position: 0 } });
      });

      // Haptics should fire immediately
      expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Medium);

      // Advance timers to trigger the route update
      act(() => {
        jest.advanceTimersByTime(100);
      });

      // onPageChange should be called with the wrapped topic (only topicId, global navigation)
      // absoluteIndex = 0 + (0 - 3) = -3 -> wraps to 9 which is theme-001
      await waitFor(() => {
        expect(onPageChange).toHaveBeenCalledWith('theme-001');
      });

      jest.useRealTimers();
    });
  });

  describe('cross-category circular navigation', () => {
    it('should correctly render topics when navigating across category boundaries', () => {
      // Start at last EVENT topic
      renderPagerView('event-003');

      // Window around event-003 (index 2, center at position 3):
      // Should show topics from THEME (wrapped), EVENT, and PROPHECY
      // Positions: [theme-003(-1), event-001(0), event-002(1), event-003(2), prophecy-001(3), prophecy-002(4), prophecy-003(5)]
      // Wait, that's not right. Let me recalculate:
      // event-003 is at index 2
      // Position 0: absoluteIndex = 2 + (0 - 3) = -1 -> wraps to 11 (theme-003)
      // Position 1: absoluteIndex = 2 + (1 - 3) = 0 -> event-001
      // Position 2: absoluteIndex = 2 + (2 - 3) = 1 -> event-002
      // Position 3: absoluteIndex = 2 + (3 - 3) = 2 -> event-003 (center)
      // Position 4: absoluteIndex = 2 + (4 - 3) = 3 -> prophecy-001
      // Position 5: absoluteIndex = 2 + (5 - 3) = 4 -> prophecy-002
      // Position 6: absoluteIndex = 2 + (6 - 3) = 5 -> prophecy-003
      expect(screen.getByTestId('topic-page-theme-003')).toBeTruthy(); // wrapped from -1
      expect(screen.getByTestId('topic-page-event-001')).toBeTruthy();
      expect(screen.getByTestId('topic-page-event-002')).toBeTruthy();
      expect(screen.getByTestId('topic-page-event-003')).toBeTruthy(); // center
      expect(screen.getByTestId('topic-page-prophecy-001')).toBeTruthy();
      expect(screen.getByTestId('topic-page-prophecy-002')).toBeTruthy();
      expect(screen.getByTestId('topic-page-prophecy-003')).toBeTruthy();
    });
  });
});
