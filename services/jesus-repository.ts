/**
 * Jesus tab API client.
 *
 * Mirrors verse-mate-web's `jesusService`, with two deliberate differences:
 *
 *  - it goes through mobile's own `authenticatedFetch` rather than the web
 *    Eden client, so token refresh and the PostHog interceptors apply;
 *  - it is a thin repository. React Query owns caching and retries here (see
 *    `hooks/jesus`), where the web service is called directly from screens.
 *
 * Every call is anonymous-friendly: the content is public, and a signed-in
 * reader gets their preferred language only because the backend reads the
 * bearer token when one happens to be present.
 *
 * Failures degrade to an empty-but-valid shape rather than throwing, matching
 * the web client. A network blip should render an empty state, not tear down
 * the screen — React Query still sees a resolved promise, so a retry is the
 * caller's decision rather than an unhandled rejection.
 */
import { authenticatedFetch } from '@/lib/api/authenticated-fetch';
import type {
  JesusBrowse,
  JesusCollectionSummary,
  JesusCompare,
  JesusEntry,
  JesusEntryList,
  JesusEventCard,
  JesusEventDetail,
  JesusEventLifePeriod,
  JesusEventOverview,
  JesusEventPage,
  JesusOverview,
  JesusThemeSummary,
} from '@/types/jesus';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://api.versemate.org';

type QueryValue = string | number | boolean;

/** Drop empty values so they never reach the query string as "undefined". */
function compact(query: Record<string, QueryValue | undefined>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(query)
      .filter(([, v]) => v !== undefined && v !== '')
      .map(([k, v]) => [k, String(v)])
  );
}

async function get<T>(
  path: string,
  query: Record<string, QueryValue | undefined> = {}
): Promise<T | null> {
  const qs = new URLSearchParams(compact(query)).toString();
  const url = `${BASE_URL}${path}${qs ? `?${qs}` : ''}`;
  try {
    const res = await authenticatedFetch(url, { method: 'GET' });
    if (!res.ok) {
      // Degrading to null is deliberate — a screen shows an empty state rather
      // than an error boundary — but it must not also erase WHY. A silent
      // catch here is what made a failing hub indistinguishable from an empty
      // corpus while the API was serving 207 events.
      console.warn(`[jesus] ${path} -> HTTP ${res.status}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (error) {
    console.warn(`[jesus] ${path} -> ${(error as Error)?.message ?? String(error)}`);
    return null;
  }
}

const EMPTY_EVENT_OVERVIEW: JesusEventOverview = {
  total_events: 0,
  total_facets: 0,
  sections: [],
  periods: [],
  themes: [],
  collections: [],
};

/** The hub: category counts, periods, themes and collections. */
export async function fetchEventOverview(bibleVersion?: string): Promise<JesusEventOverview> {
  return (
    (await get<JesusEventOverview>('/jesus/events/overview', {
      bible_version: bibleVersion,
    })) ?? EMPTY_EVENT_OVERVIEW
  );
}

/** One browse category — "questions", "parables" — grouped into topics. */
export async function fetchBrowse(
  typeSlug: string,
  bibleVersion?: string
): Promise<JesusBrowse | null> {
  return get<JesusBrowse>(`/jesus/events/browse/${encodeURIComponent(typeSlug)}`, {
    bible_version: bibleVersion,
  });
}

/** A single event with its facets, passages, reveals, reactions and prose. */
/**
 * One event with its scripture.
 *
 * `bible_version` is NOT optional in practice: without it the backend returns
 * `passages: []` — no references and no verse text — so the screen renders a
 * title and nothing to read. Measured: no param -> 0 passages; NASB1995 -> 3
 * passages with 5 verses in the first. Requesting it without a version is what
 * made the first port conclude the array was empty and build a metadata screen.
 */
export async function fetchEvent(
  slug: string,
  bibleVersion?: string
): Promise<JesusEventDetail | null> {
  return get<JesusEventDetail>(`/jesus/events/${encodeURIComponent(slug)}`, {
    bible_version: bibleVersion,
  });
}

/** The Compare tab: which Gospels record this event, and what each adds. */
export async function fetchCompare(
  slug: string,
  bibleVersion?: string
): Promise<JesusCompare | null> {
  return get<JesusCompare>(`/jesus/events/${encodeURIComponent(slug)}/compare`, {
    bible_version: bibleVersion,
  });
}

/**
 * Follow His Life — events grouped by period, in chronological order.
 *
 * The endpoint returns `{ periods: [...] }`, not a bare array. Reading it as an
 * array yields an empty timeline and no error, so the unwrap is deliberate.
 */
export async function fetchLife(bibleVersion?: string): Promise<JesusEventLifePeriod[]> {
  const data = await get<{ periods: JesusEventLifePeriod[] }>('/jesus/events/life', {
    bible_version: bibleVersion,
  });
  return data?.periods ?? [];
}

/** A curated study collection, resolved to events. */
export async function fetchCollection(slug: string): Promise<{
  collection: JesusCollectionSummary;
  events: JesusEventCard[];
} | null> {
  return get(`/jesus/events/collections/${encodeURIComponent(slug)}`);
}

/**
 * Events that touch a passage — the reader bridge.
 *
 * `book_id` is the database's surrogate key, not the canonical book number.
 * They coincide in production but are not the same thing, so callers pass the
 * id the API gave them rather than one they computed.
 */
export async function fetchEventsForPassage(params: {
  bookId: number;
  chapter: number;
  verse?: number;
  bibleVersion?: string;
}): Promise<JesusEventCard[]> {
  const data = await get<{ events: JesusEventCard[] }>('/jesus/for-passage', {
    book_id: params.bookId,
    chapter: params.chapter,
    verse: params.verse,
    bible_version: params.bibleVersion,
  });
  return data?.events ?? [];
}

// ─── The entries family ──────────────────────────────────────────────────────
//
// A second view of the same corpus, one row per facet rather than per event.
// The book selector's Jesus tab and its search read from here, because someone
// searching "born again" wants the saying, not the scene around it.

/** Sections, periods, themes and studies with per-ENTRY counts. */
export async function fetchEntriesOverview(bibleVersion?: string): Promise<JesusOverview | null> {
  return get<JesusOverview>('/jesus/overview', { bible_version: bibleVersion });
}

/** Free-text search across His words and actions. */
export async function searchEntries(
  q: string,
  limit = 50,
  bibleVersion?: string
): Promise<JesusEntry[]> {
  const data = await get<JesusEntryList>('/jesus/entries', {
    q,
    limit,
    bible_version: bibleVersion,
  });
  return data?.entries ?? [];
}

/** One facet on its own — what a search result opens. */
export async function fetchEntry(slug: string, bibleVersion?: string): Promise<JesusEntry | null> {
  return get<JesusEntry>(`/jesus/entries/${encodeURIComponent(slug)}`, {
    bible_version: bibleVersion,
  });
}

export async function fetchThemes(bibleVersion?: string): Promise<JesusThemeSummary[]> {
  const data = await get<{ themes: JesusThemeSummary[] }>('/jesus/themes', {
    bible_version: bibleVersion,
  });
  return data?.themes ?? [];
}

/**
 * `/jesus/events` — the one paged list behind browse-by-kind, browse-by-theme
 * and search. Exactly one of `type` / `theme` / `q` is meaningful per call;
 * the endpoint accepts them together but the screens never do that.
 */
export async function fetchEvents(
  params: { type?: string; theme?: string; q?: string; limit?: number; offset?: number },
  bibleVersion?: string
): Promise<JesusEventPage> {
  const data = await get<JesusEventPage>('/jesus/events', {
    type: params.type,
    theme: params.theme,
    q: params.q,
    limit: params.limit ?? 30,
    offset: params.offset ?? 0,
    bible_version: bibleVersion,
  });
  return data ?? { events: [], total: 0, limit: params.limit ?? 30, offset: params.offset ?? 0 };
}
