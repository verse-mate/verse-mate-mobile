/**
 * AI Explanation API Tests with MSW
 *
 * Example tests demonstrating MSW usage for AI explanation endpoints
 */

import { HttpResponse, http } from 'msw';
import { mockJohn316Explanation } from '../mocks/data/explanations';
import { server } from '../mocks/server';

// Match the MSW handler configuration and generated client baseUrl
const API_BASE_URL = 'http://localhost:4000';

describe('AI Explanation API', () => {
  describe('POST /api/explanations', () => {
    it('should generate AI explanation for a verse', async () => {
      // Act
      const response = await fetch(`${API_BASE_URL}/api/explanations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verseId: 'john-3-16' }),
      });
      const data = await response.json();

      // Assert
      expect(response.ok).toBe(true);
      expect(data.explanation.id).toBe(mockJohn316Explanation.id);
      expect(data.explanation.verseId).toBe('john-3-16');
      expect(data.explanation.content).toContain('Gospel in a nutshell');
    });

    it('should include translations when requested', async () => {
      // Act
      const response = await fetch(`${API_BASE_URL}/api/explanations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          verseId: 'john-3-16',
          includeTranslations: true,
        }),
      });
      const data = await response.json();

      // Assert
      expect(response.ok).toBe(true);
      expect(data.explanation.translations).toBeDefined();
      expect(Array.isArray(data.explanation.translations)).toBe(true);
      expect(data.explanation.translations.length).toBeGreaterThan(0);
    });

    it('should return 400 when verseId is missing', async () => {
      // Act
      const response = await fetch(`${API_BASE_URL}/api/explanations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(data.error).toBe('Verse ID is required');
    });
  });

  describe('GET /api/explanations/:id', () => {
    it('should fetch an existing explanation by ID', async () => {
      // Act
      const response = await fetch(`${API_BASE_URL}/api/explanations/john-3-16-explanation`);
      const data = await response.json();

      // Assert
      expect(response.ok).toBe(true);
      expect(data.id).toBe(mockJohn316Explanation.id);
      expect(data.verseId).toBe(mockJohn316Explanation.verseId);
      expect(data.content).toBe(mockJohn316Explanation.content);
    });

    it('should return 404 for non-existent explanation', async () => {
      // Act
      const response = await fetch(`${API_BASE_URL}/api/explanations/non-existent`);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(404);
      expect(data.error).toBe('Explanation not found');
    });
  });

  describe('POST /api/explanations/:id/translate', () => {
    it('should translate explanation to Spanish', async () => {
      // Act
      const response = await fetch(
        `${API_BASE_URL}/api/explanations/john-3-16-explanation/translate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ language: 'es' }),
        }
      );
      const data = await response.json();

      // Assert
      expect(response.ok).toBe(true);
      expect(data.translation.language).toBe('es');
      expect(data.translation.content).toBeTruthy();
    });

    it('should translate explanation to Portuguese', async () => {
      // Act
      const response = await fetch(
        `${API_BASE_URL}/api/explanations/john-3-16-explanation/translate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ language: 'pt' }),
        }
      );
      const data = await response.json();

      // Assert
      expect(response.ok).toBe(true);
      expect(data.translation.language).toBe('pt');
    });

    it('should return 400 when language is missing', async () => {
      // Act
      const response = await fetch(
        `${API_BASE_URL}/api/explanations/john-3-16-explanation/translate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }
      );
      const data = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(data.error).toBe('Target language is required');
    });
  });

  describe('POST /api/explanations/:id/feedback', () => {
    it('should submit feedback with rating', async () => {
      // Act
      const response = await fetch(
        `${API_BASE_URL}/api/explanations/john-3-16-explanation/feedback`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rating: 5 }),
        }
      );
      const data = await response.json();

      // Assert
      expect(response.ok).toBe(true);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Feedback received');
    });

    it('should submit feedback with rating and comment', async () => {
      // Act
      const response = await fetch(
        `${API_BASE_URL}/api/explanations/john-3-16-explanation/feedback`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rating: 4,
            comment: 'Very helpful explanation!',
          }),
        }
      );
      const data = await response.json();

      // Assert
      expect(response.ok).toBe(true);
      expect(data.success).toBe(true);
    });

    it('should return 400 for invalid rating', async () => {
      // Act
      const response = await fetch(
        `${API_BASE_URL}/api/explanations/john-3-16-explanation/feedback`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rating: 6 }),
        }
      );
      const data = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(data.error).toBe('Rating must be between 1 and 5');
    });
  });

  describe('Delayed Response Simulation', () => {
    it('should handle delayed API responses', async () => {
      // Arrange
      const startTime = Date.now();

      // Act
      const response = await fetch(`${API_BASE_URL}/api/explanations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verseId: 'john-3-16' }),
      });
      const data = await response.json();
      const endTime = Date.now();

      // Assert
      expect(response.ok).toBe(true);
      expect(data.explanation).toBeDefined();
      // MSW delay is 500ms, so request should take at least that long
      expect(endTime - startTime).toBeGreaterThanOrEqual(400);
    });
  });
});
