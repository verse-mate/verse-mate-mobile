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
import { perfTimer, perfTrace } from '@/lib/perf';
import {
  getJesusLocal,
  type JesusLocalRow,
  jesusCacheKey,
  putJesusLocal,
  reinjectPassages,
} from '@/services/offline/jesus-store';
import type {
  JesusBrowse,
  JesusCollectionSummary,
  JesusCompare,
  JesusEntry,
  JesusEntryDetail,
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

/** The plain network request — what `get` used to be on its own. */
async function networkGet<T>(
  path: string,
  query: Record<string, QueryValue | undefined>,
  timeoutMs?: number
): Promise<T | null> {
  const qs = new URLSearchParams(compact(query)).toString();
  const url = `${BASE_URL}${path}${qs ? `?${qs}` : ''}`;
  const controller = timeoutMs ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const res = await authenticatedFetch(url, {
      method: 'GET',
      ...(controller ? { signal: controller.signal } : {}),
    });
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
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** A stored row is refreshed from the network, in the background, after this. */
const REVALIDATE_AFTER_MS = 24 * 60 * 60 * 1000;
/** How long a search waits for the server before answering from the device. */
const SEARCH_TIMEOUT_MS = 2500;
/** The page size the bundle stores a theme's full list at (the API's cap). */
const BUNDLED_LIST_LIMIT = 200;

/**
 * Every Jesus request, LOCAL FIRST.
 *
 * The operator's rule for this app: "even if the user is online the app goes
 * to what is saved locally first". A slow connection is the case that matters
 * — on plane Wi-Fi NetInfo still says "online", so a network-first read sat on
 * a spinner for as long as the connection took, which is exactly what Andy
 * saw across the Jesus feature. So: answer from the offline store when it has
 * the response, refresh it in the background once it is a day old, and only
 * go to the network for what the device does not hold.
 *
 * Scripture is the one version-dependent part: an event's passages are stored
 * in the version they were fetched in (the bundle is NASB1995). Asked for
 * another version, they are re-rendered from the offline Bible when that
 * version is downloaded; when it is not, the network is tried first so the
 * reader does not silently get a different translation, with the stored copy
 * as the fallback.
 *
 * Searches cannot be precomputed, so they go to the server with a short
 * deadline and fall back to searching the stored corpus.
 */
async function get<T>(
  path: string,
  query: Record<string, QueryValue | undefined> = {}
): Promise<T | null> {
  if (query.q) return search<T>(path, query);

  const took = perfTimer();
  const key = jesusCacheKey(path, query);
  const version = typeof query.bible_version === 'string' ? query.bible_version : undefined;

  let local: JesusLocalRow | null = null;
  try {
    local = await localLookup(path, query, key);
  } catch {
    local = null; // offline store unavailable — behave as before
  }

  if (local) {
    const usable = await forVersion(local, version);
    if (usable !== null) {
      if (Date.now() - Date.parse(local.updatedAt) > REVALIDATE_AFTER_MS) {
        void refresh(path, query, key, version);
      }
      perfTrace('jesus.get', { key, path: 'local', ms: took() });
      return usable as T;
    }
  }

  const remote = await networkGet<T>(path, query);
  if (remote !== null) {
    void store(key, remote, version);
    perfTrace('jesus.get', { key, path: 'remote', ms: took() });
    return remote;
  }
  perfTrace('jesus.get', { key, path: local ? 'local-stale' : 'miss', ms: took() });
  // The network failed: a stored copy in another translation beats nothing.
  return (local?.payload as T) ?? null;
}

/** The stored row for a request — a theme's list is stored whole and sliced. */
async function localLookup(
  path: string,
  query: Record<string, QueryValue | undefined>,
  key: string
): Promise<JesusLocalRow | null> {
  const exact = await getJesusLocal(key);
  if (exact) return exact;
  if (path === '/jesus/events' && query.theme && !query.type) {
    const whole = await getJesusLocal(
      jesusCacheKey(path, { theme: query.theme, limit: BUNDLED_LIST_LIMIT, offset: 0 })
    );
    const page = whole?.payload as JesusEventPage | undefined;
    if (whole && page?.events) {
      const limit = Number(query.limit ?? 30);
      const offset = Number(query.offset ?? 0);
      return {
        ...whole,
        payload: {
          events: page.events.slice(offset, offset + limit),
          total: page.events.length,
          limit,
          offset,
        },
      };
    }
  }
  return null;
}

/** The stored payload as it should be shown in `version`, or null to ask the network. */
async function forVersion(
  row: JesusLocalRow,
  version: string | undefined
): Promise<unknown | null> {
  const payload = row.payload as { passages?: unknown[] } | null;
  if (!version || !row.bibleVersion || row.bibleVersion === version) return row.payload;
  // Only an event's passages carry scripture; nothing else depends on version.
  if (!payload || !Array.isArray(payload.passages)) return row.payload;
  try {
    return await reinjectPassages(payload as never, version);
  } catch {
    return null;
  }
}

async function store(key: string, payload: unknown, version: string | undefined): Promise<void> {
  const hasScripture = Array.isArray((payload as { passages?: unknown[] })?.passages);
  try {
    await putJesusLocal(key, payload, hasScripture ? (version ?? null) : null);
  } catch {
    // Non-fatal: the next view fetches it again.
  }
}

async function refresh(
  path: string,
  query: Record<string, QueryValue | undefined>,
  key: string,
  version: string | undefined
): Promise<void> {
  const fresh = await networkGet(path, query);
  if (fresh !== null) await store(key, fresh, version);
}

/** Server search with a deadline, then a search of the stored corpus. */
async function search<T>(
  path: string,
  query: Record<string, QueryValue | undefined>
): Promise<T | null> {
  const took = perfTimer();
  const remote = await networkGet<T>(path, query, SEARCH_TIMEOUT_MS);
  if (remote !== null) {
    perfTrace('jesus.search', { path, q: query.q, source: 'remote', ms: took() });
    return remote;
  }
  let local: T | null = null;
  try {
    local = (await localSearch(path, String(query.q), Number(query.limit ?? 50))) as T | null;
  } catch {
    local = null;
  }
  perfTrace('jesus.search', { path, q: query.q, source: 'local', ms: took() });
  return local;
}

function matches(needle: string[], ...fields: unknown[]): boolean {
  const hay = fields
    .flat()
    .map((f) => (typeof f === 'string' ? f : ''))
    .join(' ')
    .toLowerCase();
  return needle.every((word) => hay.includes(word));
}

async function localSearch(path: string, q: string, limit: number): Promise<unknown | null> {
  const needle = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (needle.length === 0) return null;

  if (path === '/jesus/entries') {
    const row = await getJesusLocal('local:entries');
    const all = ((row?.payload as { entries?: JesusEntry[] })?.entries ?? []).filter((e) =>
      matches(
        needle,
        e.title,
        e.summary,
        e.quote,
        e.kind_label,
        (e.references ?? []).map((r) => r.display)
      )
    );
    return { entries: all.slice(0, limit), total: all.length, limit, offset: 0 };
  }

  if (path === '/jesus/events') {
    const life = await getJesusLocal('/jesus/events/life');
    const seen = new Set<string>();
    const events = ((life?.payload as { periods?: JesusEventLifePeriod[] })?.periods ?? []).flatMap(
      (p) => p.events ?? []
    );
    const hits = events.filter((e) => {
      if (seen.has(e.slug) || !matches(needle, e.title, e.summary)) return false;
      seen.add(e.slug);
      return true;
    });
    return { events: hits.slice(0, limit), total: hits.length, limit, offset: 0 };
  }
  return null;
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

/**
 * One facet on its own.
 *
 * The response WRAPS the entry — `{ entry, explanation, passages, related }` —
 * and this used to be typed as the bare entry, so the screen read `title`,
 * `kind_label` … off the top level and got undefined for all of them: a blank
 * page with an empty header title. The type is the shape the API returns.
 */
export async function fetchEntry(
  slug: string,
  bibleVersion?: string
): Promise<JesusEntryDetail | null> {
  return get<JesusEntryDetail>(`/jesus/entries/${encodeURIComponent(slug)}`, {
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
