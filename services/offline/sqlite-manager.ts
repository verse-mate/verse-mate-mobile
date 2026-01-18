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
  OfflineMetadata,
  TopicData,
  TopicReferenceData,
} from './types';

const DB_NAME = 'versemate_offline.db';

let db: SQLite.SQLiteDatabase | null = null;

/**
 * Initialize the SQLite database and create tables if they don't exist
 */
export async function initDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;

  db = await SQLite.openDatabaseAsync(DB_NAME);

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
  const database = await getDatabase();

  // Delete existing verses for this version
  await database.runAsync('DELETE FROM offline_verses WHERE version_key = ?', [versionKey]);

  // Insert in batches using transaction
  const batchSize = 500;
  for (let i = 0; i < verses.length; i += batchSize) {
    const batch = verses.slice(i, i + batchSize);
    await database.withTransactionAsync(async () => {
      const statement = await database.prepareAsync(
        'INSERT INTO offline_verses (version_key, book_id, chapter_number, verse_number, text) VALUES (?, ?, ?, ?, ?)'
      );
      try {
        for (const verse of batch) {
          await statement.executeAsync([
            versionKey,
            verse.book_id,
            verse.chapter_number,
            verse.verse_number,
            verse.text,
          ]);
        }
      } finally {
        await statement.finalizeAsync();
      }
    });
  }
}

/**
 * Get Bible chapter from local database
 */
export async function getLocalBibleChapter(
  versionKey: string,
  bookId: number,
  chapterNumber: number
): Promise<BibleVerseData[]> {
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
}

/**
 * Check if a Bible version is downloaded
 */
export async function isBibleVersionDownloaded(versionKey: string): Promise<boolean> {
  const database = await getDatabase();
  const result = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM offline_verses WHERE version_key = ?',
    [versionKey]
  );
  return (result?.count ?? 0) > 0;
}

/**
 * Delete a Bible version
 */
export async function deleteBibleVersion(versionKey: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync('DELETE FROM offline_verses WHERE version_key = ?', [versionKey]);
  await database.runAsync('DELETE FROM offline_metadata WHERE resource_key = ?', [
    `bible:${versionKey}`,
  ]);
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
  const database = await getDatabase();

  // Delete existing commentaries for this language
  await database.runAsync('DELETE FROM offline_explanations WHERE language_code = ?', [
    languageCode,
  ]);

  // Insert in batches
  const batchSize = 500;
  for (let i = 0; i < commentaries.length; i += batchSize) {
    const batch = commentaries.slice(i, i + batchSize);
    await database.withTransactionAsync(async () => {
      const statement = await database.prepareAsync(
        'INSERT INTO offline_explanations (language_code, explanation_id, book_id, chapter_number, verse_start, verse_end, type, explanation) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      );
      try {
        for (const commentary of batch) {
          await statement.executeAsync([
            languageCode,
            commentary.explanation_id,
            commentary.book_id,
            commentary.chapter_number,
            commentary.verse_start,
            commentary.verse_end,
            commentary.type,
            commentary.explanation,
          ]);
        }
      } finally {
        await statement.finalizeAsync();
      }
    });
  }
}

/**
 * Get commentary for a chapter
 */
export async function getLocalCommentary(
  languageCode: string,
  bookId: number,
  chapterNumber: number
): Promise<CommentaryData | null> {
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
}

/**
 * Check if commentaries are downloaded for a language
 */
export async function isCommentaryDownloaded(languageCode: string): Promise<boolean> {
  const database = await getDatabase();
  const result = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM offline_explanations WHERE language_code = ?',
    [languageCode]
  );
  return (result?.count ?? 0) > 0;
}

/**
 * Delete commentaries for a language
 */
export async function deleteCommentaries(languageCode: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync('DELETE FROM offline_explanations WHERE language_code = ?', [
    languageCode,
  ]);
  await database.runAsync('DELETE FROM offline_metadata WHERE resource_key = ?', [
    `commentary:${languageCode}`,
  ]);
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
  const database = await getDatabase();

  // Delete existing topics for this language
  await database.runAsync('DELETE FROM offline_topics WHERE language_code = ?', [languageCode]);
  await database.runAsync('DELETE FROM offline_topic_references WHERE language_code = ?', [
    languageCode,
  ]);

  // Insert topics
  await database.withTransactionAsync(async () => {
    const topicStatement = await database.prepareAsync(
      'INSERT INTO offline_topics (language_code, topic_id, name, content) VALUES (?, ?, ?, ?)'
    );
    try {
      for (const topic of topics) {
        await topicStatement.executeAsync([
          languageCode,
          topic.topic_id,
          topic.name,
          topic.content,
        ]);
      }
    } finally {
      await topicStatement.finalizeAsync();
    }
  });

  // Insert references in batches
  const batchSize = 500;
  for (let i = 0; i < references.length; i += batchSize) {
    const batch = references.slice(i, i + batchSize);
    await database.withTransactionAsync(async () => {
      const refStatement = await database.prepareAsync(
        'INSERT INTO offline_topic_references (language_code, topic_id, book_id, chapter_number, verse_start, verse_end) VALUES (?, ?, ?, ?, ?, ?)'
      );
      try {
        for (const ref of batch) {
          await refStatement.executeAsync([
            languageCode,
            ref.topic_id,
            ref.book_id,
            ref.chapter_number,
            ref.verse_start,
            ref.verse_end,
          ]);
        }
      } finally {
        await refStatement.finalizeAsync();
      }
    });
  }
}

/**
 * Get all topics for a language
 */
export async function getLocalTopics(languageCode: string): Promise<TopicData[]> {
  const database = await getDatabase();
  const result = await database.getAllAsync<{
    topic_id: string;
    name: string;
    content: string;
    language_code: string;
  }>('SELECT topic_id, name, content, language_code FROM offline_topics WHERE language_code = ?', [
    languageCode,
  ]);
  return result;
}

/**
 * Check if topics are downloaded for a language
 */
export async function isTopicsDownloaded(languageCode: string): Promise<boolean> {
  const database = await getDatabase();
  const result = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM offline_topics WHERE language_code = ?',
    [languageCode]
  );
  return (result?.count ?? 0) > 0;
}

/**
 * Delete topics for a language
 */
export async function deleteTopics(languageCode: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync('DELETE FROM offline_topics WHERE language_code = ?', [languageCode]);
  await database.runAsync('DELETE FROM offline_topic_references WHERE language_code = ?', [
    languageCode,
  ]);
  await database.runAsync('DELETE FROM offline_metadata WHERE resource_key = ?', [
    `topics:${languageCode}`,
  ]);
}

/**
 * Get a specific topic by ID
 */
export async function getLocalTopic(topicId: string): Promise<TopicData | null> {
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
}

/**
 * Get references for a specific topic
 */
export async function getLocalTopicReferences(topicId: string): Promise<TopicReferenceData[]> {
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
}

// ============================================================================
// Metadata Operations
// ============================================================================

/**
 * Save download metadata
 */
export async function saveMetadata(metadata: OfflineMetadata): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    'INSERT OR REPLACE INTO offline_metadata (resource_key, last_updated_at, downloaded_at, size_bytes) VALUES (?, ?, ?, ?)',
    [metadata.resource_key, metadata.last_updated_at, metadata.downloaded_at, metadata.size_bytes]
  );
}

/**
 * Get metadata for a resource
 */
export async function getMetadata(resourceKey: string): Promise<OfflineMetadata | null> {
  const database = await getDatabase();
  const result = await database.getFirstAsync<OfflineMetadata>(
    'SELECT resource_key, last_updated_at, downloaded_at, size_bytes FROM offline_metadata WHERE resource_key = ?',
    [resourceKey]
  );
  return result ?? null;
}

/**
 * Get all metadata
 */
export async function getAllMetadata(): Promise<OfflineMetadata[]> {
  const database = await getDatabase();
  const result = await database.getAllAsync<OfflineMetadata>(
    'SELECT resource_key, last_updated_at, downloaded_at, size_bytes FROM offline_metadata'
  );
  return result;
}

/**
 * Delete all offline data (full reset)
 */
export async function deleteAllOfflineData(): Promise<void> {
  const database = await getDatabase();
  await database.execAsync(`
    DELETE FROM offline_verses;
    DELETE FROM offline_explanations;
    DELETE FROM offline_topics;
    DELETE FROM offline_topic_references;
    DELETE FROM offline_metadata;
  `);
}

/**
 * Get total storage used by offline data
 */
export async function getTotalStorageUsed(): Promise<number> {
  const database = await getDatabase();
  const result = await database.getFirstAsync<{ total: number }>(
    'SELECT COALESCE(SUM(size_bytes), 0) as total FROM offline_metadata'
  );
  return result?.total ?? 0;
}
