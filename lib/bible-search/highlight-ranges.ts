/**
 * Reads text with matches wrapped in ⟦ ⟧ (SQLite FTS5 highlight(), like the
 * backend's ts_headline) back into [start, end) ranges over the original text.
 * For an exact phrase only whole occurrences of the phrase are kept, so a
 * stray "and" elsewhere in the verse is not bold. Mirrors verse-mate's
 * bible/search/search-query.ts highlightRanges.
 */

export const HIGHLIGHT_START = '⟦';
export const HIGHLIGHT_STOP = '⟧';

export function highlightRanges(
  marked: string,
  original: string,
  phrase?: { words: string[]; prefix: boolean }
): [number, number][] {
  const ranges: [number, number][] = [];
  let plain = '';
  let start = -1;
  for (const ch of marked) {
    if (ch === HIGHLIGHT_START) {
      start = plain.length;
    } else if (ch === HIGHLIGHT_STOP) {
      if (start >= 0 && plain.length > start) ranges.push([start, plain.length]);
      start = -1;
    } else {
      plain += ch;
    }
  }
  if (plain !== original) return [];
  if (!phrase || phrase.words.length < 2) return ranges;

  const wanted = phrase.words.map(fold);
  const last = wanted.length - 1;
  const wordAt = (i: number) => fold(original.slice(ranges[i][0], ranges[i][1]));
  const kept = new Set<number>();
  for (let i = 0; i + last < ranges.length; i++) {
    let ok = true;
    for (let k = 0; k <= last && ok; k++) {
      const word = wordAt(i + k);
      ok = k === last && phrase.prefix ? word.startsWith(wanted[k]) : word === wanted[k];
      if (ok && k > 0) {
        const gap = original.slice(ranges[i + k - 1][1], ranges[i + k][0]);
        ok = !/[\p{L}\p{M}\p{N}]/u.test(gap);
      }
    }
    if (ok) for (let k = 0; k <= last; k++) kept.add(i + k);
  }
  return ranges.filter((_, i) => kept.has(i));
}

/** Case- and accent-insensitive form of a word, for comparing only. */
function fold(word: string): string {
  return word.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}
