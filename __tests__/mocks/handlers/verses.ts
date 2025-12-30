/**
 * MSW Handlers for VerseMate Verse API Endpoints
 *
 * Mock API handlers for Bible verse-related endpoints
 */

import { HttpResponse, http } from 'msw';
import {
  createMockVerse,
  createMockVerseList,
  mockGenesis11,
  mockJohn316,
  mockPsalm23,
} from '../data/verses';

// Base API URL - matches the generated SDK default
// API Base URL - matches the generated client default
const API_BASE_URL = 'http://localhost:4000';

export const verseHandlers = [
  // GET /api/verses/daily - Get verse of the day
  // NOTE: This must come BEFORE /api/verses/:id to avoid route collision
  http.get(`${API_BASE_URL}/api/verses/daily`, () => {
    return HttpResponse.json({
      verse: mockJohn316,
      date: new Date().toISOString().split('T')[0],
    });
  }),

  // GET /api/verses/:id - Get a single verse by ID
  http.get(`${API_BASE_URL}/api/verses/:id`, ({ params }) => {
    const { id } = params;

    // Return specific mock verses based on ID
    if (id === 'john-3-16') {
      return HttpResponse.json(mockJohn316);
    }
    if (id === 'psalm-23-1') {
      return HttpResponse.json(mockPsalm23);
    }
    if (id === 'genesis-1-1') {
      return HttpResponse.json(mockGenesis11);
    }

    // Default verse for unknown IDs
    return HttpResponse.json(createMockVerse({ id: id as string }));
  }),

  // GET /api/verses - Get verses by book/chapter
  http.get(`${API_BASE_URL}/api/verses`, ({ request }) => {
    const url = new URL(request.url);
    const book = url.searchParams.get('book');
    const chapter = url.searchParams.get('chapter');

    if (!book || !chapter) {
      return HttpResponse.json({ error: 'Book and chapter are required' }, { status: 400 });
    }

    // Return a list of verses for the requested chapter
    const verses = createMockVerseList(10).map((verse, index) => ({
      ...verse,
      id: `${book.toLowerCase()}-${chapter}-${index + 1}`,
      book,
      chapter: Number.parseInt(chapter, 10),
      verse: index + 1,
    }));

    return HttpResponse.json({ verses });
  }),

  // POST /api/verses/search - Search verses by text
  http.post(`${API_BASE_URL}/api/verses/search`, async ({ request }) => {
    const body = (await request.json()) as { query: string; translation?: string };

    if (!body.query) {
      return HttpResponse.json({ error: 'Search query is required' }, { status: 400 });
    }

    // Return mock search results
    const results = [mockJohn316, mockPsalm23, mockGenesis11].filter((verse) =>
      verse.text.toLowerCase().includes(body.query.toLowerCase())
    );

    return HttpResponse.json({
      results,
      total: results.length,
      query: body.query,
    });
  }),
];
