/**
 * "Highlight all": every place a word or phrase occurs in a book.
 *
 * Andy (2026-11-01): highlighting a book's repeated words and phrases is a common study method —
 * "I am" through John. The reader selects the words once and the highlight sheet's "All in John"
 * highlights each occurrence.
 *
 * Matches are found in the same verse text the reader shows and stores highlight offsets against
 * (the chapter query), not through search: search's exact match is a stemmed full-text phrase, so
 * a short phrase of common words is exactly what it handles worst.
 */

export interface PhraseOccurrence {
  chapter: number;
  verse: number;
  /** Offset into the verse's own text, inclusive. */
  start: number;
  /** Offset into the verse's own text, exclusive. */
  end: number;
  /** The words as they appear there (case can differ from the selection). */
  text: string;
}

export interface ChapterVerses {
  verseNumber: number;
  text: string;
}

const REGEX_SPECIAL = /[.*+?^${}()|[\]\\]/g;
const APOSTROPHES = /['’‘]/g;

/**
 * A pattern for the phrase: case-insensitive, any run of whitespace between words, either
 * apostrophe, and whole words only — "am" must not match inside "Amos" or "lamb".
 */
function phrasePattern(phrase: string): RegExp | null {
  const words = phrase.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;
  const body = words
    .map((word) => word.replace(REGEX_SPECIAL, '\\$&').replace(APOSTROPHES, "['’‘]"))
    .join('\\s+');
  // The end is a lookahead; the start is checked by hand in findPhraseOccurrences, since the app
  // uses no regex lookbehind anywhere and Hermes' support for it is not something to find out on
  // a reader's phone.
  return new RegExp(`${body}(?![\\p{L}\\p{N}])`, 'giu');
}

const WORD_CHAR = /[\p{L}\p{N}]/u;

/** Every whole-word occurrence of `phrase` in `text`, as [start, end) offsets. */
export function findPhraseOccurrences(
  text: string,
  phrase: string
): { start: number; end: number; text: string }[] {
  const pattern = phrasePattern(phrase);
  if (!pattern) return [];
  const found: { start: number; end: number; text: string }[] = [];
  let match = pattern.exec(text);
  while (match) {
    const start = match.index;
    if (start > 0 && WORD_CHAR.test(text[start - 1])) {
      // Inside a word: retry from the next character, so a real match that begins within this
      // one is not skipped.
      pattern.lastIndex = start + 1;
    } else {
      found.push({ start, end: start + match[0].length, text: match[0] });
    }
    match = pattern.exec(text);
  }
  return found;
}

/**
 * Every occurrence of `phrase` in a book, chapter by chapter, in Bible order.
 *
 * `loadChapter` returns a chapter's verses, or null when it cannot be read; such a chapter is
 * skipped and counted in `missingChapters`, so the caller can say the result is partial.
 */
export async function collectBookOccurrences({
  phrase,
  chapterCount,
  loadChapter,
  signal,
}: {
  phrase: string;
  chapterCount: number;
  loadChapter: (chapter: number) => Promise<ChapterVerses[] | null>;
  signal?: AbortSignal;
}): Promise<{ occurrences: PhraseOccurrence[]; missingChapters: number[] }> {
  const occurrences: PhraseOccurrence[] = [];
  const missingChapters: number[] = [];
  for (let chapter = 1; chapter <= chapterCount; chapter++) {
    if (signal?.aborted) break;
    let verses: ChapterVerses[] | null = null;
    try {
      verses = await loadChapter(chapter);
    } catch {
      verses = null;
    }
    if (!verses) {
      missingChapters.push(chapter);
      continue;
    }
    for (const verse of verses) {
      for (const hit of findPhraseOccurrences(verse.text, phrase)) {
        occurrences.push({ chapter, verse: verse.verseNumber, ...hit });
      }
    }
  }
  return { occurrences, missingChapters };
}

/** More than this asks the reader first: "and" in Genesis would paint the whole book. */
export const HIGHLIGHT_ALL_CONFIRM_ABOVE = 100;

/** The fields of a saved highlight these helpers read. */
export interface SavedHighlightLike {
  highlight_id: number;
  book_id: number;
  color: string;
  start_char: unknown;
  end_char: unknown;
  selected_text: unknown;
  created_at: string;
}

/** The same words however they are cased, spaced or apostrophed, as findPhraseOccurrences matches. */
function normalizePhrase(phrase: string): string {
  return phrase.replace(APOSTROPHES, "'").replace(/\s+/g, ' ').trim().toLocaleLowerCase();
}

/** A highlight of some words (character offsets and their text), not of whole verses. */
function wordsOf(h: SavedHighlightLike): string | null {
  if (typeof h.start_char !== 'number' || typeof h.end_char !== 'number') return null;
  return typeof h.selected_text === 'string' && h.selected_text.trim()
    ? normalizePhrase(h.selected_text)
    : null;
}

/**
 * Every highlight of exactly these words in a book: what "Remove all in John" removes, whichever
 * way each one was made.
 */
export function phraseHighlightsInBook<T extends SavedHighlightLike>(
  highlights: readonly T[],
  bookId: number,
  phrase: string
): T[] {
  const words = normalizePhrase(phrase);
  if (!words) return [];
  return highlights.filter((h) => h.book_id === bookId && wordsOf(h) === words);
}

/** Highlight all saves a run back to back (a few at a time); a gap this long ends a run. */
export const HIGHLIGHT_ALL_RUN_GAP_MS = 60_000;

/**
 * The "Highlight all" run a highlight belongs to, or null when it was made on its own.
 *
 * A saved highlight carries no mark of how it was made, so a run is recognised by what Highlight
 * all leaves behind: highlights of the same words, in the same colour and book, saved within
 * seconds of each other. Two or more of those in one burst is a run. Highlighting the same word
 * by hand, in the same colour, more than once within a minute of the last is the one way to look
 * like a run without being one.
 */
export function highlightAllRun<T extends SavedHighlightLike>(
  highlights: readonly T[],
  target: T
): T[] | null {
  const words = wordsOf(target);
  if (!words) return null;
  const same = highlights
    .filter(
      (h) => h.book_id === target.book_id && h.color === target.color && wordsOf(h) === words
    )
    .map((h) => ({ h, at: Date.parse(h.created_at) }))
    .filter(({ at }) => Number.isFinite(at))
    .sort((a, b) => a.at - b.at);

  let run: T[] = [];
  let lastAt = Number.NEGATIVE_INFINITY;
  for (const { h, at } of same) {
    if (at - lastAt > HIGHLIGHT_ALL_RUN_GAP_MS) {
      if (run.some((r) => r.highlight_id === target.highlight_id)) break;
      run = [];
    }
    run.push(h);
    lastAt = at;
  }
  return run.length >= 2 && run.some((r) => r.highlight_id === target.highlight_id) ? run : null;
}

/**
 * Every highlight that belongs to a "Highlight all" run (see highlightAllRun), as a set of ids:
 * the study layer the highlights list leaves out, so one pass over "I am" in John doesn't fill
 * it with chapters.
 */
export function highlightAllRunIds(highlights: readonly SavedHighlightLike[]): Set<number> {
  const groups = new Map<string, { id: number; at: number }[]>();
  for (const h of highlights) {
    const words = wordsOf(h);
    if (!words) continue;
    const at = Date.parse(h.created_at);
    if (!Number.isFinite(at)) continue;
    const key = `${h.book_id}|${h.color}|${words}`;
    const list = groups.get(key) ?? [];
    list.push({ id: h.highlight_id, at });
    groups.set(key, list);
  }
  const ids = new Set<number>();
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    list.sort((a, b) => a.at - b.at);
    let run: number[] = [];
    let lastAt = Number.NEGATIVE_INFINITY;
    const flush = () => {
      if (run.length >= 2) for (const id of run) ids.add(id);
    };
    for (const { id, at } of list) {
      if (at - lastAt > HIGHLIGHT_ALL_RUN_GAP_MS) {
        flush();
        run = [];
      }
      run.push(id);
      lastAt = at;
    }
    flush();
  }
  return ids;
}

/** The fields of a saved highlight highlightedPhraseAt reads, beyond SavedHighlightLike. */
interface PlacedHighlightLike extends SavedHighlightLike {
  chapter_number: number;
  start_verse: number;
  end_verse: number;
}

/**
 * The words of the word highlight a selection sits in, or null when it touches none: selecting
 * "Son of" inside a highlighted "Son of Man" means "Son of Man" when removing all in the book.
 */
export function highlightedPhraseAt(
  highlights: readonly PlacedHighlightLike[],
  place: {
    bookId: number;
    chapterNumber: number;
    verse: number;
    startChar?: number;
    endChar?: number;
  }
): string | null {
  for (const h of highlights) {
    if (h.book_id !== place.bookId || h.chapter_number !== place.chapterNumber) continue;
    if (h.start_verse !== place.verse || h.end_verse !== place.verse) continue;
    if (!wordsOf(h)) continue;
    const start = h.start_char as number;
    const end = h.end_char as number;
    const touches =
      place.startChar === undefined ||
      place.endChar === undefined ||
      (start < place.endChar && place.startChar < end);
    if (touches) return (h.selected_text as string).trim();
  }
  return null;
}
