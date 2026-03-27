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

  // 1. Exact match
  if (dictionary[normalized]) {
    return dictionary[normalized];
  }

  // 2. Fuzzy match — try common biblical spelling variants
  const fuzzyMatch = findFuzzyMatch(normalized, dictionary);
  return fuzzyMatch;
}

/**
 * Finds a fuzzy match in the dictionary for common spelling variants.
 * Handles cases like "zaccheus" → "zacchaeus", "isaih" → "isaiah", etc.
 */
function findFuzzyMatch(normalized: string, dictionary: EastonDictionary): EastonEntry | null {
  // Only attempt fuzzy matching for words 4+ characters (avoid false positives on short words)
  if (normalized.length < 4) return null;

  const keys = Object.keys(dictionary);

  // Strategy 1: Check if removing/adding common letter variants matches
  // e.g., ae/e, ph/f, ck/c, double letters
  for (const key of keys) {
    if (Math.abs(key.length - normalized.length) > 2) continue;
    if (key[0] !== normalized[0]) continue; // Must start with same letter

    // Simple edit distance check — allow distance of 1-2 for similar words
    const dist = levenshteinDistance(normalized, key);
    if (dist === 1 || (dist === 2 && normalized.length >= 6)) {
      return dictionary[key];
    }
  }

  return null;
}

/**
 * Compute Levenshtein edit distance between two strings.
 * Used for fuzzy dictionary matching on biblical name variants.
 */
function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  return dp[m][n];
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
