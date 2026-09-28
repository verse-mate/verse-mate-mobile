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
 * under the key its request produces — path + sorted query, minus
 * bible_version — so the request the screen already makes is the lookup.
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
 * The storage key for a request. Must match `key()` in
 * scripts/generate-jesus-bundle.py exactly — that is what makes a bundled row
 * answer the app's own request.
 */
export function jesusCacheKey(path: string, query: Record<string, QueryValue> = {}): string {
  const entries = Object.entries(query)
    .filter(([k, v]) => k !== 'bible_version' && v !== undefined && v !== '')
    .map(([k, v]) => [k, String(v)] as const)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const qs = new URLSearchParams(entries as [string, string][]).toString();
  return qs ? `${path}?${qs}` : path;
}

let importPromise: Promise<void> | null = null;

/**
 * Copy the bundled corpus into the offline database if it is newer than what
 * the device holds. Safe to call repeatedly; concurrent callers share one run.
 */
export function importJesusSeed(): Promise<void> {
  if (!importPromise) {
    importPromise = runImport().catch((error) => {
      perfTrace('jesus.import', { outcome: 'failed', error: String(error) });
      // Non-fatal: every read falls back to the network, as before.
    });
  }
  return importPromise;
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

  database.execSync(`ATTACH DATABASE '${path.replace(/'/g, "''")}' AS jesus_seed`);
  try {
    const seed = database.getFirstSync<{ v: string }>(
      "SELECT v FROM jesus_seed.jesus_meta WHERE k = 'generated_at'"
    );
    const held = database.getFirstSync<{ v: string }>(
      "SELECT v FROM jesus_meta WHERE k = 'seed_generated_at'"
    );
    if (!seed?.v) throw new Error('jesus seed: missing generated_at');
    if (held?.v && held.v >= seed.v) {
      perfTrace('jesus.import', { outcome: 'current', seed: seed.v, ms: total() });
      return;
    }
    database.withTransactionSync(() => {
      // Keep a row the network refreshed after this bundle was generated.
      database.execSync(`
        INSERT OR REPLACE INTO offline_jesus (key, payload, bible_version, updated_at)
        SELECT s.key, s.payload, s.bible_version, s.updated_at FROM jesus_seed.offline_jesus s
        WHERE NOT EXISTS (
          SELECT 1 FROM offline_jesus m WHERE m.key = s.key AND m.updated_at > s.updated_at
        )
      `);
      database.runSync("INSERT OR REPLACE INTO jesus_meta (k, v) VALUES ('seed_generated_at', ?)", [
        seed.v,
      ]);
    });
    const count = database.getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM offline_jesus');
    perfTrace('jesus.import', { outcome: 'imported', seed: seed.v, rows: count?.n, ms: total() });
  } finally {
    database.execSync('DETACH DATABASE jesus_seed');
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
