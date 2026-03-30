import { clearCache, getStats, lookupWebster } from '@/services/webster-service';

// Mock word-mapping-service for normalizeWord
jest.mock('@/services/word-mapping-service', () => ({
  normalizeWord: (w: string) => w.toLowerCase().replace(/[.,;:!?'"()]/g, ''),
}));

// Mock the JSON shard requires
const mockShardA = {
  abandon: { term: 'Abandon', definition: 'To give up absolutely; to forsake entirely.' },
  apple: { term: 'Apple', definition: 'The fruit of a tree.' },
};

const mockShardB = {
  book: { term: 'Book', definition: 'A collection of sheets of paper bound together.' },
};

jest.mock('@/assets/data/webster-a.json', () => mockShardA, { virtual: true });
jest.mock('@/assets/data/webster-b.json', () => mockShardB, { virtual: true });
jest.mock('@/assets/data/webster-c.json', () => ({}), { virtual: true });
jest.mock('@/assets/data/webster-d.json', () => ({}), { virtual: true });
jest.mock('@/assets/data/webster-e.json', () => ({}), { virtual: true });
jest.mock('@/assets/data/webster-f.json', () => ({}), { virtual: true });
jest.mock('@/assets/data/webster-g.json', () => ({}), { virtual: true });
jest.mock('@/assets/data/webster-h.json', () => ({}), { virtual: true });
jest.mock('@/assets/data/webster-i.json', () => ({}), { virtual: true });
jest.mock('@/assets/data/webster-j.json', () => ({}), { virtual: true });
jest.mock('@/assets/data/webster-k.json', () => ({}), { virtual: true });
jest.mock('@/assets/data/webster-l.json', () => ({}), { virtual: true });
jest.mock('@/assets/data/webster-m.json', () => ({}), { virtual: true });
jest.mock('@/assets/data/webster-n.json', () => ({}), { virtual: true });
jest.mock('@/assets/data/webster-o.json', () => ({}), { virtual: true });
jest.mock('@/assets/data/webster-p.json', () => ({}), { virtual: true });
jest.mock('@/assets/data/webster-q.json', () => ({}), { virtual: true });
jest.mock('@/assets/data/webster-r.json', () => ({}), { virtual: true });
jest.mock('@/assets/data/webster-s.json', () => ({}), { virtual: true });
jest.mock('@/assets/data/webster-t.json', () => ({}), { virtual: true });
jest.mock('@/assets/data/webster-u.json', () => ({}), { virtual: true });
jest.mock('@/assets/data/webster-v.json', () => ({}), { virtual: true });
jest.mock('@/assets/data/webster-w.json', () => ({}), { virtual: true });
jest.mock('@/assets/data/webster-x.json', () => ({}), { virtual: true });
jest.mock('@/assets/data/webster-y.json', () => ({}), { virtual: true });
jest.mock('@/assets/data/webster-z.json', () => ({}), { virtual: true });

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
