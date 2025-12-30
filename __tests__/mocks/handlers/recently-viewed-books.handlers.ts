/**
 * MSW Handlers for Recently Viewed Books API
 *
 * Mock handlers for recently viewed books endpoints:
 * - GET /user/recently-viewed-books
 * - POST /user/recently-viewed-books/sync
 */

import { HttpResponse, http } from 'msw';
import type {
  GetUserRecentlyViewedBooksResponse,
  PostUserRecentlyViewedBooksSyncData,
  PostUserRecentlyViewedBooksSyncResponse,
} from '@/src/api/generated/types.gen';

// API Base URL - matches the generated client default
const API_BASE_URL = 'http://localhost:4000';

/**
 * In-memory store for recently viewed books
 * Structure: Map<userId, Array<{bookId: string, timestamp: number}>>
 */
const recentlyViewedStore = new Map<string, { bookId: string; timestamp: number }[]>();

/**
 * Helper to reset recently viewed store to initial state
 */
export function resetRecentlyViewedStore() {
  recentlyViewedStore.clear();
}

/**
 * Helper to set recently viewed books for a user (for test setup)
 */
export function setRecentlyViewedBooksForUser(
  userId: string,
  books: { bookId: string; timestamp: number }[]
) {
  recentlyViewedStore.set(userId, books);
}

/**
 * Helper to get recently viewed books for a user
 */
export function getRecentlyViewedBooksForUser(userId: string) {
  return recentlyViewedStore.get(userId) || [];
}

/**
 * GET /user/recently-viewed-books
 * Returns user's recently viewed books (max 4, ordered by most recent)
 */
export const getUserRecentlyViewedBooksHandler = http.get(
  `${API_BASE_URL}/user/recently-viewed-books`,
  ({ request }) => {
    // Extract user ID from Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return HttpResponse.json({ message: 'Authentication required', data: null }, { status: 401 });
    }

    // For testing, we'll use a default user ID
    // In real implementation, this would be extracted from the JWT token
    const userId = 'test-user-id';

    const userBooks = recentlyViewedStore.get(userId) || [];

    // Sort by timestamp (most recent first) and limit to 4
    const sortedBooks = [...userBooks].sort((a, b) => b.timestamp - a.timestamp).slice(0, 4);

    const response: GetUserRecentlyViewedBooksResponse = {
      bookIds: sortedBooks.map((book) => book.bookId),
    };

    return HttpResponse.json(response);
  }
);

/**
 * POST /user/recently-viewed-books/sync
 * Syncs recently viewed books from client with backend
 * Merges local and backend data, keeping most recent timestamps
 */
export const postUserRecentlyViewedBooksSyncHandler = http.post(
  `${API_BASE_URL}/user/recently-viewed-books/sync`,
  async ({ request }) => {
    // Extract user ID from Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return HttpResponse.json({ message: 'Authentication required', data: null }, { status: 401 });
    }

    const body = (await request.json()) as PostUserRecentlyViewedBooksSyncData['body'];

    // Validate request body
    if (!body?.books || !Array.isArray(body.books)) {
      return HttpResponse.json({ message: 'Invalid request body', data: null }, { status: 400 });
    }

    // For testing, we'll use a default user ID
    const userId = 'test-user-id';

    // Get current books from store
    const currentBooks = recentlyViewedStore.get(userId) || [];

    // Create a map to track the most recent timestamp for each book
    const bookMap = new Map<string, number>();

    // Add existing books to map
    for (const book of currentBooks) {
      bookMap.set(book.bookId, book.timestamp);
    }

    // Merge with incoming books, keeping most recent timestamp
    for (const book of body.books) {
      const existingTimestamp = bookMap.get(book.bookId);
      if (!existingTimestamp || book.timestamp > existingTimestamp) {
        bookMap.set(book.bookId, book.timestamp);
      }
    }

    // Convert map back to array and sort by timestamp
    const mergedBooks = Array.from(bookMap.entries())
      .map(([bookId, timestamp]) => ({ bookId, timestamp }))
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 4); // Limit to 4 books

    // Update store
    recentlyViewedStore.set(userId, mergedBooks);

    // Return merged book IDs
    const response: PostUserRecentlyViewedBooksSyncResponse = {
      bookIds: mergedBooks.map((book) => book.bookId),
    };

    return HttpResponse.json(response);
  }
);

/**
 * Export all handlers
 */
export const recentlyViewedBooksHandlers = [
  getUserRecentlyViewedBooksHandler,
  postUserRecentlyViewedBooksSyncHandler,
];
