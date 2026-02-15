import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import {
  closeDatabase,
  deleteBibleVersion,
  getDatabase,
  getLocalBibleChapter,
  insertBibleVerses,
} from '../sqlite-manager';

// Mock expo-sqlite
const mockExecAsync = jest.fn();
const mockRunAsync = jest.fn();
const mockGetAllAsync = jest.fn();
const mockGetFirstAsync = jest.fn();
const mockWithTransactionAsync = jest.fn((callback: any) => callback());
const mockPrepareAsync = jest.fn(() =>
  Promise.resolve({
    executeAsync: jest.fn(),
    finalizeAsync: jest.fn(),
  })
);
const mockCloseAsync = jest.fn();

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(() =>
    Promise.resolve({
      execAsync: mockExecAsync,
      runAsync: mockRunAsync,
      getAllAsync: mockGetAllAsync,
      getFirstAsync: mockGetFirstAsync,
      withTransactionAsync: mockWithTransactionAsync,
      prepareAsync: mockPrepareAsync,
      closeAsync: mockCloseAsync,
    })
  ),
}));

describe('SQLite Manager', () => {
  let mockDb: any;

  beforeEach(async () => {
    // Ensure fresh start
    await closeDatabase();
    jest.clearAllMocks();
    mockDb = await getDatabase();
  });

  afterEach(async () => {
    await closeDatabase();
  });

  it('should initialize database and create tables', async () => {
    // beforeEach already initialized it.
    // Since we cleared mocks BEFORE initializing in beforeEach (wait, no).
    // In beforeEach:
    // 1. closeDatabase()
    // 2. clearAllMocks()
    // 3. getDatabase() -> calls initDatabase() -> calls openDatabaseAsync -> calls execAsync

    // So execAsync SHOULD be called.
    expect(mockExecAsync).toHaveBeenCalledWith(
      expect.stringContaining('CREATE TABLE IF NOT EXISTS offline_verses')
    );
  });

  it('should insert bible verses using transaction', async () => {
    const verses = [
      { book_id: 1, chapter_number: 1, verse_number: 1, text: 'In the beginning' },
      { book_id: 1, chapter_number: 1, verse_number: 2, text: 'God created' },
    ];

    await insertBibleVerses('NASB1995', verses);

    // Verify manual transaction was used via runAsync
    expect(mockRunAsync).toHaveBeenCalledWith('BEGIN TRANSACTION');
    // Verify old verses were deleted first
    expect(mockRunAsync).toHaveBeenCalledWith('DELETE FROM offline_verses WHERE version_key = ?', [
      'NASB1995',
    ]);
    // Verify batch insert was called
    expect(mockRunAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO offline_verses'),
      expect.arrayContaining(['NASB1995', 1, 1, 1, 'In the beginning'])
    );
    // Verify transaction was committed
    expect(mockRunAsync).toHaveBeenCalledWith('COMMIT');
  });

  it('should retrieve bible verses', async () => {
    mockGetAllAsync.mockResolvedValue([
      { book_id: 1, chapter_number: 1, verse_number: 1, text: 'In the beginning' },
    ]);

    const result = await getLocalBibleChapter('NASB1995', 1, 1);

    expect(mockGetAllAsync).toHaveBeenCalledWith(
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

    expect(mockRunAsync).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM offline_verses WHERE version_key = ?'),
      ['NASB1995']
    );
    expect(mockRunAsync).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM offline_metadata'),
      ['bible:NASB1995']
    );
  });
});
