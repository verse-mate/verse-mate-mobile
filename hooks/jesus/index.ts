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
import { bibleVersions } from '@/constants/bible-versions';
import * as Auth from '@/contexts/AuthContext';
import { useBibleVersion } from '@/hooks/use-bible-version';
import * as repo from '@/services/jesus-repository';
import { jesusContentLanguage } from '@/services/offline/jesus-store';

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
  // Run even when NetInfo says offline. The queryFn reads the offline store
  // first (services/offline/jesus-store.ts), so pausing it — React Query's
  // default for a query it thinks needs the network — is what would hide
  // content the device already holds.
  networkMode: 'always',
} as const;

/**
 * The signed-in user, or null outside an AuthProvider.
 *
 * Resolved once at module load: these hooks run inside ChapterPage, and many of
 * its test suites mock AuthContext with `useAuth` alone. Falling back to "no
 * user" there is the anonymous reader's behaviour, which is what those tests
 * render anyway.
 */
const useAuthUser: () => unknown =
  typeof (Auth as { useOptionalAuth?: unknown }).useOptionalAuth === 'function'
    ? () => Auth.useOptionalAuth()?.user ?? null
    : () => null;

/**
 * The reader's translation and the language Jesus content comes back in.
 *
 * The language mirrors the backend's `resolveLanguage`: a signed-in reader's
 * preferred language, otherwise the Bible version's language, otherwise
 * English. It is in EVERY query key and every stored row's key, because the
 * same URL returns different content per language (a German response has no
 * "what this reveals" or reactions yet), and caching one under the other's key
 * is what served one reader's language to the next.
 */
function useJesusContext(): { bibleVersion: string; language: string } {
  const { bibleVersion } = useBibleVersion();
  const user = useAuthUser() as { preferred_language?: unknown } | null | undefined;
  const preferred =
    typeof user?.preferred_language === 'string' && user.preferred_language
      ? user.preferred_language
      : undefined;
  const versionLanguage = bibleVersions.find((v) => v.key === bibleVersion)?.language;
  return { bibleVersion, language: jesusContentLanguage(preferred ?? versionLanguage) };
}

/** The language Jesus content (and its taxonomy nouns) arrives in, as `en`/`de`. */
export function useJesusContentLanguage(): string {
  return useJesusContext().language;
}

export function useJesusOverview() {
  const { bibleVersion, language } = useJesusContext();
  return useQuery({
    queryKey: ['jesus', 'overview', bibleVersion, language],
    queryFn: () => repo.fetchEventOverview(bibleVersion, language),
    ...STATIC,
  });
}

export function useJesusBrowse(typeSlug: string | undefined) {
  const { bibleVersion, language } = useJesusContext();
  return useQuery({
    queryKey: ['jesus', 'browse', typeSlug, bibleVersion, language],
    queryFn: () => repo.fetchBrowse(typeSlug as string, bibleVersion, language),
    enabled: Boolean(typeSlug),
    ...STATIC,
  });
}

export function useJesusEvent(slug: string | undefined) {
  const { bibleVersion, language } = useJesusContext();
  return useQuery({
    queryKey: ['jesus', 'event', slug, bibleVersion, language],
    queryFn: () => repo.fetchEvent(slug as string, bibleVersion, language),
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
  const { bibleVersion, language } = useJesusContext();
  return useQuery({
    queryKey: ['jesus', 'compare', slug, bibleVersion, language],
    queryFn: () => repo.fetchCompare(slug as string, bibleVersion, language),
    enabled: Boolean(slug) && enabled,
    ...STATIC,
  });
}

export function useJesusLife() {
  const { bibleVersion, language } = useJesusContext();
  return useQuery({
    queryKey: ['jesus', 'life', bibleVersion, language],
    queryFn: () => repo.fetchLife(bibleVersion, language),
    ...STATIC,
  });
}

export function useJesusCollection(slug: string | undefined) {
  const { language } = useJesusContext();
  return useQuery({
    queryKey: ['jesus', 'collection', slug, language],
    queryFn: () => repo.fetchCollection(slug as string, language),
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
  const { bibleVersion, language } = useJesusContext();
  return useQuery({
    queryKey: ['jesus', 'passage', bookId, chapter, verse ?? null, bibleVersion, language],
    queryFn: () =>
      repo.fetchEventsForPassage({
        bookId: bookId as number,
        chapter: chapter as number,
        verse,
        bibleVersion,
        language,
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
  const { bibleVersion, language } = useJesusContext();
  const term = useDebounced(query.trim());
  return useQuery({
    queryKey: ['jesus', 'search', term, bibleVersion, language],
    queryFn: () => repo.fetchEvents({ q: term, limit: 50 }, bibleVersion, language),
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
  const { bibleVersion, language } = useJesusContext();
  const { type, theme } = params;
  return useQuery({
    queryKey: ['jesus', 'events', type ?? null, theme ?? null, bibleVersion, language],
    queryFn: () => repo.fetchEvents({ type, theme, limit: 50 }, bibleVersion, language),
    enabled: Boolean(type || theme),
    ...STATIC,
  });
}

/** The book selector's Jesus tab reads per-entry counts, not per-event ones. */
export function useJesusEntriesOverview() {
  const { bibleVersion, language } = useJesusContext();
  return useQuery({
    queryKey: ['jesus', 'entries-overview', bibleVersion, language],
    queryFn: () => repo.fetchEntriesOverview(bibleVersion, language),
    ...STATIC,
  });
}

/** The selector's search — facets rather than events, same as web. */
export function useJesusEntrySearch(query: string) {
  const { bibleVersion, language } = useJesusContext();
  const term = useDebounced(query.trim());
  return useQuery({
    queryKey: ['jesus', 'entry-search', term, bibleVersion, language],
    queryFn: () => repo.searchEntries(term, 50, bibleVersion, language),
    enabled: term.length > 0,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useJesusEntry(slug: string | undefined) {
  const { bibleVersion, language } = useJesusContext();
  return useQuery({
    queryKey: ['jesus', 'entry', slug, bibleVersion, language],
    queryFn: () => repo.fetchEntry(slug as string, bibleVersion, language),
    enabled: Boolean(slug),
    ...STATIC,
  });
}
