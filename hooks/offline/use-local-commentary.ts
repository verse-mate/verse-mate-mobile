/**
 * Local Commentary Hook
 *
 * Hook for reading commentary/explanation data from local SQLite storage
 */

import { useQuery } from '@tanstack/react-query';
import { getLocalCommentary, isCommentaryDownloaded } from '@/services/offline';

/**
 * Check if commentaries are available locally for a language
 */
export function useIsCommentaryLocal(languageCode: string) {
  return useQuery({
    queryKey: ['local-commentary-available', languageCode],
    queryFn: () => isCommentaryDownloaded(languageCode),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Get commentary for a chapter from local storage
 */
export function useLocalCommentary(
  languageCode: string,
  bookId: number,
  chapterNumber: number,
  enabled = true
) {
  return useQuery({
    queryKey: ['local-commentary', languageCode, bookId, chapterNumber],
    queryFn: () => getLocalCommentary(languageCode, bookId, chapterNumber),
    enabled: enabled && bookId > 0 && chapterNumber > 0,
    staleTime: Number.POSITIVE_INFINITY, // Local data doesn't change
  });
}
