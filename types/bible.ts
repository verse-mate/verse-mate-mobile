/**
 * Shared Type Definitions for Bible Reading Interface
 *
 * This file contains type definitions specific to the Bible reading UI components.
 * It extends and complements the API types from src/api/bible/types.ts.
 *
 * @see API Types: /src/api/bible/types.ts
 * @see Spec: agent-os/specs/2025-10-14-bible-reading-mobile/spec.md
 */

// Import Testament type to use in type definitions
import type { Testament } from '@/src/api/bible/types';

// Re-export commonly used API types for convenience
export type {
  BibleBook,
  BookMetadata,
  ChapterContent,
  ChapterSection,
  ExplanationContent,
  ReadingPosition,
  Subtitle,
  Testament,
  Verse,
} from '@/src/api/bible/types';

// ============================================================================
// UI State Types
// ============================================================================

/**
 * Content tab type for reading modes
 * - summary: High-level chapter overview
 * - byline: Verse-by-verse explanation
 * - detailed: In-depth theological analysis
 */
export type ContentTabType = 'summary' | 'byline' | 'detailed';

/**
 * View mode type for chapter screen
 * - bible: Plain Bible text reading mode
 * - explanations: AI-powered explanations with tabs (Summary/By Line/Detailed)
 */
export type ViewModeType = 'bible' | 'explanations';

/**
 * Navigation state for the Bible navigation modal
 * Tracks the user's current selection in the testament/book/chapter picker
 */
export interface NavigationState {
  /** Currently selected testament (Old Testament or New Testament) */
  testament: Testament;
  /** Currently selected book ID (1-66), null if no book selected */
  selectedBookId: number | null;
  /** Currently selected chapter number, null if no chapter selected */
  selectedChapter: number | null;
  /** Search/filter text for book list */
  filterText: string;
}

/**
 * Recent book entry for tracking user's reading history
 * Stored in AsyncStorage with 30-day expiry
 */
export interface RecentBook {
  /** Book ID (1-66) */
  bookId: number;
  /** Unix timestamp (milliseconds) when book was last accessed */
  timestamp: number;
}

/**
 * Book progress calculation result
 * Used for displaying reading progress in the progress bar
 */
export interface BookProgress {
  /** Current chapter number being read */
  currentChapter: number;
  /** Total number of chapters in the book */
  totalChapters: number;
  /** Progress as a percentage (0-100) */
  percentage: number;
}

/**
 * Last read position data stored in AsyncStorage
 * Contains all necessary information to restore the user's last reading state
 */
export interface LastReadPosition {
  /** Type of content: 'bible' for Bible chapter, 'topic' for topic */
  type: 'bible' | 'topic';
  /** Book ID (1-66) - required for Bible chapters */
  bookId?: number;
  /** Chapter number - required for Bible chapters */
  chapterNumber?: number;
  /** Active tab (summary, byline, detailed) */
  activeTab: ContentTabType;
  /** Active view mode (bible reading or explanations) */
  activeView: ViewModeType;
  /** Topic ID - required for topic content */
  topicId?: string;
  /** Topic category - optional for topic content */
  topicCategory?: string;
  /** Unix timestamp (milliseconds) when position was last saved */
  timestamp: number;
}

// ============================================================================
// Component Props Types
// ============================================================================

/**
 * Props for chapter navigation (prev/next buttons and swipe gestures)
 */
export interface ChapterNavigationProps {
  /** Current book ID */
  bookId: number;
  /** Current chapter number */
  chapterNumber: number;
  /** Total chapters in current book */
  totalChapters: number;
  /** Callback when navigating to previous chapter */
  onPrevious: () => void;
  /** Callback when navigating to next chapter */
  onNext: () => void;
  /** Whether previous navigation is available */
  canNavigatePrevious: boolean;
  /** Whether next navigation is available */
  canNavigateNext: boolean;
}

/**
 * Props for content tab switching
 */
export interface ContentTabProps {
  /** Currently active tab */
  activeTab: ContentTabType;
  /** Callback when tab is changed */
  onTabChange: (tab: ContentTabType) => void;
  /** Whether tabs should be disabled (e.g., during loading) */
  disabled?: boolean;
}

/**
 * Props for modal visibility and control
 */
export interface ModalControlProps {
  /** Whether modal is visible */
  visible: boolean;
  /** Callback when modal should be closed */
  onClose: () => void;
}

// ============================================================================
// Storage Keys
// ============================================================================

/**
 * AsyncStorage keys for persisting user data
 * All keys are prefixed with @verse-mate/ to avoid collisions
 */
export const STORAGE_KEYS = {
  /** Active reading tab preference */
  ACTIVE_TAB: '@verse-mate/active-tab',
  /** Active view mode preference (bible or explanations) */
  ACTIVE_VIEW: '@verse-mate/active-view',
  /** Recent books list (JSON array of RecentBook) */
  RECENT_BOOKS: '@verse-mate/recent-books',
  /** Last read position (JSON object of ReadingPosition) */
  LAST_READ: '@verse-mate/last-read',
  /** Last read position for app launch (includes bookId, chapter, tab, view, and optional topicId) */
  LAST_READ_POSITION: '@verse-mate/last-read-position',
} as const;

// ============================================================================
// Constants
// ============================================================================

/**
 * Maximum number of recent books to track
 */
export const MAX_RECENT_BOOKS = 5;

/**
 * Number of days before recent book entries expire
 */
export const RECENT_BOOKS_EXPIRY_DAYS = 30;

/**
 * Book ID boundaries
 */
export const BOOK_ID_MIN = 1;
export const BOOK_ID_MAX = 66;
export const OLD_TESTAMENT_MAX_BOOK_ID = 39;
export const NEW_TESTAMENT_MIN_BOOK_ID = 40;

/**
 * Default reading position (Genesis 1)
 */
export const DEFAULT_BOOK_ID = 1;
export const DEFAULT_CHAPTER = 1;

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if a value is a valid ContentTabType
 */
export function isContentTabType(value: unknown): value is ContentTabType {
  return (
    typeof value === 'string' && (value === 'summary' || value === 'byline' || value === 'detailed')
  );
}

/**
 * Type guard to check if a value is a valid ViewModeType
 */
export function isViewModeType(value: unknown): value is ViewModeType {
  return typeof value === 'string' && (value === 'bible' || value === 'explanations');
}

/**
 * Type guard to check if a value is a valid Testament
 */
export function isTestament(value: unknown): value is Testament {
  return typeof value === 'string' && (value === 'OT' || value === 'NT');
}

/**
 * Validate if book ID is within valid range
 */
export function isValidBookId(bookId: number): boolean {
  return Number.isInteger(bookId) && bookId >= BOOK_ID_MIN && bookId <= BOOK_ID_MAX;
}

/**
 * Validate if chapter number is positive integer
 */
export function isValidChapterNumber(chapterNumber: number): boolean {
  return Number.isInteger(chapterNumber) && chapterNumber >= 1;
}

/**
 * Get testament from book ID
 */
export function getTestamentFromBookId(bookId: number): Testament {
  return bookId <= OLD_TESTAMENT_MAX_BOOK_ID ? 'OT' : 'NT';
}

// ============================================================================
// Navigation Types (for page-based swipe navigation)
// ============================================================================

/**
 * Chapter location reference (bookId + chapterNumber)
 * Used for navigation calculations in page-based swipe navigation
 */
export interface ChapterLocation {
  /** Book ID (1-66) */
  bookId: number;
  /** Chapter number (1-based) */
  chapterNumber: number;
}

/**
 * Navigation metadata for current chapter
 * Contains references to next/previous chapters and navigation availability flags
 */
export interface ChapterNavigation {
  /** Next chapter reference, or null if at Bible end (Revelation 22) */
  nextChapter: ChapterLocation | null;
  /** Previous chapter reference, or null if at Bible start (Genesis 1) */
  prevChapter: ChapterLocation | null;
  /** Whether next navigation is available */
  canGoNext: boolean;
  /** Whether previous navigation is available */
  canGoPrevious: boolean;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Async storage result type
 */
export type AsyncStorageResult<T> = {
  data: T | null;
  error: Error | null;
};

/**
 * Loading state for async operations
 */
export interface LoadingState {
  isLoading: boolean;
  error: Error | null;
}

/**
 * Combined hook return type for reading position
 */
export interface UseReadingPositionResult extends LoadingState {
  bookId: number;
  chapterNumber: number;
  savePosition: (bookId: number, chapterNumber: number) => Promise<void>;
}

/**
 * Combined hook return type for recent books
 */
export interface UseRecentBooksResult extends LoadingState {
  recentBooks: RecentBook[];
  addRecentBook: (bookId: number) => Promise<void>;
  clearRecentBooks: () => Promise<void>;
}

/**
 * Combined hook return type for active tab
 */
export interface UseActiveTabResult extends LoadingState {
  activeTab: ContentTabType;
  setActiveTab: (tab: ContentTabType) => Promise<void>;
}

/**
 * Combined hook return type for active view mode
 */
export interface UseActiveViewResult extends LoadingState {
  activeView: ViewModeType;
  setActiveView: (view: ViewModeType) => Promise<void>;
}

/**
 * Combined hook return type for book progress
 */
export interface UseBookProgressResult {
  progress: BookProgress;
  isCalculating: boolean;
}

/**
 * Combined hook return type for offline status
 */
export interface UseOfflineStatusResult {
  isOffline: boolean;
  isConnected: boolean;
  networkType: string | null;
}

/**
 * Combined hook return type for last read position
 */
export interface UseLastReadPositionResult extends LoadingState {
  lastPosition: LastReadPosition | null;
  savePosition: (position: Omit<LastReadPosition, 'timestamp'>) => Promise<void>;
  clearPosition: () => Promise<void>;
}
