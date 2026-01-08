/**
 * Tests for useTopicNavigation Hook
 *
 * Tests navigation metadata calculation for topics across all categories globally.
 * Implements circular navigation - swiping from first topic goes to last topic,
 * and swiping from last topic goes to first topic.
 *
 * @see hooks/topics/use-topic-navigation.ts
 */

import { renderHook } from '@testing-library/react-native';
import { useTopicNavigation } from '@/hooks/topics/use-topic-navigation';
import type { TopicListItem } from '@/types/topics';

/**
 * Mock topic data for testing - single category (EVENT)
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

/**
 * Mock topic data for testing cross-category navigation
 * Global sorted array: EVENT -> PROPHECY -> PARABLE -> THEME
 */
const mockAllTopicsGlobal: TopicListItem[] = [
  // EVENT topics (3)
  {
    topic_id: 'event-001',
    name: 'Creation',
    description: 'God creates the world',
    sort_order: 1,
    category: 'EVENT',
  },
  {
    topic_id: 'event-002',
    name: 'The Fall',
    description: 'Adam and Eve sin',
    sort_order: 2,
    category: 'EVENT',
  },
  {
    topic_id: 'event-003',
    name: 'The Flood',
    description: "Noah's flood",
    sort_order: 3,
    category: 'EVENT',
  },
  // PROPHECY topics (2)
  {
    topic_id: 'prophecy-001',
    name: 'Messiah Promised',
    description: 'Promise of a savior',
    sort_order: 1,
    category: 'PROPHECY',
  },
  {
    topic_id: 'prophecy-002',
    name: 'Virgin Birth',
    description: 'Isaiah 7:14',
    sort_order: 2,
    category: 'PROPHECY',
  },
  // PARABLE topics (2)
  {
    topic_id: 'parable-001',
    name: 'Good Samaritan',
    description: 'Love your neighbor',
    sort_order: 1,
    category: 'PARABLE',
  },
  {
    topic_id: 'parable-002',
    name: 'Prodigal Son',
    description: 'The lost son returns',
    sort_order: 2,
    category: 'PARABLE',
  },
  // THEME topics (2)
  {
    topic_id: 'theme-001',
    name: 'Faith',
    description: 'Trusting in God',
    sort_order: 1,
    category: 'THEME',
  },
  {
    topic_id: 'theme-002',
    name: 'Love',
    description: 'God is love',
    sort_order: 2,
    category: 'THEME',
  },
];

describe('useTopicNavigation', () => {
  describe('mid-list navigation (unchanged behavior)', () => {
    it('returns correct nextTopic and prevTopic for middle topic', () => {
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
  });

  describe('circular navigation at boundaries', () => {
    /**
     * Test: At first topic globally, prevTopic returns last topic across all categories
     */
    it('at first topic globally: prevTopic returns last topic across all categories', () => {
      // First topic globally (Creation - EVENT)
      const { result } = renderHook(() => useTopicNavigation('event-001', mockAllTopicsGlobal));

      // prevTopic should wrap to last topic (Love - THEME)
      expect(result.current.prevTopic).not.toBeNull();
      expect(result.current.prevTopic?.topic_id).toBe('theme-002');
      expect(result.current.prevTopic?.name).toBe('Love');
      expect(result.current.prevTopic?.category).toBe('THEME');

      // Current index should be 0
      expect(result.current.currentIndex).toBe(0);
    });

    /**
     * Test: At first topic globally, canGoPrevious returns true
     */
    it('at first topic globally: canGoPrevious returns true', () => {
      // First topic globally (Creation - EVENT)
      const { result } = renderHook(() => useTopicNavigation('event-001', mockAllTopicsGlobal));

      // With circular navigation, canGoPrevious is always true
      expect(result.current.canGoPrevious).toBe(true);
    });

    /**
     * Test: At last topic globally, nextTopic returns first topic across all categories
     */
    it('at last topic globally: nextTopic returns first topic across all categories', () => {
      // Last topic globally (Love - THEME)
      const { result } = renderHook(() => useTopicNavigation('theme-002', mockAllTopicsGlobal));

      // nextTopic should wrap to first topic (Creation - EVENT)
      expect(result.current.nextTopic).not.toBeNull();
      expect(result.current.nextTopic?.topic_id).toBe('event-001');
      expect(result.current.nextTopic?.name).toBe('Creation');
      expect(result.current.nextTopic?.category).toBe('EVENT');

      // Current index should be 8 (last index in 9-topic array)
      expect(result.current.currentIndex).toBe(8);
    });

    /**
     * Test: At last topic globally, canGoNext returns true
     */
    it('at last topic globally: canGoNext returns true', () => {
      // Last topic globally (Love - THEME)
      const { result } = renderHook(() => useTopicNavigation('theme-002', mockAllTopicsGlobal));

      // With circular navigation, canGoNext is always true
      expect(result.current.canGoNext).toBe(true);
    });

    /**
     * Test: Cross-category navigation works (last EVENT topic -> first PROPHECY topic)
     */
    it('cross-category navigation works: last EVENT topic -> first PROPHECY topic', () => {
      // Last EVENT topic (The Flood)
      const { result } = renderHook(() => useTopicNavigation('event-003', mockAllTopicsGlobal));

      // nextTopic should be first PROPHECY topic (Messiah Promised)
      expect(result.current.nextTopic).not.toBeNull();
      expect(result.current.nextTopic?.topic_id).toBe('prophecy-001');
      expect(result.current.nextTopic?.name).toBe('Messiah Promised');
      expect(result.current.nextTopic?.category).toBe('PROPHECY');

      // prevTopic should be The Fall (still within EVENT)
      expect(result.current.prevTopic).not.toBeNull();
      expect(result.current.prevTopic?.topic_id).toBe('event-002');
      expect(result.current.prevTopic?.category).toBe('EVENT');

      // Current index should be 2
      expect(result.current.currentIndex).toBe(2);
    });

    /**
     * Test: Cross-category navigation works in reverse (first PROPHECY -> last EVENT)
     */
    it('cross-category navigation works in reverse: first PROPHECY -> last EVENT', () => {
      // First PROPHECY topic (Messiah Promised)
      const { result } = renderHook(() => useTopicNavigation('prophecy-001', mockAllTopicsGlobal));

      // prevTopic should be last EVENT topic (The Flood)
      expect(result.current.prevTopic).not.toBeNull();
      expect(result.current.prevTopic?.topic_id).toBe('event-003');
      expect(result.current.prevTopic?.name).toBe('The Flood');
      expect(result.current.prevTopic?.category).toBe('EVENT');

      // nextTopic should be Virgin Birth (still within PROPHECY)
      expect(result.current.nextTopic).not.toBeNull();
      expect(result.current.nextTopic?.topic_id).toBe('prophecy-002');
      expect(result.current.nextTopic?.category).toBe('PROPHECY');

      // Current index should be 3
      expect(result.current.currentIndex).toBe(3);
    });
  });

  describe('edge cases', () => {
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
      const { result } = renderHook(() =>
        useTopicNavigation('non-existent-uuid', mockSortedTopics)
      );

      // All navigation should be disabled
      expect(result.current.canGoNext).toBe(false);
      expect(result.current.canGoPrevious).toBe(false);
      expect(result.current.nextTopic).toBeNull();
      expect(result.current.prevTopic).toBeNull();
      expect(result.current.currentIndex).toBe(-1);
    });

    it('handles single topic array - circular navigation wraps to itself', () => {
      const singleTopic: TopicListItem[] = [
        {
          topic_id: 'only-topic',
          name: 'Only Topic',
          sort_order: 1,
          category: 'EVENT',
        },
      ];

      const { result } = renderHook(() => useTopicNavigation('only-topic', singleTopic));

      // With circular navigation and single topic, next/prev wrap to the same topic
      expect(result.current.canGoNext).toBe(true);
      expect(result.current.canGoPrevious).toBe(true);
      expect(result.current.nextTopic?.topic_id).toBe('only-topic');
      expect(result.current.prevTopic?.topic_id).toBe('only-topic');
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

    it('handles null topics array gracefully', () => {
      const { result } = renderHook(() => useTopicNavigation('topic-uuid-001', null as any));

      // All navigation should be disabled
      expect(result.current.canGoNext).toBe(false);
      expect(result.current.canGoPrevious).toBe(false);
      expect(result.current.nextTopic).toBeNull();
      expect(result.current.prevTopic).toBeNull();
      expect(result.current.currentIndex).toBe(-1);
    });
  });
});
