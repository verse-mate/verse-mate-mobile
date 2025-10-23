/**
 * Verse API Tests with MSW
 *
 * Example tests demonstrating MSW usage for API mocking
 */

import { HttpResponse, http } from 'msw';
import { mockJohn316, mockPsalm23 } from '../mocks/data/verses';
import { server } from '../mocks/server';

// Match the MSW handler configuration and generated client baseUrl
const API_BASE_URL = 'http://localhost:4000';

describe('Verse API', () => {
  describe('GET /api/verses/:id', () => {
    it('should fetch a verse by ID', async () => {
      // Arrange - MSW handler is already set up in server

      // Act
      const response = await fetch(`${API_BASE_URL}/api/verses/john-3-16`);
      const data = await response.json();

      // Assert
      expect(response.ok).toBe(true);
      expect(data).toEqual(mockJohn316);
      expect(data.book).toBe('John');
      expect(data.chapter).toBe(3);
      expect(data.verse).toBe(16);
    });

    it('should return a default verse for unknown IDs', async () => {
      // Act
      const response = await fetch(`${API_BASE_URL}/api/verses/unknown-id`);
      const data = await response.json();

      // Assert
      expect(response.ok).toBe(true);
      expect(data.id).toBe('unknown-id');
      expect(data).toHaveProperty('text');
    });
  });

  describe('GET /api/verses', () => {
    it('should fetch verses by book and chapter', async () => {
      // Act
      const response = await fetch(`${API_BASE_URL}/api/verses?book=John&chapter=3`);
      const data = await response.json();

      // Assert
      expect(response.ok).toBe(true);
      expect(Array.isArray(data.verses)).toBe(true);
      expect(data.verses.length).toBeGreaterThan(0);
      expect(data.verses[0].book).toBe('John');
      expect(data.verses[0].chapter).toBe(3);
    });

    it('should return 400 when book or chapter is missing', async () => {
      // Act
      const response = await fetch(`${API_BASE_URL}/api/verses?book=John`);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(data.error).toBe('Book and chapter are required');
    });
  });

  describe('POST /api/verses/search', () => {
    it('should search verses by text query', async () => {
      // Act
      const response = await fetch(`${API_BASE_URL}/api/verses/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'love' }),
      });
      const data = await response.json();

      // Assert
      expect(response.ok).toBe(true);
      expect(Array.isArray(data.results)).toBe(true);
      expect(data.query).toBe('love');
      expect(data.total).toBeGreaterThan(0);
    });

    it('should return empty results for non-matching query', async () => {
      // Act
      const response = await fetch(`${API_BASE_URL}/api/verses/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'xyznonexistent' }),
      });
      const data = await response.json();

      // Assert
      expect(response.ok).toBe(true);
      expect(data.results).toEqual([]);
      expect(data.total).toBe(0);
    });

    it('should return 400 when query is missing', async () => {
      // Act
      const response = await fetch(`${API_BASE_URL}/api/verses/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(data.error).toBe('Search query is required');
    });
  });

  describe('GET /api/verses/daily', () => {
    it('should fetch verse of the day', async () => {
      // Act
      const response = await fetch(`${API_BASE_URL}/api/verses/daily`);
      const data = await response.json();

      // Assert
      expect(response.ok).toBe(true);
      expect(data).toHaveProperty('verse');
      expect(data).toHaveProperty('date');
      expect(data.verse).toBeTruthy();
      expect(data.verse.book).toBe('John');
    });
  });

  describe('MSW Handler Override', () => {
    it('should allow overriding handlers for specific test cases', async () => {
      // Arrange - Override the default handler for this test
      server.use(
        http.get(`${API_BASE_URL}/api/verses/:id`, () => {
          return HttpResponse.json(mockPsalm23);
        })
      );

      // Act
      const response = await fetch(`${API_BASE_URL}/api/verses/any-id`);
      const data = await response.json();

      // Assert
      expect(data).toEqual(mockPsalm23);
      expect(data.book).toBe('Psalm');
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      // Arrange - Simulate network error
      server.use(
        http.get(`${API_BASE_URL}/api/verses/:id`, () => {
          return HttpResponse.error();
        })
      );

      // Act
      const response = await fetch(`${API_BASE_URL}/api/verses/john-3-16`);

      // Assert - Network errors return type 'error' and status 0
      expect(response.type).toBe('error');
      expect(response.status).toBe(0);
    });

    it('should handle 500 server errors', async () => {
      // Arrange - Simulate server error
      server.use(
        http.get(`${API_BASE_URL}/api/verses/:id`, () => {
          return HttpResponse.json({ error: 'Internal server error' }, { status: 500 });
        })
      );

      // Act
      const response = await fetch(`${API_BASE_URL}/api/verses/john-3-16`);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
    });
  });
});
