/**
 * Local Topics Hook
 *
 * Hook for reading topics data from local SQLite storage
 */

import { useQuery } from '@tanstack/react-query';
import { getLocalTopics, isTopicsDownloaded } from '@/services/offline';

/**
 * Check if topics are available locally for a language
 */
export function useIsTopicsLocal(languageCode: string) {
  return useQuery({
    queryKey: ['local-topics-available', languageCode],
    queryFn: () => isTopicsDownloaded(languageCode),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Get all topics for a language from local storage
 */
export function useLocalTopics(languageCode: string, enabled = true) {
  return useQuery({
    queryKey: ['local-topics', languageCode],
    queryFn: () => getLocalTopics(languageCode),
    enabled,
    staleTime: Number.POSITIVE_INFINITY, // Local data doesn't change
  });
}
