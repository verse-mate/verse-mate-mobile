import { clearCache, getAll } from '@/services/names-of-god-repository';

const mockDataset = [
  {
    id: 'yahweh',
    nameEn: 'Yahweh',
    nameOriginal: 'יְהוָה',
    transliteration: 'Yahweh',
    language: 'Hebrew',
    category: 'covenant-name',
    meaning: 'I AM WHO I AM; the eternal, self-existent, covenant name of God revealed to Moses',
    testament: 'OT',
    verseRefs: ['Exodus 3:14', 'Exodus 6:2', 'Psalm 83:18'],
  },
  {
    id: 'elohim',
    nameEn: 'Elohim',
    nameOriginal: 'אֱלֹהִים',
    transliteration: 'Elohim',
    language: 'Hebrew',
    category: 'divine-name',
    meaning: 'God; the plural form emphasising majesty and fullness of divine power',
    testament: 'OT',
    verseRefs: ['Genesis 1:1', 'Psalm 19:1'],
  },
  {
    id: 'kyrios',
    nameEn: 'Kyrios',
    nameOriginal: 'Κύριος',
    transliteration: 'Kyrios',
    language: 'Greek',
    category: 'divine-name',
    meaning: 'Lord; title of authority and sovereignty used of both God and Jesus',
    testament: 'NT',
    verseRefs: ['Romans 10:9', 'Philippians 2:11'],
  },
];

jest.mock('@/assets/names-of-god.json', () => mockDataset, { virtual: true });

describe('names-of-god-repository', () => {
  beforeEach(() => {
    clearCache();
  });

  describe('getAll', () => {
    it('returns all entries from the dataset', () => {
      expect(getAll()).toHaveLength(3);
    });

    it('returns entries with expected shape', () => {
      const first = getAll()[0];
      expect(first).toHaveProperty('id');
      expect(first).toHaveProperty('nameEn');
      expect(first).toHaveProperty('transliteration');
      expect(first).toHaveProperty('language');
      expect(first).toHaveProperty('meaning');
      expect(first).toHaveProperty('verseRefs');
    });

    it('returns cached data on subsequent calls', () => {
      const first = getAll();
      const second = getAll();
      expect(first).toBe(second);
    });

    it('reloads after clearCache', () => {
      const before = getAll();
      clearCache();
      const after = getAll();
      expect(after).toEqual(before);
    });

    it('returns verseRefs as an array', () => {
      const entry = getAll()[0];
      expect(Array.isArray(entry.verseRefs)).toBe(true);
      expect(entry.verseRefs.length).toBeGreaterThan(0);
    });
  });

  describe('clearCache', () => {
    it('does not throw when cache is empty', () => {
      clearCache();
      expect(() => clearCache()).not.toThrow();
    });
  });
});
