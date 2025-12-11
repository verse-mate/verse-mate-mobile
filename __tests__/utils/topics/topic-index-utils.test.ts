/**
 * Tests for Topic Index Utilities
 *
 * Tests for calculating topic positions within a category-sorted array.
 * Topics use UUID-based IDs and sort_order field for ordering.
 *
 * @see utils/topics/topic-index-utils.ts
 */

import type { TopicListItem } from '@/types/topics';
import {
  getTopicFromIndex,
  getTopicIndexInCategory,
  isValidTopicIndex,
} from '@/utils/topics/topic-index-utils';

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

describe('topic-index-utils', () => {
  describe('getTopicIndexInCategory', () => {
    it('returns correct index for valid topic ID', () => {
      // First topic
      expect(getTopicIndexInCategory('topic-uuid-001', mockSortedTopics)).toBe(0);

      // Middle topic
      expect(getTopicIndexInCategory('topic-uuid-003', mockSortedTopics)).toBe(2);

      // Last topic
      expect(getTopicIndexInCategory('topic-uuid-005', mockSortedTopics)).toBe(4);
    });

    it('returns -1 for invalid topic ID', () => {
      expect(getTopicIndexInCategory('non-existent-uuid', mockSortedTopics)).toBe(-1);
      expect(getTopicIndexInCategory('', mockSortedTopics)).toBe(-1);
    });

    it('returns -1 for empty topics array', () => {
      expect(getTopicIndexInCategory('topic-uuid-001', [])).toBe(-1);
    });

    it('handles undefined/null inputs gracefully', () => {
      expect(getTopicIndexInCategory('topic-uuid-001', undefined as any)).toBe(-1);
      expect(getTopicIndexInCategory('topic-uuid-001', null as any)).toBe(-1);
      expect(getTopicIndexInCategory(undefined as any, mockSortedTopics)).toBe(-1);
      expect(getTopicIndexInCategory(null as any, mockSortedTopics)).toBe(-1);
    });
  });

  describe('getTopicFromIndex', () => {
    it('returns correct topic for valid index', () => {
      // First index
      const first = getTopicFromIndex(0, mockSortedTopics);
      expect(first).not.toBeNull();
      expect(first?.topic_id).toBe('topic-uuid-001');
      expect(first?.name).toBe('Creation');

      // Middle index
      const middle = getTopicFromIndex(2, mockSortedTopics);
      expect(middle).not.toBeNull();
      expect(middle?.topic_id).toBe('topic-uuid-003');
      expect(middle?.name).toBe('The Flood');

      // Last index
      const last = getTopicFromIndex(4, mockSortedTopics);
      expect(last).not.toBeNull();
      expect(last?.topic_id).toBe('topic-uuid-005');
      expect(last?.name).toBe('Call of Abraham');
    });

    it('returns null for out-of-bounds index', () => {
      expect(getTopicFromIndex(-1, mockSortedTopics)).toBeNull();
      expect(getTopicFromIndex(-100, mockSortedTopics)).toBeNull();
      expect(getTopicFromIndex(5, mockSortedTopics)).toBeNull();
      expect(getTopicFromIndex(100, mockSortedTopics)).toBeNull();
    });

    it('returns null for empty topics array', () => {
      expect(getTopicFromIndex(0, [])).toBeNull();
    });

    it('handles undefined/null inputs gracefully', () => {
      expect(getTopicFromIndex(0, undefined as any)).toBeNull();
      expect(getTopicFromIndex(0, null as any)).toBeNull();
    });
  });

  describe('isValidTopicIndex', () => {
    it('returns true for valid indices', () => {
      expect(isValidTopicIndex(0, mockSortedTopics)).toBe(true);
      expect(isValidTopicIndex(2, mockSortedTopics)).toBe(true);
      expect(isValidTopicIndex(4, mockSortedTopics)).toBe(true);
    });

    it('returns false for out-of-bounds indices', () => {
      expect(isValidTopicIndex(-1, mockSortedTopics)).toBe(false);
      expect(isValidTopicIndex(5, mockSortedTopics)).toBe(false);
      expect(isValidTopicIndex(100, mockSortedTopics)).toBe(false);
    });

    it('returns false for empty topics array', () => {
      expect(isValidTopicIndex(0, [])).toBe(false);
    });

    it('handles undefined/null inputs gracefully', () => {
      expect(isValidTopicIndex(0, undefined as any)).toBe(false);
      expect(isValidTopicIndex(0, null as any)).toBe(false);
    });
  });
});
