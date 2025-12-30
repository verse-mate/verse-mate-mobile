/**
 * Bookmark API Integration Tests
 *
 * Focused tests for bookmark API operations.
 * Tests only critical behaviors: fetch bookmarks, add bookmark, remove bookmark, authentication.
 *
 * Limit: 2-8 highly focused tests maximum
 */

import { HttpResponse, http } from 'msw';
import type {
  DeleteBibleBookBookmarkRemoveResponse,
  GetBibleBookBookmarksByUserIdResponse,
  PostBibleBookBookmarkAddResponse,
} from '@/src/api/generated/types.gen';
import { MOCK_USER_ID, mockBookmarksResponse } from '../mocks/data/bookmarks.data';
import { clearBookmarkStore, resetBookmarkStore } from '../mocks/handlers/bookmarks.handlers';
import { server } from '../mocks/server';

// Match the MSW handler configuration and generated client baseUrl
const API_BASE_URL = 'http://localhost:4000';

describe('Bookmark API Integration', () => {
  beforeEach(() => {
    // Reset bookmark store to initial state before each test
    resetBookmarkStore();
  });

  // Test 1: Fetch bookmarks for a user
  describe('GET /bible/book/bookmarks/:user_id', () => {
    it('should fetch all bookmarks for a user', async () => {
      // Act
      const response = await fetch(`${API_BASE_URL}/bible/book/bookmarks/${MOCK_USER_ID}`);
      const data: GetBibleBookBookmarksByUserIdResponse = await response.json();

      // Assert
      expect(response.ok).toBe(true);
      expect(data.favorites).toEqual(mockBookmarksResponse.favorites);
      expect(data.favorites).toHaveLength(4);
      expect(data.favorites[0]).toMatchObject({
        favorite_id: expect.any(Number),
        chapter_number: expect.any(Number),
        book_id: expect.any(Number),
        book_name: expect.any(String),
      });
    });
  });

  // Test 2: Add a bookmark
  describe('POST /bible/book/bookmark/add', () => {
    it('should successfully add a new bookmark', async () => {
      // Arrange
      clearBookmarkStore(); // Start with empty bookmarks

      // Act - Add a bookmark
      const addResponse = await fetch(`${API_BASE_URL}/bible/book/bookmark/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: MOCK_USER_ID,
          book_id: 1,
          chapter_number: 1,
        }),
      });
      const addData: PostBibleBookBookmarkAddResponse = await addResponse.json();

      // Assert - Add was successful
      expect(addResponse.ok).toBe(true);
      expect(addData.success).toBe(true);

      // Verify bookmark was added by fetching bookmarks
      const fetchResponse = await fetch(`${API_BASE_URL}/bible/book/bookmarks/${MOCK_USER_ID}`);
      const fetchData: GetBibleBookBookmarksByUserIdResponse = await fetchResponse.json();
      expect(fetchData.favorites).toHaveLength(1);
      expect(fetchData.favorites[0]).toMatchObject({
        book_id: 1,
        chapter_number: 1,
        book_name: 'Genesis',
      });
    });

    it('should return 400 when required fields are missing', async () => {
      // Act
      const response = await fetch(`${API_BASE_URL}/bible/book/bookmark/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: MOCK_USER_ID }), // Missing book_id and chapter_number
      });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(data.message).toBe('Missing required fields');
    });
  });

  // Test 3: Remove a bookmark
  describe('DELETE /bible/book/bookmark/remove', () => {
    it('should successfully remove an existing bookmark', async () => {
      // Arrange - Add a bookmark first
      await fetch(`${API_BASE_URL}/bible/book/bookmark/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: MOCK_USER_ID,
          book_id: 1,
          chapter_number: 1,
        }),
      });

      // Act - Remove the bookmark
      const removeResponse = await fetch(
        `${API_BASE_URL}/bible/book/bookmark/remove?user_id=${MOCK_USER_ID}&book_id=1&chapter_number=1`,
        {
          method: 'DELETE',
        }
      );
      const removeData: DeleteBibleBookBookmarkRemoveResponse = await removeResponse.json();

      // Assert - Remove was successful
      expect(removeResponse.ok).toBe(true);
      expect(removeData.success).toBe(true);

      // Verify bookmark was removed by fetching bookmarks
      const fetchResponse = await fetch(`${API_BASE_URL}/bible/book/bookmarks/${MOCK_USER_ID}`);
      const fetchData: GetBibleBookBookmarksByUserIdResponse = await fetchResponse.json();
      const hasBookmark = fetchData.favorites.some(
        (b) => b.book_id === 1 && b.chapter_number === 1
      );
      expect(hasBookmark).toBe(false);
    });

    it('should return 400 when query parameters are missing', async () => {
      // Act
      const response = await fetch(
        `${API_BASE_URL}/bible/book/bookmark/remove?user_id=${MOCK_USER_ID}`,
        {
          method: 'DELETE',
        }
      );
      const data = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(data.message).toBe('Missing required query parameters');
    });
  });

  // Test 4: Bookmark persistence across add/remove operations
  describe('Bookmark State Management', () => {
    it('should maintain correct state after multiple add/remove operations', async () => {
      // Arrange - Start with empty bookmarks
      clearBookmarkStore();

      // Act - Add multiple bookmarks
      await fetch(`${API_BASE_URL}/bible/book/bookmark/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: MOCK_USER_ID,
          book_id: 1,
          chapter_number: 1,
        }),
      });
      await fetch(`${API_BASE_URL}/bible/book/bookmark/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: MOCK_USER_ID,
          book_id: 40,
          chapter_number: 5,
        }),
      });

      // Assert - Should have 2 bookmarks
      let fetchResponse = await fetch(`${API_BASE_URL}/bible/book/bookmarks/${MOCK_USER_ID}`);
      let fetchData: GetBibleBookBookmarksByUserIdResponse = await fetchResponse.json();
      expect(fetchData.favorites).toHaveLength(2);

      // Act - Remove one bookmark
      await fetch(
        `${API_BASE_URL}/bible/book/bookmark/remove?user_id=${MOCK_USER_ID}&book_id=1&chapter_number=1`,
        {
          method: 'DELETE',
        }
      );

      // Assert - Should have 1 bookmark remaining
      fetchResponse = await fetch(`${API_BASE_URL}/bible/book/bookmarks/${MOCK_USER_ID}`);
      fetchData = await fetchResponse.json();
      expect(fetchData.favorites).toHaveLength(1);
      expect(fetchData.favorites[0]).toMatchObject({
        book_id: 40,
        chapter_number: 5,
      });
    });
  });

  // Test 5: Empty state handling
  describe('Empty Bookmarks', () => {
    it('should return empty array when user has no bookmarks', async () => {
      // Arrange
      clearBookmarkStore();

      // Act
      const response = await fetch(`${API_BASE_URL}/bible/book/bookmarks/${MOCK_USER_ID}`);
      const data: GetBibleBookBookmarksByUserIdResponse = await response.json();

      // Assert
      expect(response.ok).toBe(true);
      expect(data.favorites).toEqual([]);
      expect(data.favorites).toHaveLength(0);
    });
  });
});
