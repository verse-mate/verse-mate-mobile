import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { ApiService } from '@/services/api';

describe('ApiService', () => {
  let apiService: ApiService;
  let mockFetch: any;

  beforeEach(() => {
    // Create a fresh mock for each test
    mockFetch = mock(() => Promise.resolve(new Response()));
    global.fetch = mockFetch;
    // Create ApiService instance (it will use the current retry logic)
    apiService = new ApiService('https://api.verse-mate.apegro.dev');
  });

  describe('getTestaments', () => {
    it('should fetch testaments successfully', async () => {
      const mockTestaments = [
        { id: 'old', name: 'Old Testament', books: [] },
        { id: 'new', name: 'New Testament', books: [] },
      ];

      mockFetch.mockImplementation(() => Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockTestaments),
      }));

      const result = await apiService.getTestaments();

      expect(result).toEqual(mockTestaments);
    });

    it('should handle HTTP client errors when fetching testaments', async () => {
      mockFetch.mockImplementation(() => Promise.resolve({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      }));

      await expect(apiService.getTestaments()).rejects.toThrow();
    });
  });

  describe('getBooks', () => {
    it('should fetch books successfully', async () => {
      const mockBooks = [
        { id: 1, name: 'Genesis', testament: 'old', chapters: 50 },
        { id: 2, name: 'Exodus', testament: 'old', chapters: 40 },
      ];

      mockFetch.mockImplementation(() => Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockBooks),
      }));

      const result = await apiService.getBooks();

      expect(result).toEqual(mockBooks);
    });

    it('should handle client errors when fetching books', async () => {
      mockFetch.mockImplementation(() => Promise.resolve({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
      }));

      await expect(apiService.getBooks()).rejects.toThrow();
    });
  });

  describe('getChapter', () => {
    it('should fetch chapter successfully', async () => {
      const mockChapterData = {
        book: { id: 1, name: 'Genesis' },
        chapter: 1,
        verses: [
          { number: 1, text: 'In the beginning God created the heavens and the earth.' }
        ]
      };

      mockFetch.mockImplementation(() => Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockChapterData),
      }));

      const result = await apiService.getChapter(1, 1);

      expect(result).toEqual(mockChapterData);
    });

    it('should handle invalid chapter number', async () => {
      mockFetch.mockImplementation(() => Promise.resolve({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      }));

      await expect(apiService.getChapter(1, 999)).rejects.toThrow();
    });
  });

  describe('searchChapters', () => {
    it('should search chapters successfully', async () => {
      const mockSearchResults = [
        { book: 'Genesis', chapter: 1, verse: 1, text: 'In the beginning...' }
      ];

      mockFetch.mockImplementation(() => Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockSearchResults),
      }));

      const result = await apiService.searchChapters('beginning');

      expect(result).toEqual(mockSearchResults);
    });

    it('should return empty array for no results', async () => {
      mockFetch.mockImplementation(() => Promise.resolve({
        ok: true,
        json: () => Promise.resolve([]),
      }));

      const result = await apiService.searchChapters('nonexistentword');

      expect(result).toEqual([]);
    });
  });
});