/**
 * MSW Handlers for VerseMate AI Explanation API Endpoints
 *
 * Mock API handlers for AI explanation-related endpoints
 */

import { delay, HttpResponse, http } from 'msw';
import {
  createMockExplanation,
  createMockExplanationWithTranslations,
  mockGenesis11Explanation,
  mockJohn316Explanation,
  mockPsalm23Explanation,
} from '../data/explanations';

// Base API URL - matches the generated SDK default
// Use localhost for tests since the generated client.gen.ts uses http://localhost:4000
const API_BASE_URL = 'http://localhost:4000';

export const explanationHandlers = [
  // POST /api/explanations - Generate AI explanation for a verse
  http.post(`${API_BASE_URL}/api/explanations`, async ({ request }) => {
    const body = (await request.json()) as {
      verseId: string;
      language?: string;
      includeTranslations?: boolean;
    };

    if (!body.verseId) {
      return HttpResponse.json({ error: 'Verse ID is required' }, { status: 400 });
    }

    // Simulate AI generation delay
    await delay(500);

    // Return specific explanations for known verses
    if (body.verseId === 'john-3-16') {
      return HttpResponse.json({
        explanation: body.includeTranslations
          ? createMockExplanationWithTranslations({
              id: 'john-3-16-explanation',
              verseId: body.verseId,
            })
          : mockJohn316Explanation,
      });
    }

    if (body.verseId === 'psalm-23-1') {
      return HttpResponse.json({
        explanation: mockPsalm23Explanation,
      });
    }

    if (body.verseId === 'genesis-1-1') {
      return HttpResponse.json({
        explanation: mockGenesis11Explanation,
      });
    }

    // Default explanation for unknown verses
    return HttpResponse.json({
      explanation: createMockExplanation({
        verseId: body.verseId,
        language: body.language || 'en',
      }),
    });
  }),

  // GET /api/explanations/:id - Get an existing explanation
  http.get(`${API_BASE_URL}/api/explanations/:id`, ({ params }) => {
    const { id } = params;

    if (id === 'john-3-16-explanation') {
      return HttpResponse.json(mockJohn316Explanation);
    }

    if (id === 'psalm-23-explanation') {
      return HttpResponse.json(mockPsalm23Explanation);
    }

    if (id === 'genesis-1-1-explanation') {
      return HttpResponse.json(mockGenesis11Explanation);
    }

    return HttpResponse.json({ error: 'Explanation not found' }, { status: 404 });
  }),

  // POST /api/explanations/:id/translate - Translate an explanation
  http.post(`${API_BASE_URL}/api/explanations/:id/translate`, async ({ params, request }) => {
    const { id: _id } = params;
    const body = (await request.json()) as { language: string };

    if (!body.language) {
      return HttpResponse.json({ error: 'Target language is required' }, { status: 400 });
    }

    // Simulate translation delay
    await delay(300);

    const translations: Record<string, string> = {
      es: 'Este versículo resume el mensaje central del cristianismo sobre el amor de Dios.',
      pt: 'Este versículo resume a mensagem central do cristianismo sobre o amor de Deus.',
      fr: "Ce verset résume le message central du christianisme sur l'amour de Dieu.",
    };

    return HttpResponse.json({
      translation: {
        language: body.language,
        content: translations[body.language] || 'Translation not available',
      },
    });
  }),

  // POST /api/explanations/:id/feedback - Submit feedback on explanation
  http.post(`${API_BASE_URL}/api/explanations/:id/feedback`, async ({ params, request }) => {
    const { id } = params;
    const body = (await request.json()) as {
      rating: number;
      comment?: string;
    };

    if (body.rating < 1 || body.rating > 5) {
      return HttpResponse.json({ error: 'Rating must be between 1 and 5' }, { status: 400 });
    }

    return HttpResponse.json({
      success: true,
      message: 'Feedback received',
      explanationId: id,
    });
  }),
];
