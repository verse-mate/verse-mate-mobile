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
  downloadBibleVersion as downloadBibleVersionService,
  downloadCommentaries as downloadCommentariesService,
  downloadLanguageBundle as downloadLanguageBundleService,
  downloadTopics as downloadTopicsService,
  downloadUserData as downloadUserDataService,
  fetchManifest,
  getBibleVersionsDownloadInfo,
  getCommentaryDownloadInfo,
  getDownloadedBibleVersions,
  getDownloadedCommentaryLanguages,
  getDownloadedTopicLanguages,
  getLanguageBundleStatus,
  getLastSyncTime,
  getTopicsDownloadInfo,
  getTotalStorageUsed,
  initDatabase,
  isUserDataDownloaded,
  processSyncQueue,
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
  refreshManifest: () => Promise<void>;
  downloadBibleVersion: (versionKey: string) => Promise<void>;
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

export function OfflineProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const netInfo = useNetInfo();
  const isOnline = netInfo.isConnected === true;

  // Mode state
  const [isAutoSyncEnabled, setAutoSyncEnabledState] = useState(true);

  // Initialization state
  const [isInitialized, setIsInitialized] = useState(false);
  const dbReady = useRef(false);
  const userDataSyncInProgress = useRef(false);
  const [manifest, setManifest] = useState<OfflineManifest | null>(null);

  // Downloaded content
  const [downloadedBibleVersions, setDownloadedBibleVersions] = useState<string[]>([]);
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
          runAutoSyncIfNeeded().catch(console.warn);
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

  // Process sync queue when online
  useEffect(() => {
    if (isOnline && isInitialized) {
      processSyncQueue().catch((e) =>
        console.warn('[Offline Context] Sync queue processing failed:', e)
      );
    }
  }, [isOnline, isInitialized]);

  // Auto-sync user data when authenticated
  useEffect(() => {
    if (!isInitialized || !isAuthenticated || !dbReady.current || !isOnline) return;

    // Throttle: Only auto-sync if not synced in the last hour
    const SYNC_THROTTLE = 60 * 60 * 1000; // 1 hour

    const syncUserDataIfNeeded = async () => {
      if (userDataSyncInProgress.current) return;

      // Check last sync time
      const lastSync = await getLastSyncTime();
      if (lastSync && Date.now() - lastSync.getTime() < SYNC_THROTTLE) {
        if (__DEV__) console.log('[Offline Context] Skipping user data auto-sync (synced recently)');
        return;
      }

      userDataSyncInProgress.current = true;
      try {
        await downloadUserDataService();
        setIsUserDataSynced(true);
        setLastSyncTime(new Date());
      } catch (error) {
        console.warn('User data auto-sync failed:', error);
      } finally {
        userDataSyncInProgress.current = false;
      }
    };

    syncUserDataIfNeeded();
  }, [isInitialized, isAuthenticated, isOnline]);

  // Set auto-sync
  const setAutoSyncEnabled = (enabled: boolean) => {
    setAutoSyncEnabledState(enabled);
    AsyncStorage.setItem(AUTO_SYNC_KEY, enabled.toString()).catch(console.warn);
  };

  // Refresh manifest and download info
  const refreshManifest = useCallback(async () => {
    if (!dbReady.current) {
      console.warn('[Offline] refreshManifest skipped — database not ready');
      return;
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
    } catch (error) {
      console.error('Failed to refresh manifest:', error);
      throw error;
    }
  }, [refreshLanguageBundles]); // dependencies handled inside or stable

  // Download Bible version
  const downloadBibleVersion = async (versionKey: string) => {
    if (!manifest) {
      await refreshManifest();
    }
    const currentManifest = manifest || (await fetchManifest());

    setIsSyncing(true);
    try {
      await downloadBibleVersionService(versionKey, currentManifest, setSyncProgress);
      await refreshDownloadState(currentManifest);
    } finally {
      setIsSyncing(false);
      setSyncProgress(null);
    }
  };

  // Download commentaries
  const downloadCommentaries = async (languageCode: string) => {
    if (!manifest) {
      await refreshManifest();
    }
    const currentManifest = manifest || (await fetchManifest());

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
    if (!manifest) {
      await refreshManifest();
    }
    const currentManifest = manifest || (await fetchManifest());

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
    if (!manifest) {
      await refreshManifest();
    }
    const currentManifest = manifest || (await fetchManifest());

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
    setDownloadedCommentaryLanguages([]);
    setDownloadedTopicLanguages([]);
    setTotalStorageUsed(0);
    setBibleVersionsInfo([]);
    setCommentaryInfo([]);
    setTopicsInfo([]);
    setLanguageBundles((prev) => prev.map((b) => ({ ...b, status: 'not_downloaded' as const })));
    setIsUserDataSynced(false);
    setLastSyncTime(null);
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
