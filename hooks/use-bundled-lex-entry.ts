/**
 * useBundledLexEntry Hook
 *
 * The bundled English `@versemate/lexicon` entry a non-English lemma card
 * falls back to. The backend only stores text for its `loaded` lemmas, so a
 * card for any other word arrives bare and the popover would say "No detailed
 * lexicon entry"; the bundled entry fills it in, in English.
 *
 * `loadStrongsIndex` imports the whole 18.7MB `_lemmas.json` (a ~2s JS-thread
 * block on a phone, the first time), so the entry is only loaded once the
 * card is back and lacks text, or the request failed. A translated card never
 * pays for it.
 */

import { type LexEntry, loadStrongsIndex } from '@versemate/lexicon';
import { useEffect, useState } from 'react';
import type { LemmaCard } from '@/hooks/use-lemma';
import { canonicalStrongs, cardLacksText } from '@/lib/lexicon/lemma-card';

export interface BundledLexEntry {
  /** The bundled entry, or null when not needed, not loaded yet, or absent. */
  bundled: LexEntry | null;
  /** True while the bundled entry is needed but still loading. */
  isPending: boolean;
}

/**
 * @param strongs The word's Strong's number, or null when the popover is not
 *   resolving an API card (English, or closed).
 * @param card The API card, once it has arrived.
 * @param isCardLoading True while the API request is still in flight.
 */
export function useBundledLexEntry(
  strongs: string | null,
  card: LemmaCard | undefined,
  isCardLoading: boolean
): BundledLexEntry {
  const needed = Boolean(strongs) && !isCardLoading && (!card || cardLacksText(card));
  const key = needed && strongs ? canonicalStrongs(strongs) : null;
  const [loaded, setLoaded] = useState<{ key: string; entry: LexEntry | null } | null>(null);

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    loadStrongsIndex()
      .then((index) => {
        if (!cancelled) setLoaded({ key, entry: index[key] ?? null });
      })
      .catch(() => {
        // No bundled entry: the API card (or the stub) still renders.
        if (!cancelled) setLoaded({ key, entry: null });
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  const isCurrent = key !== null && loaded?.key === key;
  return {
    bundled: isCurrent ? loaded.entry : null,
    isPending: key !== null && !isCurrent,
  };
}
