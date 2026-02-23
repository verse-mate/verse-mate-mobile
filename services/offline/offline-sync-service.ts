/**
 * Offline Sync Service
 *
 * Handles fetching offline data from the backend and storing it locally.
 * Manages download progress, update checks, and auto-sync functionality.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { authenticatedFetch } from '@/lib/api/authenticated-fetch';
import {
  deleteBibleVersion,
  deleteCommentaries,
  deleteSyncAction,
  deleteTopics,
  getAllMetadata,
  getMetadata,
  getPendingSyncActions,
  insertBibleVerses,
  insertCommentaries,
  insertTopics,
  insertUserBookmarks,
  insertUserHighlights,
  insertUserNotes,
  isBibleVersionDownloaded,
  isCommentaryDownloaded,
  isTopicsDownloaded,
  saveMetadata,
  updateSyncActionStatus,
} from './sqlite-manager';
import type {
  BibleVerseData,
  CommentaryData,
  DownloadInfo,
  DownloadStatus,
  LanguageBundle,
  LanguageBundleStatus,
  OfflineManifest,
  SyncProgress,
  TopicsDownloadData,
  UserDataDownload,
} from './types';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://api.versemate.org';
const LAST_SYNC_KEY = 'versemate:offline:last_sync';
const AUTO_SYNC_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

type ProgressCallback = (progress: SyncProgress) => void;

/**
 * Fetch JSON from the offline API without compression.
 * React Native's fetch doesn't reliably handle gzip auto-decompression,
 * so we request identity encoding to get plain JSON.
 */
async function fetchOfflineJSON<T>(url: string): Promise<T> {
  if (__DEV__) {
    console.log(`[Offline Sync] Fetching: ${url}`);
  }
  const start = Date.now();
  const response = await fetch(url, {
    headers: { 'Accept-Encoding': 'identity' },
  });
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  const text = await response.text();
  if (__DEV__) {
    console.log(
      `[Offline Sync] Received ${(text.length / 1024).toFixed(0)}KB in ${Date.now() - start}ms`
    );
  }
  return JSON.parse(text);
}

/**
 * Fetch the offline manifest from the server
 */
export async function fetchManifest(): Promise<OfflineManifest> {
  return fetchOfflineJSON<OfflineManifest>(`${API_URL}/offline/manifest`);
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

  onProgress?.({ current: 30, total: 100, message: 'Processing data...' });

  const verses = await fetchOfflineJSON<BibleVerseData[]>(`${API_URL}/offline/bible/${versionKey}`);

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

  onProgress?.({ current: 30, total: 100, message: 'Processing data...' });

  const commentaries = await fetchOfflineJSON<CommentaryData[]>(
    `${API_URL}/offline/commentaries/${languageCode}`
  );

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

  onProgress?.({ current: 30, total: 100, message: 'Processing data...' });

  const data = await fetchOfflineJSON<TopicsDownloadData>(
    `${API_URL}/offline/topics/${languageCode}`
  );

  onProgress?.({ current: 50, total: 100, message: 'Storing locally...' });

  await insertTopics(languageCode, data.topics, data.references, data.explanations);

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
 * Check for updates and download if available.
 *
 * Two passes:
 * 1. Update pass — re-downloads any already-downloaded resource whose
 *    server `updated_at` is newer than the local copy.
 * 2. New-content pass — for every language where the user has *any*
 *    downloaded content (commentary OR topics), automatically download
 *    newly available content types for that same language so the user
 *    doesn't have to manually fetch them.
 */
export async function checkAndSyncUpdates(onProgress?: ProgressCallback): Promise<void> {
  const manifest = await fetchManifest();
  const metadata = await getAllMetadata();

  let updated = 0;

  // --- Pass 1: update existing downloads ---
  const existingKeys = new Set(metadata.map((m) => m.resource_key));

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
        total: metadata.length,
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

  // --- Pass 2: detect newly available content for already-downloaded languages ---
  // Collect language codes the user has downloaded commentary or topics for.
  const downloadedCommentaryLangs = new Set<string>();
  const downloadedTopicLangs = new Set<string>();

  for (const meta of metadata) {
    const [type, key] = meta.resource_key.split(':');
    if (type === 'commentary') downloadedCommentaryLangs.add(key);
    if (type === 'topics') downloadedTopicLangs.add(key);
  }

  // If user has commentaries for a language, auto-download topics when they appear
  for (const langCode of downloadedCommentaryLangs) {
    if (
      !existingKeys.has(`topics:${langCode}`) &&
      manifest.topic_languages.some((l) => l.code === langCode)
    ) {
      onProgress?.({
        current: updated,
        total: metadata.length + 1,
        message: `Downloading new topics (${langCode})...`,
      });

      await downloadTopics(langCode, manifest);
      updated++;
    }
  }

  // If user has topics for a language, auto-download commentaries when they appear
  for (const langCode of downloadedTopicLangs) {
    if (
      !existingKeys.has(`commentary:${langCode}`) &&
      manifest.commentary_languages.some((l) => l.code === langCode)
    ) {
      onProgress?.({
        current: updated,
        total: metadata.length + 1,
        message: `Downloading new commentaries (${langCode})...`,
      });

      await downloadCommentaries(langCode, manifest);
      updated++;
    }
  }

  // Save last sync time
  await AsyncStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());

  onProgress?.({
    current: metadata.length + updated,
    total: metadata.length + updated,
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

// ============================================================================
// Language Bundle Operations
// ============================================================================

/**
 * Normalize language codes for grouping.
 * Bible versions use "en-US" style, commentaries/topics use "en" style.
 */
export function normalizeLanguageCode(code: string): string {
  return code.split('-')[0].toLowerCase();
}

/**
 * Build language bundles from manifest by grouping content by language
 */
export function buildLanguageBundles(manifest: OfflineManifest): LanguageBundle[] {
  const languageMap = new Map<string, LanguageBundle>();

  for (const version of manifest.bible_versions) {
    const code = normalizeLanguageCode(version.language);
    if (!languageMap.has(code)) {
      languageMap.set(code, {
        languageCode: code,
        languageName: '',
        bibleVersions: [],
        hasCommentaries: false,
        hasTopics: false,
        totalSizeBytes: 0,
        status: 'not_downloaded',
      });
    }
    const bundle = languageMap.get(code);
    if (!bundle) continue;
    bundle.bibleVersions.push(version);
    bundle.totalSizeBytes += version.size_bytes;
  }

  for (const commentary of manifest.commentary_languages) {
    const code = commentary.code;
    if (!languageMap.has(code)) {
      languageMap.set(code, {
        languageCode: code,
        languageName: commentary.name,
        bibleVersions: [],
        hasCommentaries: false,
        hasTopics: false,
        totalSizeBytes: 0,
        status: 'not_downloaded',
      });
    }
    const bundle = languageMap.get(code);
    if (!bundle) continue;
    bundle.hasCommentaries = true;
    bundle.commentaryInfo = commentary;
    bundle.totalSizeBytes += commentary.size_bytes;
    if (!bundle.languageName) bundle.languageName = commentary.name;
  }

  for (const topic of manifest.topic_languages) {
    const code = topic.code;
    if (!languageMap.has(code)) {
      languageMap.set(code, {
        languageCode: code,
        languageName: topic.name,
        bibleVersions: [],
        hasCommentaries: false,
        hasTopics: false,
        totalSizeBytes: 0,
        status: 'not_downloaded',
      });
    }
    const bundle = languageMap.get(code);
    if (!bundle) continue;
    bundle.hasTopics = true;
    bundle.topicsInfo = topic;
    bundle.totalSizeBytes += topic.size_bytes;
    if (!bundle.languageName) bundle.languageName = topic.name;
  }

  return Array.from(languageMap.values());
}

/**
 * Determine the download status for a language bundle
 */
export async function getLanguageBundleStatus(
  bundle: LanguageBundle,
  manifest: OfflineManifest
): Promise<LanguageBundleStatus> {
  let totalItems = bundle.bibleVersions.length;
  if (bundle.hasCommentaries) totalItems++;
  if (bundle.hasTopics) totalItems++;

  let downloadedItems = 0;
  let hasUpdate = false;

  for (const version of bundle.bibleVersions) {
    const status = await getBibleVersionStatus(version.key, manifest);
    if (status === 'downloaded') downloadedItems++;
    if (status === 'update_available') {
      downloadedItems++;
      hasUpdate = true;
    }
  }

  if (bundle.hasCommentaries) {
    const status = await getCommentaryStatus(bundle.languageCode, manifest);
    if (status === 'downloaded') downloadedItems++;
    if (status === 'update_available') {
      downloadedItems++;
      hasUpdate = true;
    }
  }

  if (bundle.hasTopics) {
    const status = await getTopicsStatus(bundle.languageCode, manifest);
    if (status === 'downloaded') downloadedItems++;
    if (status === 'update_available') {
      downloadedItems++;
      hasUpdate = true;
    }
  }

  if (downloadedItems === 0) return 'not_downloaded';
  if (hasUpdate) return 'update_available';
  if (downloadedItems < totalItems) return 'partially_downloaded';
  return 'downloaded';
}

/**
 * Download all content for a language (Bible versions + commentaries + topics)
 */
export async function downloadLanguageBundle(
  languageCode: string,
  manifest: OfflineManifest,
  onProgress?: ProgressCallback
): Promise<void> {
  const bibleVersions = manifest.bible_versions.filter(
    (v) => normalizeLanguageCode(v.language) === languageCode
  );
  const hasCommentary = manifest.commentary_languages.some((c) => c.code === languageCode);
  const hasTopics = manifest.topic_languages.some((t) => t.code === languageCode);

  const steps: { label: string; fn: () => Promise<void> }[] = [];

  for (const version of bibleVersions) {
    steps.push({
      label: `Bible: ${version.name}`,
      fn: () => downloadBibleVersion(version.key, manifest),
    });
  }
  if (hasCommentary) {
    steps.push({
      label: 'Commentaries',
      fn: () => downloadCommentaries(languageCode, manifest),
    });
  }
  if (hasTopics) {
    steps.push({
      label: 'Topics',
      fn: () => downloadTopics(languageCode, manifest),
    });
  }

  const total = steps.length;
  for (let i = 0; i < steps.length; i++) {
    onProgress?.({
      current: i,
      total,
      message: `Downloading ${steps[i].label}...`,
    });
    await steps[i].fn();
  }

  onProgress?.({ current: total, total, message: 'Complete!' });
}

/**
 * Delete all content for a language
 */
export async function deleteLanguageBundle(
  languageCode: string,
  manifest: OfflineManifest
): Promise<void> {
  const bibleVersions = manifest.bible_versions.filter(
    (v) => normalizeLanguageCode(v.language) === languageCode
  );

  for (const version of bibleVersions) {
    await removeBibleVersion(version.key);
  }

  const hasCommentary = manifest.commentary_languages.some((c) => c.code === languageCode);
  if (hasCommentary) {
    await removeCommentaries(languageCode);
  }

  const hasTopics = manifest.topic_languages.some((t) => t.code === languageCode);
  if (hasTopics) {
    await removeTopics(languageCode);
  }
}

// ============================================================================
// User Data Operations
// ============================================================================

/**
 * Download and store user data (notes, highlights, bookmarks)
 */
export async function downloadUserData(onProgress?: ProgressCallback): Promise<void> {
  onProgress?.({ current: 0, total: 100, message: 'Syncing user data...' });

  const response = await authenticatedFetch(`${API_URL}/offline/user-data`, {
    headers: { 'Accept-Encoding': 'identity' },
  });
  if (response.status === 401) {
    throw new Error('User data download failed: session expired, please log in again');
  }
  if (!response.ok) {
    throw new Error(`Failed to download user data: ${response.status}`);
  }

  onProgress?.({ current: 30, total: 100, message: 'Processing user data...' });

  const text = await response.text();
  const data: UserDataDownload = JSON.parse(text);

  onProgress?.({ current: 50, total: 100, message: 'Storing notes...' });
  await insertUserNotes(data.notes);

  onProgress?.({ current: 70, total: 100, message: 'Storing highlights...' });
  await insertUserHighlights(data.highlights);

  onProgress?.({ current: 85, total: 100, message: 'Storing bookmarks...' });
  await insertUserBookmarks(data.bookmarks);

  onProgress?.({ current: 95, total: 100, message: 'Saving metadata...' });

  const estimatedSize = JSON.stringify(data).length;
  await saveMetadata({
    resource_key: 'user-data',
    last_updated_at: new Date().toISOString(),
    downloaded_at: new Date().toISOString(),
    size_bytes: estimatedSize,
  });

  onProgress?.({ current: 100, total: 100, message: 'User data synced!' });
}

// ============================================================================
// Sync Queue Processing
// ============================================================================

export async function processSyncQueue(): Promise<void> {
  const actions = await getPendingSyncActions();
  if (actions.length === 0) return;

  console.log(`[Offline Sync] Processing ${actions.length} pending actions`);

  // Process sequentially to ensure order
  for (const action of actions) {
    try {
      await updateSyncActionStatus(action.id, 'SYNCING');
      const payload = JSON.parse(action.payload);

      if (action.type === 'NOTE') {
        if (action.action === 'CREATE') {
          await authenticatedFetch(`${API_URL}/bible-book-note/add`, {
            method: 'POST',
            body: JSON.stringify(payload),
          });
        } else if (action.action === 'UPDATE') {
          await authenticatedFetch(`${API_URL}/bible-book-note/update`, {
            method: 'PUT',
            body: JSON.stringify(payload),
          });
        } else if (action.action === 'DELETE') {
          await authenticatedFetch(`${API_URL}/bible-book-note/remove?note_id=${payload.note_id}`, {
            method: 'DELETE',
          });
        }
      } else if (action.type === 'HIGHLIGHT') {
        if (action.action === 'CREATE') {
          await authenticatedFetch(`${API_URL}/bible-highlight/add`, {
            method: 'POST',
            body: JSON.stringify(payload),
          });
        } else if (action.action === 'UPDATE') {
          // payload includes highlight_id for path param
          const { highlight_id, ...body } = payload;
          await authenticatedFetch(`${API_URL}/bible-highlight/${highlight_id}`, {
            method: 'PUT',
            body: JSON.stringify(body),
          });
        } else if (action.action === 'DELETE') {
          const { highlight_id } = payload;
          await authenticatedFetch(`${API_URL}/bible-highlight/${highlight_id}`, {
            method: 'DELETE',
          });
        }
      } else if (action.type === 'BOOKMARK') {
        if (action.action === 'CREATE') {
          await authenticatedFetch(`${API_URL}/bible-book-bookmark/add`, {
            method: 'POST',
            body: JSON.stringify(payload),
          });
        } else if (action.action === 'DELETE') {
          const query = new URLSearchParams();
          // Allow deleting by favorite_id OR by book/chapter
          if (payload.favorite_id) query.append('favorite_id', String(payload.favorite_id));
          if (payload.book_id) query.append('book_id', String(payload.book_id));
          if (payload.chapter_number)
            query.append('chapter_number', String(payload.chapter_number));
          if (payload.insight_type) query.append('insight_type', String(payload.insight_type));
          if (payload.user_id) query.append('user_id', String(payload.user_id));

          await authenticatedFetch(`${API_URL}/bible-book-bookmark/remove?${query.toString()}`, {
            method: 'DELETE',
          });
        }
      }

      await deleteSyncAction(action.id);
    } catch (e) {
      console.error(`[Offline Sync] Action ${action.id} failed:`, e);
      // Mark as failed and increment retry count
      await updateSyncActionStatus(action.id, 'FAILED', action.retry_count + 1);
    }
  }

  // After processing queue, trigger a user data sync to refresh local IDs and ensure consistency
  // Use fire-and-forget
  downloadUserData().catch((e) => console.warn('[Offline Sync] Post-queue sync failed:', e));
}
