/**
 * MSW Handlers for Bible API
 *
 * Mock handlers for all Bible-related endpoints
 */

import { HttpResponse, http } from 'msw';
import type {
  GetBibleChapterResponse,
  GetBibleExplanationResponse,
  GetBibleTestamentsResponse,
  GetLastReadRequest,
  GetLastReadResponse,
  SaveLastReadRequest,
} from '../../../src/api/generated';
import { mockTestamentBooks } from '../data/bible-books.data';
import { mockGenesis1Response, mockGenesis1Summary } from '../data/genesis-1.data';
import { mockMatthew5Response } from '../data/matthew-5.data';

// API Base URL - matches the generated SDK default
// Use localhost for tests since the generated client.gen.ts uses http://localhost:4000
const BIBLE_API_BASE_URL = 'http://localhost:4000';

/**
 * GET /bible/testaments
 * Returns all 66 Bible books with metadata
 */
export const getBibleTestamentsHandler = http.get(`${BIBLE_API_BASE_URL}/bible/testaments`, () => {
  // Transform BookMetadata back to API format
  const testaments = mockTestamentBooks.map((book) => ({
    b: book.id,
    n: book.name,
    t: book.testament,
    g: book.genre,
    c: book.chapterCount,
  }));

  const response: GetBibleTestamentsResponse = {
    testaments,
  };

  return HttpResponse.json(response);
});

/**
 * GET /bible/book/:bookId/:chapterNumber
 * Returns a single Bible chapter
 */
export const getBibleChapterHandler = http.get(
  `${BIBLE_API_BASE_URL}/bible/book/:bookId/:chapterNumber`,
  ({ params }) => {
    const { bookId, chapterNumber } = params;
    const bookIdNum = Number(bookId);
    const chapterNum = Number(chapterNumber);

    // Return mock data for known chapters
    if (bookIdNum === 1 && chapterNum === 1) {
      return HttpResponse.json(mockGenesis1Response);
    }

    if (bookIdNum === 40 && chapterNum === 5) {
      return HttpResponse.json(mockMatthew5Response);
    }

    // Generic response for other chapters
    const book = mockTestamentBooks.find((b) => b.id === bookIdNum);

    if (!book) {
      return HttpResponse.json({ error: 'Book not found' }, { status: 404 });
    }

    if (chapterNum < 1 || chapterNum > book.chapterCount) {
      return HttpResponse.json({ error: 'Chapter not found' }, { status: 404 });
    }

    const response: GetBibleChapterResponse = {
      book: {
        bookId: book.id,
        name: book.name,
        testament: book.testament,
        genre: {
          g: book.genre,
          n: book.genre === 1 ? 'Law' : book.genre === 5 ? 'Gospels' : 'Unknown',
        },
        chapters: [
          {
            chapterNumber: chapterNum,
            subtitles: [
              {
                subtitle: `${book.name} ${chapterNum} Content`,
                start_verse: 1,
                end_verse: 10,
              },
            ],
            verses: Array.from({ length: 10 }, (_, i) => ({
              verseNumber: i + 1,
              text: `This is verse ${i + 1} of ${book.name} chapter ${chapterNum}.`,
            })),
          },
        ],
      },
    };

    return HttpResponse.json(response);
  }
);

/**
 * GET /bible/book/explanation/:bookId/:chapterNumber
 * Returns AI-generated explanation
 */
export const getBibleExplanationHandler = http.get(
  `${BIBLE_API_BASE_URL}/bible/book/explanation/:bookId/:chapterNumber`,
  ({ params, request }) => {
    const { bookId, chapterNumber } = params;
    const url = new URL(request.url);
    const explanationType = url.searchParams.get('explanationType') || 'summary';

    const bookIdNum = Number(bookId);
    const chapterNum = Number(chapterNumber);

    // Return mock summary for Genesis 1
    if (bookIdNum === 1 && chapterNum === 1) {
      return HttpResponse.json(mockGenesis1Summary);
    }

    // Generic explanation for other chapters
    const book = mockTestamentBooks.find((b) => b.id === bookIdNum);

    if (!book) {
      return HttpResponse.json({ error: 'Book not found' }, { status: 404 });
    }

    const response: GetBibleExplanationResponse = {
      explanation: {
        book_id: bookIdNum,
        chapter_number: chapterNum,
        type: explanationType,
        explanation: `# ${explanationType} of ${book.name} ${chapterNum}\n\nThis is a mock ${explanationType} explanation for testing purposes.`,
        explanation_id: Math.floor(Math.random() * 100000),
        language_code: 'en-US',
      },
    };

    return HttpResponse.json(response);
  }
);

/**
 * POST /bible/book/chapter/save-last-read
 * Saves user's last read position
 */
export const saveLastReadHandler = http.post(
  `${BIBLE_API_BASE_URL}/bible/book/chapter/save-last-read`,
  async ({ request }) => {
    const body = (await request.json()) as SaveLastReadRequest;

    // Validate request
    if (!body.user_id || !body.book_id || !body.chapter_number) {
      return HttpResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Success response (API returns empty 200)
    return HttpResponse.json({ success: true });
  }
);

/**
 * POST /bible/book/chapter/last-read
 * Gets user's last read position
 */
let mockLastReadPosition: { book_id: number; chapter_number: number } | null = null;

export const getLastReadHandler = http.post(
  `${BIBLE_API_BASE_URL}/bible/book/chapter/last-read`,
  async ({ request }) => {
    const body = (await request.json()) as GetLastReadRequest;

    if (!body.user_id) {
      return HttpResponse.json({ error: 'Missing user_id' }, { status: 400 });
    }

    // Return mock last read position or default to Genesis 1
    const response: GetLastReadResponse = {
      result: mockLastReadPosition || {
        book_id: 1,
        chapter_number: 1,
        bookName: 'Genesis',
        chapterNumber: 1,
        testament: 'OT',
        explanation: [],
      },
    };

    return HttpResponse.json(response);
  }
);

/**
 * Helper to set mock last read position in tests
 */
export function setMockLastReadPosition(bookId: number, chapterNumber: number) {
  mockLastReadPosition = {
    book_id: bookId,
    chapter_number: chapterNumber,
  };
}

/**
 * Helper to clear mock last read position
 */
export function clearMockLastReadPosition() {
  mockLastReadPosition = null;
}

/**
 * All Bible API handlers
 */
export const bibleHandlers = [
  getBibleTestamentsHandler,
  getBibleChapterHandler,
  getBibleExplanationHandler,
  saveLastReadHandler,
  getLastReadHandler,
];
