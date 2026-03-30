import { normalizeWord } from '@/services/word-mapping-service';
import type { WebsterDictionary, WebsterEntry } from '@/types/dictionary';

// Module-level cache for lazy-loaded Webster shards, keyed by first letter
const shardCache = new Map<string, WebsterDictionary>();

/**
 * Dynamic shard loaders — uses import() for code splitting so the ~27MB of
 * dictionary JSON is not embedded in the main JS bundle. Each shard is only
 * fetched when first accessed.
 */
const SHARD_LOADERS: Record<string, () => Promise<unknown>> = {
  a: () => import('@/assets/data/webster-a.json'),
  b: () => import('@/assets/data/webster-b.json'),
  c: () => import('@/assets/data/webster-c.json'),
  d: () => import('@/assets/data/webster-d.json'),
  e: () => import('@/assets/data/webster-e.json'),
  f: () => import('@/assets/data/webster-f.json'),
  g: () => import('@/assets/data/webster-g.json'),
  h: () => import('@/assets/data/webster-h.json'),
  i: () => import('@/assets/data/webster-i.json'),
  j: () => import('@/assets/data/webster-j.json'),
  k: () => import('@/assets/data/webster-k.json'),
  l: () => import('@/assets/data/webster-l.json'),
  m: () => import('@/assets/data/webster-m.json'),
  n: () => import('@/assets/data/webster-n.json'),
  o: () => import('@/assets/data/webster-o.json'),
  p: () => import('@/assets/data/webster-p.json'),
  q: () => import('@/assets/data/webster-q.json'),
  r: () => import('@/assets/data/webster-r.json'),
  s: () => import('@/assets/data/webster-s.json'),
  t: () => import('@/assets/data/webster-t.json'),
  u: () => import('@/assets/data/webster-u.json'),
  v: () => import('@/assets/data/webster-v.json'),
  w: () => import('@/assets/data/webster-w.json'),
  x: () => import('@/assets/data/webster-x.json'),
  y: () => import('@/assets/data/webster-y.json'),
  z: () => import('@/assets/data/webster-z.json'),
};

/**
 * Lazy loads a Webster dictionary shard by first letter
 */
async function loadShard(letter: string): Promise<WebsterDictionary> {
  const cached = shardCache.get(letter);
  if (cached) return cached;

  const loader = SHARD_LOADERS[letter];
  if (!loader) return {};

  const data = await loader();
  const dictionary = ((data as Record<string, unknown>).default || data) as WebsterDictionary;
  shardCache.set(letter, dictionary);
  return dictionary;
}

/**
 * Looks up a word in Webster's 1913 Unabridged Dictionary.
 * Loads only the shard for the word's first letter on demand.
 *
 * @param word - The word to look up (will be normalized)
 * @returns WebsterEntry if found, null otherwise
 */
export async function lookupWebster(word: string): Promise<WebsterEntry | null> {
  if (!word) return null;

  const normalized = normalizeWord(word);
  if (!normalized) return null;

  const firstLetter = normalized[0];
  if (firstLetter < 'a' || firstLetter > 'z') return null;

  const shard = await loadShard(firstLetter);
  return shard[normalized] ?? null;
}

/**
 * Clears the cached dictionary shards to free memory
 */
export function clearCache(): void {
  shardCache.clear();
}

/**
 * Gets statistics about loaded Webster dictionary shards
 */
export function getStats() {
  return {
    loadedShards: shardCache.size,
    cachedLetters: Array.from(shardCache.keys()),
  };
}
