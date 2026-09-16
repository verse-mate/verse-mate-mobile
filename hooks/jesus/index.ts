/**
 * React Query hooks for the Jesus tab.
 *
 * The repository degrades to empty-or-null rather than throwing, so a failed
 * request resolves and React Query caches it. That is deliberate — it keeps the
 * screens free of error boundaries — but it means `data === null` is the signal
 * for "did not load", not `isError`. The screens branch on that.
 *
 * Jesus content is effectively static: the corpus changes when someone runs a
 * seed, not per request. So it is cached for a long time and not refetched on
 * focus, which matters on mobile where a tab switch would otherwise re-hit the
 * network on a connection the reader may not have.
 */
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useBibleVersion } from '@/hooks/use-bible-version';
import * as repo from '@/services/jesus-repository';

/** Static-content cache policy shared by every Jesus query. */
const STATIC = {
  staleTime: 60 * 60 * 1000, // an hour
  gcTime: 24 * 60 * 60 * 1000,
  refetchOnWindowFocus: false,
  // Deliberately true, where focus refetching is not. A query started while
  // NetInfo said offline is PAUSED, not failed, and this is what gets the
  // corpus onto the screen once the connection comes back rather than leaving
  // the reader on a placeholder until they navigate away and return. The hour
  // of stale time means a reconnect with data already in hand costs nothing.
  refetchOnReconnect: true,
} as const;

/**
 * The reader's chosen translation, read here rather than threaded through every
 * screen. The three routes that quote scripture take it; the rest do not, so it
 * is only in those query keys — putting it in all of them would evict the whole
 * corpus on a version change for no reason.
 */
function useVersion(): string {
  const { bibleVersion } = useBibleVersion();
  return bibleVersion;
}

export function useJesusOverview() {
  const bibleVersion = useVersion();
  return useQuery({
    queryKey: ['jesus', 'overview', bibleVersion],
    queryFn: () => repo.fetchEventOverview(bibleVersion),
    ...STATIC,
  });
}

export function useJesusBrowse(typeSlug: string | undefined) {
  const bibleVersion = useVersion();
  return useQuery({
    queryKey: ['jesus', 'browse', typeSlug, bibleVersion],
    queryFn: () => repo.fetchBrowse(typeSlug as string, bibleVersion),
    enabled: Boolean(typeSlug),
    ...STATIC,
  });
}

export function useJesusEvent(slug: string | undefined) {
  const bibleVersion = useVersion();
  return useQuery({
    queryKey: ['jesus', 'event', slug, bibleVersion],
    queryFn: () => repo.fetchEvent(slug as string, bibleVersion),
    enabled: Boolean(slug),
    ...STATIC,
  });
}

/**
 * Compare is fetched separately from the event rather than with it: most
 * readers never open that tab, and it is a second round trip the event screen
 * should not wait on.
 */
export function useJesusCompare(slug: string | undefined, enabled: boolean) {
  const bibleVersion = useVersion();
  return useQuery({
    queryKey: ['jesus', 'compare', slug, bibleVersion],
    queryFn: () => repo.fetchCompare(slug as string, bibleVersion),
    enabled: Boolean(slug) && enabled,
    ...STATIC,
  });
}

export function useJesusLife() {
  const bibleVersion = useVersion();
  return useQuery({
    queryKey: ['jesus', 'life', bibleVersion],
    queryFn: () => repo.fetchLife(bibleVersion),
    ...STATIC,
  });
}

export function useJesusCollection(slug: string | undefined) {
  return useQuery({
    queryKey: ['jesus', 'collection', slug],
    queryFn: () => repo.fetchCollection(slug as string),
    enabled: Boolean(slug),
    ...STATIC,
  });
}

/** The reader bridge: events touching the chapter/verse currently open. */
export function useJesusForPassage(params: {
  bookId: number | undefined;
  chapter: number | undefined;
  verse?: number;
}) {
  const { bookId, chapter, verse } = params;
  const bibleVersion = useVersion();
  return useQuery({
    queryKey: ['jesus', 'passage', bookId, chapter, verse ?? null, bibleVersion],
    queryFn: () =>
      repo.fetchEventsForPassage({
        bookId: bookId as number,
        chapter: chapter as number,
        verse,
        bibleVersion,
      }),
    enabled: Boolean(bookId && chapter),
    ...STATIC,
  });
}

// ─── Search and the entries family ───────────────────────────────────────────

/**
 * Debounced, because this runs on every keystroke in the hub's search box.
 * 250ms matches the web client, so the two feel the same under a slow network.
 */
function useDebounced(value: string, ms = 250): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

/** The hub's search: events matching a free-text term. */
export function useJesusSearch(query: string) {
  const bibleVersion = useVersion();
  const term = useDebounced(query.trim());
  return useQuery({
    queryKey: ['jesus', 'search', term, bibleVersion],
    queryFn: () => repo.fetchEvents({ q: term, limit: 50 }, bibleVersion),
    enabled: term.length > 0,
    // Search is the one query here that is not static content: it is keyed on
    // what the reader typed, so caching it for an hour would pin stale results
    // to a box they are still editing.
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

/** One page of events for a kind or a theme. */
export function useJesusEvents(params: { type?: string; theme?: string }) {
  const bibleVersion = useVersion();
  const { type, theme } = params;
  return useQuery({
    queryKey: ['jesus', 'events', type ?? null, theme ?? null, bibleVersion],
    queryFn: () => repo.fetchEvents({ type, theme, limit: 50 }, bibleVersion),
    enabled: Boolean(type || theme),
    ...STATIC,
  });
}

/** The book selector's Jesus tab reads per-entry counts, not per-event ones. */
export function useJesusEntriesOverview() {
  const bibleVersion = useVersion();
  return useQuery({
    queryKey: ['jesus', 'entries-overview', bibleVersion],
    queryFn: () => repo.fetchEntriesOverview(bibleVersion),
    ...STATIC,
  });
}

/** The selector's search — facets rather than events, same as web. */
export function useJesusEntrySearch(query: string) {
  const bibleVersion = useVersion();
  const term = useDebounced(query.trim());
  return useQuery({
    queryKey: ['jesus', 'entry-search', term, bibleVersion],
    queryFn: () => repo.searchEntries(term, 50, bibleVersion),
    enabled: term.length > 0,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useJesusEntry(slug: string | undefined) {
  const bibleVersion = useVersion();
  return useQuery({
    queryKey: ['jesus', 'entry', slug, bibleVersion],
    queryFn: () => repo.fetchEntry(slug as string, bibleVersion),
    enabled: Boolean(slug),
    ...STATIC,
  });
}
