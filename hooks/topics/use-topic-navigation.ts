/**
 * useTopicNavigation Hook
 *
 * Encapsulates navigation logic for topics within a single category.
 * Calculates next/previous topic references and boundary flags.
 *
 * Unlike Bible chapter navigation which spans across books,
 * topic navigation is scoped to a single category and uses
 * UUID-based IDs with sort_order for ordering.
 *
 * @example
 * ```tsx
 * const { nextTopic, prevTopic, canGoNext, canGoPrevious, currentIndex } = useTopicNavigation(
 *   'topic-uuid-003', // The Flood
 *   sortedTopics      // Pre-sorted by sort_order
 * );
 *
 * // nextTopic: { topic_id: 'topic-uuid-004', name: 'Tower of Babel', ... }
 * // prevTopic: { topic_id: 'topic-uuid-002', name: 'The Fall', ... }
 * // canGoNext: true
 * // canGoPrevious: true
 * // currentIndex: 2
 * ```
 *
 * @see utils/topics/topic-index-utils.ts - Index calculation utilities
 * @see hooks/bible/use-chapter-navigation.ts - Similar pattern for Bible chapters
 */

import { useMemo } from 'react';
import type { TopicListItem } from '@/types/topics';
import { getTopicFromIndex, getTopicIndexInCategory } from '@/utils/topics/topic-index-utils';

/**
 * Navigation result with next/previous topic references
 */
export interface TopicNavigation {
  /** Next topic reference, or null if at category end */
  nextTopic: TopicListItem | null;
  /** Previous topic reference, or null if at category start */
  prevTopic: TopicListItem | null;
  /** Whether next navigation is available */
  canGoNext: boolean;
  /** Whether previous navigation is available */
  canGoPrevious: boolean;
  /** Current topic's zero-indexed position in the sorted array */
  currentIndex: number;
}

/**
 * Hook to calculate next/previous topic navigation
 *
 * @param topicId - Current topic UUID
 * @param sortedTopics - Array of topics sorted by sort_order (within same category)
 * @returns Navigation metadata with next/prev topic references
 *
 * @example
 * ```ts
 * // First topic in category
 * useTopicNavigation('first-uuid', sortedTopics)
 * // => { prevTopic: null, canGoPrevious: false, currentIndex: 0, ... }
 *
 * // Middle topic in category
 * useTopicNavigation('middle-uuid', sortedTopics)
 * // => { prevTopic: {...}, nextTopic: {...}, canGoNext: true, canGoPrevious: true, ... }
 *
 * // Last topic in category
 * useTopicNavigation('last-uuid', sortedTopics)
 * // => { nextTopic: null, canGoNext: false, currentIndex: length-1, ... }
 * ```
 */
export function useTopicNavigation(
  topicId: string,
  sortedTopics: TopicListItem[] | undefined | null
): TopicNavigation {
  return useMemo(() => {
    // Handle undefined or empty topics array
    if (!sortedTopics || !Array.isArray(sortedTopics) || sortedTopics.length === 0) {
      return {
        nextTopic: null,
        prevTopic: null,
        canGoNext: false,
        canGoPrevious: false,
        currentIndex: -1,
      };
    }

    // Find current topic's index
    const currentIndex = getTopicIndexInCategory(topicId, sortedTopics);

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

    // Calculate next topic (if not at end)
    const nextTopic = getTopicFromIndex(currentIndex + 1, sortedTopics);

    // Calculate previous topic (if not at start)
    const prevTopic = getTopicFromIndex(currentIndex - 1, sortedTopics);

    return {
      nextTopic,
      prevTopic,
      canGoNext: nextTopic !== null,
      canGoPrevious: prevTopic !== null,
      currentIndex,
    };
  }, [topicId, sortedTopics]);
}
