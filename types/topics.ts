/**
 * Shared Type Definitions for Topics Feature
 *
 * This file contains type definitions specific to the Topics UI components.
 * It extends and complements the API types from src/api/generated/types.gen.ts.
 *
 * Topics are categorized Bible content (Events, Prophecies, Parables) with
 * AI-generated explanations and Bible verse references.
 */

// ============================================================================
// Core Types
// ============================================================================

/**
 * Topic category type
 * - EVENT: Historical events in the Bible
 * - PROPHECY: Prophetic passages and their fulfillment
 * - PARABLE: Jesus' parables and teachings
 * - THEME: Thematic Bible topics (e.g., Faith, Love, Hope)
 */
export type TopicCategory = 'EVENT' | 'PROPHECY' | 'PARABLE' | 'THEME';

/**
 * Frontend-friendly category names (for UI display)
 */
export type TopicCategoryDisplay = 'EVENTS' | 'PROPHECIES' | 'PARABLES' | 'THEMES';

/**
 * Explanation type for topics
 */
export type TopicExplanationType = 'summary' | 'byline' | 'detailed';

/**
 * Topic item as returned by search/list endpoint
 */
export interface TopicListItem {
  /** Unique topic identifier (UUID) */
  topic_id: string;
  /** Topic name */
  name: string;
  /** Optional description */
  description?: string | null;
  /** Sort order within category (for chronological ordering) */
  sort_order?: number | null;
  /** Topic category */
  category?: TopicCategory;
}

/**
 * Complete topic details with metadata
 */
export interface TopicDetail {
  /** Unique topic identifier (UUID) */
  topic_id: string;
  /** Topic name */
  name: string;
  /** Optional description */
  description?: string | null;
  /** Topic category */
  category: TopicCategory;
  /** Sort order within category */
  sort_order?: number | null;
  /** Whether this topic is active */
  is_active?: boolean;
  /** Creation timestamp */
  created_at?: string;
  /** Last update timestamp */
  updated_at?: string;
}

/**
 * Topic references (Bible verses with parsed content)
 * Content includes placeholders replaced with actual Bible text
 */
export interface TopicReferences {
  /** Markdown content with injected Bible verses */
  content: string;
}

/**
 * Topic explanations (all types combined)
 */
export interface TopicExplanations {
  /** Brief summary of the topic */
  summary: string;
  /** Detailed by-line explanation */
  byline: string;
  /** In-depth detailed explanation */
  detailed: string;
}

/**
 * Single topic explanation
 */
export interface TopicExplanation {
  /** The explanation content (markdown) */
  explanation: string;
}

/**
 * Complete topic data (details + references + explanations)
 * As returned by GET /topics/:id
 */
export interface TopicFullData {
  /** Topic metadata */
  topic: TopicDetail;
  /** Bible references with parsed verses */
  references: TopicReferences | null;
  /** All explanation types */
  explanation: TopicExplanations;
}

// ============================================================================
// UI State Types
// ============================================================================

/**
 * Navigation state for the Topics navigation modal/tab
 * Tracks the user's current selection in the category/topic picker
 */
export interface TopicsNavigationState {
  /** Currently selected category */
  category: TopicCategory;
  /** Currently selected topic ID (UUID), null if no topic selected */
  selectedTopicId: string | null;
  /** Search/filter text for topic list */
  filterText: string;
}

/**
 * Recent topic entry for tracking user's reading history
 * Similar to RecentBook for Bible reading
 */
export interface RecentTopic {
  /** Topic ID (UUID) */
  topicId: string;
  /** Topic category */
  category: TopicCategory;
  /** Unix timestamp (milliseconds) when topic was last accessed */
  timestamp: number;
}

/**
 * Topic progress for navigation (similar to chapter navigation)
 */
export interface TopicProgress {
  /** Current topic sort order */
  currentSortOrder: number;
  /** Total topics in category */
  totalTopics: number;
  /** Has previous topic */
  hasPrevious: boolean;
  /** Has next topic */
  hasNext: boolean;
}

// ============================================================================
// Component Props Types
// ============================================================================

/**
 * Props for topic navigation (prev/next buttons and swipe gestures)
 */
export interface TopicNavigationProps {
  /** Current topic ID */
  topicId: string;
  /** Current topic category */
  category: TopicCategory;
  /** Current topic sort order */
  sortOrder: number;
  /** Callback when navigating to previous topic */
  onPrevious: () => void;
  /** Callback when navigating to next topic */
  onNext: () => void;
  /** Whether previous navigation is disabled */
  isPreviousDisabled: boolean;
  /** Whether next navigation is disabled */
  isNextDisabled: boolean;
}

/**
 * Props for topic list component
 */
export interface TopicsListProps {
  /** Category to display topics for */
  category: TopicCategory;
  /** Search/filter text */
  filterText?: string;
  /** Callback when a topic is selected */
  onTopicPress: (topicId: string) => void;
  /** Currently selected topic ID (for highlighting) */
  selectedTopicId?: string | null;
}

/**
 * Props for topic detail screen
 */
export interface TopicDetailProps {
  /** Topic ID to display */
  topicId: string;
  /** Bible version for verse references */
  bibleVersion?: string;
}

/**
 * Props for topic explanation component
 */
export interface TopicExplanationProps {
  /** Topic ID */
  topicId: string;
  /** Explanation type to display */
  type: TopicExplanationType;
  /** Language code (e.g., "en-US") */
  lang?: string;
}

// ============================================================================
// Utility Functions Type
// ============================================================================

/**
 * Category mapping helpers
 */
export interface TopicCategoryUtils {
  /** Convert frontend category to backend format */
  toBackend: (category: TopicCategoryDisplay) => TopicCategory;
  /** Convert backend category to frontend format */
  toFrontend: (category: TopicCategory) => TopicCategoryDisplay;
  /** Convert frontend category to display label */
  toLabel: (category: TopicCategoryDisplay) => string;
}

// ============================================================================
// Storage Keys
// ============================================================================

/**
 * AsyncStorage keys for Topics feature
 */
export const TOPICS_STORAGE_KEYS = {
  /** Key for storing recent topics */
  RECENT_TOPICS: '@verse-mate/recent-topics',
  /** Key for storing last viewed topic */
  LAST_TOPIC: '@verse-mate/last-topic',
  /** Key for storing active topic category */
  ACTIVE_CATEGORY: '@verse-mate/active-topic-category',
} as const;
