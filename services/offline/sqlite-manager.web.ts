/**
 * SQLite Manager — web stub
 *
 * On web, all data is fetched from the API (online-only mode).
 * This module provides no-op stubs to prevent expo-sqlite from being imported.
 */

import type {
  BibleVerseData,
  CommentaryData,
  OfflineBookmark,
  OfflineHighlight,
  OfflineMetadata,
  OfflineNote,
  OfflineSyncAction,
  TopicData,
  TopicExplanationData,
  TopicReferenceData,
} from './types';

export async function initDatabase(): Promise<any> {
  return null;
}
export async function getDatabase(): Promise<any> {
  return null;
}
export async function resetDatabase(): Promise<any> {
  return null;
}
export async function closeDatabase(): Promise<void> {}
export async function insertBibleVerses(
  _versionKey: string,
  _verses: BibleVerseData[]
): Promise<void> {}
export async function getLocalBibleChapter(
  _bookId: number,
  _chapter: number,
  _versionKey: string
): Promise<BibleVerseData[]> {
  return [];
}
export async function isBibleVersionDownloaded(_versionKey: string): Promise<boolean> {
  return false;
}
export async function deleteBibleVersion(_versionKey: string): Promise<void> {}
export async function getSpecificVerses(
  _bookId: number,
  _chapter: number,
  _verses: number[],
  _versionKey: string
): Promise<BibleVerseData[]> {
  return [];
}
export async function insertCommentaries(
  _languageCode: string,
  _commentaries: CommentaryData[]
): Promise<void> {}
export async function getLocalCommentary(
  _bookId: number,
  _chapter: number,
  _languageCode: string
): Promise<CommentaryData[]> {
  return [];
}
export async function isCommentaryDownloaded(_languageCode: string): Promise<boolean> {
  return false;
}
export async function deleteCommentaries(_languageCode: string): Promise<void> {}
export async function insertTopics(_languageCode: string, _topics: TopicData[]): Promise<void> {}
export async function getLocalTopics(_languageCode: string): Promise<TopicData[]> {
  return [];
}
export async function isTopicsDownloaded(_languageCode: string): Promise<boolean> {
  return false;
}
export async function deleteTopics(_languageCode: string): Promise<void> {}
export async function getLocalTopic(
  _topicId: string,
  _languageCode: string
): Promise<TopicData | null> {
  return null;
}
export async function getLocalTopicReferences(
  _topicId: string
): Promise<TopicReferenceData | null> {
  return null;
}
export async function getLocalTopicExplanation(
  _topicId: string,
  _type: string,
  _languageCode: string
): Promise<TopicExplanationData | null> {
  return null;
}
export async function getLocalTopicExplanations(
  _topicId: string,
  _languageCode: string
): Promise<TopicExplanationData[]> {
  return [];
}
export async function insertUserNotes(_notes: OfflineNote[]): Promise<void> {}
export async function insertUserHighlights(_highlights: OfflineHighlight[]): Promise<void> {}
export async function insertUserBookmarks(_bookmarks: OfflineBookmark[]): Promise<void> {}
export async function getLocalNotes(_bookId: number, _chapter: number): Promise<OfflineNote[]> {
  return [];
}
export async function getLocalAllNotes(): Promise<OfflineNote[]> {
  return [];
}
export async function getLocalHighlights(
  _bookId: number,
  _chapter: number
): Promise<OfflineHighlight[]> {
  return [];
}
export async function getLocalAllHighlights(): Promise<OfflineHighlight[]> {
  return [];
}
export async function getLocalBookmarks(): Promise<OfflineBookmark[]> {
  return [];
}
export async function isUserDataDownloaded(): Promise<boolean> {
  return false;
}
export async function deleteAllUserData(): Promise<void> {}
export async function saveMetadata(_metadata: OfflineMetadata): Promise<void> {}
export async function getMetadata(_resourceKey: string): Promise<OfflineMetadata | null> {
  return null;
}
export async function getAllMetadata(): Promise<OfflineMetadata[]> {
  return [];
}
export async function addSyncAction(
  _type: string,
  _action: string,
  _payload: object
): Promise<void> {}
export async function getPendingSyncActions(): Promise<OfflineSyncAction[]> {
  return [];
}
export async function updateSyncActionStatus(_id: number, _status: string): Promise<void> {}
export async function deleteSyncAction(_id: number): Promise<void> {}
export async function addLocalNote(_note: OfflineNote): Promise<void> {}
export async function updateLocalNote(_noteId: string, _content: string): Promise<void> {}
export async function deleteLocalNote(_noteId: string): Promise<void> {}
export async function addLocalHighlight(_highlight: OfflineHighlight): Promise<void> {}
export async function updateLocalHighlightColor(
  _highlightId: number,
  _color: string
): Promise<void> {}
export async function deleteLocalHighlight(_highlightId: number): Promise<void> {}
export async function addLocalBookmark(_bookmark: OfflineBookmark): Promise<void> {}
export async function deleteLocalBookmark(_bookmarkId: number): Promise<void> {}
export async function deleteLocalBookmarkByChapter(
  _bookId: number,
  _chapter: number
): Promise<void> {}
export async function deleteAllOfflineData(): Promise<void> {}
export async function getTotalStorageUsed(): Promise<number> {
  return 0;
}
