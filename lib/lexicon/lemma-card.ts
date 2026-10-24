/**
 * Lemma card merging for the non-English lexicon popover.
 *
 * Non-English Bibles resolve their card from the backend `/lemma` endpoint,
 * which falls back to English field by field. But the backend only stores
 * prose for the ~2,200 `loaded` lemmas; for the other ~16K its English
 * fields are null too, so most words would show "No detailed lexicon entry".
 * The bundled `@versemate/lexicon` has an English entry for every Strong's
 * number, so it is the base layer: the backend card overrides it only where
 * the backend actually has text, in the reader's language or in English.
 */

import type { LexEntry, RelatedWord } from '@versemate/lexicon';
import type { LemmaCard } from '@/hooks/use-lemma';

/** Canonical G####/H#### — the key `loadStrongsIndex()` uses. */
export function canonicalStrongs(raw: string): string | null {
  const m = /^([GH])0*(\d+)/i.exec(raw.trim());
  return m ? `${m[1].toUpperCase()}${m[2].padStart(4, '0')}` : null;
}

/**
 * Overlay a backend card on the bundled entry (or, when the bundled lexicon
 * has none, the chapter's stub). A null or empty card field leaves the
 * underlying value in place.
 *
 * `related`: the API ships `translit` + `note` but no original-script lemma.
 * Restore it from the bundled entry by position; without one, reuse the
 * translit so the related-word heading still reads.
 */
export function mergeLemmaCard(card: LemmaCard, bundled: LexEntry | null, stub: LexEntry): LexEntry {
  const base = bundled ?? stub;
  const merged: LexEntry = { ...base, strongs: card.strongs, loaded: card.loaded };
  if (card.lemma) merged.lemma = card.lemma;
  if (card.translit) merged.translit = card.translit;
  if (card.pronunciation) merged.pronunciation = card.pronunciation;
  if (card.pos) merged.pos = card.pos;
  if (card.basic_gloss) merged.basicGloss = card.basic_gloss;
  if (card.semantic_range && card.semantic_range.length > 0) merged.semanticRange = card.semantic_range;
  if (card.notes) merged.notes = card.notes;
  if (card.nt_frequency != null) merged.ntFrequency = card.nt_frequency;
  if (card.ot_frequency != null) merged.otFrequency = card.ot_frequency;
  if (card.related && card.related.length > 0) {
    merged.related = card.related.map(
      (r, i): RelatedWord => ({
        lemma: base.related?.[i]?.lemma || r.translit,
        translit: r.translit,
        note: r.note,
      })
    );
  }
  return merged;
}
