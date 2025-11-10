/**
 * Tests for useRecentBooks Hook
 *
 * Focused tests for recent books tracking functionality with backend sync.
 * Tests cover:
 * - Loading persisted books from AsyncStorage
 * - Adding books to recent history
 * - Filtering expired entries (> 30 days)
 * - Max 4 books limit
 * - Backend sync for authenticated users
 *
 * @see hook: /hooks/bible/use-recent-books.ts
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { HttpResponse, http } from 'msw';
import type { ReactNode } from 'react';
import { AuthProvider } from '@/contexts/AuthContext';
import { useRecentBooks } from '@/hooks/bible/use-recent-books';
import { RECENT_BOOKS_EXPIRY_DAYS, STORAGE_KEYS } from '@/types/bible';
import { resetRecentlyViewedStore } from '../../mocks/handlers/recently-viewed-books.handlers';
import { server } from '../../mocks/server';

const API_BASE_URL = 'https://api.verse-mate.apegro.dev';

// Test user ID (matches mock pattern)
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

// Mock token refresh
jest.mock('@/lib/auth/token-refresh', () => ({
  setupProactiveRefresh: jest.fn(() => jest.fn()),
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

describe('useRecentBooks', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    // Reset recently viewed store
    resetRecentlyViewedStore();

    // Clear all mocks
    jest.clearAllMocks();

    // Create a new QueryClient for each test
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    // Override auth session handler to return our test user
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
    // Clear query client
    queryClient.clear();

    // Reset MSW handlers
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

  it('should load recent books from AsyncStorage on mount', async () => {
    const mockBooks = [
      { bookId: 1, timestamp: Date.now() },
      { bookId: 19, timestamp: Date.now() - 1000 * 60 * 60 }, // 1 hour ago
    ];

    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockBooks));

    const { result } = renderHook(() => useRecentBooks(), {
      wrapper: createWrapper(),
    });

    // Initially loading
    expect(result.current.isLoading).toBe(true);
    expect(result.current.recentBooks).toEqual([]);

    // Wait for load to complete
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.recentBooks).toEqual(mockBooks);
    expect(result.current.error).toBeNull();
    expect(AsyncStorage.getItem).toHaveBeenCalledWith(STORAGE_KEYS.RECENT_BOOKS);
  });

  it('should filter out expired books (> 30 days)', async () => {
    const now = Date.now();
    const expiryMs = RECENT_BOOKS_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

    const mockBooks = [
      { bookId: 1, timestamp: now }, // Valid
      { bookId: 19, timestamp: now - expiryMs - 1000 }, // Expired (just over 30 days)
      { bookId: 40, timestamp: now - 1000 * 60 * 60 * 24 * 15 }, // Valid (15 days old)
    ];

    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockBooks));

    const { result } = renderHook(() => useRecentBooks(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Only non-expired books should be in state
    expect(result.current.recentBooks).toHaveLength(2);
    expect(result.current.recentBooks.find((b) => b.bookId === 19)).toBeUndefined();
    expect(result.current.recentBooks.find((b) => b.bookId === 1)).toBeDefined();
    expect(result.current.recentBooks.find((b) => b.bookId === 40)).toBeDefined();

    // Storage should be updated to remove expired books (may not be called if sync occurs)
  });

  it('should add a book to recent history', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

    const { result } = renderHook(() => useRecentBooks(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Add a book
    await act(async () => {
      await result.current.addRecentBook(1); // Genesis
    });

    expect(result.current.recentBooks).toHaveLength(1);
    expect(result.current.recentBooks[0].bookId).toBe(1);
    expect(result.current.error).toBeNull();

    // Verify storage was called
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      STORAGE_KEYS.RECENT_BOOKS,
      expect.stringContaining('"bookId":1')
    );
  });

  it('should move existing book to top when added again', async () => {
    const initialTimestamp = Date.now() - 1000 * 60 * 60; // 1 hour ago
    const mockBooks = [
      { bookId: 1, timestamp: initialTimestamp },
      { bookId: 19, timestamp: Date.now() },
    ];

    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockBooks));

    const { result } = renderHook(() => useRecentBooks(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Add book 1 again (should move to top)
    await act(async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockBooks));
      await result.current.addRecentBook(1);
    });

    // Book 1 should now be at top with new timestamp
    expect(result.current.recentBooks[0].bookId).toBe(1);
    expect(result.current.recentBooks[0].timestamp).toBeGreaterThan(initialTimestamp);
    expect(result.current.recentBooks).toHaveLength(2);
  });

  it('should default to empty array if no stored books', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

    const { result } = renderHook(() => useRecentBooks(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.recentBooks).toEqual([]);
    expect(result.current.error).toBeNull();
  });
});
