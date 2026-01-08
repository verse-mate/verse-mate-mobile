/**
 * Mock Bookmarks Utility
 *
 * Helper to create mock UseBookmarksResult objects for tests
 */

import type { UseBookmarksResult } from '@/hooks/bible/use-bookmarks';

/**
 * Creates a complete mock UseBookmarksResult with all required methods
 * Includes both chapter bookmarks and insight bookmarks
 */
export function createMockBookmarksResult(
  overrides: Partial<UseBookmarksResult> = {}
): UseBookmarksResult {
  return {
    bookmarks: [],
    isFetchingBookmarks: false,
    isAddingBookmark: false,
    isRemovingBookmark: false,
    isBookmarked: jest.fn(() => false),
    addBookmark: jest.fn(),
    removeBookmark: jest.fn(),
    isInsightBookmarked: jest.fn(() => false),
    addInsightBookmark: jest.fn(),
    removeInsightBookmark: jest.fn(),
    refetchBookmarks: jest.fn(),
    ...overrides,
  };
}
