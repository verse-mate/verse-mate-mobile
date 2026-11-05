import { lookupEaston, lookupEastonVariant } from '@/services/easton-service';
import { isValidStrongsNumber, lookup } from '@/services/lexicon-service';
import { lookupWebster } from '@/services/webster-service';
import { baseForms } from '@/services/word-forms';
import { getStrongsNumber, hasStrongsNumber, normalizeWord } from '@/services/word-mapping-service';
import type { DictionaryResult, EastonEntry, WebsterEntry } from '@/types/dictionary';

/**
 * Easton's headwords that are a biblical name spelled like a common English
 * word. Found by running every word of NASB1995 through this lookup: the
 * reader tapping "so" got King So of Egypt, "on" the city On, "no" No-Amon
 * (Thebes), "a" the Greek letter Alpha.
 *
 * ALWAYS: the English word, however it is capitalized. A poetry line opens
 * with a capital ("So teach us to number our days"), so the capital is no
 * sign of the name, and the names themselves occur a handful of times.
 *
 * LOWERCASE: the English word only when written in lowercase. Capitalized,
 * these are names in genealogies and itineraries (Ram son of Hezron, Beer the
 * well-station, Madmen the Moabite town).
 */
const NAME_ENTRY_ALWAYS = new Set(['a', 'on', 'so', 'no']);
const NAME_ENTRY_LOWERCASE = new Set(['ram', 'beer', 'madmen']);

/** The word's first letter is lowercase ("swept", not "Swept"). */
function startsLowercase(word: string): boolean {
  const first = word.match(/\p{L}/u)?.[0];
  return !!first && first === first.toLowerCase() && first !== first.toUpperCase();
}

/** The word's first letter is a capital — how a name is written. */
function startsUppercase(word: string): boolean {
  const first = word.match(/\p{L}/u)?.[0];
  return !!first && first === first.toUpperCase() && first !== first.toLowerCase();
}

async function eastonFor(word: string, key: string): Promise<EastonEntry | null> {
  if (NAME_ENTRY_ALWAYS.has(key)) return null;
  if (NAME_ENTRY_LOWERCASE.has(key) && startsLowercase(word)) return null;
  return lookupEaston(key);
}

/**
 * Webster's lists many inflections only as a pointer — "swept" is "imp. &
 * p. p. of Sweep." — which defines nothing. Matches only the grammatical
 * pointers: "The act of anatomizing." has the same shape but is a definition.
 */
const WEBSTER_POINTER_RE =
  /^(?:(?:imp|p\.\s*p|p\.\s*pr|pl|pres|superl|compar|3d\s+pers\.\s*sing(?:\.\s*pres)?)\.?\s*(?:&|,|or)?\s*)+of\s+([A-Za-z][A-Za-z-]*)\.?\s*$/;

async function websterFor(key: string): Promise<WebsterEntry | null> {
  const entry = await lookupWebster(key);
  if (!entry) return null;
  const pointer = entry.definition.match(WEBSTER_POINTER_RE);
  if (!pointer) return entry;
  const target = await lookupWebster(pointer[1]);
  if (!target) return entry;
  // Keep the pointer line so the reader sees how "swept" relates to "Sweep".
  return {
    term: target.term,
    definition: `${entry.definition.trim()}\n\n${target.definition}`,
  };
}

/**
 * Unified dictionary lookup that orchestrates all dictionary sources.
 *
 * Priority:
 * 1. Easton's Bible Dictionary, exact headword (bar the name collisions above)
 * 2. Strong's Concordance (via word-mapping-service)
 * 3. Direct Strong's number lookup (if word is e.g. "G26")
 * 4. Webster's 1913, exact headword (following "imp. of …" pointers)
 * 5. Steps 1 and 4 again for its base forms ("sons" → son, "called" → call)
 * 6. Easton's spelling variants, for capitalized words (names) only
 *
 * Exact lookups all come before the spelling-variant match: run first, that
 * match answered ordinary words with the nearest name ("will" → Wall,
 * "anew" → Anab).
 *
 * @param word - The word to look up, as written in the verse (its case matters)
 * @returns DictionaryResult with the best available definition
 */
export async function lookupWord(word: string): Promise<DictionaryResult> {
  if (!word) {
    return { word, source: 'none' };
  }
  const key = normalizeWord(word);

  // 1. Easton's Bible Dictionary (highest hit rate for English words)
  const eastonEntry = await eastonFor(word, key);
  if (eastonEntry) {
    return {
      word,
      eastonEntry,
      source: 'easton',
    };
  }

  // 2. Try Strong's via word mapping
  if (hasStrongsNumber(word)) {
    const strongsNumber = getStrongsNumber(word);
    if (!strongsNumber) return { word, source: 'none' };
    const result = await lookup(strongsNumber);
    if (result.found && result.entry) {
      return {
        word,
        strongsNumber,
        strongsEntry: result.entry,
        source: 'strongs',
      };
    }
  }

  // 3. If the word itself is a Strong's number (e.g., "G26", "H430")
  if (isValidStrongsNumber(word)) {
    const strongsNumber = word.toUpperCase();
    const result = await lookup(strongsNumber);
    if (result.found && result.entry) {
      return {
        word,
        strongsNumber,
        strongsEntry: result.entry,
        source: 'strongs',
      };
    }
  }

  // 4. Webster's 1913 Dictionary (general English)
  const websterEntry = await websterFor(key);
  if (websterEntry) {
    return { word, websterEntry, source: 'webster' };
  }

  // 5. Its base forms, through the same exact lookups
  for (const base of baseForms(key)) {
    const easton = await eastonFor(word, base);
    if (easton) return { word, eastonEntry: easton, source: 'easton' };
    const webster = await websterFor(base);
    if (webster) return { word, websterEntry: webster, source: 'webster' };
  }

  // 6. A near spelling of a biblical name ("Zaccheus" → Zacchaeus)
  if (startsUppercase(word)) {
    const variant = await lookupEastonVariant(word);
    if (variant) return { word, eastonEntry: variant, source: 'easton' };
  }

  return { word, source: 'none' };
}
