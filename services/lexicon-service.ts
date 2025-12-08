import type {
  LanguageType,
  LexiconDictionary,
  LookupResult,
  StrongsEntry,
} from '@/types/dictionary';

// Module-level caches for lazy-loaded lexicon data
let greekCache: LexiconDictionary | null = null;
let hebrewCache: LexiconDictionary | null = null;

/**
 * Determines if a Strong's number is Greek or Hebrew based on prefix
 */
function getLanguageType(strongsNum: string): LanguageType | null {
  const normalized = strongsNum.toUpperCase();
  if (normalized.startsWith('G')) return 'greek';
  if (normalized.startsWith('H')) return 'hebrew';
  return null;
}

/**
 * Lazy loads the Greek lexicon data
 */
async function loadGreek(): Promise<LexiconDictionary> {
  if (greekCache) return greekCache;

  // Dynamic import for code splitting
  const data = await import('@/assets/data/strongs-greek.json');
  const lexicon = data.default || data;
  greekCache = lexicon as LexiconDictionary;
  return greekCache;
}

/**
 * Lazy loads the Hebrew lexicon data
 */
async function loadHebrew(): Promise<LexiconDictionary> {
  if (hebrewCache) return hebrewCache;

  // Dynamic import for code splitting
  const data = await import('@/assets/data/strongs-hebrew.json');
  const lexicon = data.default || data;
  hebrewCache = lexicon as LexiconDictionary;
  return hebrewCache;
}

/**
 * Looks up a Strong's number and returns the entry
 *
 * @param strongsNum - Strong's number (e.g., "G26", "H430", "g26", "h430")
 * @returns LookupResult with entry if found
 *
 * @example
 * ```ts
 * const result = await lookup("G26");
 * if (result.found && result.entry) {
 *   console.log(result.entry.definition); // "unconditional love"
 * }
 * ```
 */
export async function lookup(strongsNum: string): Promise<LookupResult> {
  if (!strongsNum) {
    return {
      entry: null,
      found: false,
      error: "Strong's number is required",
    };
  }

  const normalized = strongsNum.toUpperCase();
  const langType = getLanguageType(normalized);

  if (!langType) {
    return {
      entry: null,
      found: false,
      error: `Invalid Strong's number format: ${strongsNum}. Must start with 'G' (Greek) or 'H' (Hebrew)`,
    };
  }

  try {
    const lexicon = langType === 'greek' ? await loadGreek() : await loadHebrew();

    const entry = lexicon[normalized];

    if (!entry) {
      return {
        entry: null,
        found: false,
        error: `Strong's number ${normalized} not found in ${langType} lexicon`,
        language: langType,
      };
    }

    return {
      entry,
      found: true,
      language: langType,
    };
  } catch (error) {
    return {
      entry: null,
      found: false,
      error: `Failed to load ${langType} lexicon: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}

/**
 * Looks up multiple Strong's numbers at once
 *
 * @param strongsNumbers - Array of Strong's numbers
 * @returns Array of LookupResults in the same order
 *
 * @example
 * ```ts
 * const results = await batchLookup(["G26", "H430"]);
 * ```
 */
export async function batchLookup(strongsNumbers: string[]): Promise<LookupResult[]> {
  return Promise.all(strongsNumbers.map((num) => lookup(num)));
}

/**
 * Preloads both lexicons for faster subsequent lookups
 * Useful for improving UX when you know dictionary will be used
 */
export async function preload(): Promise<void> {
  await Promise.all([loadGreek(), loadHebrew()]);
}

/**
 * Clears the cached lexicon data to free memory
 * Useful in memory-constrained environments
 */
export function clearCache(): void {
  greekCache = null;
  hebrewCache = null;
}

/**
 * Gets statistics about the lexicons
 */
export async function getStats() {
  const [greek, hebrew] = await Promise.all([loadGreek(), loadHebrew()]);

  return {
    greek: {
      totalEntries: Object.keys(greek).length,
      cached: greekCache !== null,
    },
    hebrew: {
      totalEntries: Object.keys(hebrew).length,
      cached: hebrewCache !== null,
    },
  };
}

/**
 * Checks if a Strong's number is valid (without loading the full lexicon)
 */
export function isValidStrongsNumber(strongsNum: string): boolean {
  if (!strongsNum || typeof strongsNum !== 'string') {
    return false;
  }
  const normalized = strongsNum.toUpperCase();
  // Matches G1-G9999 or H1-H9999
  return /^[GH]\d{1,4}$/.test(normalized);
}
