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
 * Looks up a word's exact headword in Easton's Bible Dictionary
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
 * Looks up a near spelling of a word in Easton's — biblical name variants
 * ("Zaccheus" → Zacchaeus, "Isaih" → Isaiah).
 *
 * Separate from `lookupEaston` because it must only run once every exact
 * lookup has missed, and only for names. Run first, as it once was, it caught
 * ordinary English: in NASB1995, 2,768 distinct words had no exact Easton
 * headword and were handed the nearest one — "will" → Wall, "soul" → Saul,
 * "holy" → Hold, "servant" → Serpent, "anew" → Anab — before Webster's,
 * which has most of them, was ever asked.
 */
export async function lookupEastonVariant(word: string): Promise<EastonEntry | null> {
  if (!word) return null;

  const dictionary = await loadEaston();
  return findFuzzyMatch(normalizeWord(word), dictionary);
}

/**
 * A name's spelling with the transliteration variants that differ between
 * English Bibles folded away: doubled consonants (Bezaleel/Bezalel,
 * Pashhur/Pashur), "ae"/"ee" (Zacchaeus/Zaccheus), "ch" for "c"
 * (Maachah/Maacah), a final "h" after a vowel (Ramah/Rama), hyphens
 * (Bath-sheba/Bathsheba). Doubled "a" stays: in a
 * Hebrew name it marks a different word (Raamah is not Ramah).
 */
function canonicalName(key: string): string {
  return key
    .replace(/-/g, '')
    .replace(/ae|ee/g, 'e')
    .replace(/ch/g, 'c')
    .replace(/([b-df-hj-np-tv-z])\1/g, '$1')
    .replace(/([aeiou])h$/, '$1');
}

let canonicalIndex: Map<string, string[]> | null = null;
let canonicalIndexFor: EastonDictionary | null = null;

function canonicalKeys(dictionary: EastonDictionary): Map<string, string[]> {
  if (canonicalIndex && canonicalIndexFor === dictionary) return canonicalIndex;
  const index = new Map<string, string[]>();
  for (const key of Object.keys(dictionary)) {
    const c = canonicalName(key);
    const list = index.get(c);
    if (list) list.push(key);
    else index.set(c, [key]);
  }
  canonicalIndex = index;
  canonicalIndexFor = dictionary;
  return index;
}

/**
 * Finds the entry a name's other spelling is filed under. Every rule is an
 * exact match on a rewritten form; the edit-distance match this replaced
 * also caught near-misses that are other names ("Pilate" → Palace, "Herod" →
 * Harod, "Neco" → Nebo).
 *
 * 1. Gentilic singular: "Jebusite" → "jebusites".
 * 2. A longer headword that begins with the name, when it is the only one:
 *    "Pilate" → "pilate pontius" (but "Herod" has six — none is guessed).
 * 3. The same canonical spelling (see `canonicalName`), when unambiguous.
 */
function findFuzzyMatch(normalized: string, dictionary: EastonDictionary): EastonEntry | null {
  if (normalized.length < 3) return null;

  const plural = dictionary[`${normalized}s`];
  if (plural) return plural;

  const longer = Object.keys(dictionary).filter((k) => k.startsWith(`${normalized} `));
  if (longer.length === 1) return dictionary[longer[0]];

  const same = canonicalKeys(dictionary).get(canonicalName(normalized));
  if (same && same.length === 1) return dictionary[same[0]];

  return null;
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
