/**
 * useTopicNavigation Hook
 *
 * Encapsulates circular navigation logic for topics across ALL categories globally.
 * Calculates next/previous topic references with circular wrap-around at boundaries.
 *
 * Navigation is circular across all categories (EVENT, PROPHECY, PARABLE, THEME):
 * - At the first topic globally: prevTopic wraps to the last topic
 * - At the last topic globally: nextTopic wraps to the first topic
 * - Cross-category navigation is seamless (e.g., last EVENT -> first PROPHECY)
 *
 * This mirrors the circular Bible chapter navigation pattern where swiping
 * backward from Genesis 1 goes to Revelation 22, and vice versa.
 *
 * @example
 * ```tsx
 * const { nextTopic, prevTopic, canGoNext, canGoPrevious, currentIndex } = useTopicNavigation(
 *   'topic-uuid-003', // The Flood
 *   allSortedTopics   // Pre-sorted by category order, then sort_order within category
 * );
 *
 * // nextTopic: { topic_id: 'topic-uuid-004', name: 'Tower of Babel', ... }
 * // prevTopic: { topic_id: 'topic-uuid-002', name: 'The Fall', ... }
 * // canGoNext: true (always true when valid topics exist)
 * // canGoPrevious: true (always true when valid topics exist)
 * // currentIndex: 2
 *
 * // At first topic globally (index 0):
 * // prevTopic: { topic_id: 'last-topic-uuid', name: 'Last Topic', ... } (wraps around)
 * // canGoPrevious: true (circular navigation)
 *
 * // At last topic globally (index length-1):
 * // nextTopic: { topic_id: 'first-topic-uuid', name: 'First Topic', ... } (wraps around)
 * // canGoNext: true (circular navigation)
 * ```
 *
 * @see utils/topics/topic-index-utils.ts - Index calculation utilities including wrapCircularTopicIndex
 * @see hooks/bible/use-chapter-navigation.ts - Similar circular pattern for Bible chapters
 * @see Spec: agent-os/specs/fix-topic-swipe-navigation/spec.md
 */

import { useMemo } from 'react';
import type { TopicListItem } from '@/types/topics';
import {
  getTopicFromIndex,
  getTopicIndexInCategory,
  wrapCircularTopicIndex,
} from '@/utils/topics/topic-index-utils';

/**
 * Navigation result with next/previous topic references.
 *
 * With circular navigation enabled:
 * - `nextTopic` is always non-null when valid topics exist (wraps from last to first)
 * - `prevTopic` is always non-null when valid topics exist (wraps from first to last)
 * - `canGoNext` and `canGoPrevious` are always true when valid topics exist
 */
export interface TopicNavigation {
  /** Next topic reference (wraps from last topic to first topic when at end) */
  nextTopic: TopicListItem | null;
  /** Previous topic reference (wraps from first topic to last topic when at start) */
  prevTopic: TopicListItem | null;
  /** Whether next navigation is available (always true when valid topics exist) */
  canGoNext: boolean;
  /** Whether previous navigation is available (always true when valid topics exist) */
  canGoPrevious: boolean;
  /** Current topic's zero-indexed position in the global sorted array */
  currentIndex: number;
}

/**
 * Hook to calculate next/previous topic navigation with circular wrap-around.
 *
 * @param topicId - Current topic UUID
 * @param allTopics - Array of ALL topics sorted globally (category order, then sort_order within category)
 * @returns Navigation metadata with next/prev topic references (circular at boundaries)
 *
 * @example
 * ```ts
 * // First topic globally - circular navigation wraps to last
 * useTopicNavigation('first-uuid', allTopics)
 * // => { prevTopic: { last topic }, canGoPrevious: true, currentIndex: 0, ... }
 *
 * // Middle topic - normal navigation
 * useTopicNavigation('middle-uuid', allTopics)
 * // => { prevTopic: {...}, nextTopic: {...}, canGoNext: true, canGoPrevious: true, ... }
 *
 * // Last topic globally - circular navigation wraps to first
 * useTopicNavigation('last-uuid', allTopics)
 * // => { nextTopic: { first topic }, canGoNext: true, currentIndex: length-1, ... }
 * ```
 */
export function useTopicNavigation(
  topicId: string,
  allTopics: TopicListItem[] | undefined | null
): TopicNavigation {
  return useMemo(() => {
    // Handle undefined or empty topics array
    if (!allTopics || !Array.isArray(allTopics) || allTopics.length === 0) {
      return {
        nextTopic: null,
        prevTopic: null,
        canGoNext: false,
        canGoPrevious: false,
        currentIndex: -1,
      };
    }

    // Find current topic's index
    const currentIndex = getTopicIndexInCategory(topicId, allTopics);

    // Handle topic not found
    if (currentIndex === -1) {
      return {
        nextTopic: null,
        prevTopic: null,
        canGoNext: false,
        canGoPrevious: false,
        currentIndex: -1,
      };
    }

    // Calculate next topic with circular wrapping
    // wrapCircularTopicIndex handles overflow: (length) -> 0
    const nextIndex = wrapCircularTopicIndex(currentIndex + 1, allTopics);
    const nextTopic = getTopicFromIndex(nextIndex, allTopics);

    // Calculate previous topic with circular wrapping
    // wrapCircularTopicIndex handles underflow: (-1) -> (length - 1)
    const prevIndex = wrapCircularTopicIndex(currentIndex - 1, allTopics);
    const prevTopic = getTopicFromIndex(prevIndex, allTopics);

    // With circular navigation, we can always navigate when valid topics exist
    return {
      nextTopic,
      prevTopic,
      canGoNext: nextTopic !== null,
      canGoPrevious: prevTopic !== null,
      currentIndex,
    };
  }, [topicId, allTopics]);
}
