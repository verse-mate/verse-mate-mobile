/**
 * SQLite Manager for Offline Storage
 *
 * Handles database initialization, migrations, and CRUD operations
 * for offline Bible, commentary, and topic data.
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

let db: SQLite.SQLiteDatabase | null = null;
let initPromise: Promise<SQLite.SQLiteDatabase> | null = null;

/**
 * Simple serializer to prevent concurrent SQLite operations on Android.
 * expo-sqlite's NativeStatement can crash when multiple operations
 * (especially transactions + reads) run concurrently.
 */
let operationQueue: Promise<unknown> = Promise.resolve();

async function serialized<T>(fn: () => Promise<T>): Promise<T> {
  const previous = operationQueue;
  let resolveCurrent: (() => void) | undefined;
  operationQueue = new Promise<void>((r) => {
    resolveCurrent = r;
  });
  await previous;
  try {
    return await fn();
  } finally {
    resolveCurrent?.();
  }
}

/**
 * Initialize the SQLite database and create tables if they don't exist.
 * Uses a shared promise to prevent concurrent initialization.
 */
export async function initDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  if (initPromise) return initPromise;

  initPromise = performInit().catch(async (error) => {
    console.warn('[Offline DB] Init failed, resetting:', error.message);
    // Close the broken connection, delete the database, and retry
    if (db) {
      try {
        await db.closeAsync();
      } catch {
        /* ignore */
      }
      db = null;
    }
    try {
      await SQLite.deleteDatabaseAsync(DB_NAME);
    } catch {
      /* ignore - file may not exist or already deleted */
    }
    return performInit();
  });
  try {
    return await initPromise;
  } finally {
    initPromise = null;
  }
}

async function performInit(): Promise<SQLite.SQLiteDatabase> {
  // Force a new connection to avoid inheriting a stale cached connection with a broken transaction
  db = await SQLite.openDatabaseAsync(DB_NAME, { useNewConnection: true });

  // Clear any stale transaction left from a previous crash
  try {
    await db.execAsync('ROLLBACK');
  } catch {
    /* no active transaction — expected */
  }

  // Enable WAL mode and set busy timeout so long transactions don't fail with "database is locked"
  await db.execAsync('PRAGMA journal_mode = WAL');
  await db.execAsync('PRAGMA busy_timeout = 10000');

  // Create tables
  await db.execAsync(`
    -- Bible verses by version
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

    -- Commentaries by language
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

    -- Topics by language
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

    -- User notes (offline copy)
    CREATE TABLE IF NOT EXISTS offline_notes (
      note_id TEXT PRIMARY KEY,
      book_id INTEGER NOT NULL,
      chapter_number INTEGER NOT NULL,
      verse_number INTEGER,
      content TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_notes_chapter ON offline_notes(book_id, chapter_number);

    -- User highlights (offline copy)
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

    -- User bookmarks (offline copy)
    CREATE TABLE IF NOT EXISTS offline_bookmarks (
      favorite_id INTEGER PRIMARY KEY,
      book_id INTEGER NOT NULL,
      chapter_number INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_bookmarks_chapter ON offline_bookmarks(book_id, chapter_number);

    -- Sync metadata
    CREATE TABLE IF NOT EXISTS offline_metadata (
      resource_key TEXT PRIMARY KEY,
      last_updated_at TEXT NOT NULL,
      downloaded_at TEXT NOT NULL,
      size_bytes INTEGER NOT NULL
    );
  `);

  return db;
}

/**
 * Get the database instance (initializes if needed)
 */
export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    return initDatabase();
  }
  return db;
}

/**
 * Force re-initialize the database (resets connection and re-applies pragmas)
 */
export async function resetDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) {
    await db.closeAsync();
    db = null;
  }
  return initDatabase();
}

/**
 * Close the database connection
 */
export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.closeAsync();
    db = null;
  }
}

// ============================================================================
// Bible Verses Operations
// ============================================================================

/**
 * Insert Bible verses for a version (bulk insert with transaction)
 */
export async function insertBibleVerses(
  versionKey: string,
  verses: BibleVerseData[]
): Promise<void> {
  return serialized(async () => {
    const database = await getDatabase();
    console.log(`[Offline DB] Inserting ${verses.length} verses for ${versionKey}`);
    const start = Date.now();

    await database.runAsync('BEGIN TRANSACTION');
    try {
      await database.runAsync('DELETE FROM offline_verses WHERE version_key = ?', [versionKey]);

      const batchSize = 200;
      for (let i = 0; i < verses.length; i += batchSize) {
        const batch = verses.slice(i, i + batchSize);
        const placeholders = batch.map(() => '(?, ?, ?, ?, ?)').join(', ');
        const params = batch.flatMap((v) => [
          versionKey,
          v.book_id,
          v.chapter_number,
          v.verse_number,
          v.text,
        ]);
        await database.runAsync(
          `INSERT INTO offline_verses (version_key, book_id, chapter_number, verse_number, text) VALUES ${placeholders}`,
          params
        );
        if ((i / batchSize) % 10 === 0) {
          console.log(
            `[Offline DB] Verses: ${Math.min(i + batchSize, verses.length)}/${verses.length}`
          );
        }
      }

      await database.runAsync('COMMIT');
    } catch (e) {
      await database.runAsync('ROLLBACK');
      throw e;
    }

    console.log(`[Offline DB] Verses inserted in ${Date.now() - start}ms`);
  });
}

/**
 * Get Bible chapter from local database
 */
export async function getLocalBibleChapter(
  versionKey: string,
  bookId: number,
  chapterNumber: number
): Promise<BibleVerseData[]> {
  return serialized(async () => {
    const database = await getDatabase();
    const result = await database.getAllAsync<{
      book_id: number;
      chapter_number: number;
      verse_number: number;
      text: string;
    }>(
      'SELECT book_id, chapter_number, verse_number, text FROM offline_verses WHERE version_key = ? AND book_id = ? AND chapter_number = ? ORDER BY verse_number',
      [versionKey, bookId, chapterNumber]
    );
    return result;
  });
}

/**
 * Check if a Bible version is downloaded
 */
export async function isBibleVersionDownloaded(versionKey: string): Promise<boolean> {
  return serialized(async () => {
    const database = await getDatabase();
    const result = await database.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM offline_verses WHERE version_key = ?',
      [versionKey]
    );
    return (result?.count ?? 0) > 0;
  });
}

/**
 * Delete a Bible version
 */
export async function deleteBibleVersion(versionKey: string): Promise<void> {
  return serialized(async () => {
    const database = await getDatabase();
    await database.runAsync('DELETE FROM offline_verses WHERE version_key = ?', [versionKey]);
    await database.runAsync('DELETE FROM offline_metadata WHERE resource_key = ?', [
      `bible:${versionKey}`,
    ]);
  });
}

/**
 * Get specific verses from local database (for topic rendering)
 */
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

  return serialized(async () => {
    const database = await getDatabase();
    const placeholders = verses.map(() => '?').join(',');

    const result = await database.getAllAsync<{
      book_id: number;
      chapter_number: number;
      verse_number: number;
      text: string;
    }>(
      `SELECT book_id, chapter_number, verse_number, text
       FROM offline_verses
       WHERE version_key = ? AND book_id = ? AND chapter_number = ? AND verse_number IN (${placeholders})
       ORDER BY verse_number`,
      [versionKey, book.id, chapterNumber, ...verses]
    );

    return result;
  });
}

// ============================================================================
// Commentary Operations
// ============================================================================

/**
 * Insert commentaries for a language (bulk insert with transaction)
 */
export async function insertCommentaries(
  languageCode: string,
  commentaries: CommentaryData[]
): Promise<void> {
  return serialized(async () => {
    const database = await getDatabase();
    console.log(`[Offline DB] Inserting ${commentaries.length} commentaries for ${languageCode}`);
    const start = Date.now();

    await database.runAsync('BEGIN TRANSACTION');
    try {
      await database.runAsync('DELETE FROM offline_explanations WHERE language_code = ?', [
        languageCode,
      ]);

      const batchSize = 100;
      for (let i = 0; i < commentaries.length; i += batchSize) {
        const batch = commentaries.slice(i, i + batchSize);
        const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
        const params = batch.flatMap((c) => [
          languageCode,
          c.explanation_id,
          c.book_id,
          c.chapter_number,
          c.verse_start,
          c.verse_end,
          c.type,
          c.explanation,
        ]);
        await database.runAsync(
          `INSERT INTO offline_explanations (language_code, explanation_id, book_id, chapter_number, verse_start, verse_end, type, explanation) VALUES ${placeholders}`,
          params
        );
      }

      await database.runAsync('COMMIT');
    } catch (e) {
      await database.runAsync('ROLLBACK');
      throw e;
    }

    console.log(`[Offline DB] Commentaries inserted in ${Date.now() - start}ms`);
  });
}

/**
 * Get commentary for a chapter
 */
export async function getLocalCommentary(
  languageCode: string,
  bookId: number,
  chapterNumber: number
): Promise<CommentaryData | null> {
  return serialized(async () => {
    const database = await getDatabase();
    const result = await database.getFirstAsync<{
      explanation_id: number;
      book_id: number;
      chapter_number: number;
      verse_start: number | null;
      verse_end: number | null;
      type: string;
      explanation: string;
      language_code: string;
    }>(
      'SELECT explanation_id, book_id, chapter_number, verse_start, verse_end, type, explanation, language_code FROM offline_explanations WHERE language_code = ? AND book_id = ? AND chapter_number = ? LIMIT 1',
      [languageCode, bookId, chapterNumber]
    );
    return result ?? null;
  });
}

/**
 * Check if commentaries are downloaded for a language
 */
export async function isCommentaryDownloaded(languageCode: string): Promise<boolean> {
  return serialized(async () => {
    const database = await getDatabase();
    const result = await database.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM offline_explanations WHERE language_code = ?',
      [languageCode]
    );
    return (result?.count ?? 0) > 0;
  });
}

/**
 * Delete commentaries for a language
 */
export async function deleteCommentaries(languageCode: string): Promise<void> {
  return serialized(async () => {
    const database = await getDatabase();
    await database.runAsync('DELETE FROM offline_explanations WHERE language_code = ?', [
      languageCode,
    ]);
    await database.runAsync('DELETE FROM offline_metadata WHERE resource_key = ?', [
      `commentary:${languageCode}`,
    ]);
  });
}

// ============================================================================
// Topics Operations
// ============================================================================

/**
 * Insert topics for a language
 */
export async function insertTopics(
  languageCode: string,
  topics: TopicData[],
  references: TopicReferenceData[]
): Promise<void> {
  return serialized(async () => {
    const database = await getDatabase();
    console.log(
      `[Offline DB] Inserting ${topics.length} topics, ${references.length} refs for ${languageCode}`
    );
    const start = Date.now();

    await database.runAsync('BEGIN TRANSACTION');
    try {
      await database.runAsync('DELETE FROM offline_topics WHERE language_code = ?', [languageCode]);
      await database.runAsync('DELETE FROM offline_topic_references WHERE language_code = ?', [
        languageCode,
      ]);

      // Insert topics
      const topicBatchSize = 100;
      for (let i = 0; i < topics.length; i += topicBatchSize) {
        const batch = topics.slice(i, i + topicBatchSize);
        const placeholders = batch.map(() => '(?, ?, ?, ?)').join(', ');
        const params = batch.flatMap((t) => [languageCode, t.topic_id, t.name, t.content]);
        await database.runAsync(
          `INSERT INTO offline_topics (language_code, topic_id, name, content) VALUES ${placeholders}`,
          params
        );
      }

      // Insert references
      const refBatchSize = 200;
      for (let i = 0; i < references.length; i += refBatchSize) {
        const batch = references.slice(i, i + refBatchSize);
        const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?)').join(', ');
        const params = batch.flatMap((r) => [
          languageCode,
          r.topic_id,
          r.book_id,
          r.chapter_number,
          r.verse_start,
          r.verse_end,
        ]);
        await database.runAsync(
          `INSERT INTO offline_topic_references (language_code, topic_id, book_id, chapter_number, verse_start, verse_end) VALUES ${placeholders}`,
          params
        );
      }

      await database.runAsync('COMMIT');
    } catch (e) {
      await database.runAsync('ROLLBACK');
      throw e;
    }

    console.log(`[Offline DB] Topics inserted in ${Date.now() - start}ms`);
  });
}

/**
 * Get all topics for a language
 */
export async function getLocalTopics(languageCode: string): Promise<TopicData[]> {
  return serialized(async () => {
    const database = await getDatabase();
    const result = await database.getAllAsync<{
      topic_id: string;
      name: string;
      content: string;
      language_code: string;
    }>(
      'SELECT topic_id, name, content, language_code FROM offline_topics WHERE language_code = ?',
      [languageCode]
    );
    return result;
  });
}

/**
 * Check if topics are downloaded for a language
 */
export async function isTopicsDownloaded(languageCode: string): Promise<boolean> {
  return serialized(async () => {
    const database = await getDatabase();
    const result = await database.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM offline_topics WHERE language_code = ?',
      [languageCode]
    );
    return (result?.count ?? 0) > 0;
  });
}

/**
 * Delete topics for a language
 */
export async function deleteTopics(languageCode: string): Promise<void> {
  return serialized(async () => {
    const database = await getDatabase();
    await database.runAsync('DELETE FROM offline_topics WHERE language_code = ?', [languageCode]);
    await database.runAsync('DELETE FROM offline_topic_references WHERE language_code = ?', [
      languageCode,
    ]);
    await database.runAsync('DELETE FROM offline_metadata WHERE resource_key = ?', [
      `topics:${languageCode}`,
    ]);
  });
}

/**
 * Get a specific topic by ID
 */
export async function getLocalTopic(topicId: string): Promise<TopicData | null> {
  return serialized(async () => {
    const database = await getDatabase();
    const result = await database.getFirstAsync<{
      topic_id: string;
      name: string;
      content: string;
      language_code: string;
    }>('SELECT topic_id, name, content, language_code FROM offline_topics WHERE topic_id = ?', [
      topicId,
    ]);
    return result ?? null;
  });
}

/**
 * Get references for a specific topic
 */
export async function getLocalTopicReferences(topicId: string): Promise<TopicReferenceData[]> {
  return serialized(async () => {
    const database = await getDatabase();
    const result = await database.getAllAsync<{
      topic_id: string;
      book_id: number;
      chapter_number: number;
      verse_start: number;
      verse_end: number | null;
    }>(
      'SELECT topic_id, book_id, chapter_number, verse_start, verse_end FROM offline_topic_references WHERE topic_id = ?',
      [topicId]
    );
    return result;
  });
}

// ============================================================================
// User Data Operations
// ============================================================================

/**
 * Insert user notes (bulk insert with transaction)
 */
export async function insertUserNotes(notes: OfflineNote[]): Promise<void> {
  return serialized(async () => {
    const database = await getDatabase();
    console.log(`[Offline DB] Inserting ${notes.length} notes`);

    await database.runAsync('BEGIN TRANSACTION');
    try {
      await database.runAsync('DELETE FROM offline_notes');

      const batchSize = 100;
      for (let i = 0; i < notes.length; i += batchSize) {
        const batch = notes.slice(i, i + batchSize);
        const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?)').join(', ');
        const params = batch.flatMap((n) => [
          n.note_id,
          n.book_id,
          n.chapter_number,
          n.verse_number,
          n.content,
          n.updated_at,
        ]);
        await database.runAsync(
          `INSERT INTO offline_notes (note_id, book_id, chapter_number, verse_number, content, updated_at) VALUES ${placeholders}`,
          params
        );
      }

      await database.runAsync('COMMIT');
    } catch (e) {
      await database.runAsync('ROLLBACK');
      throw e;
    }
  });
}

/**
 * Insert user highlights (bulk insert with transaction)
 */
export async function insertUserHighlights(highlights: OfflineHighlight[]): Promise<void> {
  return serialized(async () => {
    const database = await getDatabase();
    console.log(`[Offline DB] Inserting ${highlights.length} highlights`);

    await database.runAsync('BEGIN TRANSACTION');
    try {
      await database.runAsync('DELETE FROM offline_highlights');

      const batchSize = 100;
      for (let i = 0; i < highlights.length; i += batchSize) {
        const batch = highlights.slice(i, i + batchSize);
        const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
        const params = batch.flatMap((h) => [
          h.highlight_id,
          h.book_id,
          h.chapter_number,
          h.start_verse,
          h.end_verse,
          h.color,
          h.start_char,
          h.end_char,
          h.updated_at,
        ]);
        await database.runAsync(
          `INSERT INTO offline_highlights (highlight_id, book_id, chapter_number, start_verse, end_verse, color, start_char, end_char, updated_at) VALUES ${placeholders}`,
          params
        );
      }

      await database.runAsync('COMMIT');
    } catch (e) {
      await database.runAsync('ROLLBACK');
      throw e;
    }
  });
}

/**
 * Insert user bookmarks (bulk insert with transaction)
 */
export async function insertUserBookmarks(bookmarks: OfflineBookmark[]): Promise<void> {
  return serialized(async () => {
    const database = await getDatabase();
    console.log(`[Offline DB] Inserting ${bookmarks.length} bookmarks`);

    await database.runAsync('BEGIN TRANSACTION');
    try {
      await database.runAsync('DELETE FROM offline_bookmarks');

      const batchSize = 200;
      for (let i = 0; i < bookmarks.length; i += batchSize) {
        const batch = bookmarks.slice(i, i + batchSize);
        const placeholders = batch.map(() => '(?, ?, ?, ?)').join(', ');
        const params = batch.flatMap((b) => [
          b.favorite_id,
          b.book_id,
          b.chapter_number,
          b.created_at,
        ]);
        await database.runAsync(
          `INSERT INTO offline_bookmarks (favorite_id, book_id, chapter_number, created_at) VALUES ${placeholders}`,
          params
        );
      }

      await database.runAsync('COMMIT');
    } catch (e) {
      await database.runAsync('ROLLBACK');
      throw e;
    }
  });
}

/**
 * Get notes for a chapter, or all notes if no filter
 */
export async function getLocalNotes(
  bookId?: number,
  chapterNumber?: number
): Promise<OfflineNote[]> {
  return serialized(async () => {
    const database = await getDatabase();
    if (bookId !== undefined && chapterNumber !== undefined) {
      return database.getAllAsync<OfflineNote>(
        'SELECT note_id, book_id, chapter_number, verse_number, content, updated_at FROM offline_notes WHERE book_id = ? AND chapter_number = ? ORDER BY verse_number',
        [bookId, chapterNumber]
      );
    }
    return database.getAllAsync<OfflineNote>(
      'SELECT note_id, book_id, chapter_number, verse_number, content, updated_at FROM offline_notes ORDER BY updated_at DESC'
    );
  });
}

/**
 * Get all notes
 */
export async function getLocalAllNotes(): Promise<OfflineNote[]> {
  return serialized(async () => {
    const database = await getDatabase();
    return database.getAllAsync<OfflineNote>(
      'SELECT note_id, book_id, chapter_number, verse_number, content, updated_at FROM offline_notes ORDER BY updated_at DESC'
    );
  });
}

/**
 * Get highlights for a chapter, or all highlights if no filter
 */
export async function getLocalHighlights(
  bookId?: number,
  chapterNumber?: number
): Promise<OfflineHighlight[]> {
  return serialized(async () => {
    const database = await getDatabase();
    if (bookId !== undefined && chapterNumber !== undefined) {
      return database.getAllAsync<OfflineHighlight>(
        'SELECT highlight_id, book_id, chapter_number, start_verse, end_verse, color, start_char, end_char, updated_at FROM offline_highlights WHERE book_id = ? AND chapter_number = ? ORDER BY start_verse',
        [bookId, chapterNumber]
      );
    }
    return database.getAllAsync<OfflineHighlight>(
      'SELECT highlight_id, book_id, chapter_number, start_verse, end_verse, color, start_char, end_char, updated_at FROM offline_highlights ORDER BY updated_at DESC'
    );
  });
}

/**
 * Get all highlights
 */
export async function getLocalAllHighlights(): Promise<OfflineHighlight[]> {
  return serialized(async () => {
    const database = await getDatabase();
    return database.getAllAsync<OfflineHighlight>(
      'SELECT highlight_id, book_id, chapter_number, start_verse, end_verse, color, start_char, end_char, updated_at FROM offline_highlights ORDER BY updated_at DESC'
    );
  });
}

/**
 * Get all bookmarks
 */
export async function getLocalBookmarks(): Promise<OfflineBookmark[]> {
  return serialized(async () => {
    const database = await getDatabase();
    return database.getAllAsync<OfflineBookmark>(
      'SELECT favorite_id, book_id, chapter_number, created_at FROM offline_bookmarks ORDER BY created_at DESC'
    );
  });
}

/**
 * Check if user data is downloaded
 */
export async function isUserDataDownloaded(): Promise<boolean> {
  return serialized(async () => {
    const database = await getDatabase();
    const result = await database.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) as count FROM offline_metadata WHERE resource_key = 'user-data'"
    );
    return (result?.count ?? 0) > 0;
  });
}

/**
 * Delete all user data
 */
export async function deleteAllUserData(): Promise<void> {
  return serialized(async () => {
    const database = await getDatabase();
    await database.execAsync(`
      DELETE FROM offline_notes;
      DELETE FROM offline_highlights;
      DELETE FROM offline_bookmarks;
    `);
    await database.runAsync("DELETE FROM offline_metadata WHERE resource_key = 'user-data'");
  });
}

// ============================================================================
// Metadata Operations
// ============================================================================

/**
 * Save download metadata
 */
export async function saveMetadata(metadata: OfflineMetadata): Promise<void> {
  return serialized(async () => {
    const database = await getDatabase();
    await database.runAsync(
      'INSERT OR REPLACE INTO offline_metadata (resource_key, last_updated_at, downloaded_at, size_bytes) VALUES (?, ?, ?, ?)',
      [metadata.resource_key, metadata.last_updated_at, metadata.downloaded_at, metadata.size_bytes]
    );
  });
}

/**
 * Get metadata for a resource
 */
export async function getMetadata(resourceKey: string): Promise<OfflineMetadata | null> {
  return serialized(async () => {
    const database = await getDatabase();
    const result = await database.getFirstAsync<OfflineMetadata>(
      'SELECT resource_key, last_updated_at, downloaded_at, size_bytes FROM offline_metadata WHERE resource_key = ?',
      [resourceKey]
    );
    return result ?? null;
  });
}

/**
 * Get all metadata
 */
export async function getAllMetadata(): Promise<OfflineMetadata[]> {
  return serialized(async () => {
    const database = await getDatabase();
    const result = await database.getAllAsync<OfflineMetadata>(
      'SELECT resource_key, last_updated_at, downloaded_at, size_bytes FROM offline_metadata'
    );
    return result;
  });
}

/**
 * Delete all offline data (full reset)
 */
export async function deleteAllOfflineData(): Promise<void> {
  return serialized(async () => {
    const database = await getDatabase();
    await database.execAsync(`
      DELETE FROM offline_verses;
      DELETE FROM offline_explanations;
      DELETE FROM offline_topics;
      DELETE FROM offline_topic_references;
      DELETE FROM offline_notes;
      DELETE FROM offline_highlights;
      DELETE FROM offline_bookmarks;
      DELETE FROM offline_metadata;
    `);
  });
}

/**
 * Get total storage used by offline data
 */
export async function getTotalStorageUsed(): Promise<number> {
  return serialized(async () => {
    const database = await getDatabase();
    const result = await database.getFirstAsync<{ total: number }>(
      'SELECT COALESCE(SUM(size_bytes), 0) as total FROM offline_metadata'
    );
    return result?.total ?? 0;
  });
}
