/**
 * Web build: there is no on-device verse store, so search is online only.
 * Mirrors the native module's exports.
 */
import type { VerseSearchFilters, VerseSearchPage } from '@/lib/bible-search/types';

export async function ensureVerseSearchIndex(): Promise<void> {}

export async function searchVersesOffline(_params: {
  q: string;
  versionKey: string;
  filters: VerseSearchFilters;
  cursor: string | null;
}): Promise<VerseSearchPage> {
  throw new Error('Offline Bible search is not available on web');
}

export async function hasOfflineVerses(_versionKey: string): Promise<boolean> {
  return false;
}
