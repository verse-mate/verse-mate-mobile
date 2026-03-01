import { lookupWord } from '@/services/dictionary-service';

// Mock easton-service
const mockLookupEaston = jest.fn();
jest.mock('@/services/easton-service', () => ({
  lookupEaston: (...args: unknown[]) => mockLookupEaston(...args),
}));

// Mock lexicon-service
const mockLookup = jest.fn();
const mockIsValidStrongsNumber = jest.fn();
jest.mock('@/services/lexicon-service', () => ({
  lookup: (...args: unknown[]) => mockLookup(...args),
  isValidStrongsNumber: (...args: unknown[]) => mockIsValidStrongsNumber(...args),
}));

// Mock word-mapping-service
const mockHasStrongsNumber = jest.fn();
const mockGetStrongsNumber = jest.fn();
jest.mock('@/services/word-mapping-service', () => ({
  hasStrongsNumber: (...args: unknown[]) => mockHasStrongsNumber(...args),
  getStrongsNumber: (...args: unknown[]) => mockGetStrongsNumber(...args),
  normalizeWord: (w: string) => w.toLowerCase().replace(/[.,;:!?'"()]/g, ''),
}));

const mockEastonEntry = {
  term: 'Love',
  definition: 'This word seems to require explanation.',
  scriptureRefs: ['John 21:16'],
};

const mockEastonEntryWithSeeAlso = {
  term: 'Aaron',
  definition: 'The eldest son of Amram and Jochebed.',
  scriptureRefs: ['Exod 4:14', 'Exod 6:20'],
  seeAlso: ['moses', 'levite'],
};

const mockStrongsEntry = {
  id: 'G26',
  lemma: '\u1F00\u03B3\u03AC\u03C0\u03B7',
  definition: 'Love, affection, good-will',
  derivation: 'From G25',
  kjvTranslation: 'love, charity',
};

const mockHebrewStrongsEntry = {
  id: 'H430',
  lemma: '\u05D0\u05DC\u05D4\u05D9\u05DD',
  definition: 'God, gods, judges',
  derivation: 'Plural of H433',
  kjvTranslation: 'God, god, judge',
};

describe('dictionary-service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLookupEaston.mockResolvedValue(null);
    mockHasStrongsNumber.mockReturnValue(false);
    mockGetStrongsNumber.mockReturnValue(null);
    mockIsValidStrongsNumber.mockReturnValue(false);
    mockLookup.mockResolvedValue({ found: false, entry: null });
  });

  describe('priority order', () => {
    it("should return Easton's entry when found (highest priority)", async () => {
      mockLookupEaston.mockResolvedValue(mockEastonEntry);
      // Even if Strong's is also available, Easton should win
      mockHasStrongsNumber.mockReturnValue(true);
      mockGetStrongsNumber.mockReturnValue('G26');

      const result = await lookupWord('love');

      expect(result.source).toBe('easton');
      expect(result.eastonEntry).toEqual(mockEastonEntry);
      expect(result.strongsEntry).toBeUndefined();
      // Should not even call Strong's lookup since Easton was found
      expect(mockLookup).not.toHaveBeenCalled();
    });

    it("should fall back to Strong's when Easton's misses", async () => {
      mockLookupEaston.mockResolvedValue(null);
      mockHasStrongsNumber.mockReturnValue(true);
      mockGetStrongsNumber.mockReturnValue('G26');
      mockLookup.mockResolvedValue({ found: true, entry: mockStrongsEntry });

      const result = await lookupWord('love');

      expect(result.source).toBe('strongs');
      expect(result.strongsEntry).toEqual(mockStrongsEntry);
      expect(result.strongsNumber).toBe('G26');
    });

    it("should return 'none' when no dictionary has the word", async () => {
      mockLookupEaston.mockResolvedValue(null);
      mockHasStrongsNumber.mockReturnValue(false);
      mockIsValidStrongsNumber.mockReturnValue(false);

      const result = await lookupWord('xyzzy');

      expect(result.source).toBe('none');
      expect(result.eastonEntry).toBeUndefined();
      expect(result.strongsEntry).toBeUndefined();
    });

    it("should not attempt Strong's lookup when word mapping returns null", async () => {
      mockLookupEaston.mockResolvedValue(null);
      mockHasStrongsNumber.mockReturnValue(true);
      mockGetStrongsNumber.mockReturnValue(null);

      const result = await lookupWord('unknown');

      expect(result.source).toBe('none');
      expect(mockLookup).not.toHaveBeenCalled();
    });
  });

  describe("Easton's dictionary results", () => {
    it('should include scripture references in Easton result', async () => {
      mockLookupEaston.mockResolvedValue(mockEastonEntry);

      const result = await lookupWord('love');

      expect(result.source).toBe('easton');
      expect(result.eastonEntry?.scriptureRefs).toEqual(['John 21:16']);
    });

    it('should include seeAlso in Easton result', async () => {
      mockLookupEaston.mockResolvedValue(mockEastonEntryWithSeeAlso);

      const result = await lookupWord('aaron');

      expect(result.source).toBe('easton');
      expect(result.eastonEntry?.seeAlso).toEqual(['moses', 'levite']);
    });

    it('should set hasNativeDefinition to false for Easton results', async () => {
      mockLookupEaston.mockResolvedValue(mockEastonEntry);

      const result = await lookupWord('love');

      expect(result.hasNativeDefinition).toBe(false);
    });

    it('should set the word field correctly', async () => {
      mockLookupEaston.mockResolvedValue(mockEastonEntry);

      const result = await lookupWord('love');

      expect(result.word).toBe('love');
    });
  });

  describe("Strong's number direct input", () => {
    it("should look up directly when word is a Strong's number", async () => {
      mockLookupEaston.mockResolvedValue(null);
      mockHasStrongsNumber.mockReturnValue(false);
      mockIsValidStrongsNumber.mockReturnValue(true);
      mockLookup.mockResolvedValue({ found: true, entry: mockStrongsEntry });

      const result = await lookupWord('G26');

      expect(result.source).toBe('strongs');
      expect(result.strongsNumber).toBe('G26');
      expect(result.strongsEntry).toEqual(mockStrongsEntry);
    });

    it("should handle lowercase Strong's number", async () => {
      mockLookupEaston.mockResolvedValue(null);
      mockHasStrongsNumber.mockReturnValue(false);
      mockIsValidStrongsNumber.mockReturnValue(true);
      mockLookup.mockResolvedValue({ found: true, entry: mockStrongsEntry });

      const result = await lookupWord('g26');

      expect(result.strongsNumber).toBe('G26');
    });

    it("should handle Hebrew Strong's numbers", async () => {
      mockLookupEaston.mockResolvedValue(null);
      mockHasStrongsNumber.mockReturnValue(false);
      mockIsValidStrongsNumber.mockReturnValue(true);
      mockLookup.mockResolvedValue({ found: true, entry: mockHebrewStrongsEntry });

      const result = await lookupWord('H430');

      expect(result.source).toBe('strongs');
      expect(result.strongsNumber).toBe('H430');
      expect(result.strongsEntry).toEqual(mockHebrewStrongsEntry);
    });

    it("should return 'none' when Strong's number not found in lexicon", async () => {
      mockLookupEaston.mockResolvedValue(null);
      mockHasStrongsNumber.mockReturnValue(false);
      mockIsValidStrongsNumber.mockReturnValue(true);
      mockLookup.mockResolvedValue({ found: false, entry: null });

      const result = await lookupWord('G99999');

      expect(result.source).toBe('none');
    });
  });

  describe("Strong's via word mapping", () => {
    it("should return 'none' when Strong's lookup fails after mapping", async () => {
      mockLookupEaston.mockResolvedValue(null);
      mockHasStrongsNumber.mockReturnValue(true);
      mockGetStrongsNumber.mockReturnValue('G26');
      mockLookup.mockResolvedValue({ found: false, entry: null });

      const result = await lookupWord('love');

      // Falls through to direct Strong's check which also fails
      expect(result.source).toBe('none');
    });
  });

  describe('edge cases', () => {
    it('should handle empty string', async () => {
      const result = await lookupWord('');
      expect(result.source).toBe('none');
    });

    it('should set hasNativeDefinition to false', async () => {
      const result = await lookupWord('test');
      expect(result.hasNativeDefinition).toBe(false);
    });

    it('should always include the word in the result', async () => {
      const result = await lookupWord('darkness');
      expect(result.word).toBe('darkness');
    });
  });
});
