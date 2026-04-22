/**
 * Offline Context
 *
 * Provides global state management for offline mode functionality.
 * Handles download state, sync operations, and offline mode toggling.
 * Supports language-based bundled downloads and user data sync.
 */

import { useAuth } from '@/contexts/AuthContext';
import {
  buildLanguageBundles,
  checkAndSyncUpdates,
  closeDatabase,
  deleteAllOfflineData,
  deleteLanguageBundle as deleteLanguageBundleService,
  downloadBibleBook as downloadBibleBookService,
  downloadBibleVersion as downloadBibleVersionService,
  downloadCommentaries as downloadCommentariesService,
  downloadLanguageBundle as downloadLanguageBundleService,
  downloadTopics as downloadTopicsService,
  downloadUserData as downloadUserDataService,
  fetchManifest,
  getBibleVersionsDownloadInfo,
  getCommentaryDownloadInfo,
  getDownloadedBibleVersions,
  getDownloadedBooksForVersion,
  getDownloadedCommentaryLanguages,
  getDownloadedTopicLanguages,
  getLanguageBundleStatus,
  getLastSyncTime,
  getTopicsDownloadInfo,
  getTotalStorageUsed,
  initDatabase,
  isUserDataDownloaded,
  processSyncQueue,
  removeBibleBook,
  removeBibleVersion,
  removeCommentaries,
  removeTopics,
  runAutoSyncIfNeeded,
  type DownloadInfo,
  type LanguageBundle,
  type OfflineManifest,
  type SyncProgress,
} from '@/services/offline';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNetInfo } from '@react-native-community/netinfo';
import { useQueryClient } from '@tanstack/react-query';
import { InteractionManager, Platform } from 'react-native';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

const AUTO_SYNC_KEY = 'versemate:offline:auto_sync_enabled';

export interface OfflineContextType {
  // Mode
  isAutoSyncEnabled: boolean;
  setAutoSyncEnabled: (enabled: boolean) => void;
  isOnline: boolean;

  // State
  isInitialized: boolean;
  manifest: OfflineManifest | null;

  // Downloaded content
  downloadedBibleVersions: string[];
  /** Map of Bible version key -> array of downloaded book IDs (book-level granularity). */
  downloadedBibleBooks: Record<string, number[]>;
  downloadedCommentaryLanguages: string[];
  downloadedTopicLanguages: string[];

  // Download info (with status)
  bibleVersionsInfo: DownloadInfo[];
  commentaryInfo: DownloadInfo[];
  topicsInfo: DownloadInfo[];

  // Language bundles
  languageBundles: LanguageBundle[];

  // User data
  isUserDataSynced: boolean;

  // Sync state
  isSyncing: boolean;
  syncProgress: SyncProgress | null;
  lastSyncTime: Date | null;
  setLastSyncTime: (date: Date | null) => void;

  // Storage
  totalStorageUsed: number;

  // Actions
  refreshManifest: () => Promise<OfflineManifest | null>;
  downloadBibleVersion: (versionKey: string) => Promise<void>;
  downloadBibleBook: (versionKey: string, bookId: number) => Promise<void>;
  deleteBibleBook: (versionKey: string, bookId: number) => Promise<void>;
  downloadCommentaries: (languageCode: string) => Promise<void>;
  downloadTopics: (languageCode: string) => Promise<void>;
  deleteBibleVersion: (versionKey: string) => Promise<void>;
  deleteCommentaries: (languageCode: string) => Promise<void>;
  deleteTopics: (languageCode: string) => Promise<void>;
  deleteAllData: () => Promise<void>;
  checkForUpdates: () => Promise<void>;
  downloadLanguage: (languageCode: string) => Promise<void>;
  deleteLanguage: (languageCode: string) => Promise<void>;
  syncUserData: () => Promise<void>;
}

const OfflineContext = createContext<OfflineContextType | null>(null);

// No-op context value for web — all data comes from API, no SQLite
const webOnlyValue: OfflineContextType = {
  isAutoSyncEnabled: false,
  setAutoSyncEnabled: () => {},
  isOnline: true,
  isInitialized: true,
  manifest: null,
  downloadedBibleVersions: [],
  downloadedBibleBooks: {},
  downloadedCommentaryLanguages: [],
  downloadedTopicLanguages: [],
  bibleVersionsInfo: [],
  commentaryInfo: [],
  topicsInfo: [],
  languageBundles: [],
  isUserDataSynced: false,
  isSyncing: false,
  syncProgress: null,
  lastSyncTime: null,
  setLastSyncTime: () => {},
  totalStorageUsed: 0,
  refreshManifest: async () => null,
  downloadBibleVersion: async () => {},
  downloadBibleBook: async () => {},
  deleteBibleBook: async () => {},
  downloadCommentaries: async () => {},
  downloadTopics: async () => {},
  deleteBibleVersion: async () => {},
  deleteCommentaries: async () => {},
  deleteTopics: async () => {},
  deleteAllData: async () => {},
  checkForUpdates: async () => {},
  downloadLanguage: async () => {},
  deleteLanguage: async () => {},
  syncUserData: async () => {},
};

export function OfflineProvider({ children }: { children: ReactNode }) {
  // Web: skip SQLite initialization, all data fetched from API
  if (Platform.OS === 'web') {
    return <OfflineContext.Provider value={webOnlyValue}>{children}</OfflineContext.Provider>;
  }

  const { isAuthenticated } = useAuth();
  const netInfo = useNetInfo();
  const isOnline = netInfo.isConnected === true;

  const queryClient = useQueryClient();

  // React Query key helpers — matched against the `_id` field the generated
  // `createQueryKey` puts on the first segment, so renaming the generated
  // operation only requires updating these strings (and TS will eventually
  // surface it via the imported types).
  const CHAPTER_QUERY_ID = 'getBibleBookByBookIdByChapterNumber';
  const EXPLANATION_QUERY_ID = 'getBibleBookExplanationByBookIdByChapterNumber';
  const matchesBookId = (queryKey: unknown, bookId: number): boolean => {
    if (!Array.isArray(queryKey)) return false;
    const first = queryKey[0] as { path?: { bookId?: string } } | undefined;
    return first?.path?.bookId === String(bookId);
  };
  const matchesOperationId = (queryKey: unknown, id: string): boolean => {
    if (!Array.isArray(queryKey)) return false;
    const first = queryKey[0] as { _id?: string } | undefined;
    return first?._id === id;
  };

  // Mode state
  const [isAutoSyncEnabled, setAutoSyncEnabledState] = useState(true);

  // Initialization state
  const [isInitialized, setIsInitialized] = useState(false);
  const dbReady = useRef(false);
  const userDataSyncInProgress = useRef(false);
  const [manifest, setManifest] = useState<OfflineManifest | null>(null);

  // Downloaded content
  const [downloadedBibleVersions, setDownloadedBibleVersions] = useState<string[]>([]);
  const [downloadedBibleBooks, setDownloadedBibleBooks] = useState<Record<string, number[]>>({});
  const [downloadedCommentaryLanguages, setDownloadedCommentaryLanguages] = useState<string[]>([]);
  const [downloadedTopicLanguages, setDownloadedTopicLanguages] = useState<string[]>([]);

  // Download info
  const [bibleVersionsInfo, setBibleVersionsInfo] = useState<DownloadInfo[]>([]);
  const [commentaryInfo, setCommentaryInfo] = useState<DownloadInfo[]>([]);
  const [topicsInfo, setTopicsInfo] = useState<DownloadInfo[]>([]);

  // Language bundles
  const [languageBundles, setLanguageBundles] = useState<LanguageBundle[]>([]);

  // User data
  const [isUserDataSynced, setIsUserDataSynced] = useState(false);

  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  // Storage
  const [totalStorageUsed, setTotalStorageUsed] = useState(0);

  // Helper to refresh language bundle statuses
  const refreshLanguageBundles = useCallback(async (m: OfflineManifest) => {
    const bundles = buildLanguageBundles(m);
    const bundlesWithStatus = await Promise.all(
      bundles.map(async (bundle) => ({
        ...bundle,
        status: await getLanguageBundleStatus(bundle, m),
      }))
    );
    setLanguageBundles(bundlesWithStatus);
  }, []);

  // Helper to refresh all download state
  const refreshDownloadState = async (m: OfflineManifest) => {
    const [bibleVersions, commentaryLangs, topicLangs, storage] = await Promise.all([
      getDownloadedBibleVersions(),
      getDownloadedCommentaryLanguages(),
      getDownloadedTopicLanguages(),
      getTotalStorageUsed(),
    ]);

    setDownloadedBibleVersions(bibleVersions);
    setDownloadedCommentaryLanguages(commentaryLangs);
    setDownloadedTopicLanguages(topicLangs);
    setTotalStorageUsed(storage);

    const bookEntries = await Promise.all(
      bibleVersions.map(async (v) => [v, await getDownloadedBooksForVersion(v)] as const)
    );
    setDownloadedBibleBooks(Object.fromEntries(bookEntries));

    const [bibleInfo, commInfo, topicInfo] = await Promise.all([
      getBibleVersionsDownloadInfo(m),
      getCommentaryDownloadInfo(m),
      getTopicsDownloadInfo(m),
    ]);

    setBibleVersionsInfo(bibleInfo);
    setCommentaryInfo(commInfo);
    setTopicsInfo(topicInfo);

    await refreshLanguageBundles(m);
  };

  // Initialize database and load state
  useEffect(() => {
    async function initialize() {
      try {
        await initDatabase();

        const autoSync = await AsyncStorage.getItem(AUTO_SYNC_KEY);

        if (autoSync !== 'false') {
          setAutoSyncEnabledState(true);
        }

        const [bibleVersions, commentaryLangs, topicLangs] = await Promise.all([
          getDownloadedBibleVersions(),
          getDownloadedCommentaryLanguages(),
          getDownloadedTopicLanguages(),
        ]);

        if (__DEV__) {
          console.log('[Offline Context] Downloaded Bible versions:', bibleVersions);
          console.log('[Offline Context] Downloaded commentary langs:', commentaryLangs);
          console.log('[Offline Context] Downloaded topic langs:', topicLangs);
        }

        setDownloadedBibleVersions(bibleVersions);
        setDownloadedCommentaryLanguages(commentaryLangs);
        setDownloadedTopicLanguages(topicLangs);

        const bookEntries = await Promise.all(
          bibleVersions.map(async (v) => [v, await getDownloadedBooksForVersion(v)] as const)
        );
        setDownloadedBibleBooks(Object.fromEntries(bookEntries));

        const [syncTime, storage, userDataSynced] = await Promise.all([
          getLastSyncTime(),
          getTotalStorageUsed(),
          isUserDataDownloaded(),
        ]);

        setLastSyncTime(syncTime);
        setTotalStorageUsed(storage);
        setIsUserDataSynced(userDataSynced);

        setIsInitialized(true);
        dbReady.current = true;

        if (autoSync !== 'false') {
          InteractionManager.runAfterInteractions(() => {
            runAutoSyncIfNeeded().catch(console.warn);
          });
        }
      } catch (error) {
        console.error('Failed to initialize offline context:', error);
        setIsInitialized(true);
      }
    }

    initialize();

    // Close the database on unmount / hot-reload so the native connection
    // doesn't leak and hold a file lock that blocks subsequent sessions.
    return () => {
      closeDatabase().catch(console.warn);
    };
  }, []);

  // Coordinated reconnect: process sync queue then sync user data (single flow to prevent races)
  useEffect(() => {
    if (!isOnline || !isInitialized) return;

    const SYNC_THROTTLE = 60 * 60 * 1000; // 1 hour

    const syncOnReconnect = async () => {
      if (userDataSyncInProgress.current) return;
      userDataSyncInProgress.current = true;

      try {
        // 1. Process any pending sync queue first
        const queueResult = await processSyncQueue();

        // 2. Then sync user data if authenticated
        if (isAuthenticated && dbReady.current) {
          const lastSync = await getLastSyncTime();
          // Force sync if queue had items (local IDs need refresh), otherwise throttle
          const needsSync =
            queueResult.total > 0 ||
            !lastSync ||
            Date.now() - lastSync.getTime() >= SYNC_THROTTLE;

          if (needsSync) {
            await downloadUserDataService();
            setIsUserDataSynced(true);
            setLastSyncTime(new Date());
          } else if (__DEV__) {
            console.log('[Offline Context] Skipping user data auto-sync (synced recently)');
          }
        }
      } catch (error) {
        console.warn('[Offline Context] Reconnect sync failed:', error);
      } finally {
        userDataSyncInProgress.current = false;
      }
    };

    syncOnReconnect();
  }, [isOnline, isInitialized, isAuthenticated]);

  // Set auto-sync
  const setAutoSyncEnabled = (enabled: boolean) => {
    setAutoSyncEnabledState(enabled);
    AsyncStorage.setItem(AUTO_SYNC_KEY, enabled.toString()).catch(console.warn);
  };

  // Refresh manifest and download info. Returns the fresh manifest so callers
  // can use the up-to-date value synchronously — React's state update from
  // `setManifest` hasn't committed yet by the time this promise resolves, so
  // reading `manifest` from closure would be stale.
  const refreshManifest = useCallback(async (): Promise<OfflineManifest | null> => {
    if (!dbReady.current) {
      console.warn('[Offline] refreshManifest skipped — database not ready');
      return null;
    }
    try {
      const newManifest = await fetchManifest();
      setManifest(newManifest);

      const [bibleInfo, commInfo, topicInfo] = await Promise.all([
        getBibleVersionsDownloadInfo(newManifest),
        getCommentaryDownloadInfo(newManifest),
        getTopicsDownloadInfo(newManifest),
      ]);

      setBibleVersionsInfo(bibleInfo);
      setCommentaryInfo(commInfo);
      setTopicsInfo(topicInfo);

      await refreshLanguageBundles(newManifest);
      return newManifest;
    } catch (error) {
      console.error('Failed to refresh manifest:', error);
      throw error;
    }
  }, [refreshLanguageBundles]);

  // Return the current manifest, fetching it only once if missing. Reuses the
  // refreshManifest result so we don't fall back to a second `fetchManifest`
  // just because `manifest` state hasn't committed yet.
  const ensureManifest = async (): Promise<OfflineManifest> => {
    if (manifest) return manifest;
    const refreshed = await refreshManifest();
    return refreshed ?? (await fetchManifest());
  };

  // Download Bible version
  const downloadBibleVersion = async (versionKey: string) => {
    const currentManifest = await ensureManifest();

    setIsSyncing(true);
    try {
      await downloadBibleVersionService(versionKey, currentManifest, setSyncProgress);
      await refreshDownloadState(currentManifest);
    } finally {
      setIsSyncing(false);
      setSyncProgress(null);
    }
  };

  // Download a single Bible book
  const downloadBibleBook = async (versionKey: string, bookId: number) => {
    if (!isOnline) {
      const err = new Error('OFFLINE');
      (err as Error & { code?: string }).code = 'OFFLINE';
      throw err;
    }
    const currentManifest = await ensureManifest();

    setIsSyncing(true);
    try {
      await downloadBibleBookService(versionKey, bookId, currentManifest, setSyncProgress);
      await refreshDownloadState(currentManifest);
      // Invalidate chapter queries for this book so stale cached payloads don't
      // mask the newly-available local data.
      queryClient.invalidateQueries({
        predicate: (q) => matchesBookId(q.queryKey, bookId),
      });
    } finally {
      setIsSyncing(false);
      setSyncProgress(null);
    }
  };

  // Delete a single Bible book
  const deleteBibleBookAction = async (versionKey: string, bookId: number) => {
    await removeBibleBook(versionKey, bookId);
    if (manifest) {
      await refreshDownloadState(manifest);
    }
    // Hard-remove (not just invalidate) so the next chapter render doesn't get
    // the stale payload while the refetch is still in flight — `invalidate`
    // keeps `data` populated, which is exactly what we don't want here.
    queryClient.removeQueries({
      predicate: (q) => matchesBookId(q.queryKey, bookId),
    });
  };

  // Download commentaries
  const downloadCommentaries = async (languageCode: string) => {
    const currentManifest = await ensureManifest();

    setIsSyncing(true);
    try {
      await downloadCommentariesService(languageCode, currentManifest, setSyncProgress);
      await refreshDownloadState(currentManifest);
    } finally {
      setIsSyncing(false);
      setSyncProgress(null);
    }
  };

  // Download topics
  const downloadTopics = async (languageCode: string) => {
    const currentManifest = await ensureManifest();

    setIsSyncing(true);
    try {
      await downloadTopicsService(languageCode, currentManifest, setSyncProgress);
      await refreshDownloadState(currentManifest);
    } finally {
      setIsSyncing(false);
      setSyncProgress(null);
    }
  };

  // Download all content for a language
  const downloadLanguage = async (languageCode: string) => {
    const currentManifest = await ensureManifest();

    setIsSyncing(true);
    try {
      await downloadLanguageBundleService(languageCode, currentManifest, setSyncProgress);
      await refreshDownloadState(currentManifest);
    } finally {
      setIsSyncing(false);
      setSyncProgress(null);
    }
  };

  // Delete all content for a language
  const deleteLanguage = async (languageCode: string) => {
    if (!manifest) return;

    await deleteLanguageBundleService(languageCode, manifest);
    await refreshDownloadState(manifest);
  };

  // Delete Bible version
  const deleteBibleVersion = async (versionKey: string) => {
    await removeBibleVersion(versionKey);
    setDownloadedBibleVersions((prev) => prev.filter((k) => k !== versionKey));

    const storage = await getTotalStorageUsed();
    setTotalStorageUsed(storage);

    if (manifest) {
      const bibleInfo = await getBibleVersionsDownloadInfo(manifest);
      setBibleVersionsInfo(bibleInfo);
      await refreshLanguageBundles(manifest);
    }
  };

  // Delete commentaries
  const deleteCommentaries = async (languageCode: string) => {
    await removeCommentaries(languageCode);
    setDownloadedCommentaryLanguages((prev) => prev.filter((c) => c !== languageCode));

    const storage = await getTotalStorageUsed();
    setTotalStorageUsed(storage);

    if (manifest) {
      const commInfo = await getCommentaryDownloadInfo(manifest);
      setCommentaryInfo(commInfo);
      await refreshLanguageBundles(manifest);
    }
  };

  // Delete topics
  const deleteTopics = async (languageCode: string) => {
    await removeTopics(languageCode);
    setDownloadedTopicLanguages((prev) => prev.filter((c) => c !== languageCode));

    const storage = await getTotalStorageUsed();
    setTotalStorageUsed(storage);

    if (manifest) {
      const topicInfo = await getTopicsDownloadInfo(manifest);
      setTopicsInfo(topicInfo);
      await refreshLanguageBundles(manifest);
    }
  };

  // Sync user data manually
  const syncUserData = async () => {
    setIsSyncing(true);
    try {
      await downloadUserDataService(setSyncProgress);
      setIsUserDataSynced(true);

      const storage = await getTotalStorageUsed();
      setTotalStorageUsed(storage);
    } finally {
      setIsSyncing(false);
      setSyncProgress(null);
    }
  };

  // Delete all data
  const deleteAllData = async () => {
    await deleteAllOfflineData();
    setDownloadedBibleVersions([]);
    setDownloadedBibleBooks({});
    setDownloadedCommentaryLanguages([]);
    setDownloadedTopicLanguages([]);
    setTotalStorageUsed(0);
    setBibleVersionsInfo([]);
    setCommentaryInfo([]);
    setTopicsInfo([]);
    setLanguageBundles((prev) => prev.map((b) => ({ ...b, status: 'not_downloaded' as const })));
    setIsUserDataSynced(false);
    setLastSyncTime(null);
    // Refresh manifest-backed status lists so badges like "Update Available"
    // that were cached from before don't linger after the wipe.
    if (manifest) {
      await refreshDownloadState(manifest);
    }
    // Hard-remove (not just invalidate) chapter/explanation payloads. Delete
    // All wipes SQLite, so the cached `data` should disappear too — `invalidate`
    // would keep serving it until the next successful refetch, which can't
    // happen offline.
    queryClient.removeQueries({
      predicate: (q) =>
        matchesOperationId(q.queryKey, CHAPTER_QUERY_ID) ||
        matchesOperationId(q.queryKey, EXPLANATION_QUERY_ID),
    });
  };

  // Check for updates
  const checkForUpdates = async () => {
    setIsSyncing(true);
    try {
      await checkAndSyncUpdates(setSyncProgress);

      const syncTime = await getLastSyncTime();
      setLastSyncTime(syncTime);

      if (manifest) {
        await refreshDownloadState(manifest);
      } else {
        const [bibleVersions, commentaryLangs, topicLangs, storage] = await Promise.all([
          getDownloadedBibleVersions(),
          getDownloadedCommentaryLanguages(),
          getDownloadedTopicLanguages(),
          getTotalStorageUsed(),
        ]);

        setDownloadedBibleVersions(bibleVersions);
        setDownloadedCommentaryLanguages(commentaryLangs);
        setDownloadedTopicLanguages(topicLangs);
        setTotalStorageUsed(storage);
      }
    } finally {
      setIsSyncing(false);
      setSyncProgress(null);
    }
  };

  const value: OfflineContextType = {
    // Mode
    isAutoSyncEnabled,
    setAutoSyncEnabled,
    isOnline,

    // State
    isInitialized,
    manifest,

    // Downloaded content
    downloadedBibleVersions,
    downloadedBibleBooks,
    downloadedCommentaryLanguages,
    downloadedTopicLanguages,

    // Download info
    bibleVersionsInfo,
    commentaryInfo,
    topicsInfo,

    // Language bundles
    languageBundles,

    // User data
    isUserDataSynced,

    // Sync state
    isSyncing,
    syncProgress,
    lastSyncTime,
    setLastSyncTime,

    // Storage
    totalStorageUsed,

    // Actions
    refreshManifest,
    downloadBibleVersion,
    downloadBibleBook,
    deleteBibleBook: deleteBibleBookAction,
    downloadCommentaries,
    downloadTopics,
    deleteBibleVersion,
    deleteCommentaries,
    deleteTopics,
    deleteAllData,
    checkForUpdates,
    downloadLanguage,
    deleteLanguage,
    syncUserData,
  };

  return <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>;
}

export function useOfflineContext() {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error('useOfflineContext must be used within an OfflineProvider');
  }
  return context;
}
