/**
 * Manual mock for @/hooks/bible
 *
 * This file provides default mock implementations for all bible hooks.
 * Tests using jest.mock('@/hooks/bible') will automatically use these mocks.
 *
 * Individual tests can customize mock return values in beforeEach:
 * ```typescript
 * import { useActiveTab } from '@/hooks/bible';
 * beforeEach(() => {
 *   (useActiveTab as jest.Mock).mockReturnValue({ activeTab: 'summary', ... });
 * });
 * ```
 */

const React = require('react');

// Active tab persistence hook
export const useActiveTab = jest.fn(() => ({
  activeTab: 'summary' as const,
  setActiveTab: jest.fn(),
  isLoading: false,
  error: null,
}));

// Active view mode persistence hook (uses React state for realistic behavior)
export const useActiveView = jest.fn(() => {
  const [activeView, setActiveView] = React.useState('bible');
  return { activeView, setActiveView, isLoading: false, error: null };
});

// Book progress calculation hook
export const useBookProgress = jest.fn(() => ({
  progress: {
    percentage: 0,
    currentChapter: 1,
    totalChapters: 50,
  },
  isCalculating: false,
}));

// Bookmarks management hook
export const useBookmarks = jest.fn(() => ({
  bookmarks: [],
  addBookmark: jest.fn(),
  removeBookmark: jest.fn(),
  isBookmarked: jest.fn(() => false),
  isLoading: false,
  error: null,
}));

// Chapter reading duration tracking hook (Time-Based Analytics)
export const useChapterReadingDuration = jest.fn();

// Last read position hook (wraps API hook)
export const useLastRead = jest.fn(() => ({
  lastRead: null,
  isLoading: false,
  error: null,
}));

// Last read position persistence hook (for app launch continuity)
export const useLastReadPosition = jest.fn(() => ({
  lastPosition: null,
  savePosition: jest.fn(),
  clearPosition: jest.fn(),
  isLoading: false,
  error: null,
}));

// Offline status detection hook
export const useOfflineStatus = jest.fn(() => ({
  isOffline: false,
  isLoading: false,
}));

// Reading position persistence hook
export const useReadingPosition = jest.fn(() => ({
  position: null,
  savePosition: jest.fn(),
  clearPosition: jest.fn(),
}));

// Recent books tracking hook
export const useRecentBooks = jest.fn(() => ({
  recentBooks: [],
  addRecentBook: jest.fn(),
  isLoading: false,
  error: null,
}));

// Scroll depth tracking hook (Time-Based Analytics)
export const useScrollDepthTracking = jest.fn(() => ({
  maxScrollDepth: 0,
  handleScroll: jest.fn(),
}));

// View mode duration tracking hook (Time-Based Analytics)
export const useViewModeDuration = jest.fn();
