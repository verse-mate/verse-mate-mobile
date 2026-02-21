import { clearCache, getStats, lookupEaston, preload } from '@/services/easton-service';

// Mock the JSON import
const mockDictionary = {
  aaron: {
    term: 'Aaron',
    definition: 'The eldest son of Amram and Jochebed, a daughter of Levi.',
    scriptureRefs: ['Exod 4:14', 'Exod 6:20'],
    seeAlso: ['moses', 'levite'],
  },
  love: {
    term: 'Love',
    definition: 'This word seems to require explanation only in the case of its use by our Lord.',
    scriptureRefs: ['John 21:16', 'John 21:17', '1 Cor 13'],
  },
  baptism: {
    term: 'Baptism',
    definition: 'A word of Greek origin signifying to dip or immerse.',
    scriptureRefs: ['Matt 3:16'],
    seeAlso: ['john the baptist'],
  },
};

jest.mock('@/assets/data/easton-dictionary.json', () => mockDictionary, { virtual: true });

describe('easton-service', () => {
  beforeEach(() => {
    clearCache();
  });

  describe('lookupEaston', () => {
    it('should return entry for exact match', async () => {
      const entry = await lookupEaston('aaron');
      expect(entry).toEqual(mockDictionary.aaron);
    });

    it('should normalize word to lowercase for lookup', async () => {
      const entry = await lookupEaston('Aaron');
      expect(entry).toEqual(mockDictionary.aaron);
    });

    it('should strip punctuation for lookup', async () => {
      const entry = await lookupEaston('Love,');
      expect(entry).toEqual(mockDictionary.love);
    });

    it('should return null for missing word', async () => {
      const entry = await lookupEaston('nonexistent');
      expect(entry).toBeNull();
    });

    it('should return null for empty string', async () => {
      const entry = await lookupEaston('');
      expect(entry).toBeNull();
    });

    it('should include scriptureRefs when present', async () => {
      const entry = await lookupEaston('aaron');
      expect(entry?.scriptureRefs).toEqual(['Exod 4:14', 'Exod 6:20']);
    });

    it('should include seeAlso when present', async () => {
      const entry = await lookupEaston('aaron');
      expect(entry?.seeAlso).toEqual(['moses', 'levite']);
    });
  });

  describe('preload', () => {
    it('should load the dictionary without error', async () => {
      await expect(preload()).resolves.toBeUndefined();
    });
  });

  describe('clearCache', () => {
    it('should allow re-loading after clearing', async () => {
      await preload();
      clearCache();
      // Should still work after cache clear
      const entry = await lookupEaston('love');
      expect(entry).toEqual(mockDictionary.love);
    });
  });

  describe('getStats', () => {
    it('should return entry count and cache status', async () => {
      const stats = await getStats();
      expect(stats.totalEntries).toBe(3);
      expect(stats.cached).toBe(true);
    });

    it('should reflect cache state', async () => {
      clearCache();
      // After getStats loads the dictionary, it should be cached
      const stats = await getStats();
      expect(stats.cached).toBe(true);
    });
  });
});
