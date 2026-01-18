/**
 * Local Bible Hook
 *
 * Hook for reading Bible data from local SQLite storage
 */

import { useQuery } from '@tanstack/react-query';
import { getLocalBibleChapter, isBibleVersionDownloaded } from '@/services/offline';

/**
 * Check if a Bible version is available locally
 */
export function useIsBibleVersionLocal(versionKey: string) {
  return useQuery({
    queryKey: ['local-bible-version-available', versionKey],
    queryFn: () => isBibleVersionDownloaded(versionKey),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Get Bible chapter from local storage
 */
export function useLocalBibleChapter(
  versionKey: string,
  bookId: number,
  chapterNumber: number,
  enabled = true
) {
  return useQuery({
    queryKey: ['local-bible-chapter', versionKey, bookId, chapterNumber],
    queryFn: () => getLocalBibleChapter(versionKey, bookId, chapterNumber),
    enabled: enabled && bookId > 0 && chapterNumber > 0,
    staleTime: Number.POSITIVE_INFINITY, // Local data doesn't change
  });
}
