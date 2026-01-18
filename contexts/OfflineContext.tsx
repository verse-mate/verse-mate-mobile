/**
 * Offline Context
 *
 * Provides global state management for offline mode functionality.
 * Handles download state, sync operations, and offline mode toggling.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  type DownloadInfo,
  type OfflineManifest,
  type SyncProgress,
  fetchManifest,
  downloadBibleVersion as downloadBibleVersionService,
  downloadCommentaries as downloadCommentariesService,
  downloadTopics as downloadTopicsService,
  removeBibleVersion,
  removeCommentaries,
  removeTopics,
  getBibleVersionsDownloadInfo,
  getCommentaryDownloadInfo,
  getTopicsDownloadInfo,
  getDownloadedBibleVersions,
  getDownloadedCommentaryLanguages,
  getDownloadedTopicLanguages,
  checkAndSyncUpdates,
  getLastSyncTime,
  runAutoSyncIfNeeded,
  initDatabase,
  getTotalStorageUsed,
  deleteAllOfflineData,
} from '@/services/offline';

const OFFLINE_MODE_KEY = 'versemate:offline:mode_enabled';
const AUTO_SYNC_KEY = 'versemate:offline:auto_sync_enabled';

export interface OfflineContextType {
  // Mode
  isOfflineModeEnabled: boolean;
  setOfflineModeEnabled: (enabled: boolean) => void;
  isAutoSyncEnabled: boolean;
  setAutoSyncEnabled: (enabled: boolean) => void;

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

  // Sync state
  isSyncing: boolean;
  syncProgress: SyncProgress | null;
  lastSyncTime: Date | null;

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
}

const OfflineContext = createContext<OfflineContextType | null>(null);

export function OfflineProvider({ children }: { children: ReactNode }) {
  // Mode state
  const [isOfflineModeEnabled, setOfflineModeEnabledState] = useState(false);
  const [isAutoSyncEnabled, setAutoSyncEnabledState] = useState(true);

  // Initialization state
  const [isInitialized, setIsInitialized] = useState(false);
  const [manifest, setManifest] = useState<OfflineManifest | null>(null);

  // Downloaded content
  const [downloadedBibleVersions, setDownloadedBibleVersions] = useState<string[]>([]);
  const [downloadedCommentaryLanguages, setDownloadedCommentaryLanguages] = useState<string[]>([]);
  const [downloadedTopicLanguages, setDownloadedTopicLanguages] = useState<string[]>([]);

  // Download info
  const [bibleVersionsInfo, setBibleVersionsInfo] = useState<DownloadInfo[]>([]);
  const [commentaryInfo, setCommentaryInfo] = useState<DownloadInfo[]>([]);
  const [topicsInfo, setTopicsInfo] = useState<DownloadInfo[]>([]);

  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  // Storage
  const [totalStorageUsed, setTotalStorageUsed] = useState(0);

  // Initialize database and load state
  useEffect(() => {
    async function initialize() {
      try {
        // Initialize SQLite database
        await initDatabase();

        // Load persisted settings
        const [offlineMode, autoSync] = await Promise.all([
          AsyncStorage.getItem(OFFLINE_MODE_KEY),
          AsyncStorage.getItem(AUTO_SYNC_KEY),
        ]);

        if (offlineMode === 'true') {
          setOfflineModeEnabledState(true);
        }
        if (autoSync !== 'false') {
          setAutoSyncEnabledState(true);
        }

        // Load downloaded content lists
        const [bibleVersions, commentaryLangs, topicLangs] = await Promise.all([
          getDownloadedBibleVersions(),
          getDownloadedCommentaryLanguages(),
          getDownloadedTopicLanguages(),
        ]);

        setDownloadedBibleVersions(bibleVersions);
        setDownloadedCommentaryLanguages(commentaryLangs);
        setDownloadedTopicLanguages(topicLangs);

        // Load last sync time
        const syncTime = await getLastSyncTime();
        setLastSyncTime(syncTime);

        // Load storage used
        const storage = await getTotalStorageUsed();
        setTotalStorageUsed(storage);

        setIsInitialized(true);

        // Run auto-sync if enabled
        if (autoSync !== 'false') {
          runAutoSyncIfNeeded().catch(console.warn);
        }
      } catch (error) {
        console.error('Failed to initialize offline context:', error);
        setIsInitialized(true);
      }
    }

    initialize();
  }, []);

  // Set offline mode
  const setOfflineModeEnabled = useCallback((enabled: boolean) => {
    setOfflineModeEnabledState(enabled);
    AsyncStorage.setItem(OFFLINE_MODE_KEY, enabled.toString()).catch(console.warn);
  }, []);

  // Set auto-sync
  const setAutoSyncEnabled = useCallback((enabled: boolean) => {
    setAutoSyncEnabledState(enabled);
    AsyncStorage.setItem(AUTO_SYNC_KEY, enabled.toString()).catch(console.warn);
  }, []);

  // Refresh manifest and download info
  const refreshManifest = useCallback(async () => {
    try {
      const newManifest = await fetchManifest();
      setManifest(newManifest);

      // Update download info
      const [bibleInfo, commInfo, topicInfo] = await Promise.all([
        getBibleVersionsDownloadInfo(newManifest),
        getCommentaryDownloadInfo(newManifest),
        getTopicsDownloadInfo(newManifest),
      ]);

      setBibleVersionsInfo(bibleInfo);
      setCommentaryInfo(commInfo);
      setTopicsInfo(topicInfo);
    } catch (error) {
      console.error('Failed to refresh manifest:', error);
      throw error;
    }
  }, []);

  // Download Bible version
  const downloadBibleVersion = useCallback(
    async (versionKey: string) => {
      if (!manifest) {
        await refreshManifest();
      }
      const currentManifest = manifest || (await fetchManifest());

      setIsSyncing(true);
      try {
        await downloadBibleVersionService(versionKey, currentManifest, setSyncProgress);

        // Update state
        setDownloadedBibleVersions((prev) => [...new Set([...prev, versionKey])]);
        const storage = await getTotalStorageUsed();
        setTotalStorageUsed(storage);

        // Refresh download info
        const bibleInfo = await getBibleVersionsDownloadInfo(currentManifest);
        setBibleVersionsInfo(bibleInfo);
      } finally {
        setIsSyncing(false);
        setSyncProgress(null);
      }
    },
    [manifest, refreshManifest]
  );

  // Download commentaries
  const downloadCommentaries = useCallback(
    async (languageCode: string) => {
      if (!manifest) {
        await refreshManifest();
      }
      const currentManifest = manifest || (await fetchManifest());

      setIsSyncing(true);
      try {
        await downloadCommentariesService(languageCode, currentManifest, setSyncProgress);

        // Update state
        setDownloadedCommentaryLanguages((prev) => [...new Set([...prev, languageCode])]);
        const storage = await getTotalStorageUsed();
        setTotalStorageUsed(storage);

        // Refresh download info
        const commInfo = await getCommentaryDownloadInfo(currentManifest);
        setCommentaryInfo(commInfo);
      } finally {
        setIsSyncing(false);
        setSyncProgress(null);
      }
    },
    [manifest, refreshManifest]
  );

  // Download topics
  const downloadTopics = useCallback(
    async (languageCode: string) => {
      if (!manifest) {
        await refreshManifest();
      }
      const currentManifest = manifest || (await fetchManifest());

      setIsSyncing(true);
      try {
        await downloadTopicsService(languageCode, currentManifest, setSyncProgress);

        // Update state
        setDownloadedTopicLanguages((prev) => [...new Set([...prev, languageCode])]);
        const storage = await getTotalStorageUsed();
        setTotalStorageUsed(storage);

        // Refresh download info
        const topicInfo = await getTopicsDownloadInfo(currentManifest);
        setTopicsInfo(topicInfo);
      } finally {
        setIsSyncing(false);
        setSyncProgress(null);
      }
    },
    [manifest, refreshManifest]
  );

  // Delete Bible version
  const deleteBibleVersion = useCallback(
    async (versionKey: string) => {
      await removeBibleVersion(versionKey);
      setDownloadedBibleVersions((prev) => prev.filter((k) => k !== versionKey));

      const storage = await getTotalStorageUsed();
      setTotalStorageUsed(storage);

      if (manifest) {
        const bibleInfo = await getBibleVersionsDownloadInfo(manifest);
        setBibleVersionsInfo(bibleInfo);
      }
    },
    [manifest]
  );

  // Delete commentaries
  const deleteCommentaries = useCallback(
    async (languageCode: string) => {
      await removeCommentaries(languageCode);
      setDownloadedCommentaryLanguages((prev) => prev.filter((c) => c !== languageCode));

      const storage = await getTotalStorageUsed();
      setTotalStorageUsed(storage);

      if (manifest) {
        const commInfo = await getCommentaryDownloadInfo(manifest);
        setCommentaryInfo(commInfo);
      }
    },
    [manifest]
  );

  // Delete topics
  const deleteTopics = useCallback(
    async (languageCode: string) => {
      await removeTopics(languageCode);
      setDownloadedTopicLanguages((prev) => prev.filter((c) => c !== languageCode));

      const storage = await getTotalStorageUsed();
      setTotalStorageUsed(storage);

      if (manifest) {
        const topicInfo = await getTopicsDownloadInfo(manifest);
        setTopicsInfo(topicInfo);
      }
    },
    [manifest]
  );

  // Delete all data
  const deleteAllData = useCallback(async () => {
    await deleteAllOfflineData();
    setDownloadedBibleVersions([]);
    setDownloadedCommentaryLanguages([]);
    setDownloadedTopicLanguages([]);
    setTotalStorageUsed(0);
    setBibleVersionsInfo([]);
    setCommentaryInfo([]);
    setTopicsInfo([]);
  }, []);

  // Check for updates
  const checkForUpdates = useCallback(async () => {
    setIsSyncing(true);
    try {
      await checkAndSyncUpdates(setSyncProgress);

      // Refresh all state
      const syncTime = await getLastSyncTime();
      setLastSyncTime(syncTime);

      const [bibleVersions, commentaryLangs, topicLangs] = await Promise.all([
        getDownloadedBibleVersions(),
        getDownloadedCommentaryLanguages(),
        getDownloadedTopicLanguages(),
      ]);

      setDownloadedBibleVersions(bibleVersions);
      setDownloadedCommentaryLanguages(commentaryLangs);
      setDownloadedTopicLanguages(topicLangs);

      const storage = await getTotalStorageUsed();
      setTotalStorageUsed(storage);

      if (manifest) {
        const [bibleInfo, commInfo, topicInfo] = await Promise.all([
          getBibleVersionsDownloadInfo(manifest),
          getCommentaryDownloadInfo(manifest),
          getTopicsDownloadInfo(manifest),
        ]);

        setBibleVersionsInfo(bibleInfo);
        setCommentaryInfo(commInfo);
        setTopicsInfo(topicInfo);
      }
    } finally {
      setIsSyncing(false);
      setSyncProgress(null);
    }
  }, [manifest]);

  const value: OfflineContextType = {
    // Mode
    isOfflineModeEnabled,
    setOfflineModeEnabled,
    isAutoSyncEnabled,
    setAutoSyncEnabled,

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

    // Sync state
    isSyncing,
    syncProgress,
    lastSyncTime,

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
