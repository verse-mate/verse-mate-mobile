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
import { useBibleVersion } from '@/hooks/use-bible-version';
import * as repo from '@/services/jesus-repository';

/** Static-content cache policy shared by every Jesus query. */
const STATIC = {
  staleTime: 60 * 60 * 1000, // an hour
  gcTime: 24 * 60 * 60 * 1000,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
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
  return useQuery({
    queryKey: ['jesus', 'browse', typeSlug],
    queryFn: () => repo.fetchBrowse(typeSlug as string),
    enabled: Boolean(typeSlug),
    ...STATIC,
  });
}

export function useJesusEvent(slug: string | undefined) {
  return useQuery({
    queryKey: ['jesus', 'event', slug],
    queryFn: () => repo.fetchEvent(slug as string),
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
  return useQuery({
    queryKey: ['jesus', 'compare', slug],
    queryFn: () => repo.fetchCompare(slug as string),
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
