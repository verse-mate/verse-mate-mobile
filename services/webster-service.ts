import { normalizeWord } from '@/services/word-mapping-service';
import type { WebsterDictionary, WebsterEntry } from '@/types/dictionary';

// Module-level cache for lazy-loaded Webster shards, keyed by first letter
const shardCache = new Map<string, WebsterDictionary>();

/**
 * Static shard loaders — Metro bundler requires static require() paths.
 * Each loader is only invoked when the shard is first accessed.
 */
const SHARD_LOADERS: Record<string, () => WebsterDictionary> = {
  a: () => require('@/assets/data/webster-a.json'),
  b: () => require('@/assets/data/webster-b.json'),
  c: () => require('@/assets/data/webster-c.json'),
  d: () => require('@/assets/data/webster-d.json'),
  e: () => require('@/assets/data/webster-e.json'),
  f: () => require('@/assets/data/webster-f.json'),
  g: () => require('@/assets/data/webster-g.json'),
  h: () => require('@/assets/data/webster-h.json'),
  i: () => require('@/assets/data/webster-i.json'),
  j: () => require('@/assets/data/webster-j.json'),
  k: () => require('@/assets/data/webster-k.json'),
  l: () => require('@/assets/data/webster-l.json'),
  m: () => require('@/assets/data/webster-m.json'),
  n: () => require('@/assets/data/webster-n.json'),
  o: () => require('@/assets/data/webster-o.json'),
  p: () => require('@/assets/data/webster-p.json'),
  q: () => require('@/assets/data/webster-q.json'),
  r: () => require('@/assets/data/webster-r.json'),
  s: () => require('@/assets/data/webster-s.json'),
  t: () => require('@/assets/data/webster-t.json'),
  u: () => require('@/assets/data/webster-u.json'),
  v: () => require('@/assets/data/webster-v.json'),
  w: () => require('@/assets/data/webster-w.json'),
  x: () => require('@/assets/data/webster-x.json'),
  y: () => require('@/assets/data/webster-y.json'),
  z: () => require('@/assets/data/webster-z.json'),
};

/**
 * Lazy loads a Webster dictionary shard by first letter
 */
function loadShard(letter: string): WebsterDictionary {
  const cached = shardCache.get(letter);
  if (cached) return cached;

  const loader = SHARD_LOADERS[letter];
  if (!loader) return {};

  const data = loader();
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

  const shard = loadShard(firstLetter);
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
