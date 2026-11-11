/**
 * MSW handler for GET /bible/search (verse search).
 */

import { HttpResponse, http } from 'msw';
import { resolveApiBaseUrl } from '@/lib/api/base-url';

const SEARCH_URL = `${resolveApiBaseUrl()}/bible/search`;

export const mockEastAndWest = {
  results: [
    {
      match: 'exact',
      bookId: 40,
      bookName: 'Matthew',
      chapter: 8,
      verse: 11,
      text: 'I say to you that many will come from east and west, and recline',
      highlights: [
        [38, 42],
        [43, 46],
        [47, 51],
      ],
    },
    {
      match: 'words',
      bookId: 19,
      bookName: 'Psalms',
      chapter: 103,
      verse: 12,
      text: 'As far as the east is from the west',
      highlights: [
        [14, 18],
        [31, 35],
      ],
    },
  ],
  nextCursor: null,
  totals: { exact: 1, words: 1 },
  books: [
    { bookId: 19, name: 'Psalms', testament: 'OT', count: 1 },
    { bookId: 40, name: 'Matthew', testament: 'NT', count: 1 },
  ],
};

export const bibleSearchHandlers = [
  http.get(SEARCH_URL, ({ request }) => {
    const q = new URL(request.url).searchParams.get('q') ?? '';
    if (q.trim() === 'east and west') return HttpResponse.json(mockEastAndWest);
    return HttpResponse.json({
      results: [],
      nextCursor: null,
      totals: { exact: 0, words: 0 },
      books: [],
    });
  }),
];
