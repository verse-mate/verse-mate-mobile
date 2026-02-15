/**
 * Tests for SimpleTopicPager Component
 *
 * SimpleTopicPager is the V3 replacement for TopicPagerView.
 * It uses a 3-page window (previous, current, next) instead of 7 pages.
 *
 * Key differences from TopicPagerView:
 * - Only 3 pages: [prev, current, next] instead of 7-page window
 * - No recentering logic - uses key prop to force remount on navigation
 * - Circular navigation: all 3 pages always render content (no boundaries)
 * - No imperative goNext/goPrevious - parent manages state
 *
 * Tests:
 * - Renders 3 pages (previous, current, next)
 * - Initial page is center (index 1)
 * - Calls onTopicChange with correct topicId on swipe
 * - Circular wrap: first topic has last topic as prev
 * - Circular wrap: last topic has first topic as next
 *
 * @see Spec: agent-os/specs/2026-02-01-chapter-header-slide-sync-v3/spec.md
 */

import { render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { SimpleTopicPager } from '@/components/topics/SimpleTopicPager';
import type { TopicListItem } from '@/types/topics';

// Store mock callbacks for testing
let mockOnPageSelected: ((event: { nativeEvent: { position: number } }) => void) | undefined;
let mockInitialPage: number | undefined;

// Mock react-native-pager-view
jest.mock('react-native-pager-view', () => {
  const React = require('react');
  const { View } = require('react-native');

  const MockPagerView = React.forwardRef(
    ({ children, testID, onPageSelected, initialPage }: any, _ref: any) => {
      // Store for testing
      mockOnPageSelected = onPageSelected;
      mockInitialPage = initialPage;

      return (
        <View testID={testID || 'pager-view'}>
          {React.Children.map(children, (child: any, index: number) => (
            <View key={`page-${index}`} testID={`pager-page-${index}`}>
              {child}
            </View>
          ))}
        </View>
      );
    }
  );

  MockPagerView.displayName = 'PagerView';

  return {
    __esModule: true,
    default: MockPagerView,
  };
});

/**
 * Mock render function for topic pages
 */
const mockRenderTopicPage = jest.fn((topicId: string) => {
  const { Text } = require('react-native');
  return <Text testID={`topic-content-${topicId}`}>Topic {topicId}</Text>;
});

/**
 * Mock topic data for testing - sorted globally across all categories
 */
const mockSortedTopics: TopicListItem[] = [
  { topic_id: 'topic-001', name: 'Creation', sort_order: 1, category: 'EVENT' },
  { topic_id: 'topic-002', name: 'The Fall', sort_order: 2, category: 'EVENT' },
  { topic_id: 'topic-003', name: 'The Flood', sort_order: 3, category: 'EVENT' },
  { topic_id: 'topic-004', name: 'Messiah', sort_order: 1, category: 'PROPHECY' },
  { topic_id: 'topic-005', name: 'End Times', sort_order: 2, category: 'PROPHECY' },
];

describe('SimpleTopicPager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOnPageSelected = undefined;
    mockInitialPage = undefined;
  });

  /**
   * Test 1: Renders 3 pages (previous, current, next)
   */
  it('renders 3 pages (previous, current, next)', () => {
    render(
      <SimpleTopicPager
        topicId="topic-003"
        sortedTopics={mockSortedTopics}
        onTopicChange={jest.fn()}
        renderTopicPage={mockRenderTopicPage}
      />
    );

    // Should render exactly 3 pager pages
    expect(screen.getByTestId('pager-page-0')).toBeTruthy();
    expect(screen.getByTestId('pager-page-1')).toBeTruthy();
    expect(screen.getByTestId('pager-page-2')).toBeTruthy();

    // Should not have a 4th page
    expect(screen.queryByTestId('pager-page-3')).toBeNull();

    // Verify page content: prev=topic-002, current=topic-003, next=topic-004
    expect(screen.getByTestId('topic-content-topic-002')).toBeTruthy();
    expect(screen.getByTestId('topic-content-topic-003')).toBeTruthy();
    expect(screen.getByTestId('topic-content-topic-004')).toBeTruthy();
  });

  /**
   * Test 2: Initial page is center (index 1)
   */
  it('sets initial page to center (index 1)', () => {
    render(
      <SimpleTopicPager
        topicId="topic-003"
        sortedTopics={mockSortedTopics}
        onTopicChange={jest.fn()}
        renderTopicPage={mockRenderTopicPage}
      />
    );

    // Initial page should be 1 (center)
    expect(mockInitialPage).toBe(1);
  });

  /**
   * Test 3: Calls onTopicChange with correct topicId on swipe to next
   */
  it('calls onTopicChange with correct topicId when swiping to next topic', () => {
    const mockOnTopicChange = jest.fn();

    render(
      <SimpleTopicPager
        topicId="topic-003"
        sortedTopics={mockSortedTopics}
        onTopicChange={mockOnTopicChange}
        renderTopicPage={mockRenderTopicPage}
      />
    );

    // Simulate swipe to next page (index 2)
    if (mockOnPageSelected) {
      mockOnPageSelected({ nativeEvent: { position: 2 } });
    }

    // Should call onTopicChange with next topic (topic-004 Messiah)
    expect(mockOnTopicChange).toHaveBeenCalledWith('topic-004');
  });

  /**
   * Test 3b: Calls onTopicChange with correct topicId on swipe to previous
   */
  it('calls onTopicChange with correct topicId when swiping to previous topic', () => {
    const mockOnTopicChange = jest.fn();

    render(
      <SimpleTopicPager
        topicId="topic-003"
        sortedTopics={mockSortedTopics}
        onTopicChange={mockOnTopicChange}
        renderTopicPage={mockRenderTopicPage}
      />
    );

    // Simulate swipe to previous page (index 0)
    if (mockOnPageSelected) {
      mockOnPageSelected({ nativeEvent: { position: 0 } });
    }

    // Should call onTopicChange with previous topic (topic-002 The Fall)
    expect(mockOnTopicChange).toHaveBeenCalledWith('topic-002');
  });

  /**
   * Test 4: Circular wrap - first topic has last topic as prev
   */
  it('renders last topic as previous page when at first topic (circular wrap)', () => {
    render(
      <SimpleTopicPager
        topicId="topic-001"
        sortedTopics={mockSortedTopics}
        onTopicChange={jest.fn()}
        renderTopicPage={mockRenderTopicPage}
      />
    );

    // At first topic (topic-001), previous should wrap to last topic (topic-005)
    expect(screen.getByTestId('topic-content-topic-005')).toBeTruthy(); // prev (wrapped)
    expect(screen.getByTestId('topic-content-topic-001')).toBeTruthy(); // current
    expect(screen.getByTestId('topic-content-topic-002')).toBeTruthy(); // next
  });

  /**
   * Test 4b: Swiping back from first topic navigates to last topic
   */
  it('calls onTopicChange with last topicId when swiping back from first topic', () => {
    const mockOnTopicChange = jest.fn();

    render(
      <SimpleTopicPager
        topicId="topic-001"
        sortedTopics={mockSortedTopics}
        onTopicChange={mockOnTopicChange}
        renderTopicPage={mockRenderTopicPage}
      />
    );

    // Simulate swipe to previous page (index 0)
    if (mockOnPageSelected) {
      mockOnPageSelected({ nativeEvent: { position: 0 } });
    }

    // Should call onTopicChange with last topic (circular wrap)
    expect(mockOnTopicChange).toHaveBeenCalledWith('topic-005');
  });

  /**
   * Test 5: Circular wrap - last topic has first topic as next
   */
  it('renders first topic as next page when at last topic (circular wrap)', () => {
    render(
      <SimpleTopicPager
        topicId="topic-005"
        sortedTopics={mockSortedTopics}
        onTopicChange={jest.fn()}
        renderTopicPage={mockRenderTopicPage}
      />
    );

    // At last topic (topic-005), next should wrap to first topic (topic-001)
    expect(screen.getByTestId('topic-content-topic-004')).toBeTruthy(); // prev
    expect(screen.getByTestId('topic-content-topic-005')).toBeTruthy(); // current
    expect(screen.getByTestId('topic-content-topic-001')).toBeTruthy(); // next (wrapped)
  });

  /**
   * Test 5b: Swiping forward from last topic navigates to first topic
   */
  it('calls onTopicChange with first topicId when swiping forward from last topic', () => {
    const mockOnTopicChange = jest.fn();

    render(
      <SimpleTopicPager
        topicId="topic-005"
        sortedTopics={mockSortedTopics}
        onTopicChange={mockOnTopicChange}
        renderTopicPage={mockRenderTopicPage}
      />
    );

    // Simulate swipe to next page (index 2)
    if (mockOnPageSelected) {
      mockOnPageSelected({ nativeEvent: { position: 2 } });
    }

    // Should call onTopicChange with first topic (circular wrap)
    expect(mockOnTopicChange).toHaveBeenCalledWith('topic-001');
  });

  /**
   * Test 6: Does not call onTopicChange when staying on current page
   */
  it('does not call onTopicChange when staying on current page (index 1)', () => {
    const mockOnTopicChange = jest.fn();

    render(
      <SimpleTopicPager
        topicId="topic-003"
        sortedTopics={mockSortedTopics}
        onTopicChange={mockOnTopicChange}
        renderTopicPage={mockRenderTopicPage}
      />
    );

    // Simulate "swipe" that returns to current page (index 1)
    if (mockOnPageSelected) {
      mockOnPageSelected({ nativeEvent: { position: 1 } });
    }

    // Should NOT call onTopicChange
    expect(mockOnTopicChange).not.toHaveBeenCalled();
  });

  /**
   * Test 7: Handles empty topics array gracefully
   */
  it('handles empty topics array gracefully', () => {
    const result = render(
      <SimpleTopicPager
        topicId="topic-001"
        sortedTopics={[]}
        onTopicChange={jest.fn()}
        renderTopicPage={mockRenderTopicPage}
      />
    );

    // Should render without crashing
    expect(result.root).toBeTruthy();
    // Should still show the pager view
    expect(screen.getByTestId('simple-topic-pager')).toBeTruthy();
  });

  /**
   * Test 8: Handles undefined topics array gracefully
   */
  it('handles undefined topics array gracefully', () => {
    const result = render(
      <SimpleTopicPager
        topicId="topic-001"
        sortedTopics={undefined}
        onTopicChange={jest.fn()}
        renderTopicPage={mockRenderTopicPage}
      />
    );

    // Should render without crashing
    expect(result.root).toBeTruthy();
    expect(screen.getByTestId('simple-topic-pager')).toBeTruthy();
  });

  /**
   * Test 9: Single topic renders only 1 page (no prev/next)
   */
  it('renders only 1 page when there is a single topic', () => {
    const singleTopic: TopicListItem[] = [
      { topic_id: 'only-topic', name: 'Only Topic', sort_order: 1, category: 'EVENT' },
    ];

    render(
      <SimpleTopicPager
        topicId="only-topic"
        sortedTopics={singleTopic}
        onTopicChange={jest.fn()}
        renderTopicPage={mockRenderTopicPage}
      />
    );

    // Should render 1 page only
    expect(screen.getByTestId('pager-page-0')).toBeTruthy();
    expect(screen.queryByTestId('pager-page-1')).toBeNull();

    // Initial page should be 0 (no prev/next)
    expect(mockInitialPage).toBe(0);
  });
});
