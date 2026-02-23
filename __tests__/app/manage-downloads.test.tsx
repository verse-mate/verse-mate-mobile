import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type React from 'react';
import ManageDownloadsScreen from '../../app/manage-downloads';
import { useAuth } from '../../contexts/AuthContext';
import { useOfflineContext } from '../../contexts/OfflineContext';
import { useTheme } from '../../contexts/ThemeContext';

// Mock dependencies
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      background: '#fff',
      surface: '#fff',
      textPrimary: '#000',
      textSecondary: '#666',
      border: '#eee',
      primary: '#007AFF',
      success: '#4caf50',
      error: '#f44336',
    },
    isDark: false,
  }),
}));

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: true, user: { id: 'test-user' } }),
}));

jest.mock('../../contexts/OfflineContext', () => ({
  useOfflineContext: jest.fn(),
  OfflineProvider: ({ children }: { children: React.ReactNode }) => children,
}));

const mockOfflineContext = {
  isInitialized: true,
  isAutoSyncEnabled: true,
  setAutoSyncEnabled: jest.fn(),
  bibleVersionsInfo: [
    { key: 'NASB1995', name: 'NASB 1995', status: 'downloaded', size_bytes: 1024 * 1024 },
    { key: 'KJV', name: 'King James Version', status: 'not_downloaded', size_bytes: 1024 * 1024 },
  ],
  commentaryInfo: [{ key: 'en', name: 'English', status: 'downloaded', size_bytes: 250000 }],
  topicsInfo: [{ key: 'en', name: 'English', status: 'downloaded', size_bytes: 250000 }],
  languageBundles: [], // Not used by the screen
  isUserDataSynced: true,
  isSyncing: false,
  syncProgress: null,
  lastSyncTime: new Date('2026-02-22'),
  totalStorageUsed: 1500000,
  refreshManifest: jest.fn().mockResolvedValue(undefined),
  downloadBibleVersion: jest.fn().mockResolvedValue(undefined),
  deleteBibleVersion: jest.fn().mockResolvedValue(undefined),
  syncUserData: jest.fn().mockResolvedValue(undefined),
  deleteAllData: jest.fn().mockResolvedValue(undefined),
  checkForUpdates: jest.fn().mockResolvedValue(undefined),
  downloadLanguage: jest.fn().mockResolvedValue(undefined),
  deleteLanguage: jest.fn().mockResolvedValue(undefined),
};

describe('ManageDownloadsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useOfflineContext as jest.Mock).mockReturnValue(mockOfflineContext);
  });

  it('renders correctly with downloaded content', async () => {
    render(<ManageDownloadsScreen />);

    expect(screen.getByText('Manage Downloads')).toBeTruthy();
    expect(screen.getByText('NASB 1995')).toBeTruthy();
    expect(screen.getByText('English')).toBeTruthy();
    expect(screen.getByText('1.4 MB')).toBeTruthy();
  });

  it('calls downloadBibleVersion when a non-downloaded version is pressed', async () => {
    render(<ManageDownloadsScreen />);

    const kjvItem = screen.getByLabelText(/King James Version, Not Downloaded/);
    await act(async () => {
      fireEvent.press(kjvItem);
    });

    expect(mockOfflineContext.downloadBibleVersion).toHaveBeenCalledWith('KJV');
  });

  it('shows confirmation modal when delete is pressed', async () => {
    render(<ManageDownloadsScreen />);

    const nasbItem = screen.getByLabelText(/NASB 1995, Downloaded/);
    await act(async () => {
      fireEvent.press(nasbItem);
    });

    expect(screen.getByText(/Are you sure you want to delete NASB 1995/)).toBeTruthy();
  });

  it('calls syncUserData when sync button is pressed', async () => {
    render(<ManageDownloadsScreen />);

    const syncButton = screen.getByTestId('sync-user-data-button');
    await act(async () => {
      fireEvent.press(syncButton);
    });

    expect(mockOfflineContext.syncUserData).toHaveBeenCalled();
  });
});
