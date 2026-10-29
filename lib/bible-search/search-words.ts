/**
 * The words of a search, split the way the backend splits them
 * (verse-mate: bible/search/search-query.ts): runs of letters, combining
 * marks and digits, so Devanagari vowel signs stay inside their word and
 * nothing the user types can reach a query syntax.
 */

const WORD = /[\p{L}\p{M}\p{N}]+/gu;
const MAX_WORDS = 12;
const MAX_WORD_LENGTH = 40;

export interface SearchWords {
  words: string[];
  /** The last word is still being typed (no trailing space): match it as a prefix. */
  prefix: boolean;
}

export function splitSearchWords(raw: string): SearchWords | null {
  const words = (raw.slice(0, 200).match(WORD) ?? [])
    .slice(0, MAX_WORDS)
    .map((w) => w.slice(0, MAX_WORD_LENGTH));
  if (words.length === 0) return null;
  if (words.length === 1 && [...words[0]].length < 2) return null;
  const last = words[words.length - 1];
  const prefix = /[\p{L}\p{M}\p{N}]$/u.test(raw) && [...last].length >= 2;
  return { words, prefix };
}

/** At least two letters or digits: anything less is not worth a request. */
export function isSearchable(raw: string): boolean {
  return (raw.match(/[\p{L}\p{N}]/gu) ?? []).length >= 2;
}
