/**
 * The Jesus feature, offline.
 *
 * Every Jesus page is one or two GETs against /jesus/*, and until now none of
 * them were stored: on a slow connection each page sat on a spinner, and with
 * no connection it said "you're offline". Andy, on a plane (2026-09-28):
 * "Same deal on Jesus feature. Lots of not loading."
 *
 * The model mirrors the English Bible and commentaries, which ship inside the
 * app: the English Jesus corpus is bundled as assets/data/jesus-seed.db
 * (scripts/generate-jesus-bundle.py) and copied into the offline database on
 * startup, and every response is then read LOCAL FIRST. A response is stored
 * under the key its request produces — content language, then path + sorted
 * query minus bible_version — so the request the screen already makes is the
 * lookup.
 *
 * Unlike the Bible seed, the import is versioned rather than first-install
 * only: an app update carrying a newer bundle refreshes existing installs, and
 * rows refreshed from the network since are kept over older bundle rows.
 */
import { Asset } from 'expo-asset';
import { perfTimer, perfTrace } from '@/lib/perf';
import { getLocalBibleChapter, initDatabase } from './sqlite-manager';

export interface JesusLocalRow {
  payload: unknown;
  /** The Bible version its scripture is in; null for a response with none. */
  bibleVersion: string | null;
  updatedAt: string;
}

type QueryValue = string | number | boolean | undefined;

/**
 * The content language a Jesus response is in, as a bare code (`en`, `de`).
 *
 * The backend picks it per request: the Bible version's language, overridden
 * by a signed-in reader's preferred language (`resolveLanguage` in the
 * backend's jesus plugin). The hooks work out the same answer and pass it
 * here, so a Spanish reader's response and an English reader's response for
 * the same URL are two different rows.
 */
export function jesusContentLanguage(language: string | null | undefined): string {
  const base = (language ?? '').trim().toLowerCase().split(/[-_]/)[0];
  return base || 'en';
}

/**
 * The storage key for a request: content language, then path + sorted query
 * minus bible_version (scripture is the one version-dependent part, and it is
 * re-rendered per version, see `reinjectPassages`).
 *
 * The bundle stores its rows WITHOUT the language prefix (`key()` in
 * scripts/generate-jesus-bundle.py); `importJesusSeed` adds the seed's own
 * language when it copies them in.
 */
export function jesusCacheKey(
  path: string,
  query: Record<string, QueryValue> = {},
  language?: string | null
): string {
  const entries = Object.entries(query)
    .filter(([k, v]) => k !== 'bible_version' && v !== undefined && v !== '')
    .map(([k, v]) => [k, String(v)] as const)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const qs = new URLSearchParams(entries as [string, string][]).toString();
  return `${jesusContentLanguage(language)}:${qs ? `${path}?${qs}` : path}`;
}

/**
 * Milliseconds since the epoch for a stored timestamp, or NaN.
 *
 * The bundle was generated with microsecond `+00:00` stamps
 * (`2026-09-28T18:48:37.317221+00:00`), which is outside the ECMAScript
 * date-time format, so whether `Date.parse` accepts it is up to the engine.
 * Rows are normalised to milliseconds + `Z` on import; this covers anything
 * written before that.
 */
export function parseStoredTime(value: string): number {
  const normalised = value.replace(/(\.\d{3})\d+/, '$1').replace(/\+00:00$/, 'Z');
  return Date.parse(normalised);
}

/** Bumped when the stored key format changes, so an install re-imports once. */
const KEY_FORMAT = 'lang-v1';

let importPromise: Promise<void> | null = null;

/**
 * Copy the bundled corpus into the offline database if it is newer than what
 * the device holds. Safe to call repeatedly; concurrent callers share one run.
 * A failed run is forgotten, so the next read tries again instead of leaving
 * the device network-only until the app restarts.
 */
export function importJesusSeed(): Promise<void> {
  if (!importPromise) {
    importPromise = runImport().catch((error) => {
      perfTrace('jesus.import', { outcome: 'failed', error: String(error) });
      importPromise = null;
      // Non-fatal: every read falls back to the network, as before.
    });
  }
  return importPromise;
}

/** FOR TESTS ONLY. */
export function __TEST_ONLY_RESET_IMPORT(): void {
  importPromise = null;
}

async function runImport(): Promise<void> {
  const total = perfTimer();
  const database = await initDatabase();
  // biome-ignore lint/suspicious/noExplicitAny: asset registry id
  const seedModule: any = require('@/assets/data/jesus-seed.db');
  const asset = Asset.fromModule(seedModule);
  await asset.downloadAsync();
  if (!asset.localUri) throw new Error('jesus seed: no local URI');
  const path = decodeURI(asset.localUri.replace(/^file:\/\//, ''));

  // The async API throughout: the copy is ~9MB and must not block the JS
  // thread on the first launch after an install or update.
  await database.execAsync(`ATTACH DATABASE '${path.replace(/'/g, "''")}' AS jesus_seed`);
  try {
    const seed = await database.getFirstAsync<{ v: string }>(
      "SELECT v FROM jesus_seed.jesus_meta WHERE k = 'generated_at'"
    );
    const seedLanguage = await database.getFirstAsync<{ v: string }>(
      "SELECT v FROM jesus_seed.jesus_meta WHERE k = 'language'"
    );
    if (!seed?.v) throw new Error('jesus seed: missing generated_at');
    const marker = `${seed.v}|${KEY_FORMAT}`;
    const held = await database.getFirstAsync<{ v: string }>(
      "SELECT v FROM jesus_meta WHERE k = 'seed_import'"
    );
    if (held?.v && held.v >= marker) {
      perfTrace('jesus.import', { outcome: 'current', seed: seed.v, ms: total() });
      return;
    }
    const prefix = `${jesusContentLanguage(seedLanguage?.v)}:`;
    await database.withTransactionAsync(async () => {
      // Rows stored before keys carried a language (they start with the path
      // itself). They are unreachable now; drop them rather than keep a copy.
      await database.runAsync(
        "DELETE FROM offline_jesus WHERE key LIKE '/%' OR key LIKE 'local:%'"
      );
      // Keep a row the network refreshed after this bundle was generated.
      // Stamps are normalised to milliseconds + Z (see parseStoredTime).
      await database.runAsync(
        `INSERT OR REPLACE INTO offline_jesus (key, payload, bible_version, updated_at)
         SELECT ? || s.key, s.payload, s.bible_version, substr(s.updated_at, 1, 23) || 'Z'
         FROM jesus_seed.offline_jesus s
         WHERE NOT EXISTS (
           SELECT 1 FROM offline_jesus m
           WHERE m.key = ? || s.key AND m.updated_at > substr(s.updated_at, 1, 23) || 'Z'
         )`,
        [prefix, prefix]
      );
      await database.runAsync(
        "INSERT OR REPLACE INTO jesus_meta (k, v) VALUES ('seed_import', ?)",
        [marker]
      );
    });
    const count = await database.getFirstAsync<{ n: number }>(
      'SELECT COUNT(*) AS n FROM offline_jesus'
    );
    perfTrace('jesus.import', { outcome: 'imported', seed: seed.v, rows: count?.n, ms: total() });
  } finally {
    await database.execAsync('DETACH DATABASE jesus_seed');
  }
}

/**
 * The stored response for a key, or null. Waits for an in-flight import so the
 * first Jesus page after an install or update is not sent to the network for
 * content that is seconds from being local.
 */
export async function getJesusLocal(key: string): Promise<JesusLocalRow | null> {
  if (importPromise) await importPromise;
  const database = await initDatabase();
  const row = database.getFirstSync<{
    payload: string;
    bible_version: string | null;
    updated_at: string;
  }>('SELECT payload, bible_version, updated_at FROM offline_jesus WHERE key = ?', [key]);
  if (!row) return null;
  try {
    return {
      payload: JSON.parse(row.payload),
      bibleVersion: row.bible_version,
      updatedAt: row.updated_at,
    };
  } catch {
    return null;
  }
}

export async function putJesusLocal(
  key: string,
  payload: unknown,
  bibleVersion: string | null
): Promise<void> {
  const database = await initDatabase();
  database.runSync(
    'INSERT OR REPLACE INTO offline_jesus (key, payload, bible_version, updated_at) VALUES (?, ?, ?, ?)',
    [key, JSON.stringify(payload), bibleVersion, new Date().toISOString()]
  );
}

interface PassageLike {
  book_id: number;
  chapter: number;
  verse_start?: number | null;
  verse_end?: number | null;
  verses?: { verse_number: number; text: string }[];
}

/**
 * Re-render an event's scripture in another Bible version from the offline
 * Bible, when that version is on the device. Returns null when it is not, so
 * the caller can prefer the network over showing the wrong translation.
 */
export async function reinjectPassages<T extends { passages?: PassageLike[] }>(
  detail: T,
  bibleVersion: string
): Promise<T | null> {
  const passages = detail.passages ?? [];
  const out: PassageLike[] = [];
  for (const p of passages) {
    const chapter = await getLocalBibleChapter(bibleVersion, p.book_id, p.chapter);
    if (chapter.length === 0) return null;
    // A null verse_start is the whole chapter; a null verse_end is one verse.
    const whole = p.verse_start == null;
    const lo = p.verse_start ?? 1;
    const hi = whole ? Number.POSITIVE_INFINITY : (p.verse_end ?? lo);
    out.push({
      ...p,
      verses: chapter
        .filter((v) => v.verse_number >= lo && v.verse_number <= hi)
        .map((v) => ({ verse_number: v.verse_number, text: v.text })),
    });
  }
  return { ...detail, passages: out };
}
