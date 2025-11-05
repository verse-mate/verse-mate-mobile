/**
 * Bookmark Feature End-to-End Integration Tests
 *
 * Strategic tests to fill critical gaps in bookmark feature test coverage.
 * These tests focus on integration workflows and error scenarios not covered
 * by individual component/hook tests.
 *
 * Test Coverage:
 * 1. Complete bookmark flow: add → list → navigate → verify
 * 2. Remove bookmark API failure with rollback
 * 3. Rapid toggle (double-click) behavior
 * 4. Duplicate bookmark handling
 * 5. Network timeout during bookmark operation
 * 6. Empty bookmarks → add → verify appears in list
 * 7. Multiple bookmarks management (add/remove multiple)
 * 8. Bookmark toggle state persistence after navigation
 * 9. Auth-required bookmark operations
 * 10. Remove bookmark while viewing that chapter
 *
 * @see Task 7.3: Write up to 10 additional strategic tests maximum
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { HttpResponse, http } from 'msw';
import type { ReactNode } from 'react';
import { AuthProvider } from '@/contexts/AuthContext';
import { useBookmarks } from '@/hooks/bible/use-bookmarks';
import { MOCK_USER_ID } from '../mocks/data/bookmarks.data';
import { clearBookmarkStore, resetBookmarkStore } from '../mocks/handlers/bookmarks.handlers';
import { server } from '../mocks/server';

const API_BASE_URL = 'https://api.verse-mate.apegro.dev';
const TEST_USER_ID = 'user-1234567890';
const TEST_ACCESS_TOKEN = `mock-access-token-${TEST_USER_ID}`;

// Mock auth tokens
jest.mock('@/lib/auth/token-storage', () => ({
  getAccessToken: jest.fn().mockResolvedValue(TEST_ACCESS_TOKEN),
  getRefreshToken: jest.fn().mockResolvedValue(`mock-refresh-token-${TEST_USER_ID}`),
  setAccessToken: jest.fn().mockResolvedValue(undefined),
  setRefreshToken: jest.fn().mockResolvedValue(undefined),
  clearTokens: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/auth/token-refresh', () => ({
  setupProactiveRefresh: jest.fn(() => jest.fn()),
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: {
    Light: 'light',
  },
}));

describe('Bookmark Feature - End-to-End Integration Tests', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    resetBookmarkStore();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    // Override auth session handler to return our test user (must be in beforeEach for isolation)
    server.use(
      http.get(`${API_BASE_URL}/auth/session`, () => {
        return HttpResponse.json({
          id: TEST_USER_ID,
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
        });
      })
    );
  });

  afterEach(() => {
    // Clear all queries and mutations from the query client
    queryClient.clear();

    // Reset MSW handlers to restore the auth session handler
    server.restoreHandlers();
  });

  const createWrapper = () => {
    const Wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    );
    return Wrapper;
  };

  /**
   * Test 1: Complete bookmark workflow - add, list, navigate, verify
   * Gap: No test covers full user journey from add to navigation
   */
  it('should handle complete bookmark workflow: add → verify in list → navigate back', async () => {
    const { result } = renderHook(() => useBookmarks(), { wrapper: createWrapper() });

    // Wait for initial load
    await waitFor(() => {
      expect(result.current.isFetchingBookmarks).toBe(false);
    });

    const initialCount = result.current.bookmarks.length;

    // Step 1: Add bookmark for Psalms 1 (book_id: 19, chapter: 1) - not in initial data
    await act(async () => {
      await result.current.addBookmark(19, 1);
    });

    // Wait for mutation and refetch to complete
    await waitFor(() => {
      expect(result.current.isAddingBookmark).toBe(false);
      expect(result.current.isFetchingBookmarks).toBe(false);
    });

    // Step 2: Verify bookmark appears in list
    expect(result.current.bookmarks.length).toBe(initialCount + 1);
    expect(result.current.isBookmarked(19, 1)).toBe(true);

    // Step 3: Verify bookmark persists after refetch (simulating navigation)
    await act(async () => {
      await result.current.refetchBookmarks();
    });

    await waitFor(() => {
      expect(result.current.isFetchingBookmarks).toBe(false);
    });

    // Step 4: Bookmark should still be present
    expect(result.current.isBookmarked(19, 1)).toBe(true);
    const bookmark = result.current.bookmarks.find(
      (b) => b.book_id === 19 && b.chapter_number === 1
    );
    expect(bookmark).toBeDefined();
    expect(bookmark?.book_name).toBe('Psalms');
  });

  /**
   * Test 2: Remove bookmark API failure with proper rollback
   * Gap: Only add failure is tested, remove failure not covered
   */
  it('should rollback optimistic update when remove bookmark fails', async () => {
    const { result } = renderHook(() => useBookmarks(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isFetchingBookmarks).toBe(false);
    });

    // Genesis 1 is initially bookmarked
    const isGenesis1Bookmarked = result.current.bookmarks.some(
      (b) => b.book_id === 1 && b.chapter_number === 1
    );

    if (!isGenesis1Bookmarked) {
      // Add it first if not bookmarked
      await act(async () => {
        await result.current.addBookmark(1, 1);
      });

      await waitFor(() => {
        expect(result.current.isAddingBookmark).toBe(false);
        expect(result.current.isFetchingBookmarks).toBe(false);
      });
    }

    expect(result.current.isBookmarked(1, 1)).toBe(true);

    // Mock API failure for removing bookmark
    server.use(
      http.delete(`${API_BASE_URL}/bible/book/bookmark/remove`, () => {
        return HttpResponse.json({ message: 'Server error', data: null }, { status: 500 });
      })
    );

    // Try to remove bookmark (should fail and rollback)
    await act(async () => {
      try {
        await result.current.removeBookmark(1, 1);
      } catch (_e) {
        // Mutation error expected
      }
    });

    await waitFor(() => {
      expect(result.current.isRemovingBookmark).toBe(false);
    });

    // Should be rolled back (still bookmarked)
    expect(result.current.isBookmarked(1, 1)).toBe(true);
  });

  /**
   * Test 3: Rapid toggle (double-click) behavior
   * Gap: No test covers rapid sequential toggles
   */
  it('should handle rapid bookmark toggle without race conditions', async () => {
    const { result } = renderHook(() => useBookmarks(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isFetchingBookmarks).toBe(false);
    });

    // Rapid add then remove
    await act(async () => {
      const addPromise = result.current.addBookmark(50, 1);
      const removePromise = result.current.removeBookmark(50, 1);
      await Promise.all([addPromise, removePromise]);
    });

    await waitFor(() => {
      expect(result.current.isAddingBookmark).toBe(false);
      expect(result.current.isRemovingBookmark).toBe(false);
      expect(result.current.isFetchingBookmarks).toBe(false);
    });

    // Final state should be consistent (not bookmarked since remove was last)
    expect(result.current.isBookmarked(50, 1)).toBe(false);
  });

  /**
   * Test 4: Duplicate bookmark handling
   * Gap: No test verifies behavior when adding already-bookmarked chapter
   */
  it('should handle duplicate bookmark attempts gracefully', async () => {
    const { result } = renderHook(() => useBookmarks(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isFetchingBookmarks).toBe(false);
    });

    // Add bookmark
    await act(async () => {
      await result.current.addBookmark(40, 5);
    });

    await waitFor(() => {
      expect(result.current.isAddingBookmark).toBe(false);
      expect(result.current.isFetchingBookmarks).toBe(false);
    });

    expect(result.current.isBookmarked(40, 5)).toBe(true);
    const countAfterFirstAdd = result.current.bookmarks.length;

    // Try to add same bookmark again
    await act(async () => {
      await result.current.addBookmark(40, 5);
    });

    await waitFor(() => {
      expect(result.current.isAddingBookmark).toBe(false);
      expect(result.current.isFetchingBookmarks).toBe(false);
    });

    // Should not create duplicate (count should remain same)
    expect(result.current.bookmarks.length).toBe(countAfterFirstAdd);
    expect(result.current.isBookmarked(40, 5)).toBe(true);
  });

  /**
   * Test 5: Network timeout during bookmark operation
   * Gap: No test covers timeout scenarios
   */
  it('should handle network timeout during add bookmark operation', async () => {
    const { result } = renderHook(() => useBookmarks(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isFetchingBookmarks).toBe(false);
    });

    // Mock network delay/timeout
    server.use(
      http.post(`${API_BASE_URL}/bible/book/bookmark/add`, async () => {
        await new Promise((resolve) => setTimeout(resolve, 6000)); // Simulate timeout
        return HttpResponse.json({ success: false }, { status: 408 });
      })
    );

    // Try to add bookmark (should timeout)
    await act(async () => {
      try {
        await result.current.addBookmark(45, 8);
      } catch (_e) {
        // Timeout error expected
      }
    });

    await waitFor(
      () => {
        expect(result.current.isAddingBookmark).toBe(false);
      },
      { timeout: 7000 }
    );

    // Should rollback after timeout
    expect(result.current.isBookmarked(45, 8)).toBe(false);
  }, 10000); // Increase test timeout

  /**
   * Test 6: Empty bookmarks → add first → verify appears
   * Gap: Flow from empty state to first bookmark not explicitly tested
   */
  it('should transition from empty state to having bookmarks', async () => {
    clearBookmarkStore(); // Start with empty
    const { result } = renderHook(() => useBookmarks(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isFetchingBookmarks).toBe(false);
    });

    // Verify empty state
    expect(result.current.bookmarks).toHaveLength(0);

    // Add first bookmark
    await act(async () => {
      await result.current.addBookmark(1, 1);
    });

    await waitFor(() => {
      expect(result.current.isAddingBookmark).toBe(false);
      expect(result.current.isFetchingBookmarks).toBe(false);
    });

    // Verify bookmark exists
    expect(result.current.bookmarks).toHaveLength(1);
    expect(result.current.bookmarks[0]).toMatchObject({
      book_id: 1,
      chapter_number: 1,
      book_name: 'Genesis',
    });
  });

  /**
   * Test 7: Multiple bookmarks management
   * Gap: No test adds and removes multiple bookmarks in sequence
   */
  it('should manage multiple bookmarks correctly in sequence', async () => {
    clearBookmarkStore();
    const { result } = renderHook(() => useBookmarks(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isFetchingBookmarks).toBe(false);
    });

    // Add 3 bookmarks sequentially
    await act(async () => {
      await result.current.addBookmark(1, 1); // Genesis 1
    });

    await waitFor(() => {
      expect(result.current.isAddingBookmark).toBe(false);
      expect(result.current.isFetchingBookmarks).toBe(false);
    });

    await act(async () => {
      await result.current.addBookmark(43, 3); // John 3
    });

    await waitFor(() => {
      expect(result.current.isAddingBookmark).toBe(false);
      expect(result.current.isFetchingBookmarks).toBe(false);
    });

    await act(async () => {
      await result.current.addBookmark(19, 23); // Psalms 23
    });

    await waitFor(() => {
      expect(result.current.isAddingBookmark).toBe(false);
      expect(result.current.isFetchingBookmarks).toBe(false);
    });

    expect(result.current.bookmarks).toHaveLength(3);

    // Remove middle bookmark
    await act(async () => {
      await result.current.removeBookmark(43, 3);
    });

    await waitFor(() => {
      expect(result.current.isRemovingBookmark).toBe(false);
      expect(result.current.isFetchingBookmarks).toBe(false);
    });

    // Should have 2 bookmarks remaining
    expect(result.current.bookmarks).toHaveLength(2);
    expect(result.current.isBookmarked(1, 1)).toBe(true);
    expect(result.current.isBookmarked(43, 3)).toBe(false);
    expect(result.current.isBookmarked(19, 23)).toBe(true);
  });

  /**
   * Test 8: Bookmark toggle state persistence after navigation
   * Gap: Simulating navigation and verifying state persists
   */
  it('should persist bookmark state after simulated navigation', async () => {
    const { result, unmount } = renderHook(() => useBookmarks(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isFetchingBookmarks).toBe(false);
    });

    // Add bookmark
    await act(async () => {
      await result.current.addBookmark(40, 5);
    });

    await waitFor(() => {
      expect(result.current.isAddingBookmark).toBe(false);
      expect(result.current.isFetchingBookmarks).toBe(false);
    });

    expect(result.current.isBookmarked(40, 5)).toBe(true);

    // Simulate navigation by unmounting and remounting
    unmount();

    const { result: newResult } = renderHook(() => useBookmarks(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(newResult.current.isFetchingBookmarks).toBe(false);
    });

    // Bookmark should still exist after "navigation"
    expect(newResult.current.isBookmarked(40, 5)).toBe(true);
  });

  /**
   * Test 9: Unauthenticated user cannot bookmark
   * Gap: Authentication requirement integration not explicitly tested
   */
  it('should prevent bookmark operations when user is not authenticated', async () => {
    // Override auth to return unauthenticated
    server.use(
      http.get(`${API_BASE_URL}/auth/session`, () => {
        return HttpResponse.json(null, { status: 401 });
      })
    );

    const { result } = renderHook(() => useBookmarks(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isFetchingBookmarks).toBe(false);
    });

    // Bookmarks should be empty for unauthenticated user
    expect(result.current.bookmarks).toHaveLength(0);

    // Attempting to add should not work (or throw error)
    await act(async () => {
      try {
        await result.current.addBookmark(1, 1);
      } catch (_e) {
        // Auth error expected
      }
    });

    // Should not be bookmarked
    expect(result.current.isBookmarked(1, 1)).toBe(false);
  });

  /**
   * Test 10: Remove bookmark while viewing that chapter
   * Gap: Integration test for removing bookmark from chapter you're currently viewing
   */
  it('should allow removing bookmark from currently viewed chapter', async () => {
    const { result } = renderHook(() => useBookmarks(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isFetchingBookmarks).toBe(false);
    });

    // Add Genesis 1 bookmark first if not present
    const hasGenesis1 = result.current.bookmarks.some(
      (b) => b.book_id === 1 && b.chapter_number === 1
    );

    if (!hasGenesis1) {
      await act(async () => {
        await result.current.addBookmark(1, 1);
      });

      await waitFor(() => {
        expect(result.current.isAddingBookmark).toBe(false);
        expect(result.current.isFetchingBookmarks).toBe(false);
      });
    }

    expect(result.current.isBookmarked(1, 1)).toBe(true);

    // Simulate user is viewing Genesis 1 and removes bookmark
    await act(async () => {
      await result.current.removeBookmark(1, 1);
    });

    await waitFor(() => {
      expect(result.current.isRemovingBookmark).toBe(false);
      expect(result.current.isFetchingBookmarks).toBe(false);
    });

    // Should be removed even though we're "viewing" it
    expect(result.current.isBookmarked(1, 1)).toBe(false);
    const bookmark = result.current.bookmarks.find(
      (b) => b.book_id === 1 && b.chapter_number === 1
    );
    expect(bookmark).toBeUndefined();
  });
});
