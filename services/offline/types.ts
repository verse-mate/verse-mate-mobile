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
}

export interface TopicReferenceData {
  topic_id: string;
  book_id: number;
  chapter_number: number;
  verse_start: number;
  verse_end: number | null;
}

export interface TopicsDownloadData {
  topics: TopicData[];
  references: TopicReferenceData[];
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
