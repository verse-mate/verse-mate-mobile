/**
 * Service for mapping English words to Strong's Concordance numbers.
 *
 * This provides a simple word-to-Strong's mapping for common biblical terms.
 * For more comprehensive mappings, interlinear Bible data would be needed.
 */

// Common biblical word-to-Strong's number mappings
// Greek words (New Testament)
const greekWordMappings: Record<string, string> = {
  love: 'G26',
  god: 'G2316',
  word: 'G3056',
  light: 'G5457',
  life: 'G2222',
  truth: 'G225',
  faith: 'G4102',
  grace: 'G5485',
  peace: 'G1515',
  spirit: 'G4151',
  christ: 'G5547',
  jesus: 'G2424',
  lord: 'G2962',
  father: 'G3962',
  son: 'G5207',
  holy: 'G40',
  church: 'G1577',
  salvation: 'G4991',
  heaven: 'G3772',
  kingdom: 'G932',
  gospel: 'G2098',
  sin: 'G266',
  glory: 'G1391',
  power: 'G1411',
  wisdom: 'G4678',
  hope: 'G1680',
  heart: 'G2588',
  pray: 'G4336',
  prayer: 'G4335',
  believe: 'G4100',
  righteous: 'G1342',
  eternal: 'G166',
  world: 'G2889',
  death: 'G2288',
  resurrection: 'G386',
  angel: 'G32',
  apostle: 'G652',
  baptism: 'G908',
  bread: 'G740',
  blood: 'G129',
  body: 'G4983',
  cross: 'G4716',
  disciple: 'G3101',
  evil: 'G4190',
  flesh: 'G4561',
  forgive: 'G863',
  joy: 'G5479',
  judgment: 'G2920',
  law: 'G3551',
  mercy: 'G1656',
  name: 'G3686',
  prophet: 'G4396',
  repent: 'G3340',
  righteousness: 'G1343',
  sacrifice: 'G2378',
  servant: 'G1401',
  soul: 'G5590',
  temple: 'G2411',
  witness: 'G3144',
};

// Hebrew words (Old Testament)
const hebrewWordMappings: Record<string, string> = {
  elohim: 'H430',
  yahweh: 'H3068',
  adonai: 'H136',
  shalom: 'H7965',
  hesed: 'H2617',
  ruach: 'H7307',
  torah: 'H8451',
  nephesh: 'H5315',
  lev: 'H3820',
  shamayim: 'H8064',
  create: 'H1254',
  created: 'H1254',
  beginning: 'H7225',
  heavens: 'H8064',
  blessed: 'H1288',
  covenant: 'H1285',
  earth: 'H776',
  glory: 'H3519',
  holy: 'H6918',
  israel: 'H3478',
  king: 'H4428',
  lord: 'H3068',
  man: 'H120',
  people: 'H5971',
  righteousness: 'H6666',
  salvation: 'H3444',
  servant: 'H5650',
  sin: 'H2403',
  soul: 'H5315',
  spirit: 'H7307',
  word: 'H1697',
  worship: 'H7812',
};

// Combined mappings (Greek takes precedence for duplicates in NT context)
const wordToStrongs: Record<string, string> = {
  ...hebrewWordMappings,
  ...greekWordMappings,
};

/**
 * Normalizes a word for lookup by converting to lowercase and removing punctuation
 */
export function normalizeWord(word: string): string {
  return word.toLowerCase().replace(/[.,;:!?'"()]/g, '');
}

/**
 * Gets the Strong's number for a given word, if mapped
 *
 * @param word - The word to look up
 * @returns Strong's number (e.g., "G26") or null if not found
 *
 * @example
 * ```ts
 * getStrongsNumber("love"); // "G26"
 * getStrongsNumber("elohim"); // "H430"
 * getStrongsNumber("unknown"); // null
 * ```
 */
export function getStrongsNumber(word: string): string | null {
  const normalized = normalizeWord(word);
  return wordToStrongs[normalized] || null;
}

/**
 * Checks if a word has a Strong's number mapping
 */
export function hasStrongsNumber(word: string): boolean {
  return getStrongsNumber(word) !== null;
}

/**
 * Gets all mapped words for a given language
 *
 * @param language - 'greek' or 'hebrew'
 * @returns Array of words mapped for that language
 */
export function getMappedWords(language: 'greek' | 'hebrew'): string[] {
  const mappings = language === 'greek' ? greekWordMappings : hebrewWordMappings;
  return Object.keys(mappings);
}

/**
 * Gets total count of mapped words
 */
export function getMappingCount(): { greek: number; hebrew: number; total: number } {
  return {
    greek: Object.keys(greekWordMappings).length,
    hebrew: Object.keys(hebrewWordMappings).length,
    total: Object.keys(wordToStrongs).length,
  };
}
