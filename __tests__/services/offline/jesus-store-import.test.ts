/**
 * importJesusSeed: retried after a failure, skipped when current, and run
 * through the async SQLite API.
 *
 * The SQL itself was checked against the real seed with sqlite3 (first import,
 * re-import as a no-op, a newer network row kept, pre-language rows removed);
 * Jest has no real SQLite, so this pins the control flow around it.
 */
import {
  __TEST_ONLY_RESET_IMPORT,
  getJesusLocal,
  importJesusSeed,
  jesusCacheKey,
  parseStoredTime,
} from '@/services/offline/jesus-store';

const mockDb = {
  execAsync: jest.fn(),
  getFirstAsync: jest.fn(),
  runAsync: jest.fn(),
  withTransactionAsync: jest.fn(async (fn: () => Promise<void>) => fn()),
  getFirstSync: jest.fn(),
  runSync: jest.fn(),
  execSync: jest.fn(),
};

jest.mock('@/services/offline/sqlite-manager', () => ({
  initDatabase: jest.fn(async () => mockDb),
  getLocalBibleChapter: jest.fn(),
}));
jest.mock('expo-asset', () => ({
  Asset: {
    fromModule: () => ({ downloadAsync: jest.fn(), localUri: 'file:///app/jesus-seed.db' }),
  },
}));
jest.mock('@/assets/data/jesus-seed.db', () => 1, { virtual: true });

function seedMeta(held: string | null) {
  mockDb.getFirstAsync.mockImplementation(async (sql: string) => {
    if (sql.includes("jesus_seed.jesus_meta WHERE k = 'generated_at'")) {
      return { v: '2026-09-28T18:48:37.317221+00:00' };
    }
    if (sql.includes("jesus_seed.jesus_meta WHERE k = 'language'")) return { v: 'en' };
    if (sql.includes("k = 'seed_import'")) return held ? { v: held } : null;
    if (sql.includes('COUNT(*)')) return { n: 642 };
    return null;
  });
}

beforeEach(() => {
  __TEST_ONLY_RESET_IMPORT();
  for (const fn of Object.values(mockDb)) (fn as jest.Mock).mockClear();
  mockDb.execAsync.mockReset();
  mockDb.withTransactionAsync.mockImplementation(async (fn: () => Promise<void>) => fn());
});

it('imports under the seed language, removing rows from before keys carried one', async () => {
  seedMeta(null);
  await importJesusSeed();
  const sql = mockDb.runAsync.mock.calls.map(([q]) => String(q));
  expect(sql.some((q) => q.includes("DELETE FROM offline_jesus WHERE key LIKE '/%'"))).toBe(true);
  const insert = mockDb.runAsync.mock.calls.find(([q]) =>
    String(q).includes('INSERT OR REPLACE INTO offline_jesus')
  );
  expect(insert?.[1]).toEqual(['en:', 'en:']);
  // ATTACH and DETACH both went through the async API.
  const exec = mockDb.execAsync.mock.calls.map(([q]) => String(q));
  expect(exec[0]).toContain('ATTACH DATABASE');
  expect(exec.at(-1)).toContain('DETACH DATABASE');
  expect(mockDb.execSync).not.toHaveBeenCalled();
});

it('does nothing when this bundle was already imported in this key format', async () => {
  seedMeta('2026-09-28T18:48:37.317221+00:00|lang-v1');
  await importJesusSeed();
  expect(mockDb.runAsync).not.toHaveBeenCalled();
});

it('re-imports once for an install that imported before keys carried a language', async () => {
  // Such an install has no 'seed_import' marker at all.
  seedMeta(null);
  await importJesusSeed();
  expect(mockDb.withTransactionAsync).toHaveBeenCalledTimes(1);
});

it('retries on the next call after a failure instead of memoizing it', async () => {
  seedMeta(null);
  mockDb.execAsync.mockRejectedValueOnce(new Error('ATTACH failed'));
  await importJesusSeed(); // swallowed
  expect(mockDb.withTransactionAsync).not.toHaveBeenCalled();
  await importJesusSeed();
  expect(mockDb.withTransactionAsync).toHaveBeenCalledTimes(1);
});

it('a read after a failed import does not wait on the dead attempt', async () => {
  seedMeta(null);
  mockDb.execAsync.mockRejectedValueOnce(new Error('ATTACH failed'));
  await importJesusSeed();
  mockDb.getFirstSync.mockReturnValue(null);
  await expect(getJesusLocal(jesusCacheKey('/jesus/overview'))).resolves.toBeNull();
});

describe('parseStoredTime', () => {
  it('reads the bundle stamp in a form every engine accepts', () => {
    expect(parseStoredTime('2026-09-28T18:48:37.317221+00:00')).toBe(
      Date.UTC(2026, 8, 28, 18, 48, 37, 317)
    );
    expect(parseStoredTime('2026-09-28T18:48:37.317Z')).toBe(
      Date.UTC(2026, 8, 28, 18, 48, 37, 317)
    );
  });
});
