/**
 * Keep a derived array's IDENTITY stable while its contents are unchanged.
 *
 * ## Why this exists
 *
 * Filtering in a `useMemo` fixes correctness and creates a performance problem: the memo
 * re-runs whenever its source array's identity changes, and produces a NEW array every
 * time even when the filtered contents are identical. Every consumer then re-renders.
 *
 * That is measured, not hypothetical. Filtering highlights per chapter — which fixed
 * highlights bleeding from one chapter to the next — took `reader.render.bible` to 889
 * renders and `paragraph.compile` to 999 calls across about 20 chapter changes, roughly 45
 * renders per change, with `render.bible.by.chapterHighlights` at 157 and
 * `by.autoHighlights` at 142. The source arrays churn identity constantly, so the filtered
 * ones did too.
 *
 * Comparing a content key and returning the PREVIOUS array when it matches keeps both
 * properties: the filter stays correct, and consumers only see a new array when something
 * actually changed.
 */

import { useRef } from 'react';

/**
 * Return `list`, or the previously returned array when `key(list)` is unchanged.
 *
 * The key must cover every field consumers depend on. Getting it wrong means a stale array
 * is reused after a real change, so it is worth being generous — the key is computed once
 * per call and the alternative is a full re-render.
 *
 * ```ts
 * const highlights = useStableList(filtered, (h) => `${h.highlight_id}:${h.color}`);
 * ```
 */
export function useStableList<T>(list: T[], key: (item: T) => string): T[] {
  const signature = list.map(key).join('|');
  const cache = useRef<{ signature: string; list: T[] } | null>(null);

  if (cache.current === null || cache.current.signature !== signature) {
    cache.current = { signature, list };
  }
  return cache.current.list;
}
