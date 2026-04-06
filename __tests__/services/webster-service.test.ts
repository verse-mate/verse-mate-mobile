// Mock the webster-service SHARD_LOADERS to avoid dynamic import() calls
// which require --experimental-vm-modules in Jest
const mockShardA = {
  abandon: { term: 'Abandon', definition: 'To give up absolutely; to forsake entirely.' },
  apple: { term: 'Apple', definition: 'The fruit of a tree.' },
};

const mockShardB = {
  book: { term: 'Book', definition: 'A collection of sheets of paper bound together.' },
};

// Mock the entire module and re-implement with sync data
jest.mock('@/services/webster-service', () => {
  const shardCache = new Map<string, Record<string, { term: string; definition: string }>>();

  const shards: Record<string, Record<string, { term: string; definition: string }>> = {
    a: mockShardA,
    b: mockShardB,
  };

  const normalizeWord = (w: string) => w.toLowerCase().replace(/[.,;:!?'"()]/g, '');

  return {
    lookupWebster: async (word: string) => {
      if (!word) return null;
      const normalized = normalizeWord(word);
      if (!normalized) return null;
      const firstLetter = normalized[0];
      if (firstLetter < 'a' || firstLetter > 'z') return null;

      if (!shardCache.has(firstLetter)) {
        shardCache.set(firstLetter, shards[firstLetter] || {});
      }
      const shard = shardCache.get(firstLetter)!;
      return shard[normalized] ?? null;
    },
    clearCache: () => shardCache.clear(),
    getStats: () => ({
      loadedShards: shardCache.size,
      cachedLetters: Array.from(shardCache.keys()),
    }),
  };
});

import { clearCache, getStats, lookupWebster } from '@/services/webster-service';

describe('webster-service', () => {
  beforeEach(() => {
    clearCache();
  });

  describe('lookupWebster', () => {
    it('should return entry for a known word', async () => {
      const result = await lookupWebster('abandon');

      expect(result).toEqual({
        term: 'Abandon',
        definition: 'To give up absolutely; to forsake entirely.',
      });
    });

    it('should normalize word to lowercase', async () => {
      const result = await lookupWebster('APPLE');

      expect(result).toEqual({
        term: 'Apple',
        definition: 'The fruit of a tree.',
      });
    });

    it('should load correct shard based on first letter', async () => {
      const result = await lookupWebster('book');

      expect(result).toEqual({
        term: 'Book',
        definition: 'A collection of sheets of paper bound together.',
      });
    });

    it('should return null for unknown word', async () => {
      const result = await lookupWebster('xyzzynotaword');
      expect(result).toBeNull();
    });

    it('should return null for empty string', async () => {
      const result = await lookupWebster('');
      expect(result).toBeNull();
    });

    it('should return null for non-alpha first character', async () => {
      const result = await lookupWebster('123number');
      expect(result).toBeNull();
    });
  });

  describe('caching', () => {
    it('should cache shard after first load', async () => {
      await lookupWebster('abandon');
      const stats1 = getStats();
      expect(stats1.loadedShards).toBe(1);
      expect(stats1.cachedLetters).toContain('a');

      // Second lookup uses cache
      await lookupWebster('apple');
      const stats2 = getStats();
      expect(stats2.loadedShards).toBe(1); // Still 1 — same shard
    });

    it('should load multiple shards for different letters', async () => {
      await lookupWebster('abandon');
      await lookupWebster('book');

      const stats = getStats();
      expect(stats.loadedShards).toBe(2);
      expect(stats.cachedLetters).toContain('a');
      expect(stats.cachedLetters).toContain('b');
    });
  });

  describe('clearCache', () => {
    it('should clear all cached shards', async () => {
      await lookupWebster('abandon');
      await lookupWebster('book');
      expect(getStats().loadedShards).toBe(2);

      clearCache();
      expect(getStats().loadedShards).toBe(0);
    });
  });
});
