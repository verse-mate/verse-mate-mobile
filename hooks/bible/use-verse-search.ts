/**
 * Search-as-you-type over verse text (GET /bible/search), for the Search
 * sheet's Old / New Testament tabs. Mirrors verse-mate-web's useVerseSearch:
 * waits for a 250 ms typing pause and cancels the previous request when a new
 * one starts, so a slow answer for "east and" can never overwrite the one for
 * "east and west".
 *
 * `scopeBookId` limits the search to one book — "Amos day of the Lord"
 * searches "day of the Lord" in Amos (see utils/bible/bookScope).
 */

import { useCallback, useEffect, useRef, useState } from 'react';

const DEBOUNCE_MS = 250;
/** Fewer letters than this is not worth a request ("a", "I"). */
const MIN_LETTERS = 2;
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://api.versemate.org';

export interface VerseSearchResult {
  match: 'exact' | 'words';
  bookId: number;
  bookName: string;
  chapter: number;
  verse: number;
  text: string;
  /** [start, end) character ranges of the matched words in `text`. */
  highlights: [number, number][];
}

interface VerseSearchResponse {
  results: VerseSearchResult[];
  nextCursor: string | null;
  totals: { exact: number; words: number } | null;
}

export interface VerseSearchState {
  status: 'idle' | 'loading' | 'done' | 'error';
  results: VerseSearchResult[];
  total: number | null;
  nextCursor: string | null;
  loadingMore: boolean;
}

const IDLE: VerseSearchState = {
  status: 'idle',
  results: [],
  total: null,
  nextCursor: null,
  loadingMore: false,
};

export function isVerseSearchable(query: string): boolean {
  return (query.match(/[\p{L}\p{N}]/gu) ?? []).length >= MIN_LETTERS;
}

async function searchVerses(params: {
  q: string;
  version: string;
  book?: number;
  cursor?: string | null;
  signal?: AbortSignal;
}): Promise<VerseSearchResponse> {
  const qs = new URLSearchParams({ q: params.q, bible_version: params.version });
  if (params.book) qs.set('book', String(params.book));
  if (params.cursor) qs.set('cursor', params.cursor);
  const response = await fetch(`${API_URL}/bible/search?${qs.toString()}`, {
    signal: params.signal,
  });
  if (!response.ok) throw new Error(`Verse search failed: ${response.status}`);
  return response.json();
}

export function useVerseSearch(
  query: string,
  version: string,
  enabled: boolean,
  scopeBookId?: number
) {
  const [state, setState] = useState<VerseSearchState>(IDLE);
  const keyRef = useRef('');
  const active = enabled && isVerseSearchable(query.trim());

  useEffect(() => {
    if (!active) {
      keyRef.current = '';
      setState(IDLE);
      return;
    }
    const key = JSON.stringify([version, query, scopeBookId]);
    keyRef.current = key;
    setState((s) => ({ ...s, status: 'loading' }));
    const controller = new AbortController();
    const timer = setTimeout(() => {
      // The raw text, not the trimmed one: a trailing space tells the server
      // the last word is finished (no prefix match).
      searchVerses({ q: query, version, book: scopeBookId, signal: controller.signal })
        .then((data) => {
          if (keyRef.current !== key) return;
          setState({
            status: 'done',
            results: data.results,
            total: data.totals ? data.totals.exact + data.totals.words : data.results.length,
            nextCursor: data.nextCursor,
            loadingMore: false,
          });
        })
        .catch(() => {
          if (keyRef.current !== key || controller.signal.aborted) return;
          setState((s) => ({ ...s, status: 'error', loadingMore: false }));
        });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [active, query, version, scopeBookId]);

  const loadMore = useCallback(() => {
    const cursor = state.nextCursor;
    if (!cursor || state.loadingMore) return;
    const key = keyRef.current;
    setState((s) => ({ ...s, loadingMore: true }));
    searchVerses({ q: query, version, book: scopeBookId, cursor })
      .then((data) => {
        if (keyRef.current !== key) return;
        setState((s) => ({
          ...s,
          results: [...s.results, ...data.results],
          nextCursor: data.nextCursor,
          loadingMore: false,
        }));
      })
      .catch(() => {
        if (keyRef.current !== key) return;
        setState((s) => ({ ...s, loadingMore: false }));
      });
  }, [state.nextCursor, state.loadingMore, query, version, scopeBookId]);

  return { ...state, active, loadMore };
}
