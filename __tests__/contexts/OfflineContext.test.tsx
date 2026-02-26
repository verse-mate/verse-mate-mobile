import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNetInfo } from '@react-native-community/netinfo';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { OfflineProvider, useOfflineContext } from '@/contexts/OfflineContext';
import * as offlineService from '@/services/offline';

// Unmock the context that is globally mocked in test-setup.ts
jest.unmock('@/contexts/OfflineContext');

// Mock dependencies
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('@react-native-community/netinfo', () => ({
  useNetInfo: jest.fn(),
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/services/offline', () => ({
  initDatabase: jest.fn().mockResolvedValue(undefined),
  getDownloadedBibleVersions: jest.fn().mockResolvedValue([]),
  getDownloadedCommentaryLanguages: jest.fn().mockResolvedValue([]),
  getDownloadedTopicLanguages: jest.fn().mockResolvedValue([]),
  getLastSyncTime: jest.fn().mockResolvedValue(null),
  getTotalStorageUsed: jest.fn().mockResolvedValue(0),
  isUserDataDownloaded: jest.fn().mockResolvedValue(false),
  runAutoSyncIfNeeded: jest.fn().mockResolvedValue(undefined),
  closeDatabase: jest.fn().mockResolvedValue(undefined),
  fetchManifest: jest.fn().mockResolvedValue({ bible_versions: [], commentaries: [], topics: [] }),
  getBibleVersionsDownloadInfo: jest.fn().mockResolvedValue([]),
  getCommentaryDownloadInfo: jest.fn().mockResolvedValue([]),
  getTopicsDownloadInfo: jest.fn().mockResolvedValue([]),
  buildLanguageBundles: jest.fn().mockReturnValue([]),
  processSyncQueue: jest.fn().mockResolvedValue(undefined),
  downloadUserData: jest.fn().mockResolvedValue(undefined),
  deleteAllOfflineData: jest.fn().mockResolvedValue(undefined),
  getLanguageBundleStatus: jest.fn().mockResolvedValue('not_downloaded'),
}));

describe('OfflineContext', () => {
  const mockUseAuth = useAuth as jest.Mock;
  const mockUseNetInfo = useNetInfo as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({ isAuthenticated: false });
    mockUseNetInfo.mockReturnValue({ isConnected: true });
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <OfflineProvider>{children}</OfflineProvider>
  );

  it('initializes correctly', async () => {
    const { result } = renderHook(() => useOfflineContext(), { wrapper });

    await waitFor(() => {
      expect(result.current.isInitialized).toBe(true);
    });

    expect(offlineService.initDatabase).toHaveBeenCalled();
    expect(result.current.isOnline).toBe(true);
  });

  it('detects offline status', async () => {
    mockUseNetInfo.mockReturnValue({ isConnected: false });
    const { result } = renderHook(() => useOfflineContext(), { wrapper });

    await waitFor(() => {
      expect(result.current.isInitialized).toBe(true);
    });

    expect(result.current.isOnline).toBe(false);
  });

  it('refreshes manifest', async () => {
    const { result } = renderHook(() => useOfflineContext(), { wrapper });

    await waitFor(() => expect(result.current.isInitialized).toBe(true));

    await act(async () => {
      await result.current.refreshManifest();
    });

    expect(offlineService.fetchManifest).toHaveBeenCalled();
  });

  it('auto-syncs user data when coming online and authenticated', async () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true });

    // Start offline
    mockUseNetInfo.mockReturnValue({ isConnected: false });

    const { result, rerender } = renderHook(() => useOfflineContext(), { wrapper });
    await waitFor(() => expect(result.current.isInitialized).toBe(true));

    expect(offlineService.downloadUserData).not.toHaveBeenCalled();

    // Go online
    mockUseNetInfo.mockReturnValue({ isConnected: true });
    rerender({});

    await waitFor(
      () => {
        expect(offlineService.downloadUserData).toHaveBeenCalled();
      },
      { timeout: 2000 }
    );
  });

  it('processes sync queue when coming online', async () => {
    // Start offline
    mockUseNetInfo.mockReturnValue({ isConnected: false });

    const { result, rerender } = renderHook(() => useOfflineContext(), { wrapper });
    await waitFor(() => expect(result.current.isInitialized).toBe(true));

    expect(offlineService.processSyncQueue).not.toHaveBeenCalled();

    // Go online
    mockUseNetInfo.mockReturnValue({ isConnected: true });
    rerender({});

    await waitFor(
      () => {
        expect(offlineService.processSyncQueue).toHaveBeenCalled();
      },
      { timeout: 2000 }
    );
  });

  it('resets all data correctly', async () => {
    const { result } = renderHook(() => useOfflineContext(), { wrapper });
    await waitFor(() => expect(result.current.isInitialized).toBe(true));

    await act(async () => {
      await result.current.deleteAllData();
    });

    expect(offlineService.deleteAllOfflineData).toHaveBeenCalled();
    expect(result.current.lastSyncTime).toBeNull();
    expect(result.current.totalStorageUsed).toBe(0);
  });

  /**
   * Reconnect race prevention (TDD)
   *
   * Protects Change C3: Reconnect race condition.
   * When the network state flickers (false→true rapidly), downloadUserData
   * should be guarded to prevent multiple concurrent executions.
   */
  describe('reconnect race prevention (TDD)', () => {
    it.failing('[TDD] downloadUserData is called at most once during rapid reconnect', async () => {
      mockUseAuth.mockReturnValue({ isAuthenticated: true });

      // Start offline
      mockUseNetInfo.mockReturnValue({ isConnected: false });

      const { result, rerender } = renderHook(() => useOfflineContext(), { wrapper });
      await waitFor(() => expect(result.current.isInitialized).toBe(true));

      // Rapid reconnect: toggle online 3 times quickly
      // Cycle 1: online
      mockUseNetInfo.mockReturnValue({ isConnected: true });
      rerender({});
      // Cycle 2: offline again
      mockUseNetInfo.mockReturnValue({ isConnected: false });
      rerender({});
      // Cycle 3: online again
      mockUseNetInfo.mockReturnValue({ isConnected: true });
      rerender({});

      await waitFor(
        () => {
          expect(offlineService.downloadUserData).toHaveBeenCalled();
        },
        { timeout: 2000 }
      );

      // downloadUserData should be called at most once during rapid reconnect
      // Will FAIL until the reconnect guard is tightened
      expect(offlineService.downloadUserData).toHaveBeenCalledTimes(1);
    });

    it('[REGRESSION] sync queue is processed exactly once when coming back online', async () => {
      // Start offline
      mockUseNetInfo.mockReturnValue({ isConnected: false });

      const { result, rerender } = renderHook(() => useOfflineContext(), { wrapper });
      await waitFor(() => expect(result.current.isInitialized).toBe(true));

      expect(offlineService.processSyncQueue).not.toHaveBeenCalled();

      // Go online
      mockUseNetInfo.mockReturnValue({ isConnected: true });
      rerender({});

      await waitFor(
        () => {
          expect(offlineService.processSyncQueue).toHaveBeenCalled();
        },
        { timeout: 2000 }
      );

      // Verify exactly once
      expect(offlineService.processSyncQueue).toHaveBeenCalledTimes(1);
    });
  });
});
