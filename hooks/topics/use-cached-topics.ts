/**
 * useCachedTopics Hook
 *
 * Provides instant access to topics data with AsyncStorage caching.
 * Topics are loaded from cache immediately and updated in the background.
 * Since topics rarely change, this eliminates loading delays in the navigation modal.
 *
 * Features:
 * - Instant cache loading on mount (no loading state visible to user)
 * - Background API updates
 * - Automatic cache persistence
 * - Per-category caching (EVENT, PROPHECY, PARABLE, THEME)
 * - Stale-while-revalidate pattern
 *
 * @example
 * ```tsx
 * const { topics, isRefreshing } = useCachedTopics('EVENT');
 * // topics is instantly available from cache
 * // isRefreshing indicates background update in progress
 * ```
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { useOfflineContext } from '@/contexts/OfflineContext';
import { getLocalTopics } from '@/services/offline';
import { useTopicsSearch } from '@/src/api';
import type { TopicCategory, TopicListItem } from '@/types/topics';

// Storage keys for each category
const STORAGE_KEYS = {
  EVENT: '@versemate:cached_topics_events',
  PROPHECY: '@versemate:cached_topics_prophecies',
  PARABLE: '@versemate:cached_topics_parables',
  THEME: '@versemate:cached_topics_themes',
} as const;

// In-memory cache to prevent redundant AsyncStorage reads
const memoryCache: Record<TopicCategory, TopicListItem[] | null> = {
  EVENT: null,
  PROPHECY: null,
  PARABLE: null,
  THEME: null,
};

export interface UseCachedTopicsResult {
  /** Topics data (from cache or fresh API) */
  topics: TopicListItem[];
  /** Whether background refresh is in progress */
  isRefreshing: boolean;
  /** Whether this is the first load (cache empty) */
  isInitialLoad: boolean;
}

/**
 * Hook to fetch topics with instant cache access
 *
 * @param category - Topic category to fetch
 * @param enabled - Whether to enable fetching (default: true)
 * @returns Topics data with loading states
 */
export function useCachedTopics(category: TopicCategory, enabled = true): UseCachedTopicsResult {
  const { isInitialized } = useOfflineContext();

  // State for cached topics (instant)
  const [cachedTopics, setCachedTopics] = useState<TopicListItem[]>(memoryCache[category] || []);
  const [isInitialLoad, setIsInitialLoad] = useState(!memoryCache[category]);

  // Fetch fresh topics from API (background)
  const { data: apiTopics = [], isLoading: isRefreshing } = useTopicsSearch(category, {
    enabled,
  });

  // Load from AsyncStorage (instant) and SQLite (once DB is ready).
  // Re-runs when isInitialized flips true so that a first-mount attempt that
  // failed because the seed was still being copied gets a second chance.
  // biome-ignore lint/correctness/useExhaustiveDependencies: isInitialized triggers retry after seed DB is ready
  useEffect(() => {
    if (!enabled) return;
    if (!isInitialized) return; // Wait for DB to be ready before hitting SQLite
    if (memoryCache[category]) return;

    loadCachedTopics(category).then((cached) => {
      if (cached.length > 0) {
        setCachedTopics(cached);
        memoryCache[category] = cached;
      }
      // Always mark load complete so the UI never stays stuck in "loading"
      setIsInitialLoad(false);
    });
  }, [category, enabled, isInitialized]);

  // Update cache when fresh API data arrives
  useEffect(() => {
    if (apiTopics.length > 0 && enabled) {
      const topics = apiTopics as TopicListItem[];
      setCachedTopics(topics);
      memoryCache[category] = topics;
      saveCachedTopics(category, topics);
      setIsInitialLoad(false);
    }
  }, [apiTopics, category, enabled]);

  return {
    topics: cachedTopics,
    isRefreshing,
    isInitialLoad,
  };
}

/**
 * Load topics from AsyncStorage cache, falling back to local SQLite when the
 * cache is cold (fresh install, cleared storage, or first run without internet).
 * The seed database pre-populates SQLite with English topics, so this always
 * returns something useful even on a first launch with no network.
 */
async function loadCachedTopics(category: TopicCategory): Promise<TopicListItem[]> {
  // 1. AsyncStorage — fastest, populated after first successful API fetch
  try {
    const storageKey = STORAGE_KEYS[category];
    const cached = await AsyncStorage.getItem(storageKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (error) {
    console.error(`useCachedTopics: Failed to load ${category} from cache:`, error);
  }

  // 2. SQLite fallback — available from the bundled seed DB or a manual download
  try {
    const localTopics = await getLocalTopics('en');
    const filtered = localTopics
      .filter((t) => t.category === category)
      .map((t) => ({
        topic_id: t.topic_id,
        name: t.name,
        description: null,
        sort_order: t.sort_order,
        category: t.category as TopicCategory,
      }));
    if (filtered.length > 0) return filtered;
  } catch {
    // DB not yet initialised or empty — silently continue
  }

  return [];
}

/**
 * Save topics to AsyncStorage cache
 */
async function saveCachedTopics(category: TopicCategory, topics: TopicListItem[]): Promise<void> {
  try {
    const storageKey = STORAGE_KEYS[category];
    await AsyncStorage.setItem(storageKey, JSON.stringify(topics));
  } catch (error) {
    console.error(`useCachedTopics: Failed to save ${category} to cache:`, error);
  }
}

/**
 * Preload all topic categories into cache
 * Call this early in app lifecycle to ensure instant availability
 */
export async function preloadAllTopicsCache(): Promise<void> {
  const categories: TopicCategory[] = ['EVENT', 'PROPHECY', 'PARABLE', 'THEME'];
  await Promise.all(
    categories.map(async (category) => {
      const cached = await loadCachedTopics(category);
      if (cached.length > 0) {
        memoryCache[category] = cached;
      }
    })
  );
}

/**
 * FOR TEST ENVIRONMENTS ONLY
 * Clears memory cache and AsyncStorage cache
 */
export async function __TEST_ONLY_CLEAR_CACHE(): Promise<void> {
  memoryCache.EVENT = null;
  memoryCache.PROPHECY = null;
  memoryCache.PARABLE = null;
  memoryCache.THEME = null;
  await Promise.all(Object.values(STORAGE_KEYS).map((key) => AsyncStorage.removeItem(key)));
}
