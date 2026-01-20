/**
 * Chapter Navigation Context
 *
 * Provides a single source of truth for the current chapter being viewed.
 * This context eliminates sync issues between the header and content during
 * chapter navigation by ensuring both components read from the same state.
 *
 * The ChapterPagerView is the single writer to this context via `setCurrentChapter`,
 * called from its `onPageSelected` callback. External navigation (modal, deep links)
 * uses `jumpToChapter` which also triggers a pager snap callback.
 *
 * @see spec: agent-os/specs/2026-01-19-chapter-view-state-refactor/spec.md
 */

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

// ============================================================================
// Types
// ============================================================================

/**
 * Navigation state for the current chapter
 */
interface ChapterNavigationState {
  /** Current book ID (1-66) */
  currentBookId: number;
  /** Current chapter number (1-based) */
  currentChapter: number;
  /** Display name of the current book */
  bookName: string;
}

/**
 * Context value provided to all consumers
 */
export interface ChapterNavigationContextType extends ChapterNavigationState {
  /**
   * Update the current chapter state.
   * Called by ChapterPagerView when user swipes to a new chapter.
   *
   * @param bookId - The book ID (1-66)
   * @param chapter - The chapter number (1-based)
   * @param bookName - The display name of the book
   */
  setCurrentChapter: (bookId: number, chapter: number, bookName: string) => void;

  /**
   * Jump to a specific chapter from external navigation (modal, deep link).
   * Updates state and triggers the onJumpToChapter callback for pager integration.
   *
   * @param bookId - The book ID (1-66)
   * @param chapter - The chapter number (1-based)
   * @param bookName - The display name of the book
   */
  jumpToChapter: (bookId: number, chapter: number, bookName: string) => void;
}

// ============================================================================
// Context
// ============================================================================

const ChapterNavigationContext = createContext<ChapterNavigationContextType | null>(null);

// ============================================================================
// Provider Component
// ============================================================================

interface ChapterNavigationProviderProps {
  children: React.ReactNode;
  /** Initial book ID from URL params (read once on mount) */
  initialBookId: number;
  /** Initial chapter number from URL params (read once on mount) */
  initialChapter: number;
  /** Initial book name */
  initialBookName: string;
  /**
   * Optional callback triggered when jumpToChapter is called.
   * Used by ChapterScreen to snap the pager to CENTER_INDEX.
   */
  onJumpToChapter?: (bookId: number, chapter: number) => void;
}

export function ChapterNavigationProvider({
  children,
  initialBookId,
  initialChapter,
  initialBookName,
  onJumpToChapter,
}: ChapterNavigationProviderProps) {
  // Navigation state - initialized from props (URL params)
  const [navigationState, setNavigationState] = useState<ChapterNavigationState>({
    currentBookId: initialBookId,
    currentChapter: initialChapter,
    bookName: initialBookName,
  });

  /**
   * Update the current chapter state.
   * This is the primary method called by ChapterPagerView on swipe.
   */
  const setCurrentChapter = useCallback(
    (bookId: number, chapter: number, bookName: string) => {
      setNavigationState({
        currentBookId: bookId,
        currentChapter: chapter,
        bookName,
      });
    },
    []
  );

  /**
   * Jump to a specific chapter from external navigation.
   * Updates state and calls the pager snap callback.
   */
  const jumpToChapter = useCallback(
    (bookId: number, chapter: number, bookName: string) => {
      // Update state
      setNavigationState({
        currentBookId: bookId,
        currentChapter: chapter,
        bookName,
      });

      // Trigger pager snap callback if provided
      onJumpToChapter?.(bookId, chapter);
    },
    [onJumpToChapter]
  );

  // Memoize context value to prevent unnecessary re-renders
  const value = useMemo<ChapterNavigationContextType>(
    () => ({
      currentBookId: navigationState.currentBookId,
      currentChapter: navigationState.currentChapter,
      bookName: navigationState.bookName,
      setCurrentChapter,
      jumpToChapter,
    }),
    [navigationState, setCurrentChapter, jumpToChapter]
  );

  return (
    <ChapterNavigationContext.Provider value={value}>{children}</ChapterNavigationContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook to access chapter navigation context
 *
 * @throws Error if used outside ChapterNavigationProvider
 *
 * @example
 * ```tsx
 * function ChapterHeader() {
 *   const { currentBookId, currentChapter, bookName } = useChapterNavigation();
 *
 *   return (
 *     <Text>{bookName} {currentChapter}</Text>
 *   );
 * }
 * ```
 */
export function useChapterNavigation(): ChapterNavigationContextType {
  const context = useContext(ChapterNavigationContext);

  if (context === null) {
    throw new Error('useChapterNavigation must be used within a ChapterNavigationProvider');
  }

  return context;
}
