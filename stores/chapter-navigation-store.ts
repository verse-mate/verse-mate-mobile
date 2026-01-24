/**
 * Chapter Navigation Store
 *
 * External store for chapter navigation state using the "store" pattern.
 * Uses useSyncExternalStore for React integration without causing parent re-renders.
 *
 * Why this approach?
 * - Context updates trigger re-renders of ALL consumers and their children
 * - useSyncExternalStore only re-renders the specific component reading from it
 * - This prevents the "cascade re-render" problem during fast swipes
 *
 * The store is a simple JavaScript module (singleton) that:
 * - Holds current navigation state (bookId, chapter, bookName)
 * - Notifies subscribers when state changes
 * - Provides getSnapshot for useSyncExternalStore
 *
 * @see https://react.dev/reference/react/useSyncExternalStore
 * @see Spec: agent-os/specs/2026-01-21-chapter-header-slide-sync/spec.md
 */

/**
 * Navigation state shape
 */
export interface ChapterNavigationState {
  bookId: number;
  chapter: number;
  bookName: string;
}

/**
 * Subscriber callback type
 */
type Subscriber = () => void;

/**
 * Store state - module-level singleton
 */
let state: ChapterNavigationState = {
  bookId: 1,
  chapter: 1,
  bookName: 'Genesis',
};

/**
 * Set of subscribers to notify on state changes
 */
const subscribers = new Set<Subscriber>();

/**
 * Get current state snapshot (for useSyncExternalStore)
 * Returns the same object reference if state hasn't changed
 */
export function getSnapshot(): ChapterNavigationState {
  return state;
}

/**
 * Get server snapshot (for SSR - same as client in React Native)
 */
export function getServerSnapshot(): ChapterNavigationState {
  return state;
}

/**
 * Subscribe to state changes (for useSyncExternalStore)
 *
 * @param callback Function to call when state changes
 * @returns Unsubscribe function
 */
export function subscribe(callback: Subscriber): () => void {
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
  };
}

/**
 * Update navigation state and notify subscribers
 *
 * Called by ChapterPagerView when a swipe completes.
 * This does NOT trigger React re-renders in the calling component -
 * only components using useSyncExternalStore will re-render.
 *
 * @param bookId New book ID (1-66)
 * @param chapter New chapter number
 * @param bookName Human-readable book name
 */
export function setCurrentChapter(
  bookId: number,
  chapter: number,
  bookName: string
): void {
  // Only update if something actually changed
  if (
    state.bookId === bookId &&
    state.chapter === chapter &&
    state.bookName === bookName
  ) {
    return;
  }

  // Create new state object (immutable update for React's sake)
  state = { bookId, chapter, bookName };

  // Notify all subscribers
  for (const subscriber of subscribers) {
    subscriber();
  }
}

/**
 * Initialize store state (called on mount)
 *
 * Sets initial values without notifying subscribers.
 * Used when the screen first loads with URL params.
 *
 * @param bookId Initial book ID
 * @param chapter Initial chapter number
 * @param bookName Initial book name
 */
export function initializeState(
  bookId: number,
  chapter: number,
  bookName: string
): void {
  state = { bookId, chapter, bookName };
  // Don't notify subscribers - this is initialization, not a change
}

/**
 * Reset store to default state (for testing)
 */
export function resetStore(): void {
  state = {
    bookId: 1,
    chapter: 1,
    bookName: 'Genesis',
  };
  subscribers.clear();
}
