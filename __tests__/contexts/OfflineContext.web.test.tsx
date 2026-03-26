/**
 * Tests for OfflineContext web guard
 *
 * Verifies the OfflineProvider returns a no-op context on web
 * without initializing SQLite or offline sync.
 */

import { renderHook } from '@testing-library/react-native';
import type React from 'react';
import { Platform } from 'react-native';

import { OfflineProvider, useOfflineContext } from '@/contexts/OfflineContext';
// Import after mocks
import { initDatabase } from '@/services/offline';

// Save original Platform.OS
const originalOS = Platform.OS;

// Must mock before importing the module
jest.mock('@/services/offline', () => ({
  initDatabase: jest.fn(),
  getOfflineMetadata: jest.fn(),
  getAllDownloadedVersions: jest.fn(),
}));

jest.mock('@react-native-community/netinfo', () => ({
  useNetInfo: jest.fn(() => ({ isConnected: true })),
}));

describe('OfflineContext on web', () => {
  beforeAll(() => {
    // Set platform to web
    Object.defineProperty(Platform, 'OS', { value: 'web', writable: true });
  });

  afterAll(() => {
    // Restore platform
    Object.defineProperty(Platform, 'OS', { value: originalOS, writable: true });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('provides online-only context value on web', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <OfflineProvider>{children}</OfflineProvider>
    );

    const { result } = renderHook(() => useOfflineContext(), { wrapper });

    expect(result.current.isOnline).toBe(true);
    expect(result.current.isInitialized).toBe(true);
    expect(result.current.downloadedBibleVersions).toEqual([]);
    expect(result.current.isAutoSyncEnabled).toBe(false);
    expect(result.current.totalStorageUsed).toBe(0);
  });

  it('does not call initDatabase on web', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <OfflineProvider>{children}</OfflineProvider>
    );

    renderHook(() => useOfflineContext(), { wrapper });

    expect(initDatabase).not.toHaveBeenCalled();
  });

  it('provides no-op functions that do not throw', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <OfflineProvider>{children}</OfflineProvider>
    );

    const { result } = renderHook(() => useOfflineContext(), { wrapper });

    // Verify functions exist and are callable
    expect(typeof result.current.refreshManifest).toBe('function');
    expect(typeof result.current.downloadBibleVersion).toBe('function');
    expect(typeof result.current.deleteAllData).toBe('function');
    expect(typeof result.current.syncUserData).toBe('function');

    // Calling them should not throw
    expect(() => result.current.refreshManifest()).not.toThrow();
    expect(() => result.current.deleteAllData()).not.toThrow();
  });
});
