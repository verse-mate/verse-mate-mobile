import { normalizeWord } from '@/services/word-mapping-service';
import type { EastonDictionary, EastonEntry } from '@/types/dictionary';

// Module-level cache for lazy-loaded Easton data
let eastonCache: EastonDictionary | null = null;

/**
 * Lazy loads the Easton's Bible Dictionary data
 */
async function loadEaston(): Promise<EastonDictionary> {
  if (eastonCache) return eastonCache;

  // Use require for compatibility with Metro bundler and Jest
  const data = require('@/assets/data/easton-dictionary.json');
  const dictionary = (data.default || data) as EastonDictionary;
  eastonCache = dictionary;
  return eastonCache;
}

/**
 * Looks up a word in Easton's Bible Dictionary
 *
 * @param word - The word to look up (will be normalized)
 * @returns EastonEntry if found, null otherwise
 *
 * @example
 * ```ts
 * const entry = await lookupEaston("Aaron");
 * if (entry) {
 *   console.log(entry.definition);
 * }
 * ```
 */
export async function lookupEaston(word: string): Promise<EastonEntry | null> {
  if (!word) return null;

  const dictionary = await loadEaston();
  const normalized = normalizeWord(word);

  return dictionary[normalized] ?? null;
}

/**
 * Preloads the Easton dictionary for faster subsequent lookups
 */
export async function preload(): Promise<void> {
  await loadEaston();
}

/**
 * Clears the cached dictionary data to free memory
 */
export function clearCache(): void {
  eastonCache = null;
}

/**
 * Gets statistics about the Easton dictionary
 */
export async function getStats() {
  const dictionary = await loadEaston();

  return {
    totalEntries: Object.keys(dictionary).length,
    cached: eastonCache !== null,
  };
}
