import { lookupEaston } from '@/services/easton-service';
import { isValidStrongsNumber, lookup } from '@/services/lexicon-service';
import { getStrongsNumber, hasStrongsNumber } from '@/services/word-mapping-service';
import type { DictionaryResult } from '@/types/dictionary';

/**
 * Unified dictionary lookup that orchestrates all dictionary sources.
 *
 * Priority:
 * 1. Easton's Bible Dictionary (by normalized English word)
 * 2. Strong's Concordance (via word-mapping-service)
 * 3. Direct Strong's number lookup (if word is e.g. "G26")
 *
 * @param word - The word to look up
 * @returns DictionaryResult with the best available definition
 */
export async function lookupWord(word: string): Promise<DictionaryResult> {
  if (!word) {
    return { word, hasNativeDefinition: false, source: 'none' };
  }

  // 1. Try Easton's Bible Dictionary (highest hit rate for English words)
  const eastonEntry = await lookupEaston(word);
  if (eastonEntry) {
    return {
      word,
      eastonEntry,
      hasNativeDefinition: false,
      source: 'easton',
    };
  }

  // 2. Try Strong's via word mapping
  if (hasStrongsNumber(word)) {
    const strongsNumber = getStrongsNumber(word);
    if (!strongsNumber) return { word, hasNativeDefinition: false, source: 'none' };
    const result = await lookup(strongsNumber);
    if (result.found && result.entry) {
      return {
        word,
        strongsNumber,
        strongsEntry: result.entry,
        hasNativeDefinition: false,
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
        hasNativeDefinition: false,
        source: 'strongs',
      };
    }
  }

  return { word, hasNativeDefinition: false, source: 'none' };
}
