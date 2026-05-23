import { clearCache } from '@/services/names-of-god-repository';
import {
  filterByCategory,
  getAllNames,
  getNameById,
  searchNames,
} from '@/services/names-of-god-use-case';

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
    verseRefs: ['Exodus 3:14', 'Exodus 6:2', 'Psalm 83:18', 'Isaiah 42:8', 'Genesis 2:4'],
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
    nameOriginal: 'κύριος',
    transliteration: 'Kyrios',
    language: 'Greek',
    category: 'divine-name',
    meaning: 'Lord; title of authority and sovereignty used of both God and Jesus',
    testament: 'NT',
    verseRefs: ['Romans 10:9', 'Philippians 2:11'],
  },
  {
    id: 'theos',
    nameEn: 'Theos',
    nameOriginal: 'Θεός',
    transliteration: 'Theos',
    language: 'Greek',
    category: 'divine-name',
    meaning: 'God; the generic Greek term for deity',
    testament: 'NT',
    verseRefs: ['John 1:1', 'John 1:14'],
  },
  {
    id: 'adonai',
    nameEn: 'Adonai',
    nameOriginal: 'אֲדֹנָי',
    transliteration: 'Adonai',
    language: 'Hebrew',
    category: 'relational-title',
    meaning: 'Lord; master; emphasises the lordship and sovereignty of God over creation',
    testament: 'OT',
    verseRefs: ['Psalm 2:4', 'Isaiah 6:1'],
  },
  {
    id: 'bar-enash',
    nameEn: 'Bar Enash',
    nameOriginal: 'בַּר אֱנָשׁ',
    transliteration: 'Bar Enash',
    language: 'Aramaic',
    category: 'messianic-title',
    meaning: 'Son of Man; Aramaic title used in Daniel for the heavenly figure',
    testament: 'OT',
    verseRefs: ['Daniel 7:13'],
  },
];

jest.mock('@/assets/names-of-god.json', () => mockDataset, { virtual: true });

describe('names-of-god-use-case', () => {
  beforeEach(() => {
    clearCache();
  });

  describe('getAllNames', () => {
    it('returns all entries', () => {
      expect(getAllNames()).toHaveLength(6);
    });

    it('returns entries with verseRefs arrays', () => {
      for (const entry of getAllNames()) {
        expect(Array.isArray(entry.verseRefs)).toBe(true);
      }
    });
  });

  describe('searchNames', () => {
    it('returns all entries for empty query', () => {
      expect(searchNames('')).toHaveLength(6);
    });

    it('returns all entries for whitespace-only query', () => {
      expect(searchNames('   ')).toHaveLength(6);
    });

    it('matches by English name (case-insensitive)', () => {
      const results = searchNames('yahweh');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('yahweh');
    });

    it('matches by English name with mixed case', () => {
      const results = searchNames('ELOHIM');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('elohim');
    });

    it('matches by transliteration', () => {
      const results = searchNames('Kyrios');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('kyrios');
    });

    it('matches by meaning keyword', () => {
      const results = searchNames('sovereign');
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results.some((e) => e.id === 'kyrios')).toBe(true);
    });

    it('matches multiple tokens — all must appear', () => {
      const results = searchNames('eternal covenant');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('yahweh');
    });

    it('returns empty array when no entry matches', () => {
      expect(searchNames('zzznomatch')).toHaveLength(0);
    });

    it('returns multiple matches for shared keyword', () => {
      // "divine" appears in meaning of multiple entries — at least 2
      const results = searchNames('God');
      expect(results.length).toBeGreaterThanOrEqual(2);
    });

    it('does not match when one token is absent', () => {
      const results = searchNames('yahweh greek');
      expect(results).toHaveLength(0);
    });
  });

  describe('filterByCategory', () => {
    it("returns all entries for 'All'", () => {
      expect(filterByCategory('All')).toHaveLength(6);
    });

    it("returns only Hebrew entries for 'Hebrew'", () => {
      const results = filterByCategory('Hebrew');
      expect(results.length).toBeGreaterThan(0);
      for (const entry of results) {
        expect(entry.language).toBe('Hebrew');
      }
    });

    it("returns only Greek entries for 'Greek'", () => {
      const results = filterByCategory('Greek');
      expect(results.length).toBeGreaterThan(0);
      for (const entry of results) {
        expect(entry.language).toBe('Greek');
      }
    });

    it("returns empty array for 'English' when no English entries exist", () => {
      expect(filterByCategory('English')).toHaveLength(0);
    });

    it("returns only Aramaic entries for 'Aramaic'", () => {
      const results = filterByCategory('Aramaic');
      expect(results.length).toBeGreaterThan(0);
      for (const entry of results) {
        expect(entry.language).toBe('Aramaic');
      }
    });

    it('Hebrew + Greek + Aramaic counts add up to total', () => {
      const hebrew = filterByCategory('Hebrew');
      const greek = filterByCategory('Greek');
      const aramaic = filterByCategory('Aramaic');
      const all = filterByCategory('All');
      expect(hebrew.length + greek.length + aramaic.length).toBe(all.length);
    });

    it('Hebrew filter includes yahweh, elohim, adonai', () => {
      const ids = filterByCategory('Hebrew').map((e) => e.id);
      expect(ids).toContain('yahweh');
      expect(ids).toContain('elohim');
      expect(ids).toContain('adonai');
    });

    it('Greek filter includes kyrios and theos', () => {
      const ids = filterByCategory('Greek').map((e) => e.id);
      expect(ids).toContain('kyrios');
      expect(ids).toContain('theos');
    });
  });

  describe('getNameById', () => {
    it('returns the correct entry for a known id', () => {
      const entry = getNameById('yahweh');
      expect(entry).not.toBeNull();
      expect(entry?.id).toBe('yahweh');
      expect(entry?.nameEn).toBe('Yahweh');
    });

    it('returns null for an unknown id', () => {
      expect(getNameById('notanid')).toBeNull();
    });

    it('includes the full verseRefs list', () => {
      const entry = getNameById('yahweh');
      expect(entry?.verseRefs).toEqual([
        'Exodus 3:14',
        'Exodus 6:2',
        'Psalm 83:18',
        'Isaiah 42:8',
        'Genesis 2:4',
      ]);
    });

    it('returns all fields of the entry', () => {
      const entry = getNameById('kyrios');
      expect(entry).toMatchObject({
        id: 'kyrios',
        nameEn: 'Kyrios',
        nameOriginal: 'κύριος',
        transliteration: 'Kyrios',
        language: 'Greek',
        category: 'divine-name',
        testament: 'NT',
      });
    });

    it('handles empty string id', () => {
      expect(getNameById('')).toBeNull();
    });
  });
});
