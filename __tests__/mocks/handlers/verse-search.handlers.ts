/**
 * MSW handler for GET /bible/search (verse-text search in the Search sheet).
 *
 * Answers every query with one result from the requested book (or Psalms),
 * echoing `q` and `book` so tests can see what was asked.
 */

import { HttpResponse, http } from 'msw';

const BASE_URLS = ['http://localhost:4000', 'https://api.versemate.org'];

export const verseSearchHandlers = BASE_URLS.map((base) =>
  http.get(`${base}/bible/search`, ({ request }) => {
    const url = new URL(request.url);
    const q = url.searchParams.get('q') ?? '';
    const book = Number(url.searchParams.get('book') ?? 19);
    return HttpResponse.json({
      results: [
        {
          match: 'exact',
          bookId: book,
          bookName: book === 19 ? 'Psalms' : `Book ${book}`,
          chapter: 1,
          verse: 1,
          text: `A verse about ${q.trim()}`,
          highlights: [[14, 14 + q.trim().length]],
        },
      ],
      nextCursor: null,
      totals: { exact: 1, words: 0 },
      books: [{ bookId: book, name: 'Psalms', testament: 'OT', count: 1 }],
    });
  })
);
