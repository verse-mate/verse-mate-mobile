/** Shapes of GET /bible/search (verse-mate backend, bible/search module). */

export interface VerseSearchResult {
  /** "exact": every word, in order; "words": every word, any order. */
  match: 'exact' | 'words';
  bookId: number;
  bookName: string;
  chapter: number;
  verse: number;
  text: string;
  /** [start, end) ranges of `text` to show in bold. */
  highlights: [number, number][];
}

export interface VerseSearchBookCount {
  bookId: number;
  name: string;
  testament: 'OT' | 'NT';
  count: number;
}

export interface VerseSearchPage {
  results: VerseSearchResult[];
  nextCursor: string | null;
  /** First page only: totals across the whole Bible, filters ignored. */
  totals: { exact: number; words: number } | null;
  /** First page only: match count per book, filters ignored. */
  books: VerseSearchBookCount[] | null;
  /**
   * Where the page came from. Offline pages are SQLite full-text matches over
   * the downloaded verses: exact words only (no word endings) and in Bible
   * order (no popularity ranking).
   */
  source: 'online' | 'offline';
}

export interface VerseSearchFilters {
  testament?: 'OT' | 'NT';
  book?: number;
}

export const VERSE_SEARCH_PAGE_SIZE = 20;
