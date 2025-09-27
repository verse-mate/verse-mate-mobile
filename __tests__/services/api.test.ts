import { ApiService } from '@/services/api';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('ApiService', () => {
  let apiService: ApiService;

  beforeEach(() => {
    mockFetch.mockClear();
    apiService = new ApiService('https://api.verse-mate.apegro.dev');
  });

  describe('getTestaments', () => {
    it('should fetch testaments successfully', async () => {
      const mockTestaments = [
        { id: 'old', name: 'Old Testament', books: [] },
        { id: 'new', name: 'New Testament', books: [] },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockTestaments),
      });

      const result = await apiService.getTestaments();

      expect(result).toEqual(mockTestaments);
    });

    it('should handle network errors when fetching testaments', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(apiService.getTestaments()).rejects.toThrow('Network error');
    });

    it('should handle HTTP errors when fetching testaments', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(apiService.getTestaments()).rejects.toThrow();
    });
  });

  describe('getBooks', () => {
    it('should fetch books successfully', async () => {
      const mockBooks = [
        { id: 1, name: 'Genesis', testament: 'old', chapters: 50 },
        { id: 2, name: 'Exodus', testament: 'old', chapters: 40 },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockBooks),
      });

      const result = await apiService.getBooks();

      expect(result).toEqual(mockBooks);
    });

    it('should fetch books by testament', async () => {
      const mockOldTestamentBooks = [
        { id: 1, name: 'Genesis', testament: 'old', chapters: 50 },
        { id: 2, name: 'Exodus', testament: 'old', chapters: 40 },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockOldTestamentBooks),
      });

      const result = await apiService.getBooks('old');

      expect(result).toEqual(mockOldTestamentBooks);
    });

    it('should handle errors when fetching books', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      await expect(apiService.getBooks()).rejects.toThrow();
    });
  });

  describe('getChapter', () => {
    it('should fetch chapter data successfully', async () => {
      const mockChapterData = {
        bookId: 1,
        bookName: 'Genesis',
        chapter: 1,
        verses: [
          { number: 1, text: 'In the beginning God created the heavens and the earth.' },
          { number: 2, text: 'The earth was without form, and void; and darkness was on the face of the deep.' },
        ],
        version: 'NASB1995',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockChapterData),
      });

      const result = await apiService.getChapter(1, 1);

      expect(result).toEqual(mockChapterData);
    });

    it('should handle invalid book ID', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      await expect(apiService.getChapter(999, 1)).rejects.toThrow();
    });

    it('should handle invalid chapter number', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      await expect(apiService.getChapter(1, 999)).rejects.toThrow();
    });

    it('should validate input parameters', async () => {
      await expect(apiService.getChapter(0, 1)).rejects.toThrow('Invalid book ID');
      await expect(apiService.getChapter(1, 0)).rejects.toThrow('Invalid chapter number');
      await expect(apiService.getChapter(-1, 1)).rejects.toThrow('Invalid book ID');
      await expect(apiService.getChapter(1, -1)).rejects.toThrow('Invalid chapter number');
    });
  });

  describe('searchChapters', () => {
    it('should search chapters successfully', async () => {
      const mockSearchResults = [
        {
          bookId: 1,
          bookName: 'Genesis',
          chapter: 1,
          verse: 1,
          text: 'In the beginning God created the heavens and the earth.',
          relevanceScore: 0.95,
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockSearchResults),
      });

      const result = await apiService.searchChapters('beginning');

      expect(result).toEqual(mockSearchResults);
    });

    it('should handle empty search results', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue([]),
      });

      const result = await apiService.searchChapters('nonexistentword');

      expect(result).toEqual([]);
    });

    it('should validate search query', async () => {
      await expect(apiService.searchChapters('')).rejects.toThrow('Search query cannot be empty');
      await expect(apiService.searchChapters('  ')).rejects.toThrow('Search query cannot be empty');
    });
  });

  describe('Retry Logic', () => {
    it('should retry failed requests up to 3 times', async () => {
      // Mock three failed attempts followed by success
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue([]),
        });

      const result = await apiService.getTestaments();

      expect(result).toEqual([]);
      expect(mockFetch).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
    });

    it('should fail after maximum retry attempts', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(apiService.getTestaments()).rejects.toThrow('Network error');
      expect(mockFetch).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
    });
  });

  describe('Caching', () => {
    it('should cache testament data', async () => {
      const mockTestaments = [
        { id: 'old', name: 'Old Testament', books: [] },
        { id: 'new', name: 'New Testament', books: [] },
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockTestaments),
      });

      // Call twice
      const result1 = await apiService.getTestaments();
      const result2 = await apiService.getTestaments();

      expect(result1).toEqual(mockTestaments);
      expect(result2).toEqual(mockTestaments);
      expect(mockFetch).toHaveBeenCalledTimes(1); // Should only be called once due to caching
    });
  });
});