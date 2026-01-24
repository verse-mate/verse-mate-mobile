/**
 * useChapterNavigationStore Hook
 *
 * React hook for reading chapter navigation state from the external store.
 * Uses useSyncExternalStore to ensure only this component re-renders when state changes,
 * not the entire React tree.
 *
 * Usage:
 * ```tsx
 * function ChapterHeader() {
 *   const { bookId, chapter, bookName } = useChapterNavigationStore();
 *   return <Text>{bookName} {chapter}</Text>;
 * }
 * ```
 *
 * @see stores/chapter-navigation-store.ts
 */

import { useSyncExternalStore } from 'react';
import {
  type ChapterNavigationState,
  getServerSnapshot,
  getSnapshot,
  subscribe,
} from '@/stores/chapter-navigation-store';

/**
 * Hook to read chapter navigation state from external store
 *
 * This hook:
 * - Returns current navigation state (bookId, chapter, bookName)
 * - Only triggers re-render of the consuming component when state changes
 * - Does NOT cause parent/sibling components to re-render
 *
 * @returns Current chapter navigation state
 */
export function useChapterNavigationStore(): ChapterNavigationState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
