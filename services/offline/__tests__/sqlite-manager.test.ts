import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import {
  closeDatabase,
  deleteBibleVersion,
  getDatabase,
  getLocalBibleChapter,
  insertBibleVerses,
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

  it('should insert bible verses using chunked execSync transactions', async () => {
    const verses = [
      { book_id: 1, chapter_number: 1, verse_number: 1, text: 'In the beginning' },
      { book_id: 1, chapter_number: 1, verse_number: 2, text: 'God created' },
    ];

    await insertBibleVerses('NASB1995', verses);

    // First call after init: DELETE transaction (plain BEGIN, not BEGIN IMMEDIATE)
    const deleteTxnCall = mockExecSync.mock.calls.find(
      (call: any[]) =>
        typeof call[0] === 'string' &&
        call[0].includes('BEGIN') &&
        !call[0].includes('BEGIN IMMEDIATE') &&
        call[0].includes('DELETE FROM offline_verses')
    );
    expect(deleteTxnCall).toBeDefined();

    // Second call: INSERT chunk transaction (plain BEGIN)
    const insertTxnCall = mockExecSync.mock.calls.find(
      (call: any[]) =>
        typeof call[0] === 'string' &&
        call[0].includes('BEGIN') &&
        !call[0].includes('BEGIN IMMEDIATE') &&
        call[0].includes('INSERT INTO offline_verses') &&
        call[0].includes('COMMIT')
    );
    expect(insertTxnCall).toBeDefined();
    const sql = insertTxnCall?.[0] as string;
    expect(sql).toContain('In the beginning');
    expect(sql).toContain('God created');
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
});
