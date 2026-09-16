/**
 * Narrow a chapter's by-line commentary to the verses a Jesus event spans.
 *
 * Ported from verse-mate-web `src/lib/jesusByline.ts`. Same argument as the
 * study scoping next door: there is no event-scoped by-line content and there
 * doesn't need to be. The commentary is keyed by (book, chapter, verse) and an
 * event knows its verses, so filtering the chapter's rows to that span gives a
 * real line-by-line reading of the pericope today, without waiting on anything
 * to be generated.
 *
 * An event usually spans more than one passage — the same episode as Matthew,
 * Mark and Luke each tell it — and every one of those is scripture the event
 * screen prints. So the tab is built per passage and EVERY passage gets a
 * section, including accounts whose chapter has no by-line generated yet: an
 * account that is silently absent reads as "this verse has no explanation",
 * which is a different claim from "it hasn't been written".
 */
import type { JesusEventPassage } from '@/types/jesus';

/**
 * Does a passage cover this verse?
 *
 * A null `verse_start` means the passage is the whole chapter, so the range
 * test treats null as unbounded rather than as verse 0 — otherwise a
 * whole-chapter account would match nothing.
 */
export function covers(passage: JesusEventPassage, verse: number): boolean {
  if (passage.verse_start == null) return true;
  if (verse < passage.verse_start) return false;
  if (passage.verse_end == null) return verse === passage.verse_start;
  return verse <= passage.verse_end;
}

/**
 * The chapter a passage's commentary is fetched under.
 *
 * Two accounts of one event can share a chapter (Mark 1:14-15 and Mark
 * 1:16-20), which is what this key exists to notice.
 */
export function bylineChapterKey(passage: {
  book_id: number;
  chapter: number;
}): string {
  return `${passage.book_id}:${passage.chapter}`;
}

/** "Mark 4:39" — what a row's toggle shows. */
export function bylineReference(passage: JesusEventPassage, verse: number): string {
  return `${passage.book_name} ${passage.chapter}:${verse}`;
}
