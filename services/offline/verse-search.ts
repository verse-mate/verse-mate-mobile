/**
 * Offline Bible search: SQLite FTS5 over the downloaded verses.
 *
 * Used when the device is offline (or the search request fails) and the
 * reader's version has verses on the device. Compared with GET /bible/search
 * it finds exact words only (FTS5 has no stemmer for most of our languages,
 * so "loving" does not find "love") and lists matches in Bible order (the
 * popularity ranking lives on the server). Accents are ignored for Latin
 * script (`remove_diacritics 2`); Devanagari vowel signs and Cyrillic letters
 * are left alone, as on the server.
 *
 * The index is an external-content FTS5 table over offline_verses, created
 * and filled the first time an offline search runs, then kept current by
 * triggers as versions are downloaded or deleted.
 */

import { BIBLE_BOOKS } from '@/constants/bible-books';
import {
  HIGHLIGHT_START,
  HIGHLIGHT_STOP,
  highlightRanges,
} from '@/lib/bible-search/highlight-ranges';
import { splitSearchWords } from '@/lib/bible-search/search-words';
import {
  VERSE_SEARCH_PAGE_SIZE,
  type VerseSearchFilters,
  type VerseSearchPage,
  type VerseSearchResult,
} from '@/lib/bible-search/types';
import { initDatabase } from './sqlite-manager';

/** More than this per group is never read on a phone; it also bounds the work. */
const MAX_MATCHES_PER_GROUP = 1000;

const CREATE_INDEX_SQL = `
  CREATE VIRTUAL TABLE offline_verses_fts USING fts5(
    text,
    content='offline_verses',
    content_rowid='id',
    tokenize='unicode61 remove_diacritics 2'
  );
  CREATE TRIGGER offline_verses_fts_ai AFTER INSERT ON offline_verses BEGIN
    INSERT INTO offline_verses_fts(rowid, text) VALUES (new.id, new.text);
  END;
  CREATE TRIGGER offline_verses_fts_ad AFTER DELETE ON offline_verses BEGIN
    INSERT INTO offline_verses_fts(offline_verses_fts, rowid, text) VALUES ('delete', old.id, old.text);
  END;
  CREATE TRIGGER offline_verses_fts_au AFTER UPDATE ON offline_verses BEGIN
    INSERT INTO offline_verses_fts(offline_verses_fts, rowid, text) VALUES ('delete', old.id, old.text);
    INSERT INTO offline_verses_fts(rowid, text) VALUES (new.id, new.text);
  END;
  INSERT INTO offline_verses_fts(offline_verses_fts) VALUES ('rebuild');
`;

let indexReady: Promise<void> | null = null;

/**
 * Creates and fills the index once. One transaction: an app killed half-way
 * leaves no table, so the next search starts over instead of trusting a
 * half-filled index.
 */
export function ensureVerseSearchIndex(): Promise<void> {
  if (!indexReady) {
    indexReady = (async () => {
      const database = await initDatabase();
      const existing = database.getFirstSync<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'offline_verses_fts'"
      );
      if (existing) return;
      await database.withTransactionAsync(async () => {
        await database.execAsync(CREATE_INDEX_SQL);
      });
    })().catch((error) => {
      indexReady = null;
      throw error;
    });
  }
  return indexReady;
}

interface MatchRow {
  book_id: number;
  chapter_number: number;
  verse_number: number;
  text: string;
  marked: string;
}

/** One page of offline matches: exact phrase first, then every word in any order. */
export async function searchVersesOffline(params: {
  q: string;
  versionKey: string;
  filters: VerseSearchFilters;
  cursor: string | null;
}): Promise<VerseSearchPage> {
  const parsed = splitSearchWords(params.q);
  if (!parsed) {
    return {
      results: [],
      nextCursor: null,
      totals: { exact: 0, words: 0 },
      books: [],
      source: 'offline',
    };
  }

  await ensureVerseSearchIndex();
  const database = await initDatabase();

  // Each word is double-quoted (it holds only letters, marks and digits, so it
  // cannot close the quote); a trailing * makes the last one a prefix.
  const quoted = parsed.words.map((w) => `"${w}"`);
  const star = parsed.prefix ? '*' : '';
  const phrase = `"${parsed.words.join(' ')}"${star}`;
  const allWords = `${quoted.join(' AND ')}${star}`;

  // CROSS JOIN fixes the join order: the match runs once and each hit looks
  // up its verse. With a plain JOIN SQLite starts from the version's verses
  // and re-runs the match for every one of them (4-12 s instead of
  // milliseconds on the 31k-verse seed).
  const select = (match: string) =>
    database.getAllSync<MatchRow>(
      `SELECT v.book_id, v.chapter_number, v.verse_number, v.text,
              highlight(offline_verses_fts, 0, ?, ?) AS marked
       FROM offline_verses_fts
       CROSS JOIN offline_verses v ON v.id = offline_verses_fts.rowid
       WHERE offline_verses_fts MATCH ? AND v.version_key = ?
       ORDER BY v.book_id, v.chapter_number, v.verse_number
       LIMIT ?`,
      [HIGHLIGHT_START, HIGHLIGHT_STOP, match, params.versionKey, MAX_MATCHES_PER_GROUP]
    );

  const exact = select(phrase);
  const words =
    parsed.words.length > 1 ? select(`(${allWords}) NOT (${phrase})`) : ([] as MatchRow[]);

  const toResult = (row: MatchRow, match: 'exact' | 'words'): VerseSearchResult => ({
    match,
    bookId: row.book_id,
    bookName: BIBLE_BOOKS[row.book_id - 1]?.name ?? '',
    chapter: row.chapter_number,
    verse: row.verse_number,
    text: row.text,
    // FTS5 marks a phrase match as one span ("⟦east and west⟧") and only
    // where the whole phrase occurs, so no phrase filtering is needed here.
    highlights: highlightRanges(row.marked, row.text),
  });
  const all = [
    ...exact.map((r) => toResult(r, 'exact')),
    ...words.map((r) => toResult(r, 'words')),
  ];

  const offset = params.cursor ? Number.parseInt(params.cursor, 10) || 0 : 0;
  const { testament, book } = params.filters;
  const filtered = all.filter(
    (r) =>
      (!testament || (testament === 'OT' ? r.bookId <= 39 : r.bookId >= 40)) &&
      (!book || r.bookId === book)
  );
  const results = filtered.slice(offset, offset + VERSE_SEARCH_PAGE_SIZE);
  const nextOffset = offset + VERSE_SEARCH_PAGE_SIZE;

  let books: VerseSearchPage['books'] = null;
  if (offset === 0) {
    const counts = new Map<number, number>();
    for (const r of all) counts.set(r.bookId, (counts.get(r.bookId) ?? 0) + 1);
    books = [...counts.entries()]
      .sort(([a], [b]) => a - b)
      .map(([bookId, count]) => ({
        bookId,
        name: BIBLE_BOOKS[bookId - 1]?.name ?? '',
        testament: bookId <= 39 ? ('OT' as const) : ('NT' as const),
        count,
      }));
  }

  return {
    results,
    nextCursor: nextOffset < filtered.length ? String(nextOffset) : null,
    totals: offset === 0 ? { exact: exact.length, words: words.length } : null,
    books,
    source: 'offline',
  };
}

/** Whether the version has any verses on the device. */
export async function hasOfflineVerses(versionKey: string): Promise<boolean> {
  const database = await initDatabase();
  const row = database.getFirstSync<{ found: number }>(
    'SELECT 1 AS found FROM offline_verses WHERE version_key = ? LIMIT 1',
    [versionKey]
  );
  return !!row;
}
