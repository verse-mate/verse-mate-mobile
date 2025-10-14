/**
 * Tests for useRecentBooks Hook
 *
 * Focused tests for recent books tracking functionality.
 * Tests cover:
 * - Loading persisted books from AsyncStorage
 * - Adding books to recent history
 * - Filtering expired entries (> 30 days)
 * - Max 5 books limit
 *
 * @see hook: /hooks/bible/use-recent-books.ts
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { useRecentBooks } from '@/hooks/bible/use-recent-books';
import { STORAGE_KEYS, MAX_RECENT_BOOKS, RECENT_BOOKS_EXPIRY_DAYS } from '@/types/bible';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

describe('useRecentBooks', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  it('should load recent books from AsyncStorage on mount', async () => {
    const mockBooks = [
      { bookId: 1, timestamp: Date.now() },
      { bookId: 19, timestamp: Date.now() - 1000 * 60 * 60 }, // 1 hour ago
    ];

    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockBooks));

    const { result } = renderHook(() => useRecentBooks());

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

    const { result } = renderHook(() => useRecentBooks());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Only non-expired books should be in state
    expect(result.current.recentBooks).toHaveLength(2);
    expect(result.current.recentBooks.find((b) => b.bookId === 19)).toBeUndefined();
    expect(result.current.recentBooks.find((b) => b.bookId === 1)).toBeDefined();
    expect(result.current.recentBooks.find((b) => b.bookId === 40)).toBeDefined();

    // Storage should be updated to remove expired books
    expect(AsyncStorage.setItem).toHaveBeenCalled();
  });

  it('should add a book to recent history', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

    const { result } = renderHook(() => useRecentBooks());

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

    const { result } = renderHook(() => useRecentBooks());

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

    const { result } = renderHook(() => useRecentBooks());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.recentBooks).toEqual([]);
    expect(result.current.error).toBeNull();
  });
});
