/**
 * Tests for useBibleVersion hook
 *
 * Tests Bible version persistence using AsyncStorage
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { renderHook, waitFor } from '@testing-library/react-native';
import { act } from 'react-test-renderer';
import {
  backfillPreferredBibleVersion,
  resetCachedVersion,
  useBibleVersion,
} from '@/hooks/use-bible-version';
import { syncPreferredBibleVersion } from '@/lib/notifications/push-api';

jest.mock('@/lib/notifications/push-api', () => ({
  syncPreferredBibleVersion: jest.fn().mockResolvedValue(true),
}));

const mockSync = syncPreferredBibleVersion as jest.MockedFunction<typeof syncPreferredBibleVersion>;

describe('useBibleVersion', () => {
  beforeEach(async () => {
    // Clear AsyncStorage AND the module-level cache the hook uses to
    // share state between mounted consumers. Without resetting the
    // cache, a value set by an earlier test bleeds into the next one's
    // initial render.
    await AsyncStorage.clear();
    resetCachedVersion();
  });

  afterEach(async () => {
    await AsyncStorage.clear();
    resetCachedVersion();
  });

  it('should return default version (NASB1995) initially', async () => {
    const { result } = renderHook(() => useBibleVersion());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.bibleVersion).toBe('NASB1995');
  });

  it('should load stored version from AsyncStorage', async () => {
    // Pre-populate AsyncStorage
    await AsyncStorage.setItem('bible-version', 'KJV');

    const { result } = renderHook(() => useBibleVersion());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.bibleVersion).toBe('KJV');
  });

  it('should save version to AsyncStorage', async () => {
    const { result } = renderHook(() => useBibleVersion());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.setBibleVersion('ESV');
    });

    expect(result.current.bibleVersion).toBe('ESV');

    // Verify it was saved to AsyncStorage
    const stored = await AsyncStorage.getItem('bible-version');
    expect(stored).toBe('ESV');
  });

  it('should handle AsyncStorage errors gracefully', async () => {
    // Mock AsyncStorage to throw an error
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('Storage error'));

    const { result } = renderHook(() => useBibleVersion());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Should fall back to default version
    expect(result.current.bibleVersion).toBe('NASB1995');
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to load Bible version:',
      expect.any(Error)
    );

    consoleErrorSpy.mockRestore();
  });

  it('should throw error when saving fails', async () => {
    const { result } = renderHook(() => useBibleVersion());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Mock setItem to fail
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('Save failed'));

    await expect(
      act(async () => {
        await result.current.setBibleVersion('NIV');
      })
    ).rejects.toThrow('Save failed');
  });

  it('should persist version across hook re-renders', async () => {
    // First render
    const { result: result1, unmount } = renderHook(() => useBibleVersion());

    await waitFor(() => {
      expect(result1.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result1.current.setBibleVersion('NKJV');
    });

    unmount();

    // Second render (simulating app restart)
    const { result: result2 } = renderHook(() => useBibleVersion());

    await waitFor(() => {
      expect(result2.current.isLoading).toBe(false);
    });

    expect(result2.current.bibleVersion).toBe('NKJV');
  });
});

// The daily verse-of-the-day push renders in `user.preferred_bible_version`,
// which setBibleVersion only writes on change — so a translation chosen before
// that sync existed never reached the server, and the push arrives in NASB1995
// while the widget (which sends bible_version explicitly) shows the real one.
describe('backfillPreferredBibleVersion', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    resetCachedVersion();
    jest.clearAllMocks();
  });

  it('pushes the stored translation to the server once per install', async () => {
    mockSync.mockResolvedValue(true);
    await AsyncStorage.setItem('bible-version', 'KJV');

    await backfillPreferredBibleVersion();
    await backfillPreferredBibleVersion();

    expect(mockSync).toHaveBeenCalledTimes(1);
    expect(mockSync).toHaveBeenCalledWith('KJV');
  });

  it('retries on the next launch when the sync fails', async () => {
    mockSync.mockResolvedValue(false);
    await AsyncStorage.setItem('bible-version', 'KJV');

    await backfillPreferredBibleVersion();
    await backfillPreferredBibleVersion();

    // Flag stays unset on failure, so a flaky launch doesn't strand the user
    // on a translation the server never heard about.
    expect(mockSync).toHaveBeenCalledTimes(2);
  });

  it('stays silent when the user never chose a translation', async () => {
    mockSync.mockResolvedValue(true);

    await backfillPreferredBibleVersion();

    // The server default already matches; writing would claim a preference
    // the user never expressed.
    expect(mockSync).not.toHaveBeenCalled();
  });
});
