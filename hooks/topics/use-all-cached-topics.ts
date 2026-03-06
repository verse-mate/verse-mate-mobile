/**
 * useAllCachedTopics Hook
 *
 * Combines all topic categories into a single sorted array using useCachedTopics.
 * Unlike useAllTopics (which only uses API calls), this hook falls back to the
 * local seed database when the API is unavailable (e.g., CI environments).
 *
 * Used by SimpleTopicPager for circular navigation across all topics.
 */

import { useMemo } from 'react';
import type { TopicCategory, TopicListItem } from '@/types/topics';
import { useCachedTopics } from './use-cached-topics';

const CATEGORY_ORDER: TopicCategory[] = ['EVENT', 'PROPHECY', 'PARABLE', 'THEME'];

export function useAllCachedTopics() {
  const eventResult = useCachedTopics('EVENT');
  const prophecyResult = useCachedTopics('PROPHECY');
  const parableResult = useCachedTopics('PARABLE');
  const themeResult = useCachedTopics('THEME');

  const isLoading =
    eventResult.isInitialLoad ||
    prophecyResult.isInitialLoad ||
    parableResult.isInitialLoad ||
    themeResult.isInitialLoad;

  const data = useMemo((): TopicListItem[] => {
    if (isLoading) return [];

    const categoryData: Record<TopicCategory, TopicListItem[]> = {
      EVENT: eventResult.topics,
      PROPHECY: prophecyResult.topics,
      PARABLE: parableResult.topics,
      THEME: themeResult.topics,
    };

    const allTopics: TopicListItem[] = [];
    for (const category of CATEGORY_ORDER) {
      const categoryTopics = [...categoryData[category]];
      categoryTopics.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
      allTopics.push(...categoryTopics);
    }

    return allTopics;
  }, [
    isLoading,
    eventResult.topics,
    prophecyResult.topics,
    parableResult.topics,
    themeResult.topics,
  ]);

  return { data, isLoading };
}
