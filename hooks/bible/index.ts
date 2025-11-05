/**
 * Bible Hooks Barrel Export
 *
 * Centralized export point for all Bible-related custom hooks.
 * This allows for clean imports like: import { useActiveTab, useRecentBooks } from '@/hooks/bible'
 */

// Active tab persistence hook
export { useActiveTab } from './use-active-tab';
// Active view mode persistence hook
export { useActiveView } from './use-active-view';
// Book progress calculation hook
export { useBookProgress } from './use-book-progress';
// Last read position hook (wraps API hook)
export { useLastRead } from './use-last-read';
// Last read position persistence hook (for app launch continuity)
export { useLastReadPosition } from './use-last-read-position';
// Offline status detection hook
export { useOfflineStatus } from './use-offline-status';
// Reading position persistence hook
export { useReadingPosition } from './use-reading-position';
// Recent books tracking hook
export { useRecentBooks } from './use-recent-books';
