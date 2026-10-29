/**
 * Search-as-you-type over verse text, for the Search sheet.
 *
 * Waits for a 250 ms typing pause (the same as web and the Jesus search).
 * React Query keys every search by its text, version and filters, so an
 * answer for text the user has typed past can never show, and leaving a key
 * aborts its request through the query's signal. The previous results stay on
 * screen while the next ones load, so the list doesn't flash empty between
 * keystrokes. The filters reset whenever the text changes.
 */

import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useOfflineContext } from '@/contexts/OfflineContext';
import { isSearchable } from '@/lib/bible-search/search-words';
import type { VerseSearchFilters, VerseSearchPage } from '@/lib/bible-search/types';
import { searchVerses } from '@/services/bible-search';

const DEBOUNCE_MS = 250;

function useDebounced(value: string, ms = DEBOUNCE_MS): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

export function useVerseSearch(query: string, versionKey: string, enabled: boolean) {
  const { isOnline } = useOfflineContext();
  // The raw text, not trimmed: a trailing space tells the search the last
  // word is finished (no prefix match).
  const debounced = useDebounced(query);
  const active = enabled && isSearchable(debounced);
  const [filters, setFilters] = useState<VerseSearchFilters>({});

  const trimmed = debounced.trim();
  // biome-ignore lint/correctness/useExhaustiveDependencies: new text resets the filters
  useEffect(() => {
    setFilters({});
  }, [trimmed]);

  const search = useInfiniteQuery({
    queryKey: ['bible-search', versionKey, debounced, filters, isOnline],
    queryFn: ({ pageParam, signal }) =>
      searchVerses({
        q: debounced,
        versionKey,
        filters,
        cursor: pageParam,
        isOnline,
        signal,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (last: VerseSearchPage) => last.nextCursor,
    enabled: active,
    placeholderData: keepPreviousData,
    // Results only move when the server's popularity refresh runs (hourly).
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const firstPage = search.data?.pages[0];
  const results = useMemo(
    () => (search.data ? search.data.pages.flatMap((p) => p.results) : []),
    [search.data]
  );

  return {
    /** The search has something to show for (2+ letters typed). */
    active,
    /** Waiting for the typing pause or the first answer. */
    isPending: active && (debounced !== query || search.isPending),
    isError: active && search.isError,
    results: active ? results : [],
    totals: active ? (firstPage?.totals ?? null) : null,
    books: active ? (firstPage?.books ?? null) : null,
    source: firstPage?.source ?? 'online',
    hasMore: active && !!search.hasNextPage,
    isLoadingMore: search.isFetchingNextPage,
    loadMore: () => {
      if (search.hasNextPage && !search.isFetchingNextPage) void search.fetchNextPage();
    },
    filters,
    setFilters,
  };
}
