/**
 * Offline Sync Service
 *
 * Handles fetching offline data from the backend and storing it locally.
 * Manages download progress, update checks, and auto-sync functionality.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  deleteBibleVersion,
  deleteCommentaries,
  deleteTopics,
  getAllMetadata,
  getMetadata,
  insertBibleVerses,
  insertCommentaries,
  insertTopics,
  isBibleVersionDownloaded,
  isCommentaryDownloaded,
  isTopicsDownloaded,
  saveMetadata,
} from './sqlite-manager';
import type {
  BibleVerseData,
  CommentaryData,
  DownloadInfo,
  DownloadStatus,
  OfflineManifest,
  SyncProgress,
  TopicsDownloadData,
} from './types';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://api.versemate.org';
const LAST_SYNC_KEY = 'versemate:offline:last_sync';
const AUTO_SYNC_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

type ProgressCallback = (progress: SyncProgress) => void;

/**
 * Fetch the offline manifest from the server
 */
export async function fetchManifest(): Promise<OfflineManifest> {
  const response = await fetch(`${API_URL}/offline/manifest`);
  if (!response.ok) {
    throw new Error(`Failed to fetch manifest: ${response.status}`);
  }
  return response.json();
}

/**
 * Download and store a Bible version
 */
export async function downloadBibleVersion(
  versionKey: string,
  manifest: OfflineManifest,
  onProgress?: ProgressCallback
): Promise<void> {
  onProgress?.({ current: 0, total: 100, message: `Downloading ${versionKey}...` });

  const response = await fetch(`${API_URL}/offline/bible/${versionKey}`);
  if (!response.ok) {
    throw new Error(`Failed to download Bible version: ${response.status}`);
  }

  onProgress?.({ current: 30, total: 100, message: 'Processing data...' });

  const verses: BibleVerseData[] = await response.json();

  onProgress?.({ current: 50, total: 100, message: 'Storing locally...' });

  await insertBibleVerses(versionKey, verses);

  onProgress?.({ current: 90, total: 100, message: 'Saving metadata...' });

  // Find version info from manifest
  const versionInfo = manifest.bible_versions.find((v) => v.key === versionKey);

  await saveMetadata({
    resource_key: `bible:${versionKey}`,
    last_updated_at: versionInfo?.updated_at || new Date().toISOString(),
    downloaded_at: new Date().toISOString(),
    size_bytes: versionInfo?.size_bytes || 0,
  });

  onProgress?.({ current: 100, total: 100, message: 'Complete!' });
}

/**
 * Download and store commentaries for a language
 */
export async function downloadCommentaries(
  languageCode: string,
  manifest: OfflineManifest,
  onProgress?: ProgressCallback
): Promise<void> {
  onProgress?.({
    current: 0,
    total: 100,
    message: `Downloading commentaries (${languageCode})...`,
  });

  const response = await fetch(`${API_URL}/offline/commentaries/${languageCode}`);
  if (!response.ok) {
    throw new Error(`Failed to download commentaries: ${response.status}`);
  }

  onProgress?.({ current: 30, total: 100, message: 'Processing data...' });

  const commentaries: CommentaryData[] = await response.json();

  onProgress?.({ current: 50, total: 100, message: 'Storing locally...' });

  await insertCommentaries(languageCode, commentaries);

  onProgress?.({ current: 90, total: 100, message: 'Saving metadata...' });

  // Find language info from manifest
  const langInfo = manifest.commentary_languages.find((l) => l.code === languageCode);

  await saveMetadata({
    resource_key: `commentary:${languageCode}`,
    last_updated_at: langInfo?.updated_at || new Date().toISOString(),
    downloaded_at: new Date().toISOString(),
    size_bytes: langInfo?.size_bytes || 0,
  });

  onProgress?.({ current: 100, total: 100, message: 'Complete!' });
}

/**
 * Download and store topics for a language
 */
export async function downloadTopics(
  languageCode: string,
  manifest: OfflineManifest,
  onProgress?: ProgressCallback
): Promise<void> {
  onProgress?.({ current: 0, total: 100, message: `Downloading topics (${languageCode})...` });

  const response = await fetch(`${API_URL}/offline/topics/${languageCode}`);
  if (!response.ok) {
    throw new Error(`Failed to download topics: ${response.status}`);
  }

  onProgress?.({ current: 30, total: 100, message: 'Processing data...' });

  const data: TopicsDownloadData = await response.json();

  onProgress?.({ current: 50, total: 100, message: 'Storing locally...' });

  await insertTopics(languageCode, data.topics, data.references);

  onProgress?.({ current: 90, total: 100, message: 'Saving metadata...' });

  // Find language info from manifest
  const langInfo = manifest.topic_languages.find((l) => l.code === languageCode);

  await saveMetadata({
    resource_key: `topics:${languageCode}`,
    last_updated_at: langInfo?.updated_at || new Date().toISOString(),
    downloaded_at: new Date().toISOString(),
    size_bytes: langInfo?.size_bytes || 0,
  });

  onProgress?.({ current: 100, total: 100, message: 'Complete!' });
}

/**
 * Remove a Bible version
 */
export async function removeBibleVersion(versionKey: string): Promise<void> {
  await deleteBibleVersion(versionKey);
}

/**
 * Remove commentaries for a language
 */
export async function removeCommentaries(languageCode: string): Promise<void> {
  await deleteCommentaries(languageCode);
}

/**
 * Remove topics for a language
 */
export async function removeTopics(languageCode: string): Promise<void> {
  await deleteTopics(languageCode);
}

/**
 * Get download status for a Bible version
 */
async function getBibleVersionStatus(
  versionKey: string,
  manifest: OfflineManifest
): Promise<DownloadStatus> {
  const isDownloaded = await isBibleVersionDownloaded(versionKey);
  if (!isDownloaded) return 'not_downloaded';

  const metadata = await getMetadata(`bible:${versionKey}`);
  if (!metadata) return 'downloaded';

  const versionInfo = manifest.bible_versions.find((v) => v.key === versionKey);
  if (versionInfo && new Date(versionInfo.updated_at) > new Date(metadata.last_updated_at)) {
    return 'update_available';
  }

  return 'downloaded';
}

/**
 * Get download status for commentaries
 */
async function getCommentaryStatus(
  languageCode: string,
  manifest: OfflineManifest
): Promise<DownloadStatus> {
  const isDownloaded = await isCommentaryDownloaded(languageCode);
  if (!isDownloaded) return 'not_downloaded';

  const metadata = await getMetadata(`commentary:${languageCode}`);
  if (!metadata) return 'downloaded';

  const langInfo = manifest.commentary_languages.find((l) => l.code === languageCode);
  if (langInfo && new Date(langInfo.updated_at) > new Date(metadata.last_updated_at)) {
    return 'update_available';
  }

  return 'downloaded';
}

/**
 * Get download status for topics
 */
async function getTopicsStatus(
  languageCode: string,
  manifest: OfflineManifest
): Promise<DownloadStatus> {
  const isDownloaded = await isTopicsDownloaded(languageCode);
  if (!isDownloaded) return 'not_downloaded';

  const metadata = await getMetadata(`topics:${languageCode}`);
  if (!metadata) return 'downloaded';

  const langInfo = manifest.topic_languages.find((l) => l.code === languageCode);
  if (langInfo && new Date(langInfo.updated_at) > new Date(metadata.last_updated_at)) {
    return 'update_available';
  }

  return 'downloaded';
}

/**
 * Get download info for all Bible versions
 */
export async function getBibleVersionsDownloadInfo(
  manifest: OfflineManifest
): Promise<DownloadInfo[]> {
  const results: DownloadInfo[] = [];

  for (const version of manifest.bible_versions) {
    const status = await getBibleVersionStatus(version.key, manifest);
    const metadata = await getMetadata(`bible:${version.key}`);

    results.push({
      key: version.key,
      name: version.name,
      status,
      size_bytes: version.size_bytes,
      last_updated_at: version.updated_at,
      downloaded_at: metadata?.downloaded_at,
    });
  }

  return results;
}

/**
 * Get download info for all commentary languages
 */
export async function getCommentaryDownloadInfo(
  manifest: OfflineManifest
): Promise<DownloadInfo[]> {
  const results: DownloadInfo[] = [];

  for (const lang of manifest.commentary_languages) {
    const status = await getCommentaryStatus(lang.code, manifest);
    const metadata = await getMetadata(`commentary:${lang.code}`);

    results.push({
      key: lang.code,
      name: lang.name,
      status,
      size_bytes: lang.size_bytes,
      last_updated_at: lang.updated_at,
      downloaded_at: metadata?.downloaded_at,
    });
  }

  return results;
}

/**
 * Get download info for all topic languages
 */
export async function getTopicsDownloadInfo(manifest: OfflineManifest): Promise<DownloadInfo[]> {
  const results: DownloadInfo[] = [];

  for (const lang of manifest.topic_languages) {
    const status = await getTopicsStatus(lang.code, manifest);
    const metadata = await getMetadata(`topics:${lang.code}`);

    results.push({
      key: lang.code,
      name: lang.name,
      status,
      size_bytes: lang.size_bytes,
      last_updated_at: lang.updated_at,
      downloaded_at: metadata?.downloaded_at,
    });
  }

  return results;
}

/**
 * Get list of downloaded Bible version keys
 */
export async function getDownloadedBibleVersions(): Promise<string[]> {
  const metadata = await getAllMetadata();
  return metadata
    .filter((m) => m.resource_key.startsWith('bible:'))
    .map((m) => m.resource_key.replace('bible:', ''));
}

/**
 * Get list of downloaded commentary language codes
 */
export async function getDownloadedCommentaryLanguages(): Promise<string[]> {
  const metadata = await getAllMetadata();
  return metadata
    .filter((m) => m.resource_key.startsWith('commentary:'))
    .map((m) => m.resource_key.replace('commentary:', ''));
}

/**
 * Get list of downloaded topic language codes
 */
export async function getDownloadedTopicLanguages(): Promise<string[]> {
  const metadata = await getAllMetadata();
  return metadata
    .filter((m) => m.resource_key.startsWith('topics:'))
    .map((m) => m.resource_key.replace('topics:', ''));
}

/**
 * Check for updates and download if available
 */
export async function checkAndSyncUpdates(onProgress?: ProgressCallback): Promise<void> {
  const manifest = await fetchManifest();
  const metadata = await getAllMetadata();

  let updated = 0;
  const total = metadata.length;

  for (const meta of metadata) {
    const [type, key] = meta.resource_key.split(':');

    let serverUpdatedAt: string | undefined;

    if (type === 'bible') {
      const versionInfo = manifest.bible_versions.find((v) => v.key === key);
      serverUpdatedAt = versionInfo?.updated_at;
    } else if (type === 'commentary') {
      const langInfo = manifest.commentary_languages.find((l) => l.code === key);
      serverUpdatedAt = langInfo?.updated_at;
    } else if (type === 'topics') {
      const langInfo = manifest.topic_languages.find((l) => l.code === key);
      serverUpdatedAt = langInfo?.updated_at;
    }

    if (serverUpdatedAt && new Date(serverUpdatedAt) > new Date(meta.last_updated_at)) {
      onProgress?.({
        current: updated,
        total,
        message: `Updating ${type}: ${key}...`,
      });

      if (type === 'bible') {
        await downloadBibleVersion(key, manifest);
      } else if (type === 'commentary') {
        await downloadCommentaries(key, manifest);
      } else if (type === 'topics') {
        await downloadTopics(key, manifest);
      }

      updated++;
    }
  }

  // Save last sync time
  await AsyncStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());

  onProgress?.({
    current: total,
    total,
    message: updated > 0 ? `Updated ${updated} items` : 'Everything is up to date',
  });
}

/**
 * Get last sync timestamp
 */
export async function getLastSyncTime(): Promise<Date | null> {
  const lastSync = await AsyncStorage.getItem(LAST_SYNC_KEY);
  return lastSync ? new Date(lastSync) : null;
}

/**
 * Check if auto-sync should run
 */
export async function shouldAutoSync(): Promise<boolean> {
  const lastSync = await getLastSyncTime();
  if (!lastSync) return true;

  const timeSinceLastSync = Date.now() - lastSync.getTime();
  return timeSinceLastSync > AUTO_SYNC_INTERVAL;
}

/**
 * Run auto-sync if needed
 */
export async function runAutoSyncIfNeeded(): Promise<void> {
  try {
    if (await shouldAutoSync()) {
      await checkAndSyncUpdates();
    }
  } catch (error) {
    console.warn('Auto-sync failed:', error);
  }
}
