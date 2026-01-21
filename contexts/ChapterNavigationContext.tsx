/**
 * Chapter Navigation Context
 *
 * Single source of truth for navigation state in the Bible reader.
 * The PagerView updates this context on swipe completion, and the header reads from it.
 * This eliminates the multi-second delay between swipe completion and header update.
 *
 * Pattern follows BibleInteractionContext.tsx:
 * - Context with null default
 * - Provider component with state management
 * - Custom hook that throws if used outside provider
 */

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

/**
 * Type definition for the chapter navigation context value.
 */
export interface ChapterNavigationContextType {
  /** Current book ID (1-66 for standard Bible) */
  currentBookId: number;
  /** Current chapter number within the book */
  currentChapter: number;
  /** Human-readable name of the current book */
  bookName: string;
  /**
   * Update the current navigation state.
   * Called by PagerView when a swipe completes.
   */
  setCurrentChapter: (bookId: number, chapter: number, bookName: string) => void;
  /**
   * Jump to a specific chapter (e.g., from modal or deep link).
   * Invokes the callback provided to the provider.
   */
  jumpToChapter: (bookId: number, chapter: number) => void;
}

/**
 * Context for chapter navigation state.
 * Initialized as null - consumers must use the provider.
 */
const ChapterNavigationContext = createContext<ChapterNavigationContextType | null>(null);

/**
 * Props for the ChapterNavigationProvider component.
 */
export interface ChapterNavigationProviderProps {
  children: React.ReactNode;
  /** Initial book ID from URL params or default */
  initialBookId: number;
  /** Initial chapter number from URL params or default */
  initialChapter: number;
  /** Initial book name from booksMetadata or default */
  initialBookName: string;
  /**
   * Callback invoked when jumpToChapter is called.
   * Typically used to snap the PagerView to a specific page.
   */
  onJumpToChapter: (bookId: number, chapter: number) => void;
}

/**
 * Provider component for chapter navigation context.
 *
 * Manages the authoritative navigation state for the Bible reader.
 * Initialize from URL params on mount, then context is authoritative.
 */
export function ChapterNavigationProvider({
  children,
  initialBookId,
  initialChapter,
  initialBookName,
  onJumpToChapter,
}: ChapterNavigationProviderProps) {
  // State for navigation - initialized from props (URL params)
  const [currentBookId, setCurrentBookId] = useState<number>(initialBookId);
  const [currentChapter, setCurrentChapterState] = useState<number>(initialChapter);
  const [bookName, setBookName] = useState<string>(initialBookName);

  /**
   * Update all three navigation state values synchronously.
   * Called by PagerView's onPageSelected callback when a swipe completes.
   */
  const setCurrentChapter = useCallback(
    (newBookId: number, newChapter: number, newBookName: string) => {
      setCurrentBookId(newBookId);
      setCurrentChapterState(newChapter);
      setBookName(newBookName);
    },
    []
  );

  /**
   * Jump to a specific chapter via the callback.
   * Used for modal navigation and deep links.
   */
  const jumpToChapter = useCallback(
    (targetBookId: number, targetChapter: number) => {
      onJumpToChapter(targetBookId, targetChapter);
    },
    [onJumpToChapter]
  );

  // Memoize context value to prevent unnecessary re-renders
  const value = useMemo<ChapterNavigationContextType>(
    () => ({
      currentBookId,
      currentChapter,
      bookName,
      setCurrentChapter,
      jumpToChapter,
    }),
    [currentBookId, currentChapter, bookName, setCurrentChapter, jumpToChapter]
  );

  return (
    <ChapterNavigationContext.Provider value={value}>
      {children}
    </ChapterNavigationContext.Provider>
  );
}

/**
 * Hook to access chapter navigation context.
 *
 * @throws Error if used outside of ChapterNavigationProvider
 * @returns ChapterNavigationContextType with current navigation state and setters
 */
export function useChapterNavigation(): ChapterNavigationContextType {
  const context = useContext(ChapterNavigationContext);

  if (context === null) {
    throw new Error('useChapterNavigation must be used within a ChapterNavigationProvider');
  }

  return context;
}
