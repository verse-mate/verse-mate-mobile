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
// Bookmarks management hook
export { useBookmarks } from './use-bookmarks';
// Chapter display shared values hook (Header sync with Reanimated)
export { useChapterDisplay } from './use-chapter-display';
// Chapter reading duration tracking hook (Time-Based Analytics)
export { useChapterReadingDuration } from './use-chapter-reading-duration';
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
// Scroll depth tracking hook (Time-Based Analytics)
export { useScrollDepthTracking } from './use-scroll-depth-tracking';
// View mode duration tracking hook (Time-Based Analytics)
export { useViewModeDuration } from './use-view-mode-duration';
