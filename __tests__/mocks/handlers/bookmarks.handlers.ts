/**
 * MSW Handlers for Bookmark API
 *
 * Mock handlers for all bookmark-related endpoints
 */

import { HttpResponse, http } from 'msw';
import type {
  AugmentedBookmark,
  AugmentedBookmarksResponse,
} from '@/src/api/generated/types.augment';
import type {
  DeleteBibleBookBookmarkRemoveData,
  DeleteBibleBookBookmarkRemoveResponse,
  GetBibleBookBookmarksByUserIdResponse,
  PostBibleBookBookmarkAddData,
  PostBibleBookBookmarkAddResponse,
} from '@/src/api/generated/types.gen';
import { MOCK_USER_ID, mockBookmarksResponse } from '../data/bookmarks.data';

// API Base URL - matches the generated client default
const BIBLE_API_BASE_URL = 'http://localhost:4000';

/**
 * In-memory bookmark store for testing
 * This allows tests to add/remove bookmarks and see the changes
 */
let bookmarkStore: AugmentedBookmark[] = [...mockBookmarksResponse.favorites];
let nextFavoriteId = Math.max(...bookmarkStore.map((b) => b.favorite_id)) + 1;

/**
 * Helper to reset bookmark store to initial state
 */
export function resetBookmarkStore() {
  bookmarkStore = [...mockBookmarksResponse.favorites];
  nextFavoriteId = Math.max(...bookmarkStore.map((b) => b.favorite_id)) + 1;
}

/**
 * Helper to clear all bookmarks
 */
export function clearBookmarkStore() {
  bookmarkStore = [];
  nextFavoriteId = 1;
}

/**
 * Helper to add bookmark to store (for test setup)
 */
export function addToBookmarkStore(
  bookId: number,
  chapterNumber: number,
  bookName: string,
  insightType?: string
) {
  const existingIndex = bookmarkStore.findIndex((b) => {
    if (b.book_id !== bookId || b.chapter_number !== chapterNumber) {
      return false;
    }
    // Normalize: treat null, undefined, and empty string as equivalent
    const storeInsightType = b.insight_type || undefined;
    const newInsightType = insightType || undefined;
    return storeInsightType === newInsightType;
  });

  if (existingIndex === -1) {
    bookmarkStore.push({
      favorite_id: nextFavoriteId++,
      chapter_number: chapterNumber,
      book_id: bookId,
      book_name: bookName,
      insight_type: insightType || undefined,
    });
  }
}

/**
 * GET /bible/book/bookmarks/:user_id
 * Returns user's bookmarked chapters
 */
export const getBookmarksByUserIdHandler = http.get(
  `${BIBLE_API_BASE_URL}/bible/book/bookmarks/:user_id`,
  ({ params }) => {
    const { user_id } = params;

    // Validate user_id
    if (!user_id) {
      return HttpResponse.json({ message: 'User ID is required', data: null }, { status: 400 });
    }

    // Return bookmarks for the user
    const response: AugmentedBookmarksResponse = {
      favorites: bookmarkStore,
    };

    return HttpResponse.json(response);
  }
);

/**
 * POST /bible/book/bookmark/add
 * Adds a bookmark for a chapter
 */
export const addBookmarkHandler = http.post(
  `${BIBLE_API_BASE_URL}/bible/book/bookmark/add`,
  async ({ request }) => {
    const body = (await request.json()) as PostBibleBookBookmarkAddData['body'];

    // Validate request
    if (!body.user_id || !body.book_id || !body.chapter_number) {
      return HttpResponse.json({ message: 'Missing required fields', data: null }, { status: 400 });
    }

    // Check if bookmark already exists
    const existingIndex = bookmarkStore.findIndex((b) => {
      if (b.book_id !== body.book_id || b.chapter_number !== body.chapter_number) {
        return false;
      }
      // Normalize: treat null, undefined, and empty string as equivalent
      const storeInsightType = b.insight_type || undefined;
      const bodyInsightType = body.insight_type || undefined;
      return storeInsightType === bodyInsightType;
    });

    if (existingIndex !== -1) {
      // Bookmark already exists, return success anyway
      const response: PostBibleBookBookmarkAddResponse = {
        success: true,
      };
      return HttpResponse.json(response);
    }

    // Add bookmark to store
    // Note: In real API, book_name would be looked up from the database
    // For testing, we'll use a generic name based on book_id
    const bookNames: Record<number, string> = {
      1: 'Genesis',
      19: 'Psalms',
      40: 'Matthew',
      43: 'John',
    };

    bookmarkStore.push({
      favorite_id: nextFavoriteId++,
      chapter_number: body.chapter_number,
      book_id: body.book_id,
      book_name: bookNames[body.book_id] || `Book ${body.book_id}`,
      insight_type: body.insight_type || undefined,
    });

    const response: PostBibleBookBookmarkAddResponse = {
      success: true,
    };

    return HttpResponse.json(response);
  }
);

/**
 * DELETE /bible/book/bookmark/remove
 * Removes a bookmark
 */
export const removeBookmarkHandler = http.delete(
  `${BIBLE_API_BASE_URL}/bible/book/bookmark/remove`,
  ({ request }) => {
    const url = new URL(request.url);
    const user_id = url.searchParams.get('user_id');
    const book_id = url.searchParams.get('book_id');
    const chapter_number = url.searchParams.get('chapter_number');
    const insight_type = url.searchParams.get('insight_type');

    // Validate request
    if (!user_id || !book_id || !chapter_number) {
      return HttpResponse.json(
        { message: 'Missing required query parameters', data: null },
        { status: 400 }
      );
    }

    // Remove bookmark from store
    const bookIdNum = Number(book_id);
    const chapterNum = Number(chapter_number);

    const index = bookmarkStore.findIndex((b) => {
      // Match book and chapter
      if (b.book_id !== bookIdNum || b.chapter_number !== chapterNum) {
        return false;
      }

      // For insight_type, treat null, undefined, and empty string as equivalent
      const storeInsightType = b.insight_type || undefined;
      const queryInsightType = insight_type || undefined;
      return storeInsightType === queryInsightType;
    });

    if (index !== -1) {
      bookmarkStore.splice(index, 1);
    }

    const response: DeleteBibleBookBookmarkRemoveResponse = {
      success: true,
    };

    return HttpResponse.json(response);
  }
);

/**
 * All bookmark API handlers
 */
export const bookmarkHandlers = [
  getBookmarksByUserIdHandler,
  addBookmarkHandler,
  removeBookmarkHandler,
];
