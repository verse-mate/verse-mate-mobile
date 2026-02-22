/**
 * Tests for getLocalTopics (offline SQLite query)
 *
 * Verifies that the SQL query selects all required columns including
 * `category` and `sort_order`, which are essential for useCachedTopics
 * to filter topics by category.
 */

// Mock expo-sqlite at the native level so initDatabase runs without a real DB file
import { getLocalTopics } from '@/services/offline/sqlite-manager';

const mockGetAllSync = jest.fn().mockReturnValue([]);
const mockExecSync = jest.fn();

jest.mock('expo-sqlite', () => ({
  openDatabaseSync: jest.fn(() => ({
    execSync: mockExecSync,
    getAllSync: mockGetAllSync,
    runSync: jest.fn(),
    closeSync: jest.fn(),
  })),
  deleteDatabaseSync: jest.fn(),
}));

// Skip the filesystem seed-copy logic
jest.mock('@/services/offline/seed-manager', () => ({
  copySeedDatabaseIfNeeded: jest.fn().mockResolvedValue(undefined),
  DB_PATH: 'file:///mock/SQLite/versemate_offline.db',
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Find the getAllSync call that targeted `offline_topics` (not a PRAGMA). */
function findTopicsQueryCall(): [string, unknown[]] | undefined {
  return mockGetAllSync.mock.calls.find(
    ([sql]: [string]) =>
      typeof sql === 'string' &&
      sql.toLowerCase().includes('offline_topics') &&
      !sql.toLowerCase().includes('pragma')
  ) as [string, unknown[]] | undefined;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('getLocalTopics() SQL query', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAllSync.mockReturnValue([]);
  });

  it('selects the category column', async () => {
    await getLocalTopics('en');

    const call = findTopicsQueryCall();
    expect(call).toBeDefined();
    expect(call![0]).toContain('category');
  });

  it('selects the sort_order column', async () => {
    await getLocalTopics('en');

    const call = findTopicsQueryCall();
    expect(call![0]).toContain('sort_order');
  });

  it('filters by the provided language code', async () => {
    await getLocalTopics('es');

    const call = findTopicsQueryCall();
    expect(call).toBeDefined();
    // Language code should appear in the query parameters
    const params = call![1] as unknown[];
    expect(params).toContain('es');
  });

  it('passes through the rows returned by getAllSync', async () => {
    const rows = [
      {
        topic_id: 'a1',
        name: 'Creation',
        content: '{}',
        language_code: 'en',
        category: 'EVENT',
        sort_order: 1,
      },
      {
        topic_id: 'a2',
        name: 'The Flood',
        content: '{}',
        language_code: 'en',
        category: 'EVENT',
        sort_order: 2,
      },
    ];
    mockGetAllSync.mockImplementation((sql: string) => {
      if (sql.toLowerCase().includes('pragma')) return [];
      return rows;
    });

    const result = await getLocalTopics('en');

    expect(result).toEqual(rows);
  });

  it('returns an empty array when getAllSync returns nothing', async () => {
    mockGetAllSync.mockReturnValue([]);

    const result = await getLocalTopics('en');

    expect(result).toEqual([]);
  });
});
