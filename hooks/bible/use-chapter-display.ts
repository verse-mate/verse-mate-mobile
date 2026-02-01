/**
 * useChapterDisplay Hook
 *
 * Provides Reanimated shared values for tracking the current book ID, chapter number,
 * and derived book name. This hook enables the header component to update on the UI thread
 * without triggering React re-renders, eliminating header/content desync during swiping.
 *
 * The book name is derived from booksMetadata using useDerivedValue, ensuring it updates
 * synchronously whenever the bookId shared value changes.
 *
 * @see Spec: agent-os/specs/2026-02-01-chapter-header-slide-sync-v2/spec.md
 * @see Pattern: app/onboarding.tsx lines 49-78 (shared value + derived value pattern)
 * @see Pattern: hooks/bible/use-active-tab.ts (module-level state persistence)
 *
 * @example
 * ```tsx
 * const { currentBookIdValue, currentChapterValue, bookNameValue, setChapter } = useChapterDisplay();
 *
 * // In PagerView's onPageSelected:
 * setChapter(newBookId, newChapterNumber);
 *
 * // In Header component with useAnimatedStyle:
 * const animatedStyle = useAnimatedStyle(() => ({
 *   // bookNameValue.value updates on UI thread
 * }));
 * ```
 */

import type { SharedValue } from 'react-native-reanimated';
import { makeMutable, useDerivedValue } from 'react-native-reanimated';
import type { BookMetadata } from '@/src/api/bible/types';

/**
 * Options for initializing the useChapterDisplay hook
 */
export interface UseChapterDisplayOptions {
  /** Initial book ID (1-66), defaults to 1 (Genesis) */
  initialBookId?: number;
  /** Initial chapter number, defaults to 1 */
  initialChapter?: number;
}

/**
 * Return type for the useChapterDisplay hook
 */
export interface UseChapterDisplayResult {
  /** Shared value for current book ID (1-66) */
  currentBookIdValue: SharedValue<number>;
  /** Shared value for current chapter number */
  currentChapterValue: SharedValue<number>;
  /** Derived shared value for book name from booksMetadata lookup */
  bookNameValue: Readonly<SharedValue<string>>;
  /** Function to update shared values synchronously */
  setChapter: (bookId: number, chapterNumber: number) => void;
  /** Function to set booksMetadata for book name derivation */
  setBooksMetadata: (metadata: BookMetadata[]) => void;
}

// ============================================================================
// Module-level shared values - TRULY SHARED across all hook users
// ============================================================================

/**
 * Module-level shared values that are ACTUALLY shared between all components.
 * This is critical - each useSharedValue() call creates a NEW instance,
 * so we must create them once at module level and return the same references.
 *
 * Without this, ChapterPagerView and ChapterHeader would have DIFFERENT
 * shared values, causing the header to never update when the pager changes.
 *
 * @see hooks/bible/use-active-tab.ts for similar pattern
 */

// Create mutable shared values at module level
// Using makeMutable instead of useSharedValue since we're outside a component
const moduleCurrentBookIdValue = makeMutable<number>(1);
const moduleCurrentChapterValue = makeMutable<number>(1);
const moduleBooksMetadataValue = makeMutable<BookMetadata[]>([]);

// Track whether initialization has occurred (separate from the values themselves)
let isInitialized = false;

/**
 * FOR TEST ENVIRONMENTS ONLY
 * Resets the module-level state for this hook.
 */
export function __TEST_ONLY_RESET_STATE(): void {
  isInitialized = false;
  // Reset the shared values
  moduleCurrentBookIdValue.value = 1;
  moduleCurrentChapterValue.value = 1;
  moduleBooksMetadataValue.value = [];
}

/**
 * FOR TEST ENVIRONMENTS ONLY
 * Sets the booksMetadata for testing purposes.
 */
export function __TEST_ONLY_SET_BOOKS_METADATA(metadata: BookMetadata[]): void {
  moduleBooksMetadataValue.value = metadata;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook to manage chapter display state using Reanimated shared values.
 *
 * This hook provides:
 * - `currentBookIdValue`: Shared value tracking the current book ID
 * - `currentChapterValue`: Shared value tracking the current chapter number
 * - `bookNameValue`: Derived value computing book name from booksMetadata
 * - `setChapter`: Function to update both values synchronously
 * - `setBooksMetadata`: Function to set the metadata for book name lookup
 *
 * All values update on the UI thread without causing React re-renders,
 * which is critical for smooth header updates during PagerView swiping.
 *
 * @param options - Optional initialization parameters
 * @returns Object containing shared values and update functions
 */
export function useChapterDisplay(options: UseChapterDisplayOptions = {}): UseChapterDisplayResult {
  const { initialBookId, initialChapter } = options;

  // Initialize module-level shared values from options on first call
  // This is intentionally done outside of an effect to ensure the values
  // are set before the first render that uses them
  /* eslint-disable react-compiler/react-compiler -- Intentional module-level state initialization */
  if (!isInitialized && (initialBookId !== undefined || initialChapter !== undefined)) {
    if (initialBookId !== undefined) {
      moduleCurrentBookIdValue.value = initialBookId;
    }
    if (initialChapter !== undefined) {
      moduleCurrentChapterValue.value = initialChapter;
    }
    isInitialized = true;
  }
  /* eslint-enable react-compiler/react-compiler */

  /**
   * Derived value that computes book name from booksMetadata.
   *
   * Uses useDerivedValue to automatically update whenever currentBookIdValue changes.
   * This runs as a worklet on the UI thread, ensuring the header updates
   * in the same frame as the swipe animation completes.
   *
   * NOTE: We use useDerivedValue here (requires being in a component) to get
   * the reactive update behavior when the module-level shared values change.
   */
  const bookNameValue = useDerivedValue<string>(() => {
    'worklet';
    const bookId = moduleCurrentBookIdValue.value;
    const metadata = moduleBooksMetadataValue.value;

    if (!metadata || metadata.length === 0) {
      return '';
    }

    const book = metadata.find((b) => b.id === bookId);
    return book?.name ?? '';
  }, []);

  /**
   * Synchronously updates the shared values for book ID and chapter number.
   *
   * This function is called from onPageSelected in ChapterPagerView
   * and updates the shared values immediately without any setTimeout delay.
   * The header will update on the UI thread in the same frame.
   *
   * CRITICAL: Uses module-level shared values so ALL components using this hook
   * see the same values. Without this, ChapterPagerView and ChapterHeader would
   * have separate shared value instances and the header would never update!
   *
   * @param bookId - New book ID (1-66)
   * @param chapterNumber - New chapter number
   */
  const setChapter = (bookId: number, chapterNumber: number): void => {
    // Update the SHARED module-level values - all hook users will see this update
    moduleCurrentBookIdValue.value = bookId;
    moduleCurrentChapterValue.value = chapterNumber;
  };

  /**
   * Sets the booksMetadata for book name derivation.
   *
   * This should be called when booksMetadata is loaded from the API.
   * After setting, the bookNameValue will automatically derive the
   * correct book name for the current bookId.
   *
   * @param metadata - Array of BookMetadata from useBibleTestaments
   */
  const setBooksMetadata = (metadata: BookMetadata[]): void => {
    // Update shared value for worklet access
    moduleBooksMetadataValue.value = metadata;
  };

  // Return the MODULE-LEVEL shared values - same instances for all hook users
  return {
    currentBookIdValue: moduleCurrentBookIdValue,
    currentChapterValue: moduleCurrentChapterValue,
    bookNameValue,
    setChapter,
    setBooksMetadata,
  };
}
