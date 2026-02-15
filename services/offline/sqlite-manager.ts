/**
 * SQLite Manager for Offline Storage
 *
 * Uses the SYNCHRONOUS expo-sqlite API to avoid thread-pool dispatch issues.
 * All native calls run on the JS thread � no concurrent access, no lock contention
 * from our own code.
 *
 * If a stale native connection from a previous hot-reload holds the file lock,
 * init detects this via a test write, deletes the database files, and recreates.
 */

import * as SQLite from 'expo-sqlite';
import { getBookByName } from '../../constants/bible-books';
import type {
  BibleVerseData,
  CommentaryData,
  OfflineBookmark,
  OfflineHighlight,
  OfflineMetadata,
  OfflineNote,
  TopicData,
  TopicReferenceData,
} from './types';

const DB_NAME = 'versemate_offline.db';

/**
 * Escape a value for safe inclusion in raw SQL.
 * Used inside execSync-based transactions where parameterized queries
 * are not available. Data comes from our own API so injection risk is minimal,
 * but we still properly escape single quotes.
 */
function escapeSQL(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return String(val);
  return `'${String(val).replaceAll("'", "''")}'`;
}

let db: SQLite.SQLiteDatabase | null = null;
let initFailed = false;

/**
 * Execute a SQL string, rolling back on failure.
 * Retries once after a short pause if the error is SQLITE_BUSY.
 */
function execSafe(database: SQLite.SQLiteDatabase, sql: string, label: string): void {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      database.execSync(sql);
      return;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      const isLocked = msg.includes('database is locked') || msg.includes('SQLITE_BUSY');

      try {
        database.execSync('ROLLBACK');
      } catch {
        /* no active txn */
      }

      if (!isLocked || attempt === 2) {
        console.error(`[Offline DB] ${label} failed: ${msg}`);
        throw e;
      }

      console.warn(`[Offline DB] ${label} busy, retrying once...`);
      // Short blocking pause � JS thread, acceptable.
      const end = Date.now() + 300;
      while (Date.now() < end) {
        /* busy-wait */
      }
    }
  }
}

const CREATE_TABLES_SQL = `
  CREATE TABLE IF NOT EXISTS offline_verses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    version_key TEXT NOT NULL,
    book_id INTEGER NOT NULL,
    chapter_number INTEGER NOT NULL,
    verse_number INTEGER NOT NULL,
    text TEXT NOT NULL,
    UNIQUE(version_key, book_id, chapter_number, verse_number)
  );
  CREATE INDEX IF NOT EXISTS idx_verses_lookup ON offline_verses(version_key, book_id, chapter_number);

  CREATE TABLE IF NOT EXISTS offline_explanations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    language_code TEXT NOT NULL,
    explanation_id INTEGER NOT NULL,
    book_id INTEGER NOT NULL,
    chapter_number INTEGER NOT NULL,
    verse_start INTEGER,
    verse_end INTEGER,
    type TEXT NOT NULL,
    explanation TEXT NOT NULL,
    UNIQUE(language_code, explanation_id)
  );
  CREATE INDEX IF NOT EXISTS idx_explanations_lookup ON offline_explanations(language_code, book_id, chapter_number);

  CREATE TABLE IF NOT EXISTS offline_topics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    language_code TEXT NOT NULL,
    topic_id TEXT NOT NULL,
    name TEXT NOT NULL,
    content TEXT NOT NULL,
    UNIQUE(language_code, topic_id)
  );

  CREATE TABLE IF NOT EXISTS offline_topic_references (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    language_code TEXT NOT NULL,
    topic_id TEXT NOT NULL,
    book_id INTEGER NOT NULL,
    chapter_number INTEGER NOT NULL,
    verse_start INTEGER NOT NULL,
    verse_end INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_topic_refs_lookup ON offline_topic_references(language_code, book_id, chapter_number);

  CREATE TABLE IF NOT EXISTS offline_notes (
    note_id TEXT PRIMARY KEY,
    book_id INTEGER NOT NULL,
    chapter_number INTEGER NOT NULL,
    verse_number INTEGER,
    content TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_notes_chapter ON offline_notes(book_id, chapter_number);

  CREATE TABLE IF NOT EXISTS offline_highlights (
    highlight_id INTEGER PRIMARY KEY,
    book_id INTEGER NOT NULL,
    chapter_number INTEGER NOT NULL,
    start_verse INTEGER NOT NULL,
    end_verse INTEGER NOT NULL,
    color TEXT NOT NULL,
    start_char INTEGER,
    end_char INTEGER,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_highlights_chapter ON offline_highlights(book_id, chapter_number);

  CREATE TABLE IF NOT EXISTS offline_bookmarks (
    favorite_id INTEGER PRIMARY KEY,
    book_id INTEGER NOT NULL,
    chapter_number INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_bookmarks_chapter ON offline_bookmarks(book_id, chapter_number);

  CREATE TABLE IF NOT EXISTS offline_metadata (
    resource_key TEXT PRIMARY KEY,
    last_updated_at TEXT NOT NULL,
    downloaded_at TEXT NOT NULL,
    size_bytes INTEGER NOT NULL
  );
`;

/**
 * Initialize the database synchronously.
 *
 * CRITICAL: if anything after openDatabaseSync throws, the handle MUST be
 * closed � otherwise the leaked native connection holds the file lock and
 * every subsequent open / delete will fail with "database is locked".
 *
 * We deliberately do NOT set PRAGMA locking_mode = EXCLUSIVE or change the
 * journal_mode. EXCLUSIVE mode holds the lock forever, which means a stale
 * native connection from a previous hot-reload permanently blocks all new
 * connections. Default WAL mode + NORMAL locking is fine for a single-writer
 * app � locks are released at the end of each transaction.
 */
function performInitSync(): SQLite.SQLiteDatabase {
  const database = SQLite.openDatabaseSync(DB_NAME);

  try {
    // Clear any stale transaction from a previous crash / hot-reload
    try {
      database.execSync('ROLLBACK');
    } catch {
      /* no active transaction � expected */
    }

    // busy_timeout: if another connection briefly holds the lock (e.g. stale
    // hot-reload connection finishing up), SQLite will wait up to 5 s instead
    // of immediately returning SQLITE_BUSY.
    database.execSync('PRAGMA busy_timeout = 5000');

    // Create tables
    database.execSync(CREATE_TABLES_SQL);

    // Test write � if this fails the DB is unusable (stale lock from another
    // native connection). Let it throw so initDatabase can delete & retry.
    database.execSync(
      "INSERT OR REPLACE INTO offline_metadata (resource_key, last_updated_at, downloaded_at, size_bytes) VALUES ('_init', '', '', 0)"
    );
    database.execSync("DELETE FROM offline_metadata WHERE resource_key = '_init'");

    console.log('[Offline DB] Database initialized successfully');
    return database;
  } catch (e) {
    // Close the handle so we don't leak a native connection.
    try {
      database.closeSync();
    } catch {
      /* ignore */
    }
    throw e;
  }
}

/**
 * Public init - returns a Promise for backward compat with callers that await it.
 */
export async function initDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;

  try {
    db = performInitSync();
    initFailed = false;
    return db;
  } catch (error) {
    console.warn('[Offline DB] Init failed, will delete and retry:', error);
    // performInitSync already closed its handle on failure, so the file
    // should be unlocked. Delete and retry once.
    db = null;
    try {
      SQLite.deleteDatabaseSync(DB_NAME);
    } catch (delErr) {
      console.warn('[Offline DB] deleteDatabaseSync failed:', delErr);
    }

    try {
      db = performInitSync();
      initFailed = false;
      return db;
    } catch (retryError) {
      console.error('[Offline DB] Init retry also failed:', retryError);
      db = null;
      initFailed = true;
      throw retryError;
    }
  }
}

/**
 * Get the database instance, initialising on first call.
 * If init previously failed catastrophically, don't keep retrying on every
 * query � that would flood logs and waste cycles.
 */
function getDatabaseSync(): SQLite.SQLiteDatabase {
  if (db) return db;
  if (initFailed) {
    throw new Error('[Offline DB] Database init previously failed. Call initDatabase() to retry.');
  }
  db = performInitSync();
  return db;
}

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  return getDatabaseSync();
}

export async function resetDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) {
    try {
      db.closeSync();
    } catch {
      /* ignore */
    }
    db = null;
  }
  initFailed = false;
  return initDatabase();
}

export async function closeDatabase(): Promise<void> {
  if (db) {
    db.closeSync();
    db = null;
  }
  initFailed = false;
}

// ============================================================================
// Bible Verses
// ============================================================================

export async function insertBibleVerses(
  versionKey: string,
  verses: BibleVerseData[]
): Promise<void> {
  const database = getDatabaseSync();
  console.log(`[Offline DB] Inserting ${verses.length} verses for ${versionKey}`);
  const start = Date.now();

  // Build all INSERT statements
  const batchSize = 200;
  const insertStatements: string[] = [];
  for (let i = 0; i < verses.length; i += batchSize) {
    const batch = verses.slice(i, i + batchSize);
    const values = batch
      .map(
        (v) =>
          `(${escapeSQL(versionKey)}, ${v.book_id}, ${v.chapter_number}, ${v.verse_number}, ${escapeSQL(v.text)})`
      )
      .join(', ');
    insertStatements.push(
      `INSERT INTO offline_verses (version_key, book_id, chapter_number, verse_number, text) VALUES ${values}`
    );
  }

  // Delete old data in its own small transaction
  execSafe(
    database,
    `BEGIN;\nDELETE FROM offline_verses WHERE version_key = ${escapeSQL(versionKey)};\nCOMMIT`,
    'verses-delete'
  );

  // Insert in chunks so each transaction is short; yield between chunks for UI
  const statementsPerChunk = 25; // ~5 000 rows per chunk
  const totalChunks = Math.ceil(insertStatements.length / statementsPerChunk);

  for (let i = 0; i < insertStatements.length; i += statementsPerChunk) {
    const chunkNum = Math.floor(i / statementsPerChunk) + 1;
    const chunk = insertStatements.slice(i, i + statementsPerChunk);
    const chunkSQL = ['BEGIN', ...chunk, 'COMMIT'].join(';\n');

    console.log(
      `[Offline DB] Verses chunk ${chunkNum}/${totalChunks} (${chunk.length} stmts, ${(chunkSQL.length / 1024).toFixed(0)}KB)`
    );

    execSafe(database, chunkSQL, `verses-chunk-${chunkNum}`);

    // Yield to event loop between chunks so UI stays responsive
    if (chunkNum < totalChunks) {
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  console.log(`[Offline DB] All ${verses.length} verses inserted in ${Date.now() - start}ms`);
}

export async function getLocalBibleChapter(
  versionKey: string,
  bookId: number,
  chapterNumber: number
): Promise<BibleVerseData[]> {
  const database = getDatabaseSync();
  return database.getAllSync<BibleVerseData>(
    'SELECT book_id, chapter_number, verse_number, text FROM offline_verses WHERE version_key = ? AND book_id = ? AND chapter_number = ? ORDER BY verse_number',
    [versionKey, bookId, chapterNumber]
  );
}

export async function isBibleVersionDownloaded(versionKey: string): Promise<boolean> {
  const database = getDatabaseSync();
  const result = database.getFirstSync<{ count: number }>(
    'SELECT COUNT(*) as count FROM offline_verses WHERE version_key = ?',
    [versionKey]
  );
  return (result?.count ?? 0) > 0;
}

export async function deleteBibleVersion(versionKey: string): Promise<void> {
  const database = getDatabaseSync();
  database.runSync('DELETE FROM offline_verses WHERE version_key = ?', [versionKey]);
  database.runSync('DELETE FROM offline_metadata WHERE resource_key = ?', [`bible:${versionKey}`]);
}

export async function getSpecificVerses(
  versionKey: string,
  bookName: string,
  chapterNumber: number,
  verses: number[]
): Promise<BibleVerseData[]> {
  const book = getBookByName(bookName);
  if (!book) {
    console.warn(`[Offline] Book not found: ${bookName}`);
    return [];
  }
  if (verses.length === 0) return [];

  const database = getDatabaseSync();
  const placeholders = verses.map(() => '?').join(',');
  return database.getAllSync<BibleVerseData>(
    `SELECT book_id, chapter_number, verse_number, text FROM offline_verses WHERE version_key = ? AND book_id = ? AND chapter_number = ? AND verse_number IN (${placeholders}) ORDER BY verse_number`,
    [versionKey, book.id, chapterNumber, ...verses]
  );
}

// ============================================================================
// Commentaries
// ============================================================================

export async function insertCommentaries(
  languageCode: string,
  commentaries: CommentaryData[]
): Promise<void> {
  const database = getDatabaseSync();
  console.log(`[Offline DB] Inserting ${commentaries.length} commentaries for ${languageCode}`);
  const start = Date.now();

  const batchSize = 100;
  const insertStatements: string[] = [];
  for (let i = 0; i < commentaries.length; i += batchSize) {
    const batch = commentaries.slice(i, i + batchSize);
    const values = batch
      .map(
        (c) =>
          `(${escapeSQL(languageCode)}, ${c.explanation_id}, ${c.book_id}, ${c.chapter_number}, ${escapeSQL(c.verse_start)}, ${escapeSQL(c.verse_end)}, ${escapeSQL(c.type)}, ${escapeSQL(c.explanation)})`
      )
      .join(', ');
    insertStatements.push(
      `INSERT INTO offline_explanations (language_code, explanation_id, book_id, chapter_number, verse_start, verse_end, type, explanation) VALUES ${values}`
    );
  }

  // Delete old data first
  execSafe(
    database,
    `BEGIN;\nDELETE FROM offline_explanations WHERE language_code = ${escapeSQL(languageCode)};\nCOMMIT`,
    'commentaries-delete'
  );

  // Insert in chunks (same pattern as bible verses)
  const statementsPerChunk = 10;
  const totalChunks = Math.ceil(insertStatements.length / statementsPerChunk);

  for (let i = 0; i < insertStatements.length; i += statementsPerChunk) {
    const chunkNum = Math.floor(i / statementsPerChunk) + 1;
    const chunk = insertStatements.slice(i, i + statementsPerChunk);
    const chunkSQL = ['BEGIN', ...chunk, 'COMMIT'].join(';\n');

    console.log(
      `[Offline DB] Commentaries chunk ${chunkNum}/${totalChunks} (${chunk.length} stmts, ${(chunkSQL.length / 1024).toFixed(0)}KB)`
    );

    execSafe(database, chunkSQL, `commentaries-chunk-${chunkNum}`);

    // Yield between chunks
    if (chunkNum < totalChunks) {
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  console.log(`[Offline DB] Commentaries inserted in ${Date.now() - start}ms`);
}

export async function getLocalCommentary(
  languageCode: string,
  bookId: number,
  chapterNumber: number
): Promise<CommentaryData | null> {
  const database = getDatabaseSync();
  const result = database.getFirstSync<CommentaryData>(
    'SELECT explanation_id, book_id, chapter_number, verse_start, verse_end, type, explanation, language_code FROM offline_explanations WHERE language_code = ? AND book_id = ? AND chapter_number = ? LIMIT 1',
    [languageCode, bookId, chapterNumber]
  );
  return result ?? null;
}

export async function isCommentaryDownloaded(languageCode: string): Promise<boolean> {
  const database = getDatabaseSync();
  const result = database.getFirstSync<{ count: number }>(
    'SELECT COUNT(*) as count FROM offline_explanations WHERE language_code = ?',
    [languageCode]
  );
  return (result?.count ?? 0) > 0;
}

export async function deleteCommentaries(languageCode: string): Promise<void> {
  const database = getDatabaseSync();
  database.runSync('DELETE FROM offline_explanations WHERE language_code = ?', [languageCode]);
  database.runSync('DELETE FROM offline_metadata WHERE resource_key = ?', [
    `commentary:${languageCode}`,
  ]);
}

// ============================================================================
// Topics
// ============================================================================

export async function insertTopics(
  languageCode: string,
  topics: TopicData[],
  references: TopicReferenceData[]
): Promise<void> {
  const database = getDatabaseSync();
  console.log(
    `[Offline DB] Inserting ${topics.length} topics, ${references.length} refs for ${languageCode}`
  );
  const start = Date.now();

  // Step 1: Delete existing data in its own transaction
  execSafe(
    database,
    [
      'BEGIN',
      `DELETE FROM offline_topics WHERE language_code = ${escapeSQL(languageCode)}`,
      `DELETE FROM offline_topic_references WHERE language_code = ${escapeSQL(languageCode)}`,
      'COMMIT',
    ].join(';\n'),
    'topics-delete'
  );

  // Step 2: Insert topics in chunks
  const topicBatchSize = 100;
  const CHUNK_SIZE = 10;
  const topicInserts: string[] = [];
  for (let i = 0; i < topics.length; i += topicBatchSize) {
    const batch = topics.slice(i, i + topicBatchSize);
    const values = batch
      .map(
        (t) =>
          `(${escapeSQL(languageCode)}, ${escapeSQL(t.topic_id)}, ${escapeSQL(t.name)}, ${escapeSQL(t.content)})`
      )
      .join(', ');
    topicInserts.push(
      `INSERT INTO offline_topics (language_code, topic_id, name, content) VALUES ${values}`
    );
  }

  for (let c = 0; c < topicInserts.length; c += CHUNK_SIZE) {
    const chunk = topicInserts.slice(c, c + CHUNK_SIZE);
    const chunkSQL = ['BEGIN', ...chunk, 'COMMIT'].join(';\n');
    execSafe(database, chunkSQL, `topics-insert-chunk-${c / CHUNK_SIZE}`);
    if (c + CHUNK_SIZE < topicInserts.length) {
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  // Step 3: Insert references in chunks
  const refBatchSize = 200;
  const refInserts: string[] = [];
  for (let i = 0; i < references.length; i += refBatchSize) {
    const batch = references.slice(i, i + refBatchSize);
    const values = batch
      .map(
        (r) =>
          `(${escapeSQL(languageCode)}, ${escapeSQL(r.topic_id)}, ${r.book_id}, ${r.chapter_number}, ${r.verse_start}, ${escapeSQL(r.verse_end)})`
      )
      .join(', ');
    refInserts.push(
      `INSERT INTO offline_topic_references (language_code, topic_id, book_id, chapter_number, verse_start, verse_end) VALUES ${values}`
    );
  }

  for (let c = 0; c < refInserts.length; c += CHUNK_SIZE) {
    const chunk = refInserts.slice(c, c + CHUNK_SIZE);
    const chunkSQL = ['BEGIN', ...chunk, 'COMMIT'].join(';\n');
    execSafe(database, chunkSQL, `topic-refs-insert-chunk-${c / CHUNK_SIZE}`);
    if (c + CHUNK_SIZE < refInserts.length) {
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  console.log(`[Offline DB] Topics inserted in ${Date.now() - start}ms`);
}

export async function getLocalTopics(languageCode: string): Promise<TopicData[]> {
  const database = getDatabaseSync();
  return database.getAllSync<TopicData>(
    'SELECT topic_id, name, content, language_code FROM offline_topics WHERE language_code = ?',
    [languageCode]
  );
}

export async function isTopicsDownloaded(languageCode: string): Promise<boolean> {
  const database = getDatabaseSync();
  const result = database.getFirstSync<{ count: number }>(
    'SELECT COUNT(*) as count FROM offline_topics WHERE language_code = ?',
    [languageCode]
  );
  return (result?.count ?? 0) > 0;
}

export async function deleteTopics(languageCode: string): Promise<void> {
  const database = getDatabaseSync();
  database.runSync('DELETE FROM offline_topics WHERE language_code = ?', [languageCode]);
  database.runSync('DELETE FROM offline_topic_references WHERE language_code = ?', [languageCode]);
  database.runSync('DELETE FROM offline_metadata WHERE resource_key = ?', [
    `topics:${languageCode}`,
  ]);
}

export async function getLocalTopic(topicId: string): Promise<TopicData | null> {
  const database = getDatabaseSync();
  const result = database.getFirstSync<TopicData>(
    'SELECT topic_id, name, content, language_code FROM offline_topics WHERE topic_id = ?',
    [topicId]
  );
  return result ?? null;
}

export async function getLocalTopicReferences(topicId: string): Promise<TopicReferenceData[]> {
  const database = getDatabaseSync();
  return database.getAllSync<TopicReferenceData>(
    'SELECT topic_id, book_id, chapter_number, verse_start, verse_end FROM offline_topic_references WHERE topic_id = ?',
    [topicId]
  );
}

// ============================================================================
// User Data
// ============================================================================

export async function insertUserNotes(notes: OfflineNote[]): Promise<void> {
  const database = getDatabaseSync();
  console.log(`[Offline DB] Inserting ${notes.length} notes`);

  // Delete existing notes in its own transaction
  execSafe(database, 'BEGIN;\nDELETE FROM offline_notes;\nCOMMIT', 'notes-delete');

  // Insert in chunks
  const batchSize = 100;
  const CHUNK_SIZE = 10;
  const inserts: string[] = [];
  for (let i = 0; i < notes.length; i += batchSize) {
    const batch = notes.slice(i, i + batchSize);
    const values = batch
      .map(
        (n) =>
          `(${escapeSQL(n.note_id)}, ${n.book_id}, ${n.chapter_number}, ${escapeSQL(n.verse_number)}, ${escapeSQL(n.content)}, ${escapeSQL(n.updated_at)})`
      )
      .join(', ');
    inserts.push(
      `INSERT INTO offline_notes (note_id, book_id, chapter_number, verse_number, content, updated_at) VALUES ${values}`
    );
  }

  for (let c = 0; c < inserts.length; c += CHUNK_SIZE) {
    const chunk = inserts.slice(c, c + CHUNK_SIZE);
    const chunkSQL = ['BEGIN', ...chunk, 'COMMIT'].join(';\n');
    execSafe(database, chunkSQL, `notes-insert-chunk-${c / CHUNK_SIZE}`);
    if (c + CHUNK_SIZE < inserts.length) {
      await new Promise((r) => setTimeout(r, 0));
    }
  }
}

export async function insertUserHighlights(highlights: OfflineHighlight[]): Promise<void> {
  const database = getDatabaseSync();
  console.log(`[Offline DB] Inserting ${highlights.length} highlights`);

  // Delete existing highlights in its own transaction
  execSafe(database, 'BEGIN;\nDELETE FROM offline_highlights;\nCOMMIT', 'highlights-delete');

  // Insert in chunks
  const batchSize = 100;
  const CHUNK_SIZE = 10;
  const inserts: string[] = [];
  for (let i = 0; i < highlights.length; i += batchSize) {
    const batch = highlights.slice(i, i + batchSize);
    const values = batch
      .map(
        (h) =>
          `(${h.highlight_id}, ${h.book_id}, ${h.chapter_number}, ${h.start_verse}, ${h.end_verse}, ${escapeSQL(h.color)}, ${escapeSQL(h.start_char)}, ${escapeSQL(h.end_char)}, ${escapeSQL(h.updated_at)})`
      )
      .join(', ');
    inserts.push(
      `INSERT INTO offline_highlights (highlight_id, book_id, chapter_number, start_verse, end_verse, color, start_char, end_char, updated_at) VALUES ${values}`
    );
  }

  for (let c = 0; c < inserts.length; c += CHUNK_SIZE) {
    const chunk = inserts.slice(c, c + CHUNK_SIZE);
    const chunkSQL = ['BEGIN', ...chunk, 'COMMIT'].join(';\n');
    execSafe(database, chunkSQL, `highlights-insert-chunk-${c / CHUNK_SIZE}`);
    if (c + CHUNK_SIZE < inserts.length) {
      await new Promise((r) => setTimeout(r, 0));
    }
  }
}

export async function insertUserBookmarks(bookmarks: OfflineBookmark[]): Promise<void> {
  const database = getDatabaseSync();
  console.log(`[Offline DB] Inserting ${bookmarks.length} bookmarks`);

  // Delete existing bookmarks in its own transaction
  execSafe(database, 'BEGIN;\nDELETE FROM offline_bookmarks;\nCOMMIT', 'bookmarks-delete');

  // Insert in chunks
  const batchSize = 200;
  const CHUNK_SIZE = 10;
  const inserts: string[] = [];
  for (let i = 0; i < bookmarks.length; i += batchSize) {
    const batch = bookmarks.slice(i, i + batchSize);
    const values = batch
      .map(
        (b) => `(${b.favorite_id}, ${b.book_id}, ${b.chapter_number}, ${escapeSQL(b.created_at)})`
      )
      .join(', ');
    inserts.push(
      `INSERT INTO offline_bookmarks (favorite_id, book_id, chapter_number, created_at) VALUES ${values}`
    );
  }

  for (let c = 0; c < inserts.length; c += CHUNK_SIZE) {
    const chunk = inserts.slice(c, c + CHUNK_SIZE);
    const chunkSQL = ['BEGIN', ...chunk, 'COMMIT'].join(';\n');
    execSafe(database, chunkSQL, `bookmarks-insert-chunk-${c / CHUNK_SIZE}`);
    if (c + CHUNK_SIZE < inserts.length) {
      await new Promise((r) => setTimeout(r, 0));
    }
  }
}

export async function getLocalNotes(
  bookId?: number,
  chapterNumber?: number
): Promise<OfflineNote[]> {
  const database = getDatabaseSync();
  if (bookId !== undefined && chapterNumber !== undefined) {
    return database.getAllSync<OfflineNote>(
      'SELECT note_id, book_id, chapter_number, verse_number, content, updated_at FROM offline_notes WHERE book_id = ? AND chapter_number = ? ORDER BY verse_number',
      [bookId, chapterNumber]
    );
  }
  return database.getAllSync<OfflineNote>(
    'SELECT note_id, book_id, chapter_number, verse_number, content, updated_at FROM offline_notes ORDER BY updated_at DESC'
  );
}

export async function getLocalAllNotes(): Promise<OfflineNote[]> {
  const database = getDatabaseSync();
  return database.getAllSync<OfflineNote>(
    'SELECT note_id, book_id, chapter_number, verse_number, content, updated_at FROM offline_notes ORDER BY updated_at DESC'
  );
}

export async function getLocalHighlights(
  bookId?: number,
  chapterNumber?: number
): Promise<OfflineHighlight[]> {
  const database = getDatabaseSync();
  if (bookId !== undefined && chapterNumber !== undefined) {
    return database.getAllSync<OfflineHighlight>(
      'SELECT highlight_id, book_id, chapter_number, start_verse, end_verse, color, start_char, end_char, updated_at FROM offline_highlights WHERE book_id = ? AND chapter_number = ? ORDER BY start_verse',
      [bookId, chapterNumber]
    );
  }
  return database.getAllSync<OfflineHighlight>(
    'SELECT highlight_id, book_id, chapter_number, start_verse, end_verse, color, start_char, end_char, updated_at FROM offline_highlights ORDER BY updated_at DESC'
  );
}

export async function getLocalAllHighlights(): Promise<OfflineHighlight[]> {
  const database = getDatabaseSync();
  return database.getAllSync<OfflineHighlight>(
    'SELECT highlight_id, book_id, chapter_number, start_verse, end_verse, color, start_char, end_char, updated_at FROM offline_highlights ORDER BY updated_at DESC'
  );
}

export async function getLocalBookmarks(): Promise<OfflineBookmark[]> {
  const database = getDatabaseSync();
  return database.getAllSync<OfflineBookmark>(
    'SELECT favorite_id, book_id, chapter_number, created_at FROM offline_bookmarks ORDER BY created_at DESC'
  );
}

export async function isUserDataDownloaded(): Promise<boolean> {
  const database = getDatabaseSync();
  const result = database.getFirstSync<{ count: number }>(
    "SELECT COUNT(*) as count FROM offline_metadata WHERE resource_key = 'user-data'"
  );
  return (result?.count ?? 0) > 0;
}

export async function deleteAllUserData(): Promise<void> {
  const database = getDatabaseSync();
  database.execSync(
    'DELETE FROM offline_notes; DELETE FROM offline_highlights; DELETE FROM offline_bookmarks'
  );
  database.runSync("DELETE FROM offline_metadata WHERE resource_key = 'user-data'");
}

// ============================================================================
// Metadata
// ============================================================================

export async function saveMetadata(metadata: OfflineMetadata): Promise<void> {
  const database = getDatabaseSync();
  database.runSync(
    'INSERT OR REPLACE INTO offline_metadata (resource_key, last_updated_at, downloaded_at, size_bytes) VALUES (?, ?, ?, ?)',
    [metadata.resource_key, metadata.last_updated_at, metadata.downloaded_at, metadata.size_bytes]
  );
}

export async function getMetadata(resourceKey: string): Promise<OfflineMetadata | null> {
  const database = getDatabaseSync();
  const result = database.getFirstSync<OfflineMetadata>(
    'SELECT resource_key, last_updated_at, downloaded_at, size_bytes FROM offline_metadata WHERE resource_key = ?',
    [resourceKey]
  );
  return result ?? null;
}

export async function getAllMetadata(): Promise<OfflineMetadata[]> {
  const database = getDatabaseSync();
  return database.getAllSync<OfflineMetadata>(
    'SELECT resource_key, last_updated_at, downloaded_at, size_bytes FROM offline_metadata'
  );
}

export async function deleteAllOfflineData(): Promise<void> {
  const database = getDatabaseSync();
  database.execSync(`
    DELETE FROM offline_verses;
    DELETE FROM offline_explanations;
    DELETE FROM offline_topics;
    DELETE FROM offline_topic_references;
    DELETE FROM offline_notes;
    DELETE FROM offline_highlights;
    DELETE FROM offline_bookmarks;
    DELETE FROM offline_metadata;
  `);
}

export async function getTotalStorageUsed(): Promise<number> {
  const database = getDatabaseSync();
  const result = database.getFirstSync<{ total: number }>(
    'SELECT COALESCE(SUM(size_bytes), 0) as total FROM offline_metadata'
  );
  return result?.total ?? 0;
}
