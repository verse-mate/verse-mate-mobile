/**
 * Tests for useTopicNavigation Hook
 *
 * Tests navigation metadata calculation for topics within a category.
 * Returns next/previous topic references and boundary flags.
 *
 * @see hooks/topics/use-topic-navigation.ts
 */

import { renderHook } from '@testing-library/react-native';
import { useTopicNavigation } from '@/hooks/topics/use-topic-navigation';
import type { TopicListItem } from '@/types/topics';

/**
 * Mock topic data for testing
 * Sorted by sort_order within the same category
 */
const mockSortedTopics: TopicListItem[] = [
  {
    topic_id: 'topic-uuid-001',
    name: 'Creation',
    description: 'God creates the world',
    sort_order: 1,
    category: 'EVENT',
  },
  {
    topic_id: 'topic-uuid-002',
    name: 'The Fall',
    description: 'Adam and Eve sin',
    sort_order: 2,
    category: 'EVENT',
  },
  {
    topic_id: 'topic-uuid-003',
    name: 'The Flood',
    description: "Noah's flood",
    sort_order: 3,
    category: 'EVENT',
  },
  {
    topic_id: 'topic-uuid-004',
    name: 'Tower of Babel',
    description: 'Languages confused',
    sort_order: 4,
    category: 'EVENT',
  },
  {
    topic_id: 'topic-uuid-005',
    name: 'Call of Abraham',
    description: 'God calls Abraham',
    sort_order: 5,
    category: 'EVENT',
  },
];

describe('useTopicNavigation', () => {
  it('returns correct nextTopic and prevTopic for middle topic in category', () => {
    // Topic at index 2 (The Flood)
    const { result } = renderHook(() => useTopicNavigation('topic-uuid-003', mockSortedTopics));

    // Should have both next and previous
    expect(result.current.canGoNext).toBe(true);
    expect(result.current.canGoPrevious).toBe(true);

    // Previous topic should be "The Fall" (index 1)
    expect(result.current.prevTopic).not.toBeNull();
    expect(result.current.prevTopic?.topic_id).toBe('topic-uuid-002');
    expect(result.current.prevTopic?.name).toBe('The Fall');

    // Next topic should be "Tower of Babel" (index 3)
    expect(result.current.nextTopic).not.toBeNull();
    expect(result.current.nextTopic?.topic_id).toBe('topic-uuid-004');
    expect(result.current.nextTopic?.name).toBe('Tower of Babel');

    // Current index should be 2
    expect(result.current.currentIndex).toBe(2);
  });

  it('returns canGoPrevious: false and prevTopic: null for first topic', () => {
    // First topic (Creation)
    const { result } = renderHook(() => useTopicNavigation('topic-uuid-001', mockSortedTopics));

    // First topic cannot go previous
    expect(result.current.canGoPrevious).toBe(false);
    expect(result.current.prevTopic).toBeNull();

    // But can go next
    expect(result.current.canGoNext).toBe(true);
    expect(result.current.nextTopic).not.toBeNull();
    expect(result.current.nextTopic?.topic_id).toBe('topic-uuid-002');

    // Current index should be 0
    expect(result.current.currentIndex).toBe(0);
  });

  it('returns canGoNext: false and nextTopic: null for last topic', () => {
    // Last topic (Call of Abraham)
    const { result } = renderHook(() => useTopicNavigation('topic-uuid-005', mockSortedTopics));

    // Last topic cannot go next
    expect(result.current.canGoNext).toBe(false);
    expect(result.current.nextTopic).toBeNull();

    // But can go previous
    expect(result.current.canGoPrevious).toBe(true);
    expect(result.current.prevTopic).not.toBeNull();
    expect(result.current.prevTopic?.topic_id).toBe('topic-uuid-004');

    // Current index should be 4
    expect(result.current.currentIndex).toBe(4);
  });

  it('handles empty topics array gracefully', () => {
    const { result } = renderHook(() => useTopicNavigation('topic-uuid-001', []));

    // All navigation should be disabled
    expect(result.current.canGoNext).toBe(false);
    expect(result.current.canGoPrevious).toBe(false);
    expect(result.current.nextTopic).toBeNull();
    expect(result.current.prevTopic).toBeNull();
    expect(result.current.currentIndex).toBe(-1);
  });

  it('handles topic not found in array gracefully', () => {
    const { result } = renderHook(() => useTopicNavigation('non-existent-uuid', mockSortedTopics));

    // All navigation should be disabled
    expect(result.current.canGoNext).toBe(false);
    expect(result.current.canGoPrevious).toBe(false);
    expect(result.current.nextTopic).toBeNull();
    expect(result.current.prevTopic).toBeNull();
    expect(result.current.currentIndex).toBe(-1);
  });

  it('handles single topic array correctly', () => {
    const singleTopic: TopicListItem[] = [
      {
        topic_id: 'only-topic',
        name: 'Only Topic',
        sort_order: 1,
        category: 'EVENT',
      },
    ];

    const { result } = renderHook(() => useTopicNavigation('only-topic', singleTopic));

    // Single topic has no neighbors
    expect(result.current.canGoNext).toBe(false);
    expect(result.current.canGoPrevious).toBe(false);
    expect(result.current.nextTopic).toBeNull();
    expect(result.current.prevTopic).toBeNull();
    expect(result.current.currentIndex).toBe(0);
  });

  it('handles undefined topics array gracefully', () => {
    const { result } = renderHook(() => useTopicNavigation('topic-uuid-001', undefined as any));

    // All navigation should be disabled
    expect(result.current.canGoNext).toBe(false);
    expect(result.current.canGoPrevious).toBe(false);
    expect(result.current.nextTopic).toBeNull();
    expect(result.current.prevTopic).toBeNull();
    expect(result.current.currentIndex).toBe(-1);
  });
});
