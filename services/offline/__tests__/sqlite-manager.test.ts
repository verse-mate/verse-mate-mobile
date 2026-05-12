import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import {
  closeDatabase,
  deleteBibleVersion,
  getDatabase,
  getLocalBibleChapter,
  insertBibleVerses,
  insertCommentaries,
  insertTopics,
  insertUserBookmarks,
  insertUserHighlights,
  insertUserNotes,
} from '../sqlite-manager';

// Mock expo-sqlite — sync API
const mockExecSync = jest.fn();
const mockRunSync = jest.fn();
const mockGetAllSync = jest.fn().mockReturnValue([]);
const mockGetFirstSync = jest.fn().mockReturnValue(null);
const mockCloseSync = jest.fn();

jest.mock('expo-sqlite', () => ({
  openDatabaseSync: jest.fn(() => ({
    execSync: mockExecSync,
    runSync: mockRunSync,
    getAllSync: mockGetAllSync,
    getFirstSync: mockGetFirstSync,
    closeSync: mockCloseSync,
  })),
  deleteDatabaseSync: jest.fn(),
}));

describe('SQLite Manager', () => {
  beforeEach(async () => {
    await closeDatabase();
    jest.clearAllMocks();
    mockGetAllSync.mockReturnValue([]);
    mockGetFirstSync.mockReturnValue(null);
    await getDatabase();
  });

  afterEach(async () => {
    await closeDatabase();
  });

  it('should initialize database with busy_timeout and create tables', async () => {
    expect(mockExecSync).toHaveBeenCalledWith(
      expect.stringContaining('PRAGMA busy_timeout = 5000')
    );
    expect(mockExecSync).toHaveBeenCalledWith(
      expect.stringContaining('CREATE TABLE IF NOT EXISTS offline_verses')
    );
    // Test write to validate DB is usable
    expect(mockExecSync).toHaveBeenCalledWith(expect.stringContaining('_init'));
  });

  it('should insert bible verses with DELETE in first chunk for atomicity', async () => {
    const verses = [
      { book_id: 1, chapter_number: 1, verse_number: 1, text: 'In the beginning' },
      { book_id: 1, chapter_number: 1, verse_number: 2, text: 'God created' },
    ];

    await insertBibleVerses('NASB1995', verses);

    // First chunk must include both DELETE and INSERT in the same transaction
    const firstChunkCall = mockExecSync.mock.calls.find(
      (call: any[]) =>
        typeof call[0] === 'string' &&
        call[0].includes('DELETE FROM offline_verses') &&
        call[0].includes('INSERT INTO offline_verses')
    );
    expect(firstChunkCall).toBeDefined();
    const sql = firstChunkCall?.[0] as string;
    expect(sql).toContain('In the beginning');
    expect(sql).toContain('God created');
    // DELETE must appear before INSERT
    expect(sql.indexOf('DELETE')).toBeLessThan(sql.indexOf('INSERT'));
  });

  it('should only DELETE (no inserts) when verses array is empty', async () => {
    await insertBibleVerses('NASB1995', []);

    const deleteOnlyCall = mockExecSync.mock.calls.find(
      (call: any[]) =>
        typeof call[0] === 'string' &&
        call[0].includes('DELETE FROM offline_verses') &&
        !call[0].includes('INSERT')
    );
    expect(deleteOnlyCall).toBeDefined();
  });

  it('should retrieve bible verses', async () => {
    mockGetAllSync.mockReturnValue([
      { book_id: 1, chapter_number: 1, verse_number: 1, text: 'In the beginning' },
    ]);

    const result = await getLocalBibleChapter('NASB1995', 1, 1);

    expect(mockGetAllSync).toHaveBeenCalledWith(
      expect.stringContaining(
        'SELECT book_id, chapter_number, verse_number, text FROM offline_verses'
      ),
      ['NASB1995', 1, 1]
    );
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('In the beginning');
  });

  it('should delete bible version', async () => {
    await deleteBibleVersion('NASB1995');

    expect(mockRunSync).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM offline_verses WHERE version_key = ?'),
      ['NASB1995']
    );
    expect(mockRunSync).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM offline_metadata'),
      ['bible:NASB1995']
    );
  });

  describe('insertCommentaries', () => {
    it('includes DELETE in first chunk for atomicity', async () => {
      const commentaries = [
        {
          explanation_id: 1,
          language_code: 'en',
          book_id: 1,
          chapter_number: 1,
          verse_start: 1,
          verse_end: 5,
          type: 'summary',
          explanation: 'Test commentary',
        },
      ];

      await insertCommentaries('en', commentaries);

      const firstChunkCall = mockExecSync.mock.calls.find(
        (call: any[]) =>
          typeof call[0] === 'string' &&
          call[0].includes('DELETE FROM offline_explanations') &&
          call[0].includes('INSERT INTO offline_explanations')
      );
      expect(firstChunkCall).toBeDefined();
    });

    it('only deletes when commentaries array is empty', async () => {
      await insertCommentaries('en', []);

      const deleteOnlyCall = mockExecSync.mock.calls.find(
        (call: any[]) =>
          typeof call[0] === 'string' &&
          call[0].includes('DELETE FROM offline_explanations') &&
          !call[0].includes('INSERT')
      );
      expect(deleteOnlyCall).toBeDefined();
    });
  });

  describe('insertTopics', () => {
    it('includes DELETE in first chunk for atomicity', async () => {
      const topics = [
        {
          topic_id: 't1',
          language_code: 'en',
          name: 'Faith',
          content: 'About faith',
          category: 'theology',
          sort_order: 1,
        },
      ];

      await insertTopics('en', topics, [], []);

      const firstChunkCall = mockExecSync.mock.calls.find(
        (call: any[]) =>
          typeof call[0] === 'string' &&
          call[0].includes('DELETE FROM offline_topics') &&
          call[0].includes('INSERT INTO offline_topics')
      );
      expect(firstChunkCall).toBeDefined();
    });

    it('only deletes when topics array is empty', async () => {
      await insertTopics('en', [], [], []);

      const deleteOnlyCall = mockExecSync.mock.calls.find(
        (call: any[]) =>
          typeof call[0] === 'string' &&
          call[0].includes('DELETE FROM offline_topics') &&
          !call[0].includes('INSERT INTO offline_topics')
      );
      expect(deleteOnlyCall).toBeDefined();
    });
  });

  describe('insertUserNotes (VER-9: merge, not wipe)', () => {
    it('merges via INSERT OR REPLACE and never deletes existing rows', async () => {
      const notes = [
        {
          note_id: 'n1',
          book_id: 1,
          chapter_number: 1,
          verse_number: 1,
          content: 'My note',
          updated_at: '2024-01-01',
        },
      ];

      await insertUserNotes(notes);

      const mergeCall = mockExecSync.mock.calls.find(
        (call: any[]) =>
          typeof call[0] === 'string' && call[0].includes('INSERT OR REPLACE INTO offline_notes')
      );
      expect(mergeCall).toBeDefined();
      expect(mergeCall?.[0]).toContain('My note');

      // Critical: no DELETE FROM offline_notes — locally-mirrored notes that
      // the server snapshot hasn't propagated yet must survive this sync.
      const deleteCall = mockExecSync.mock.calls.find(
        (call: any[]) =>
          typeof call[0] === 'string' && call[0].includes('DELETE FROM offline_notes')
      );
      expect(deleteCall).toBeUndefined();
    });

    it('is a no-op for an empty notes payload (does not wipe local rows)', async () => {
      mockExecSync.mockClear();
      await insertUserNotes([]);

      const mutatingCall = mockExecSync.mock.calls.find(
        (call: any[]) =>
          typeof call[0] === 'string' &&
          (call[0].includes('DELETE FROM offline_notes') ||
            call[0].includes('INSERT INTO offline_notes') ||
            call[0].includes('INSERT OR REPLACE INTO offline_notes'))
      );
      expect(mutatingCall).toBeUndefined();
    });
  });

  describe('insertUserHighlights (VER-9: merge, not wipe)', () => {
    it('merges via INSERT OR REPLACE and never deletes existing rows', async () => {
      const highlights = [
        {
          highlight_id: 1,
          book_id: 1,
          chapter_number: 1,
          start_verse: 1,
          end_verse: 3,
          color: 'yellow',
          start_char: null,
          end_char: null,
          updated_at: '2024-01-01',
        },
      ];

      await insertUserHighlights(highlights);

      const mergeCall = mockExecSync.mock.calls.find(
        (call: any[]) =>
          typeof call[0] === 'string' &&
          call[0].includes('INSERT OR REPLACE INTO offline_highlights')
      );
      expect(mergeCall).toBeDefined();
      expect(mergeCall?.[0]).toContain('yellow');

      const deleteCall = mockExecSync.mock.calls.find(
        (call: any[]) =>
          typeof call[0] === 'string' && call[0].includes('DELETE FROM offline_highlights')
      );
      expect(deleteCall).toBeUndefined();
    });

    it('escapes all numeric fields via escapeSQL', async () => {
      const highlights = [
        {
          highlight_id: 42,
          book_id: 7,
          chapter_number: 3,
          start_verse: 1,
          end_verse: 5,
          color: 'blue',
          start_char: null,
          end_char: null,
          updated_at: '2024-01-01',
        },
      ];

      await insertUserHighlights(highlights);

      const mergeCall = mockExecSync.mock.calls.find(
        (call: any[]) =>
          typeof call[0] === 'string' &&
          call[0].includes('INSERT OR REPLACE INTO offline_highlights')
      );
      expect(mergeCall?.[0]).toContain('42');
      expect(mergeCall?.[0]).toContain('7');
    });
  });

  describe('insertUserBookmarks (VER-9: merge, not wipe)', () => {
    it('merges via INSERT OR REPLACE and never deletes existing rows', async () => {
      const bookmarks = [
        {
          favorite_id: 10,
          book_id: 1,
          chapter_number: 2,
          created_at: '2024-01-01',
          insight_type: undefined,
        },
      ];

      await insertUserBookmarks(bookmarks);

      const mergeCall = mockExecSync.mock.calls.find(
        (call: any[]) =>
          typeof call[0] === 'string' &&
          call[0].includes('INSERT OR REPLACE INTO offline_bookmarks')
      );
      expect(mergeCall).toBeDefined();

      const deleteCall = mockExecSync.mock.calls.find(
        (call: any[]) =>
          typeof call[0] === 'string' && call[0].includes('DELETE FROM offline_bookmarks')
      );
      expect(deleteCall).toBeUndefined();
    });
  });
});
