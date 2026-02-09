/**
 * useChapterState Hook
 *
 * Single source of truth for chapter navigation state in the Bible reading screen.
 *
 * Architecture (V3 Rewrite):
 * - State Layer: This hook holds bookId, chapterNumber, bookName
 * - Read URL params ONCE on mount (prevents snap-back bug)
 * - Debounced URL sync (1000ms) writes state back for deep-linking
 * - Never re-reads URL params after initialization
 *
 * Key behaviors:
 * - URL params read once on mount using ref guard
 * - navigateToChapter() updates state synchronously
 * - URL updates are debounced to prevent animation interference
 * - Book name computed from bookId using Bible metadata
 *
 * @example
 * ```tsx
 * function ChapterScreen() {
 *   const { bookId, chapterNumber, bookName, navigateToChapter } = useChapterState();
 *
 *   return (
 *     <>
 *       <ChapterHeader bookName={bookName} chapterNumber={chapterNumber} />
 *       <SimpleChapterPager
 *         bookId={bookId}
 *         chapterNumber={chapterNumber}
 *         onChapterChange={navigateToChapter}
 *       />
 *     </>
 *   );
 * }
 * ```
 *
 * @see Spec: agent-os/specs/2026-02-01-chapter-header-slide-sync-v3/spec.md
 */

import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { useBibleTestaments } from '@/src/api';

/**
 * State shape for chapter navigation
 */
interface ChapterState {
  bookId: number;
  chapterNumber: number;
}

/**
 * Action types for state reducer
 */
type ChapterAction =
  | { type: 'NAVIGATE'; bookId: number; chapterNumber: number }
  | { type: 'INITIALIZE'; bookId: number; chapterNumber: number };

/**
 * Debounce delay for URL sync (milliseconds)
 */
const URL_SYNC_DEBOUNCE_MS = 1000;

/**
 * Reducer for chapter state
 *
 * Handles:
 * - NAVIGATE: Update to new chapter (from user interaction)
 * - INITIALIZE: Set initial state from URL params
 */
function chapterReducer(state: ChapterState, action: ChapterAction): ChapterState {
  switch (action.type) {
    case 'NAVIGATE':
    case 'INITIALIZE': {
      // Clamp values to valid ranges
      const bookId = Math.max(1, Math.min(66, action.bookId));
      const chapterNumber = Math.max(1, action.chapterNumber);
      return { bookId, chapterNumber };
    }
    default:
      return state;
  }
}

/**
 * Return type for useChapterState hook
 */
export interface ChapterStateResult {
  /** Current book ID (1-66) */
  bookId: number;
  /** Current chapter number (1-based) */
  chapterNumber: number;
  /** Current book name (e.g., "Genesis", "Exodus") */
  bookName: string;
  /** Navigate to a specific chapter */
  navigateToChapter: (bookId: number, chapterNumber: number) => void;
}

/**
 * useChapterState Hook
 *
 * Provides single source of truth for chapter navigation state.
 * Reads URL params once on mount and provides debounced URL sync.
 */
export function useChapterState(): ChapterStateResult {
  // Get URL params
  const params = useLocalSearchParams<{
    bookId: string;
    chapterNumber: string;
  }>();

  // Parse initial values from params
  const initialBookId = Number(params.bookId) || 1;
  const initialChapter = Number(params.chapterNumber) || 1;

  // Use reducer for state management
  const [state, dispatch] = useReducer(chapterReducer, {
    bookId: Math.max(1, Math.min(66, initialBookId)),
    chapterNumber: Math.max(1, initialChapter),
  });

  // Track if we've initialized from URL params (ref guard)
  const hasInitialized = useRef(false);

  // Ref to track current state for URL sync
  const stateRef = useRef(state);
  stateRef.current = state;

  // Timer ref for debounced URL sync
  const urlSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Get book metadata
  const { data: booksMetadata } = useBibleTestaments();

  // Compute book name from bookId
  const bookName = useMemo(() => {
    if (!booksMetadata || booksMetadata.length === 0) {
      return 'Loading...';
    }
    const book = booksMetadata.find((b) => b.id === state.bookId);
    return book?.name || 'Unknown';
  }, [booksMetadata, state.bookId]);

  /**
   * Initialize state from URL params (once on mount)
   *
   * This only runs once to prevent snap-back when URL is updated
   * via debounced sync.
   */
  useEffect(() => {
    if (hasInitialized.current) {
      // Already initialized - ignore URL param changes
      return;
    }

    const paramBookId = Number(params.bookId);
    const paramChapter = Number(params.chapterNumber);

    if (!Number.isNaN(paramBookId) && !Number.isNaN(paramChapter)) {
      dispatch({
        type: 'INITIALIZE',
        bookId: paramBookId,
        chapterNumber: paramChapter,
      });
    }

    hasInitialized.current = true;
  }, [params.bookId, params.chapterNumber]);

  /**
   * Navigate to a specific chapter
   *
   * Updates state synchronously for immediate UI response.
   * URL is updated via debounced effect.
   */
  const navigateToChapter = useCallback((bookId: number, chapterNumber: number) => {
    dispatch({
      type: 'NAVIGATE',
      bookId,
      chapterNumber,
    });
  }, []);

  /**
   * Debounced URL sync
   *
   * Updates URL params after navigation settles.
   * Prevents URL updates during rapid swiping which can cause
   * animation interference.
   */
  useEffect(() => {
    // Clear any pending timer
    if (urlSyncTimerRef.current) {
      clearTimeout(urlSyncTimerRef.current);
    }

    // Skip if not yet initialized
    if (!hasInitialized.current) {
      return;
    }

    // Set new timer
    urlSyncTimerRef.current = setTimeout(() => {
      // Only update if URL differs from current state
      const currentParamBookId = Number(params.bookId);
      const currentParamChapter = Number(params.chapterNumber);

      if (currentParamBookId !== state.bookId || currentParamChapter !== state.chapterNumber) {
        router.setParams({
          bookId: state.bookId.toString(),
          chapterNumber: state.chapterNumber.toString(),
        });
      }
    }, URL_SYNC_DEBOUNCE_MS);

    // Cleanup on unmount
    return () => {
      if (urlSyncTimerRef.current) {
        clearTimeout(urlSyncTimerRef.current);
      }
    };
  }, [state.bookId, state.chapterNumber, params.bookId, params.chapterNumber]);

  return {
    bookId: state.bookId,
    chapterNumber: state.chapterNumber,
    bookName,
    navigateToChapter,
  };
}
