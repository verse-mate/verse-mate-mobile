/**
 * useCachedTopics — offline category-filtering tests
 *
 * Verifies that when the device is offline (no API data) the hook
 * correctly loads topics from the local SQLite DB and filters them
 * by category. This is the critical path for the fresh-install + no-network
 * experience where users must see the seeded topics in the navigation modal.
 */

import { renderHook, waitFor } from '@testing-library/react-native';
import { __TEST_ONLY_CLEAR_CACHE, useCachedTopics } from '@/hooks/topics/use-cached-topics';

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Simulate no API data (offline) — useTopicsSearch always returns empty
jest.mock('@/src/api', () => ({
  useTopicsSearch: jest.fn().mockReturnValue({ data: [], isLoading: false }),
}));

// DB is ready immediately
jest.mock('@/contexts/OfflineContext', () => ({
  useOfflineContext: jest.fn().mockReturnValue({ isInitialized: true }),
}));

// AsyncStorage — no prior cache so the hook always goes to SQLite
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
}));

// Seed data — a representative cross-section of what the seed DB contains
const SEED_TOPICS = [
  {
    topic_id: 'e1',
    name: 'The Creation',
    content: '{}',
    language_code: 'en',
    category: 'EVENT',
    sort_order: 1,
  },
  {
    topic_id: 'e2',
    name: 'The Fall of Man',
    content: '{}',
    language_code: 'en',
    category: 'EVENT',
    sort_order: 2,
  },
  {
    topic_id: 'p1',
    name: 'The Sower',
    content: '{}',
    language_code: 'en',
    category: 'PARABLE',
    sort_order: 1,
  },
  {
    topic_id: 'p2',
    name: 'The Prodigal Son',
    content: '{}',
    language_code: 'en',
    category: 'PARABLE',
    sort_order: 2,
  },
  {
    topic_id: 'pr1',
    name: 'Birth of the Messiah',
    content: '{}',
    language_code: 'en',
    category: 'PROPHECY',
    sort_order: 1,
  },
  {
    topic_id: 't1',
    name: 'Faith',
    content: '{}',
    language_code: 'en',
    category: 'THEME',
    sort_order: 1,
  },
];

// Mock getLocalTopics to return the seed-like data (WITH category + sort_order)
jest.mock('@/services/offline', () => ({
  getLocalTopics: jest.fn().mockResolvedValue(SEED_TOPICS),
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(async () => {
  jest.clearAllMocks();
  await __TEST_ONLY_CLEAR_CACHE();
});

describe('useCachedTopics (offline — seed DB path)', () => {
  it('returns only EVENT topics when category is EVENT', async () => {
    const { result } = renderHook(() => useCachedTopics('EVENT'));

    await waitFor(() => expect(result.current.isInitialLoad).toBe(false));

    const ids = result.current.topics.map((t) => t.topic_id);
    expect(ids).toEqual(['e1', 'e2']);
    expect(result.current.topics.every((t) => t.category === 'EVENT')).toBe(true);
  });

  it('returns only PARABLE topics when category is PARABLE', async () => {
    const { result } = renderHook(() => useCachedTopics('PARABLE'));

    await waitFor(() => expect(result.current.isInitialLoad).toBe(false));

    const ids = result.current.topics.map((t) => t.topic_id);
    expect(ids).toEqual(['p1', 'p2']);
    expect(result.current.topics.every((t) => t.category === 'PARABLE')).toBe(true);
  });

  it('returns only PROPHECY topics when category is PROPHECY', async () => {
    const { result } = renderHook(() => useCachedTopics('PROPHECY'));

    await waitFor(() => expect(result.current.isInitialLoad).toBe(false));

    expect(result.current.topics).toHaveLength(1);
    expect(result.current.topics[0].topic_id).toBe('pr1');
  });

  it('returns only THEME topics when category is THEME', async () => {
    const { result } = renderHook(() => useCachedTopics('THEME'));

    await waitFor(() => expect(result.current.isInitialLoad).toBe(false));

    expect(result.current.topics).toHaveLength(1);
    expect(result.current.topics[0].topic_id).toBe('t1');
  });

  it('never mixes categories — PARABLE results contain no EVENT entries', async () => {
    const { result } = renderHook(() => useCachedTopics('PARABLE'));

    await waitFor(() => expect(result.current.isInitialLoad).toBe(false));

    expect(result.current.topics.some((t) => t.category === 'EVENT')).toBe(false);
  });

  it('sets isInitialLoad to false once topics are loaded', async () => {
    const { result } = renderHook(() => useCachedTopics('EVENT'));

    // Initially loading
    expect(result.current.isInitialLoad).toBe(true);

    await waitFor(() => expect(result.current.isInitialLoad).toBe(false));
  });

  it('maps sort_order from the DB into the returned TopicListItem', async () => {
    const { result } = renderHook(() => useCachedTopics('EVENT'));

    await waitFor(() => expect(result.current.isInitialLoad).toBe(false));

    expect(result.current.topics[0].sort_order).toBe(1);
    expect(result.current.topics[1].sort_order).toBe(2);
  });

  it('sets description to null (seed DB has no description column)', async () => {
    const { result } = renderHook(() => useCachedTopics('EVENT'));

    await waitFor(() => expect(result.current.isInitialLoad).toBe(false));

    expect(result.current.topics.every((t) => t.description === null)).toBe(true);
  });
});
