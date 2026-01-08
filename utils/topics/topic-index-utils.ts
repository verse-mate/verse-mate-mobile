/**
 * Topic Index Calculation Utilities
 *
 * Provides utilities for working with topic positions within a sorted array.
 * Topics use UUID-based IDs and `sort_order` field for ordering within categories.
 *
 * Supports both category-scoped operations and global navigation across all categories.
 * For global circular navigation, topics from all categories (EVENT, PROPHECY, PARABLE, THEME)
 * are combined and sorted by category order first, then by sort_order within each category.
 *
 * @example
 * ```ts
 * // Find index of a topic in the sorted array
 * getTopicIndexInCategory('topic-uuid-003', sortedTopics) // => 2
 *
 * // Get topic at a specific index
 * getTopicFromIndex(2, sortedTopics) // => { topic_id: 'topic-uuid-003', name: 'The Flood', ... }
 *
 * // Check if index is valid
 * isValidTopicIndex(2, sortedTopics) // => true
 *
 * // Circular wrapping for global navigation beyond boundaries
 * wrapCircularTopicIndex(-1, allTopics) // => length - 1 (last topic)
 * wrapCircularTopicIndex(length, allTopics) // => 0 (first topic)
 * ```
 *
 * @see hooks/topics/use-topic-navigation.ts - Uses these utilities for navigation
 * @see components/topics/TopicPagerView.tsx - Uses these for sliding window calculations
 * @see utils/bible/chapter-index-utils.ts - Reference implementation for circular navigation
 * @see Spec: agent-os/specs/fix-topic-swipe-navigation/spec.md
 */

import type { TopicListItem } from '@/types/topics';

/**
 * Get the zero-indexed position of a topic within a sorted topics array
 *
 * Finds the topic by its UUID and returns its position in the array.
 * Topics should be pre-sorted by `sort_order` before calling this function.
 *
 * @param topicId - Topic UUID to find
 * @param sortedTopics - Array of topics sorted by sort_order
 * @returns Zero-indexed position (0 to length-1), or -1 if not found
 *
 * @example
 * ```ts
 * const topics = [
 *   { topic_id: 'uuid-001', name: 'Creation', sort_order: 1 },
 *   { topic_id: 'uuid-002', name: 'The Fall', sort_order: 2 },
 *   { topic_id: 'uuid-003', name: 'The Flood', sort_order: 3 },
 * ];
 *
 * getTopicIndexInCategory('uuid-001', topics) // 0 (first)
 * getTopicIndexInCategory('uuid-002', topics) // 1 (second)
 * getTopicIndexInCategory('uuid-003', topics) // 2 (third)
 * getTopicIndexInCategory('non-existent', topics) // -1 (not found)
 * ```
 */
export function getTopicIndexInCategory(
  topicId: string,
  sortedTopics: TopicListItem[] | undefined | null
): number {
  // Validate inputs
  if (!sortedTopics || !Array.isArray(sortedTopics) || sortedTopics.length === 0) {
    return -1;
  }

  if (!topicId || typeof topicId !== 'string') {
    return -1;
  }

  // Find the topic by its UUID
  const index = sortedTopics.findIndex((topic) => topic.topic_id === topicId);

  return index;
}

/**
 * Get the topic at a specific index in the sorted topics array
 *
 * Returns the topic at the given position, or null if the index is out of bounds.
 *
 * @param index - Zero-indexed position in the array
 * @param sortedTopics - Array of topics sorted by sort_order
 * @returns Topic at the index, or null if out of bounds
 *
 * @example
 * ```ts
 * const topics = [
 *   { topic_id: 'uuid-001', name: 'Creation', sort_order: 1 },
 *   { topic_id: 'uuid-002', name: 'The Fall', sort_order: 2 },
 *   { topic_id: 'uuid-003', name: 'The Flood', sort_order: 3 },
 * ];
 *
 * getTopicFromIndex(0, topics) // { topic_id: 'uuid-001', name: 'Creation', ... }
 * getTopicFromIndex(2, topics) // { topic_id: 'uuid-003', name: 'The Flood', ... }
 * getTopicFromIndex(-1, topics) // null (out of bounds)
 * getTopicFromIndex(3, topics) // null (out of bounds)
 * ```
 */
export function getTopicFromIndex(
  index: number,
  sortedTopics: TopicListItem[] | undefined | null
): TopicListItem | null {
  // Validate inputs
  if (!sortedTopics || !Array.isArray(sortedTopics) || sortedTopics.length === 0) {
    return null;
  }

  // Check bounds
  if (index < 0 || index >= sortedTopics.length) {
    return null;
  }

  return sortedTopics[index];
}

/**
 * Validate if a topic index is within the valid range
 *
 * Checks if the given index is a valid position in the topics array
 * (between 0 and length - 1, inclusive).
 *
 * @param index - Zero-indexed position to validate
 * @param sortedTopics - Array of topics sorted by sort_order
 * @returns True if index is valid (0 to length-1), false otherwise
 *
 * @example
 * ```ts
 * const topics = [
 *   { topic_id: 'uuid-001', name: 'Creation' },
 *   { topic_id: 'uuid-002', name: 'The Fall' },
 * ];
 *
 * isValidTopicIndex(0, topics) // true
 * isValidTopicIndex(1, topics) // true
 * isValidTopicIndex(-1, topics) // false
 * isValidTopicIndex(2, topics) // false
 * ```
 */
export function isValidTopicIndex(
  index: number,
  sortedTopics: TopicListItem[] | undefined | null
): boolean {
  // Validate inputs
  if (!sortedTopics || !Array.isArray(sortedTopics) || sortedTopics.length === 0) {
    return false;
  }

  // Check bounds
  return index >= 0 && index < sortedTopics.length;
}

/**
 * Wrap a topic index circularly within valid range for global topic navigation
 *
 * Enables circular navigation across all topic categories (EVENT, PROPHECY, PARABLE, THEME):
 * - Negative indices wrap to end of topics (e.g., -1 -> length - 1 for last topic)
 * - Indices beyond max wrap to beginning (e.g., length -> 0 for first topic)
 * - Valid indices (0 to length - 1) pass through unchanged
 *
 * Uses modulo arithmetic: `((index % total) + total) % total`
 * This handles both negative and positive overflow correctly.
 *
 * This function mirrors the `wrapCircularIndex` pattern from Bible chapter navigation,
 * enabling seamless circular swiping through all topics across all categories.
 *
 * @param absoluteIndex - The topic index to wrap (can be negative or >= length)
 * @param allTopics - Array of all topics sorted globally by category order then sort_order
 * @returns Wrapped index always within 0 to (length - 1) range, or -1 if allTopics is invalid
 *
 * @example
 * ```ts
 * // With 10 topics (indices 0-9):
 * wrapCircularTopicIndex(-1, allTopics) // 9 (last topic)
 * wrapCircularTopicIndex(-2, allTopics) // 8 (second-to-last topic)
 * wrapCircularTopicIndex(10, allTopics) // 0 (first topic)
 * wrapCircularTopicIndex(11, allTopics) // 1 (second topic)
 * wrapCircularTopicIndex(5, allTopics)  // 5 (unchanged, within valid range)
 * ```
 *
 * @see utils/bible/chapter-index-utils.ts - Reference implementation for circular Bible navigation
 * @see Spec: agent-os/specs/fix-topic-swipe-navigation/spec.md
 */
export function wrapCircularTopicIndex(
  absoluteIndex: number,
  allTopics: TopicListItem[] | undefined | null
): number {
  // Handle invalid allTopics
  if (!allTopics || !Array.isArray(allTopics) || allTopics.length === 0) {
    return -1;
  }

  const totalTopics = allTopics.length;

  // Use modulo arithmetic that handles negative numbers correctly
  // ((index % total) + total) % total ensures result is always positive
  return ((absoluteIndex % totalTopics) + totalTopics) % totalTopics;
}
