/**
 * Maps the app's canonical book id (1–66, Genesis…Revelation) to the USFM book
 * code Bible Brain addresses filesets by.
 *
 * `constants/bible-books.ts` carries names, chapter counts and testament but no
 * USFM code, and every Bible Brain path needs one (`/audio/ENGESVN1DA/JHN/3`).
 * The mapping is positional, so a test cross-checks it against BIBLE_BOOKS
 * rather than trusting this table by eye.
 */
import { BIBLE_BOOKS, getBookById } from '@/constants/bible-books';
import type { ChapterRef } from './scripture-storage';

/** Index 0 is book id 1. Codes are the USFM 3-letter standard. */
const USFM_BY_BOOK_ID: readonly string[] = [
  'GEN', 'EXO', 'LEV', 'NUM', 'DEU', 'JOS', 'JDG', 'RUT', '1SA', '2SA',
  '1KI', '2KI', '1CH', '2CH', 'EZR', 'NEH', 'EST', 'JOB', 'PSA', 'PRO',
  'ECC', 'SNG', 'ISA', 'JER', 'LAM', 'EZK', 'DAN', 'HOS', 'JOL', 'AMO',
  'OBA', 'JON', 'MIC', 'NAM', 'HAB', 'ZEP', 'HAG', 'ZEC', 'MAL', 'MAT',
  'MRK', 'LUK', 'JHN', 'ACT', 'ROM', '1CO', '2CO', 'GAL', 'EPH', 'PHP',
  'COL', '1TH', '2TH', '1TI', '2TI', 'TIT', 'PHM', 'HEB', 'JAS', '1PE',
  '2PE', '1JN', '2JN', '3JN', 'JUD', 'REV',
];

/** USFM code for a book id, or null when the id is out of range. */
export function usfmForBookId(bookId: number): string | null {
  if (!Number.isInteger(bookId) || bookId < 1 || bookId > USFM_BY_BOOK_ID.length) {
    return null;
  }
  return USFM_BY_BOOK_ID[bookId - 1];
}

/** Reverse lookup, for turning an API response back into app state. */
export function bookIdForUsfm(usfm: string): number | null {
  const index = USFM_BY_BOOK_ID.indexOf(usfm.toUpperCase());
  return index === -1 ? null : index + 1;
}

export function testamentForBookId(bookId: number): 'NT' | 'OT' | null {
  return getBookById(bookId)?.testament ?? null;
}

/**
 * Every chapter of a book, as download refs. Chapter counts come from
 * BIBLE_BOOKS so this stays in step with the reader's own navigation.
 */
export function chaptersForBook(filesetId: string, bookId: number): ChapterRef[] {
  const book = getBookById(bookId);
  const usfm = usfmForBookId(bookId);
  if (!book || !usfm) return [];
  return Array.from({ length: book.chapterCount }, (_, index) => ({
    filesetId,
    book: usfm,
    chapter: index + 1,
  }));
}

/** Every chapter of a testament — the "download the whole New Testament" case. */
export function chaptersForTestament(
  filesetId: string,
  testament: 'NT' | 'OT',
): ChapterRef[] {
  return BIBLE_BOOKS.filter((book) => book.testament === testament).flatMap((book) =>
    chaptersForBook(filesetId, book.id),
  );
}
