/**
 * Strong's Concordance entry from the lexicon
 */
export interface StrongsEntry {
  id: string;
  lemma: string;
  definition: string;
  kjvTranslation?: string;
  derivation?: string;
  transliteration?: string;
}

/**
 * Dictionary keyed by Strong's number (e.g., "H1", "G26")
 */
export type LexiconDictionary = Record<string, StrongsEntry>;

/**
 * Language type based on Strong's number prefix
 */
export type LanguageType = 'greek' | 'hebrew';

/**
 * Result of a lexicon lookup
 */
export interface LookupResult {
  entry: StrongsEntry | null;
  found: boolean;
  error?: string;
  language?: LanguageType;
}

/**
 * Easton's Bible Dictionary entry
 */
export interface EastonEntry {
  term: string;
  definition: string;
  scriptureRefs?: string[];
  seeAlso?: string[];
}

/**
 * Dictionary keyed by normalized English word (e.g., "aaron", "love")
 */
export type EastonDictionary = Record<string, EastonEntry>;

/**
 * Result of a dictionary lookup (including native OS dictionary)
 */
export interface DictionaryResult {
  word: string;
  strongsNumber?: string;
  strongsEntry?: StrongsEntry;
  eastonEntry?: EastonEntry;
  hasNativeDefinition: boolean;
  source: 'native' | 'strongs' | 'easton' | 'none';
}
