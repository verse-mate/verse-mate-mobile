/**
 * Mock Data for Bookmark API
 *
 * Sample bookmarked chapters for testing bookmark functionality
 */

import type { GetBibleBookBookmarksByUserIdResponse } from '@/src/api/generated/types.gen';

/**
 * Mock user ID for testing
 */
export const MOCK_USER_ID = 'test-user-123';

/**
 * Sample bookmarked chapters
 * Genesis 1, John 3, Psalms 23, Matthew 5
 */
export const mockBookmarks: GetBibleBookBookmarksByUserIdResponse['favorites'] = [
  {
    favorite_id: 1,
    chapter_number: 1,
    book_id: 1,
    book_name: 'Genesis',
  },
  {
    favorite_id: 2,
    chapter_number: 3,
    book_id: 43,
    book_name: 'John',
  },
  {
    favorite_id: 3,
    chapter_number: 23,
    book_id: 19,
    book_name: 'Psalms',
  },
  {
    favorite_id: 4,
    chapter_number: 5,
    book_id: 40,
    book_name: 'Matthew',
  },
];

/**
 * Full response structure for GET bookmarks
 */
export const mockBookmarksResponse: GetBibleBookBookmarksByUserIdResponse = {
  favorites: mockBookmarks,
};

/**
 * Empty bookmarks response for new users
 */
export const mockEmptyBookmarksResponse: GetBibleBookBookmarksByUserIdResponse = {
  favorites: [],
};
