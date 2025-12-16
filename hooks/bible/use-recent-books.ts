/**
 * useRecentBooks Hook
 *
 * Manages the user's recent books history with AsyncStorage persistence and backend sync.
 * Tracks the last 4 books accessed with timestamps, automatically expiring entries older than 30 days.
 *
 * Features:
 * - Local-first: Immediate updates to AsyncStorage for offline support
 * - Backend sync: Syncs with user account when authenticated
 * - Hybrid approach: Merges local and backend data, keeping most recent timestamps
 * - Migration: Handles old format (string[]) to new format (RecentBook[])
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
 * // Add a book when user navigates to it (auto-syncs if authenticated)
 * await addRecentBook(1); // Genesis
 * ```
 *
 * @see Spec: agent-os/specs/2025-10-14-bible-reading-mobile/spec.md (lines 457-488)
 * @see Web implementation: .agent-os/web-repo commit e3fea53
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  getUserRecentlyViewedBooksOptions,
  postUserRecentlyViewedBooksSyncMutation,
} from '@/src/api';
import type { RecentBook, UseRecentBooksResult } from '@/types/bible';
import { MAX_RECENT_BOOKS, RECENT_BOOKS_EXPIRY_DAYS, STORAGE_KEYS } from '@/types/bible';

/**
 * Hook to manage recent books history with AsyncStorage persistence and backend sync
 *
 * @returns {UseRecentBooksResult} Object containing:
 *   - recentBooks: Array of recent book entries (max 4, sorted by most recent)
 *   - addRecentBook: Function to add/update a book in recent history (syncs to backend if authenticated)
 *   - clearRecentBooks: Function to clear all recent books
 *   - isLoading: Whether initial load from storage is in progress
 *   - error: Error object if loading or saving failed
 */
export function useRecentBooks(): UseRecentBooksResult {
  const { user, isAuthenticated } = useAuth();
  const [recentBooks, setRecentBooks] = useState<RecentBook[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Fetch recently viewed books from backend (only when authenticated)
  // Note: We don't use the data directly, but this enables React Query caching
  useQuery({
    ...getUserRecentlyViewedBooksOptions(),
    enabled: isAuthenticated && !!user?.id,
  });

  // Sync mutation for backend updates
  const syncMutation = useMutation(postUserRecentlyViewedBooksSyncMutation());

  // Load from AsyncStorage and sync with backend on mount
  useEffect(() => {
    async function loadAndSyncRecentBooks() {
      try {
        setIsLoading(true);
        setError(null);

        const storedRaw = await AsyncStorage.getItem(STORAGE_KEYS.RECENT_BOOKS);
        let localBooks: RecentBook[] = [];

        // Parse and migrate from old format if needed
        if (storedRaw) {
          try {
            const parsed = JSON.parse(storedRaw);

            // Handle old format (array of strings) - migrate to new format
            if (Array.isArray(parsed) && parsed.length > 0) {
              if (typeof parsed[0] === 'string') {
                // Old format: convert to new format with current timestamp
                localBooks = parsed.map((bookId: string) => ({
                  bookId: Number.parseInt(bookId, 10),
                  timestamp: Date.now(),
                }));
                // Save back in new format
                await AsyncStorage.setItem(STORAGE_KEYS.RECENT_BOOKS, JSON.stringify(localBooks));
              } else {
                // New format already
                localBooks = parsed;
              }
            }
          } catch (parseError) {
            console.error('Failed to parse recently viewed books:', parseError);
          }
        }

        // Filter out expired entries (> 30 days old)
        const expiryMs = RECENT_BOOKS_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
        const now = Date.now();
        const validLocalBooks = localBooks.filter((book) => now - book.timestamp < expiryMs);

        // Set state immediately for instant display
        setRecentBooks(validLocalBooks);

        // If user is authenticated, sync with backend
        if (isAuthenticated && user?.id && validLocalBooks.length > 0) {
          try {
            const response = await syncMutation.mutateAsync({
              body: {
                books: validLocalBooks.map((book) => ({
                  bookId: book.bookId.toString(),
                  timestamp: book.timestamp,
                })),
              },
            });

            if (response) {
              // Merge backend response with local data
              const mergedBookIds = response.bookIds || [];
              const mergedBooks: RecentBook[] = mergedBookIds.map((bookId: string) => {
                const localBook = validLocalBooks.find(
                  (b) => b.bookId === Number.parseInt(bookId, 10)
                );
                return {
                  bookId: Number.parseInt(bookId, 10),
                  timestamp: localBook?.timestamp || Date.now(),
                };
              });

              // Update AsyncStorage with merged data
              await AsyncStorage.setItem(STORAGE_KEYS.RECENT_BOOKS, JSON.stringify(mergedBooks));
              setRecentBooks(mergedBooks);
            }
          } catch (syncError) {
            console.error('Failed to sync recently viewed books:', syncError);
            // Continue with local data on sync error
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to load recent books'));
        setRecentBooks([]);
      } finally {
        setIsLoading(false);
      }
    }

    loadAndSyncRecentBooks();
  }, [isAuthenticated, user?.id, syncMutation.mutateAsync]); // Re-run when auth state changes

  /**
   * Add or update a book in recent history
   * - Adds book with current timestamp
   * - Moves book to top if already in list
   * - Limits list to MAX_RECENT_BOOKS (4)
   * - Automatically syncs to backend if authenticated
   */
  const addRecentBook = useCallback(
    async (bookId: number): Promise<void> => {
      try {
        // Validate bookId
        if (!Number.isInteger(bookId) || bookId < 1 || bookId > 66) {
          throw new Error(`Invalid bookId: ${bookId}. Must be an integer between 1 and 66.`);
        }

        const now = Date.now();
        const expiryMs = RECENT_BOOKS_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

        // Load current list from storage
        const stored = await AsyncStorage.getItem(STORAGE_KEYS.RECENT_BOOKS);
        let currentBooks: RecentBook[] = [];

        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            // Handle both old and new format
            if (Array.isArray(parsed) && parsed.length > 0) {
              if (typeof parsed[0] === 'string') {
                currentBooks = parsed.map((id: string) => ({
                  bookId: Number.parseInt(id, 10),
                  timestamp: Date.now(),
                }));
              } else {
                currentBooks = parsed;
              }
            }
          } catch (parseError) {
            console.error('Failed to parse recently viewed books:', parseError);
          }
        }

        // Filter out expired entries and the current bookId (we'll add it back at top)
        const filteredBooks = currentBooks.filter(
          (book) => book.bookId !== bookId && now - book.timestamp < expiryMs
        );

        // Add new entry at the top
        const newBook: RecentBook = { bookId, timestamp: now };
        const updatedBooks = [newBook, ...filteredBooks].slice(0, MAX_RECENT_BOOKS);

        // Save to AsyncStorage
        await AsyncStorage.setItem(STORAGE_KEYS.RECENT_BOOKS, JSON.stringify(updatedBooks));

        // Update state immediately (optimistic update)
        setRecentBooks(updatedBooks);
        setError(null);

        // Sync with backend if authenticated (fire and forget)
        if (isAuthenticated && user?.id) {
          syncMutation.mutate({
            body: {
              books: [
                {
                  bookId: bookId.toString(),
                  timestamp: now,
                },
              ],
            },
          });
        }
      } catch (err) {
        const storageError = err instanceof Error ? err : new Error('Failed to save recent book');
        setError(storageError);
        console.error('useRecentBooks: Failed to persist recent book to storage:', storageError);
      }
    },
    [isAuthenticated, user?.id, syncMutation]
  );

  /**
   * Clear all recent books from storage and state
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
