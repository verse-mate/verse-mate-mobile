/**
 * Tests for useBibleVersion hook
 *
 * Tests Bible version persistence using AsyncStorage
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { renderHook, waitFor } from '@testing-library/react-native';
import { act } from 'react-test-renderer';
import { useBibleVersion } from '@/hooks/use-bible-version';

describe('useBibleVersion', () => {
  beforeEach(async () => {
    // Clear AsyncStorage before each test
    await AsyncStorage.clear();
  });

  afterEach(async () => {
    await AsyncStorage.clear();
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
