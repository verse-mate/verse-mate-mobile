/**
 * getLocalCommentary finds commentary under any regional spelling of the
 * requested language.
 *
 * The bundled English commentary is stored as `en-US`. Verse Insight asked for
 * `en`, the lookup was exact-only, and so it missed and went to the network for
 * content that was on the device — the By-Line spinner Andy kept hitting on a
 * slow connection (2026-09-28). The real SQL is checked against the seed
 * database in the commit; this pins the call order: exact first, then the
 * same language under any region, and never a different language.
 */
import { getLocalCommentary } from '@/services/offline/sqlite-manager';

const mockGetFirstSync = jest.fn();

jest.mock('expo-sqlite', () => ({
  openDatabaseSync: jest.fn(() => ({
    execSync: jest.fn(),
    getAllSync: jest.fn().mockReturnValue([]),
    getFirstSync: (...args: unknown[]) => mockGetFirstSync(...args),
    runSync: jest.fn(),
    closeSync: jest.fn(),
  })),
  deleteDatabaseSync: jest.fn(),
}));

jest.mock('@/services/offline/seed-manager', () => ({
  copySeedDatabaseIfNeeded: jest.fn().mockResolvedValue(undefined),
  DB_PATH: 'file:///mock/SQLite/versemate_offline.db',
}));

const ROW = {
  explanation_id: 1,
  book_id: 40,
  chapter_number: 3,
  verse_start: null,
  verse_end: null,
  type: 'byline',
  explanation: '## Matthew 3:14\n\nJohn protests.',
  language_code: 'en-US',
};

/** Only the calls that read offline_explanations. */
function explanationCalls() {
  return mockGetFirstSync.mock.calls.filter(
    ([sql]) => typeof sql === 'string' && sql.includes('offline_explanations')
  );
}

beforeEach(() => {
  mockGetFirstSync.mockReset();
});

describe('getLocalCommentary', () => {
  it('returns the exact-language row without a second query', async () => {
    mockGetFirstSync.mockImplementation((sql: string) =>
      sql.includes('offline_explanations') ? ROW : null
    );
    const row = await getLocalCommentary('en-US', 40, 3, 'byline');
    expect(row).toEqual(ROW);
    expect(explanationCalls()).toHaveLength(1);
  });

  it('finds en-US commentary when asked for en', async () => {
    let n = 0;
    mockGetFirstSync.mockImplementation((sql: string) => {
      if (!sql.includes('offline_explanations')) return null;
      n += 1;
      return n === 1 ? null : ROW; // exact misses, same-language fallback hits
    });
    const row = await getLocalCommentary('en', 40, 3, 'byline');
    expect(row).toEqual(ROW);
    const [, params] = explanationCalls()[1];
    // Searches the BASE language only — never another language.
    expect(params).toEqual(['en', 'en', 40, 3, 'byline', 'en']);
  });

  it('matches regardless of case', async () => {
    mockGetFirstSync.mockImplementation(() => null);
    await getLocalCommentary('EN-gb', 40, 3, 'byline');
    const [, params] = explanationCalls()[1];
    expect(params[0]).toBe('en');
  });

  it('reports nothing when the language is not on the device', async () => {
    mockGetFirstSync.mockImplementation(() => null);
    expect(await getLocalCommentary('es', 40, 3, 'byline')).toBeNull();
  });
});
