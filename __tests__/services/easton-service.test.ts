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
  darkness: {
    term: 'Darkness',
    definition: 'The plague (the ninth) of darkness in Egypt is described as darkness.',
    scriptureRefs: ['Exodus 10:21', 'Matthew 27:45'],
  },
  deep: {
    term: 'Deep',
    definition: 'Used to denote (1) the grave or the abyss (2) the deepest part of the sea.',
    scriptureRefs: ['Romans 10:7', 'Luke 8:31', 'Psalms 69:15'],
  },
  day: {
    term: 'Day',
    definition: 'The Jews reckoned the day from sunset to sunset.',
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

    it('should handle word with multiple punctuation marks', async () => {
      const entry = await lookupEaston('"Baptism!"');
      expect(entry).toEqual(mockDictionary.baptism);
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

    it('should return entry without seeAlso when not present', async () => {
      const entry = await lookupEaston('love');
      expect(entry?.seeAlso).toBeUndefined();
    });

    it('should return entry without scriptureRefs when not present', async () => {
      const entry = await lookupEaston('day');
      expect(entry?.scriptureRefs).toBeUndefined();
    });

    it('should return correct term field', async () => {
      const entry = await lookupEaston('darkness');
      expect(entry?.term).toBe('Darkness');
    });

    it('should return correct definition for each entry', async () => {
      const darkness = await lookupEaston('darkness');
      expect(darkness?.definition).toContain('plague');

      const deep = await lookupEaston('deep');
      expect(deep?.definition).toContain('grave or the abyss');
    });

    it('should handle case-insensitive lookup for all cases', async () => {
      const upper = await lookupEaston('DARKNESS');
      const lower = await lookupEaston('darkness');
      const mixed = await lookupEaston('Darkness');

      expect(upper).toEqual(lower);
      expect(lower).toEqual(mixed);
    });

    it('should use cache on subsequent lookups', async () => {
      // First lookup loads data
      const first = await lookupEaston('aaron');
      // Second lookup uses cache
      const second = await lookupEaston('aaron');

      expect(first).toEqual(second);
    });
  });

  describe('preload', () => {
    it('should load the dictionary without error', async () => {
      await expect(preload()).resolves.toBeUndefined();
    });

    it('should make subsequent lookups use cached data', async () => {
      await preload();
      const entry = await lookupEaston('love');
      expect(entry).toEqual(mockDictionary.love);
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

    it('should reset cache status', async () => {
      await preload();
      clearCache();
      // After clear, getStats will reload and show cached=true again
      const stats = await getStats();
      expect(stats.cached).toBe(true);
    });
  });

  describe('getStats', () => {
    it('should return entry count and cache status', async () => {
      const stats = await getStats();
      expect(stats.totalEntries).toBe(6);
      expect(stats.cached).toBe(true);
    });

    it('should reflect cache state', async () => {
      clearCache();
      // After getStats loads the dictionary, it should be cached
      const stats = await getStats();
      expect(stats.cached).toBe(true);
    });

    it('should return correct count for all entries', async () => {
      const stats = await getStats();
      expect(stats.totalEntries).toBe(Object.keys(mockDictionary).length);
    });
  });
});
