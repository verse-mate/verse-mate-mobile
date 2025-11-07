/**
 * MSW Handlers for Highlight API
 *
 * Mock handlers for all highlight-related endpoints with overlap detection
 */

import { HttpResponse, http } from 'msw';
import type {
  DeleteBibleHighlightByHighlightIdData,
  DeleteBibleHighlightByHighlightIdResponse,
  GetBibleHighlightsByUserIdByBookIdByChapterNumberResponse,
  GetBibleHighlightsByUserIdResponse,
  PostBibleHighlightAddData,
  PostBibleHighlightAddResponse,
  PutBibleHighlightByHighlightIdData,
  PutBibleHighlightByHighlightIdResponse,
} from '@/src/api/generated/types.gen';
import { MOCK_USER_ID, mockHighlightsResponse } from '../data/highlights.data';

// API Base URL - matches the generated client default
const BIBLE_API_BASE_URL = 'https://api.verse-mate.apegro.dev';

/**
 * In-memory highlight store for testing
 * This allows tests to add/remove/update highlights and see the changes
 */
let highlightStore = [...mockHighlightsResponse.highlights];
let nextHighlightId = Math.max(...highlightStore.map((h) => h.highlight_id)) + 1;

/**
 * Helper to reset highlight store to initial state
 */
export function resetHighlightStore() {
  highlightStore = [...mockHighlightsResponse.highlights];
  nextHighlightId = Math.max(...highlightStore.map((h) => h.highlight_id)) + 1;
}

/**
 * Helper to clear all highlights
 */
export function clearHighlightStore() {
  highlightStore = [];
  nextHighlightId = 1;
}

/**
 * Helper to add highlight to store (for test setup)
 */
export function addToHighlightStore(
  userId: string,
  chapterId: number,
  startVerse: number,
  endVerse: number,
  color: 'yellow' | 'green' | 'blue' | 'pink' | 'purple' | 'orange',
  selectedText: string,
  startChar?: number,
  endChar?: number
) {
  highlightStore.push({
    highlight_id: nextHighlightId++,
    user_id: userId,
    chapter_id: chapterId,
    start_verse: startVerse,
    end_verse: endVerse,
    color,
    start_char: startChar ?? null,
    end_char: endChar ?? null,
    selected_text: selectedText,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
}

/**
 * Check if a new highlight overlaps with existing highlights
 * Backend uses sophisticated detection: character-level for single-verse, verse-level for multi-verse
 */
function checkOverlap(
  chapterId: number,
  startVerse: number,
  endVerse: number,
  startChar?: number,
  endChar?: number
): boolean {
  const chapterHighlights = highlightStore.filter((h) => h.chapter_id === chapterId);

  return chapterHighlights.some((h) => {
    // Check verse range overlap
    const verseOverlap = h.start_verse <= endVerse && h.end_verse >= startVerse;
    if (!verseOverlap) return false;

    // For single-verse highlights with character positions, check character overlap
    if (
      startVerse === endVerse &&
      h.start_verse === h.end_verse &&
      h.start_verse === startVerse &&
      startChar !== undefined &&
      endChar !== undefined &&
      h.start_char !== null &&
      h.end_char !== null
    ) {
      return (h.start_char as number) < endChar && (h.end_char as number) > startChar;
    }

    // For multi-verse or verse-level, any verse overlap is a conflict
    return true;
  });
}

/**
 * GET /bible/highlights/:user_id
 * Returns all highlights for a user
 */
export const getHighlightsByUserIdHandler = http.get(
  `${BIBLE_API_BASE_URL}/bible/highlights/:user_id`,
  ({ params }) => {
    const { user_id } = params;

    // Validate user_id
    if (!user_id) {
      return HttpResponse.json({ message: 'User ID is required', data: null }, { status: 400 });
    }

    // Return highlights for the user
    const userHighlights = highlightStore.filter((h) => h.user_id === user_id);
    const response: GetBibleHighlightsByUserIdResponse = {
      highlights: userHighlights,
    };

    return HttpResponse.json(response);
  }
);

/**
 * GET /bible/highlights/:user_id/:book_id/:chapter_number
 * Returns chapter-specific highlights
 */
export const getHighlightsByChapterHandler = http.get(
  `${BIBLE_API_BASE_URL}/bible/highlights/:user_id/:book_id/:chapter_number`,
  ({ params }) => {
    const { user_id, book_id, chapter_number } = params;

    // Validate params
    if (!user_id || !book_id || !chapter_number) {
      return HttpResponse.json(
        { message: 'User ID, book ID, and chapter number are required', data: null },
        { status: 400 }
      );
    }

    // Calculate chapter_id from book_id and chapter_number
    const bookIdNum = Number(book_id);
    const chapterNum = Number(chapter_number);
    const chapterId = bookIdNum * 1000 + chapterNum;

    // Return highlights for the chapter
    const chapterHighlights = highlightStore.filter(
      (h) => h.user_id === user_id && h.chapter_id === chapterId
    );

    const response: GetBibleHighlightsByUserIdByBookIdByChapterNumberResponse = {
      highlights: chapterHighlights,
    };

    return HttpResponse.json(response);
  }
);

/**
 * POST /bible/highlight/add
 * Adds a highlight with overlap detection
 */
export const addHighlightHandler = http.post(
  `${BIBLE_API_BASE_URL}/bible/highlight/add`,
  async ({ request }) => {
    const body = (await request.json()) as PostBibleHighlightAddData['body'];

    // Validate request
    if (
      !body.user_id ||
      !body.book_id ||
      !body.chapter_number ||
      body.start_verse === undefined ||
      body.end_verse === undefined
    ) {
      return HttpResponse.json({ message: 'Missing required fields', data: null }, { status: 400 });
    }

    // Calculate chapter_id
    const chapterId = body.book_id * 1000 + body.chapter_number;

    // Check for overlap
    const hasOverlap = checkOverlap(
      chapterId,
      body.start_verse,
      body.end_verse,
      body.start_char,
      body.end_char
    );

    if (hasOverlap) {
      return HttpResponse.json(
        {
          message: 'Highlight overlaps with existing highlight',
          data: { overlap: true },
        },
        { status: 400 }
      );
    }

    // Add highlight to store
    const newHighlight: GetBibleHighlightsByUserIdResponse['highlights'][number] = {
      highlight_id: nextHighlightId++,
      user_id: body.user_id,
      chapter_id: chapterId,
      start_verse: body.start_verse,
      end_verse: body.end_verse,
      color: body.color || 'yellow',
      start_char: body.start_char ?? null,
      end_char: body.end_char ?? null,
      selected_text: body.selected_text ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    highlightStore.push(newHighlight);

    const response: PostBibleHighlightAddResponse = {
      highlight: newHighlight,
      success: true,
    };

    return HttpResponse.json(response);
  }
);

/**
 * PUT /bible/highlight/:highlight_id
 * Updates highlight color
 */
export const updateHighlightColorHandler = http.put(
  `${BIBLE_API_BASE_URL}/bible/highlight/:highlight_id`,
  async ({ params, request }) => {
    const { highlight_id } = params;
    const body = (await request.json()) as PutBibleHighlightByHighlightIdData['body'];

    // Validate request
    if (!highlight_id || !body.user_id || !body.color) {
      return HttpResponse.json({ message: 'Missing required fields', data: null }, { status: 400 });
    }

    const highlightIdNum = Number(highlight_id);

    // Find highlight
    const highlightIndex = highlightStore.findIndex((h) => h.highlight_id === highlightIdNum);

    if (highlightIndex === -1) {
      return HttpResponse.json({ message: 'Highlight not found', data: null }, { status: 404 });
    }

    // Update color
    highlightStore[highlightIndex] = {
      ...highlightStore[highlightIndex],
      color: body.color,
      updated_at: new Date().toISOString(),
    };

    const response: PutBibleHighlightByHighlightIdResponse = {
      highlight: highlightStore[highlightIndex],
      success: true,
    };

    return HttpResponse.json(response);
  }
);

/**
 * DELETE /bible/highlight/:highlight_id
 * Deletes a highlight
 */
export const deleteHighlightHandler = http.delete(
  `${BIBLE_API_BASE_URL}/bible/highlight/:highlight_id`,
  ({ params }) => {
    const { highlight_id } = params;

    // Validate request
    if (!highlight_id) {
      return HttpResponse.json(
        { message: 'Highlight ID is required', data: null },
        { status: 400 }
      );
    }

    const highlightIdNum = Number(highlight_id);

    // Find and remove highlight
    const index = highlightStore.findIndex((h) => h.highlight_id === highlightIdNum);

    if (index !== -1) {
      highlightStore.splice(index, 1);
    }

    const response: DeleteBibleHighlightByHighlightIdResponse = {
      success: true,
    };

    return HttpResponse.json(response);
  }
);

/**
 * All highlight API handlers
 */
export const highlightHandlers = [
  getHighlightsByUserIdHandler,
  getHighlightsByChapterHandler,
  addHighlightHandler,
  updateHighlightColorHandler,
  deleteHighlightHandler,
];
