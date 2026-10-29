/**
 * Bible search: GET /bible/search, falling back to the on-device index.
 *
 * Online results are the full search (exact phrase and all-words matches,
 * word endings, popular verses first). When the device is offline, or the
 * request fails, and the version has verses on the device, the offline index
 * answers instead (exact words only, Bible order); the page says which.
 */

import {
  VERSE_SEARCH_PAGE_SIZE,
  type VerseSearchFilters,
  type VerseSearchPage,
} from '@/lib/bible-search/types';
import { hasOfflineVerses, searchVersesOffline } from '@/services/offline/verse-search';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://api.versemate.org';

/** A search that takes longer than this falls back to the device, when it can. */
const ONLINE_TIMEOUT_MS = 8000;

export interface VerseSearchRequest {
  q: string;
  versionKey: string;
  filters: VerseSearchFilters;
  cursor: string | null;
  /** NetInfo's view; false skips the network entirely. */
  isOnline: boolean;
  /** Aborts when the user has typed past this search. */
  signal?: AbortSignal;
}

export async function searchVersesOnline(req: VerseSearchRequest): Promise<VerseSearchPage> {
  const query: Record<string, string> = {
    q: req.q,
    bible_version: req.versionKey,
    limit: String(VERSE_SEARCH_PAGE_SIZE),
  };
  if (req.filters.testament) query.testament = req.filters.testament;
  if (req.filters.book) query.book = String(req.filters.book);
  if (req.cursor) query.cursor = req.cursor;

  // Its own controller, so a timeout and the caller's cancel both abort it.
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  req.signal?.addEventListener('abort', onAbort);
  const timer = setTimeout(() => controller.abort(), ONLINE_TIMEOUT_MS);
  try {
    // Public and identical for everyone, so no Authorization header.
    const res = await fetch(`${BASE_URL}/bible/search?${new URLSearchParams(query)}`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`/bible/search -> HTTP ${res.status}`);
    const page = (await res.json()) as Omit<VerseSearchPage, 'source'>;
    return { ...page, source: 'online' };
  } finally {
    clearTimeout(timer);
    req.signal?.removeEventListener('abort', onAbort);
  }
}

export async function searchVerses(req: VerseSearchRequest): Promise<VerseSearchPage> {
  if (req.isOnline) {
    try {
      return await searchVersesOnline(req);
    } catch (error) {
      // The user typed past it: nothing to fall back for.
      if (req.signal?.aborted) throw error;
      if (!(await hasOfflineVerses(req.versionKey))) throw error;
    }
  } else if (!(await hasOfflineVerses(req.versionKey))) {
    throw new Error('Offline, and this version has no verses on the device');
  }
  return searchVersesOffline(req);
}
