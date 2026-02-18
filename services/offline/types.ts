/**
 * Offline Mode Types
 *
 * Type definitions for offline data storage and sync
 */

// Manifest types (from backend)
export interface BibleVersionManifest {
  key: string;
  name: string;
  language: string;
  updated_at: string;
  size_bytes: number;
}

export interface CommentaryLanguageManifest {
  code: string;
  name: string;
  updated_at: string;
  size_bytes: number;
}

export interface TopicLanguageManifest {
  code: string;
  name: string;
  updated_at: string;
  size_bytes: number;
}

export interface OfflineManifest {
  bible_versions: BibleVersionManifest[];
  commentary_languages: CommentaryLanguageManifest[];
  topic_languages: TopicLanguageManifest[];
}

// Bible data types
export interface BibleVerseData {
  book_id: number;
  chapter_number: number;
  verse_number: number;
  text: string;
}

// Commentary data types
export interface CommentaryData {
  explanation_id: number;
  book_id: number;
  chapter_number: number;
  verse_start: number | null;
  verse_end: number | null;
  type: string;
  explanation: string;
  language_code: string;
}

// Topic data types
export interface TopicData {
  topic_id: string;
  name: string;
  content: string;
  language_code: string;
  category: string;
  sort_order: number | null;
}

export interface TopicReferenceData {
  topic_id: string;
  reference_content: string;
}

export interface TopicExplanationData {
  topic_id: string;
  type: string;
  explanation: string;
  language_code: string;
}

export interface TopicsDownloadData {
  topics: TopicData[];
  references: TopicReferenceData[];
  explanations: TopicExplanationData[];
}

// Local metadata for tracking downloads
export interface OfflineMetadata {
  resource_key: string; // e.g., "bible:NASB1995", "commentary:en", "topics:en"
  last_updated_at: string;
  downloaded_at: string;
  size_bytes: number;
}

// Download status
export type DownloadStatus = 'not_downloaded' | 'downloading' | 'downloaded' | 'update_available';

export interface DownloadInfo {
  key: string;
  name: string;
  status: DownloadStatus;
  size_bytes: number;
  last_updated_at?: string;
  downloaded_at?: string;
}

// Sync progress
export interface SyncProgress {
  current: number;
  total: number;
  message?: string;
}

// User data types (from GET /offline/user-data)
export interface OfflineNote {
  note_id: string;
  book_id: number;
  chapter_number: number;
  verse_number: number | null;
  content: string;
  updated_at: string;
}

export interface OfflineHighlight {
  highlight_id: number;
  book_id: number;
  chapter_number: number;
  start_verse: number;
  end_verse: number;
  color: string;
  start_char: number | null;
  end_char: number | null;
  updated_at: string;
}

export interface OfflineBookmark {
  favorite_id: number;
  book_id: number;
  chapter_number: number;
  created_at: string;
}

export interface UserDataDownload {
  notes: OfflineNote[];
  highlights: OfflineHighlight[];
  bookmarks: OfflineBookmark[];
}

// Language bundle types for grouped downloads
export type LanguageBundleStatus =
  | 'not_downloaded'
  | 'downloading'
  | 'partially_downloaded'
  | 'downloaded'
  | 'update_available';

export interface LanguageBundle {
  languageCode: string;
  languageName: string;
  bibleVersions: BibleVersionManifest[];
  hasCommentaries: boolean;
  hasTopics: boolean;
  commentaryInfo?: CommentaryLanguageManifest;
  topicsInfo?: TopicLanguageManifest;
  totalSizeBytes: number;
  status: LanguageBundleStatus;
}
