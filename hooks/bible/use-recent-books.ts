/**
 * useRecentBooks Hook
 *
 * Manages the user's recent books history with persistence to AsyncStorage.
 * Tracks the last 5 books accessed with timestamps, automatically expiring
 * entries older than 30 days.
 *
 * @example
 * ```tsx
 * const { recentBooks, addRecentBook, isLoading } = useRecentBooks();
 *
 * // Display loading state
 * if (isLoading) {
 *   return <ActivityIndicator />;
 * }
 *
 * // Display recent books
 * recentBooks.forEach(book => <RecentBookItem key={book.bookId} book={book} />);
 *
 * // Add a book when user navigates to it
 * await addRecentBook(1); // Genesis
 * ```
 *
 * @see Spec: agent-os/specs/2025-10-14-bible-reading-mobile/spec.md (lines 457-488)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import type { RecentBook, UseRecentBooksResult } from '@/types/bible';
import { MAX_RECENT_BOOKS, RECENT_BOOKS_EXPIRY_DAYS, STORAGE_KEYS } from '@/types/bible';

/**
 * Hook to manage recent books history with AsyncStorage persistence
 *
 * @returns {UseRecentBooksResult} Object containing:
 *   - recentBooks: Array of recent book entries (max 5, sorted by most recent)
 *   - addRecentBook: Function to add/update a book in recent history
 *   - clearRecentBooks: Function to clear all recent books
 *   - isLoading: Whether initial load from storage is in progress
 *   - error: Error object if loading or saving failed
 */
export function useRecentBooks(): UseRecentBooksResult {
  const [recentBooks, setRecentBooks] = useState<RecentBook[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Load persisted recent books from AsyncStorage on mount
  useEffect(() => {
    async function loadRecentBooks() {
      try {
        setIsLoading(true);
        setError(null);

        const stored = await AsyncStorage.getItem(STORAGE_KEYS.RECENT_BOOKS);

        if (stored) {
          const books: RecentBook[] = JSON.parse(stored);

          // Filter out expired entries (> 30 days old)
          const expiryMs = RECENT_BOOKS_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
          const now = Date.now();
          const validBooks = books.filter((book) => now - book.timestamp < expiryMs);

          setRecentBooks(validBooks);

          // If any books were filtered out, update storage
          if (validBooks.length !== books.length) {
            await AsyncStorage.setItem(STORAGE_KEYS.RECENT_BOOKS, JSON.stringify(validBooks));
          }
        } else {
          // No stored books - start with empty array
          setRecentBooks([]);
        }
      } catch (err) {
        // Handle storage read error gracefully
        setError(err instanceof Error ? err : new Error('Failed to load recent books'));
        // Fall back to empty array on error
        setRecentBooks([]);
      } finally {
        setIsLoading(false);
      }
    }

    loadRecentBooks();
  }, []); // Run only on mount

  /**
   * Add or update a book in recent history
   * - Adds book with current timestamp
   * - Moves book to top if already in list
   * - Limits list to MAX_RECENT_BOOKS (5)
   * - Automatically filters out expired entries
   */
  const addRecentBook = useCallback(async (bookId: number): Promise<void> => {
    try {
      // Validate bookId
      if (!Number.isInteger(bookId) || bookId < 1 || bookId > 66) {
        throw new Error(`Invalid bookId: ${bookId}. Must be an integer between 1 and 66.`);
      }

      const now = Date.now();
      const expiryMs = RECENT_BOOKS_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

      // Load current list from storage (to ensure we have latest data)
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.RECENT_BOOKS);
      const currentBooks: RecentBook[] = stored ? JSON.parse(stored) : [];

      // Filter out expired entries and the current bookId (we'll add it back at top)
      const filteredBooks = currentBooks.filter(
        (book) => book.bookId !== bookId && now - book.timestamp < expiryMs
      );

      // Add new entry at the top
      const updatedBooks = [{ bookId, timestamp: now }, ...filteredBooks].slice(
        0,
        MAX_RECENT_BOOKS
      );

      // Save to storage
      await AsyncStorage.setItem(STORAGE_KEYS.RECENT_BOOKS, JSON.stringify(updatedBooks));

      // Update state
      setRecentBooks(updatedBooks);

      // Clear any previous errors
      setError(null);
    } catch (err) {
      // Handle storage write error
      const storageError = err instanceof Error ? err : new Error('Failed to save recent book');
      setError(storageError);

      // Log error for debugging but don't throw (graceful degradation)
      console.error('useRecentBooks: Failed to persist recent book to storage:', storageError);
    }
  }, []);

  /**
   * Clear all recent books from storage and state
   * Useful for testing or user-initiated clear
   */
  const clearRecentBooks = useCallback(async (): Promise<void> => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.RECENT_BOOKS);
      setRecentBooks([]);
      setError(null);
    } catch (err) {
      const storageError = err instanceof Error ? err : new Error('Failed to clear recent books');
      setError(storageError);
      console.error('useRecentBooks: Failed to clear recent books from storage:', storageError);
    }
  }, []);

  return {
    recentBooks,
    addRecentBook,
    clearRecentBooks,
    isLoading,
    error,
  };
}
