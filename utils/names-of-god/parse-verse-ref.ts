import { BIBLE_BOOKS } from '@/constants/bible-books';

export interface ParsedVerseRef {
  raw: string;
  bookId: number;
  bookName: string;
  chapter: number;
  verse: number;
}

/**
 * Parses a verse reference string ("Genesis 2:4", "1 Samuel 16:7") into
 * structured data. Returns null if the string can't be matched to a known book.
 *
 * Matching is case-insensitive and normalises "Psalms" <-> "Psalm" variants.
 */
export function parseVerseRef(raw: string): ParsedVerseRef | null {
  const match = raw.trim().match(/^(.*)\s(\d+):(\d+)$/);
  if (!match) return null;

  const [, bookName, chapterStr, verseStr] = match;
  const chapter = Number(chapterStr);
  const verse = Number(verseStr);

  const normalised = bookName
    .trim()
    .toLowerCase()
    .replace(/^psalms$/, 'psalms');
  const book = BIBLE_BOOKS.find(
    (b) =>
      b.name.toLowerCase() === normalised ||
      b.name.toLowerCase().replace(/^psalms$/, 'psalms') === normalised
  );
  if (!book) return null;

  return { raw, bookId: book.id, bookName: book.name, chapter, verse };
}

/** Canonical sort comparator: Gen → Rev, then chapter ASC, then verse ASC. */
export function compareVerseRefs(a: ParsedVerseRef, b: ParsedVerseRef): number {
  if (a.bookId !== b.bookId) return a.bookId - b.bookId;
  if (a.chapter !== b.chapter) return a.chapter - b.chapter;
  return a.verse - b.verse;
}

/**
 * Parses and sorts an array of raw verse reference strings in canonical order.
 * Refs that cannot be parsed are silently dropped.
 */
export function parseSortVerseRefs(rawRefs: string[]): ParsedVerseRef[] {
  return rawRefs
    .map(parseVerseRef)
    .filter((r): r is ParsedVerseRef => r !== null)
    .sort(compareVerseRefs);
}
