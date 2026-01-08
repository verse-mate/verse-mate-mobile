/**
 * Tests for wrapCircularTopicIndex utility function
 *
 * Tests circular wrapping of topic indices across all categories globally:
 * - Negative indices wrap to end of topics (e.g., -1 -> length - 1 for last topic)
 * - Indices beyond max wrap to beginning (e.g., length -> 0 for first topic)
 * - Valid indices (0 to length-1) pass through unchanged
 *
 * @see Spec: agent-os/specs/fix-topic-swipe-navigation/spec.md
 */

import type { TopicListItem } from '@/types/topics';
import { wrapCircularTopicIndex } from '@/utils/topics/topic-index-utils';

/**
 * Mock global topics data for testing
 * Represents topics across all categories sorted by category order then sort_order
 * Category order: EVENT -> PROPHECY -> PARABLE -> THEME
 */
const mockAllTopics: TopicListItem[] = [
  // EVENT topics (index 0-2)
  {
    topic_id: 'event-001',
    name: 'Creation',
    sort_order: 1,
    category: 'EVENT',
  },
  {
    topic_id: 'event-002',
    name: 'The Fall',
    sort_order: 2,
    category: 'EVENT',
  },
  {
    topic_id: 'event-003',
    name: 'The Flood',
    sort_order: 3,
    category: 'EVENT',
  },
  // PROPHECY topics (index 3-4)
  {
    topic_id: 'prophecy-001',
    name: 'Messianic Prophecy',
    sort_order: 1,
    category: 'PROPHECY',
  },
  {
    topic_id: 'prophecy-002',
    name: 'End Times',
    sort_order: 2,
    category: 'PROPHECY',
  },
  // PARABLE topics (index 5-6)
  {
    topic_id: 'parable-001',
    name: 'Prodigal Son',
    sort_order: 1,
    category: 'PARABLE',
  },
  {
    topic_id: 'parable-002',
    name: 'Good Samaritan',
    sort_order: 2,
    category: 'PARABLE',
  },
  // THEME topics (index 7-9)
  {
    topic_id: 'theme-001',
    name: 'Faith',
    sort_order: 1,
    category: 'THEME',
  },
  {
    topic_id: 'theme-002',
    name: 'Love',
    sort_order: 2,
    category: 'THEME',
  },
  {
    topic_id: 'theme-003',
    name: 'Hope',
    sort_order: 3,
    category: 'THEME',
  },
];
// Total: 10 topics (indices 0-9)

describe('wrapCircularTopicIndex', () => {
  describe('wrapping negative indices', () => {
    it('should wrap index -1 to last topic index (length - 1)', () => {
      // With 10 topics, -1 should wrap to index 9 (last topic)
      const result = wrapCircularTopicIndex(-1, mockAllTopics);
      expect(result).toBe(9);
    });

    it('should wrap index -2 to second-to-last topic index', () => {
      // With 10 topics, -2 should wrap to index 8
      const result = wrapCircularTopicIndex(-2, mockAllTopics);
      expect(result).toBe(8);
    });
  });

  describe('wrapping indices beyond max', () => {
    it('should wrap index equal to length to 0 (first topic)', () => {
      // With 10 topics (0-9), index 10 should wrap to 0
      const result = wrapCircularTopicIndex(10, mockAllTopics);
      expect(result).toBe(0);
    });

    it('should wrap index (length + 1) to 1 (second topic)', () => {
      // With 10 topics, index 11 should wrap to 1
      const result = wrapCircularTopicIndex(11, mockAllTopics);
      expect(result).toBe(1);
    });
  });

  describe('valid indices within range', () => {
    it('should return 0 unchanged for first topic', () => {
      const result = wrapCircularTopicIndex(0, mockAllTopics);
      expect(result).toBe(0);
    });

    it('should return max index unchanged for last topic', () => {
      // With 10 topics, max valid index is 9
      const result = wrapCircularTopicIndex(9, mockAllTopics);
      expect(result).toBe(9);
    });

    it('should return mid-range index unchanged', () => {
      const result = wrapCircularTopicIndex(5, mockAllTopics);
      expect(result).toBe(5);
    });
  });

  describe('edge cases with invalid allTopics', () => {
    it('should return -1 for undefined allTopics', () => {
      const result = wrapCircularTopicIndex(0, undefined);
      expect(result).toBe(-1);
    });

    it('should return -1 for null allTopics', () => {
      const result = wrapCircularTopicIndex(0, null);
      expect(result).toBe(-1);
    });

    it('should return -1 for empty allTopics array', () => {
      const result = wrapCircularTopicIndex(0, []);
      expect(result).toBe(-1);
    });
  });
});
