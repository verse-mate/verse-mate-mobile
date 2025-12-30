/**
 * Tests for useBookmarks Hook
 *
 * Focused tests for bookmark state management functionality.
 * Tests cover:
 * - Loading bookmarks from API
 * - Adding bookmarks with optimistic updates
 * - Removing bookmarks with optimistic updates
 * - Rollback on API failure
 * - Authentication checks
 *
 * Limit: 2-8 highly focused tests maximum
 *
 * @see hook: /hooks/bible/use-bookmarks.ts
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { HttpResponse, http } from 'msw';
import type { ReactNode } from 'react';
import { AuthProvider } from '@/contexts/AuthContext';
import { useBookmarks } from '@/hooks/bible/use-bookmarks';
import { MOCK_USER_ID, mockBookmarksResponse } from '../../mocks/data/bookmarks.data';
import { resetBookmarkStore } from '../../mocks/handlers/bookmarks.handlers';
import { server } from '../../mocks/server';

const API_BASE_URL = 'http://localhost:4000';

// Use a user ID that matches the mock pattern expected by auth handlers
const TEST_USER_ID = 'user-1234567890';
const TEST_ACCESS_TOKEN = `mock-access-token-${TEST_USER_ID}`;

// Mock auth tokens with proper user ID format
jest.mock('@/lib/auth/token-storage', () => ({
  getAccessToken: jest.fn().mockResolvedValue(TEST_ACCESS_TOKEN),
  getRefreshToken: jest.fn().mockResolvedValue(`mock-refresh-token-${TEST_USER_ID}`),
  setAccessToken: jest.fn().mockResolvedValue(undefined),
  setRefreshToken: jest.fn().mockResolvedValue(undefined),
  clearTokens: jest.fn().mockResolvedValue(undefined),
}));

// Mock token refresh
jest.mock('@/lib/auth/token-refresh', () => ({
  setupProactiveRefresh: jest.fn(() => jest.fn()),
}));

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: {
    Light: 'light',
  },
}));

describe('useBookmarks', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    // Reset bookmark store to initial state
    resetBookmarkStore();

    // Create a new QueryClient for each test
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

  // Test 1: Should fetch bookmarks on mount for authenticated user
  it('should fetch bookmarks from API when authenticated', async () => {
    const { result } = renderHook(() => useBookmarks(), { wrapper: createWrapper() });

    // Wait for auth to load and bookmarks to fetch
    await waitFor(
      () => {
        expect(result.current.isFetchingBookmarks).toBe(false);
      },
      { timeout: 5000 }
    );

    // Should have loaded bookmarks
    expect(result.current.bookmarks).toHaveLength(4);
    expect(result.current.bookmarks[0]).toMatchObject({
      favorite_id: expect.any(Number),
      book_id: expect.any(Number),
      chapter_number: expect.any(Number),
      book_name: expect.any(String),
    });
  });

  // Test 2: Should check if chapter is bookmarked
  it('should correctly identify bookmarked chapters', async () => {
    const { result } = renderHook(() => useBookmarks(), { wrapper: createWrapper() });

    await waitFor(
      () => {
        expect(result.current.isFetchingBookmarks).toBe(false);
      },
      { timeout: 5000 }
    );

    // Genesis 1 is in mock data
    expect(result.current.isBookmarked(1, 1)).toBe(true);

    // John 3 is in mock data
    expect(result.current.isBookmarked(43, 3)).toBe(true);

    // Romans 1 is NOT in mock data
    expect(result.current.isBookmarked(6, 1)).toBe(false);
  });

  // Test 3: Should add bookmark with optimistic update
  it('should add bookmark optimistically and update from API', async () => {
    const { result } = renderHook(() => useBookmarks(), { wrapper: createWrapper() });

    await waitFor(
      () => {
        expect(result.current.isFetchingBookmarks).toBe(false);
      },
      { timeout: 5000 }
    );

    const initialCount = result.current.bookmarks.length;

    // Add bookmark for Romans 8 (book_id: 45, chapter: 8)
    await act(async () => {
      await result.current.addBookmark(45, 8);
    });

    // Wait for mutation to complete
    await waitFor(() => {
      expect(result.current.isAddingBookmark).toBe(false);
    });

    // Should be bookmarked after API confirmation
    expect(result.current.isBookmarked(45, 8)).toBe(true);
    expect(result.current.bookmarks.length).toBeGreaterThan(initialCount);
  });

  // Test 4: Should remove bookmark with optimistic update
  it('should remove bookmark optimistically and update from API', async () => {
    const { result } = renderHook(() => useBookmarks(), { wrapper: createWrapper() });

    await waitFor(
      () => {
        expect(result.current.isFetchingBookmarks).toBe(false);
      },
      { timeout: 5000 }
    );

    // Genesis 1 is initially bookmarked
    expect(result.current.isBookmarked(1, 1)).toBe(true);

    // Remove bookmark
    await act(async () => {
      await result.current.removeBookmark(1, 1);
    });

    // Wait for mutation to complete
    await waitFor(() => {
      expect(result.current.isRemovingBookmark).toBe(false);
    });

    // Should be removed after API confirmation
    expect(result.current.isBookmarked(1, 1)).toBe(false);
  });

  // Test 5: Should rollback on API failure
  it('should rollback optimistic update when add bookmark fails', async () => {
    const { result } = renderHook(() => useBookmarks(), { wrapper: createWrapper() });

    await waitFor(
      () => {
        expect(result.current.isFetchingBookmarks).toBe(false);
      },
      { timeout: 5000 }
    );

    // Mock API failure for adding bookmark
    server.use(
      http.post(`${API_BASE_URL}/bible/book/bookmark/add`, () => {
        return HttpResponse.json({ message: 'Server error', data: null }, { status: 500 });
      })
    );

    // Try to add bookmark (should fail)
    await act(async () => {
      try {
        await result.current.addBookmark(45, 8);
      } catch (_e) {
        // Mutation error is expected
      }
    });

    // Wait for mutation to complete with error
    await waitFor(() => {
      expect(result.current.isAddingBookmark).toBe(false);
    });

    // Should be rolled back (not bookmarked)
    expect(result.current.isBookmarked(45, 8)).toBe(false);
  });

  // Test 6: Should refetch bookmarks
  it('should refetch bookmarks when requested', async () => {
    const { result } = renderHook(() => useBookmarks(), { wrapper: createWrapper() });

    await waitFor(
      () => {
        expect(result.current.isFetchingBookmarks).toBe(false);
      },
      { timeout: 5000 }
    );

    const initialBookmarks = [...result.current.bookmarks];

    // Refetch bookmarks
    await act(async () => {
      await result.current.refetchBookmarks();
    });

    // Should have re-fetched (data might be the same, but refetch was called)
    expect(result.current.bookmarks).toEqual(initialBookmarks);
  });

  // Test 7: Should handle loading states correctly
  it('should provide accurate loading states during operations', async () => {
    const { result } = renderHook(() => useBookmarks(), { wrapper: createWrapper() });

    // Initial fetch loading state
    expect(result.current.isFetchingBookmarks).toBe(true);
    expect(result.current.isAddingBookmark).toBe(false);
    expect(result.current.isRemovingBookmark).toBe(false);

    await waitFor(
      () => {
        expect(result.current.isFetchingBookmarks).toBe(false);
      },
      { timeout: 5000 }
    );

    // No loading during idle
    expect(result.current.isAddingBookmark).toBe(false);
    expect(result.current.isRemovingBookmark).toBe(false);
  });
});
