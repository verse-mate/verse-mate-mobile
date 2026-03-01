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

const mockStrongsEntry = {
  id: 'G26',
  lemma: '\u1F00\u03B3\u03AC\u03C0\u03B7',
  definition: 'Love, affection, good-will',
  derivation: 'From G25',
  kjvTranslation: 'love, charity',
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
  });
});
