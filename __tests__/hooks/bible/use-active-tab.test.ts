/**
 * useActiveTab Hook Tests
 *
 * Tests for the active tab persistence hook.
 * This hook manages the user's preferred reading mode (Summary, By Line, Detailed)
 * and persists it to AsyncStorage across app restarts.
 *
 * Task Group 8.1: Tests for cache behavior without module-level cache
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useActiveTab } from '@/hooks/bible/use-active-tab';
import { STORAGE_KEYS } from '@/types/bible';

// AsyncStorage is automatically mocked by @react-native-async-storage/async-storage

describe('useActiveTab', () => {
  beforeEach(async () => {
    // Clear AsyncStorage before each test
    await AsyncStorage.clear();
  });

  afterEach(async () => {
    // Clean up after each test
    await AsyncStorage.clear();
  });

  describe('initial mount behavior', () => {
    it('should return correct default value (summary) on mount when no stored value exists', async () => {
      const { result } = renderHook(() => useActiveTab());

      // Initially loading
      expect(result.current.isLoading).toBe(true);

      // Wait for loading to complete
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should default to 'summary'
      expect(result.current.activeTab).toBe('summary');
    });

    it('should return correct persisted value on mount when stored value exists', async () => {
      // Set up pre-existing stored value
      await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_TAB, 'detailed');

      const { result } = renderHook(() => useActiveTab());

      // Wait for loading to complete
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should load the stored value
      expect(result.current.activeTab).toBe('detailed');
    });
  });

  describe('state updates across component remounts', () => {
    it('should correctly update state and persist across unmount/remount cycle', async () => {
      // First render
      const { result: result1, unmount } = renderHook(() => useActiveTab());

      // Wait for initial load
      await waitFor(() => {
        expect(result1.current.isLoading).toBe(false);
      });

      // Verify default value
      expect(result1.current.activeTab).toBe('summary');

      // Change the active tab
      await act(async () => {
        await result1.current.setActiveTab('byline');
      });

      // Verify state updated
      expect(result1.current.activeTab).toBe('byline');

      // Unmount the first hook instance
      unmount();

      // Second render (simulating component remount)
      const { result: result2 } = renderHook(() => useActiveTab());

      await waitFor(() => {
        expect(result2.current.isLoading).toBe(false);
      });

      // Should load the persisted value, not a stale cache value
      expect(result2.current.activeTab).toBe('byline');
    });

    it('should handle multiple rapid remounts correctly', async () => {
      // Set initial value
      await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_TAB, 'detailed');

      // Rapid mount/unmount/mount cycle
      const { result: r1, unmount: u1 } = renderHook(() => useActiveTab());
      await waitFor(() => expect(r1.current.isLoading).toBe(false));
      expect(r1.current.activeTab).toBe('detailed');
      u1();

      const { result: r2, unmount: u2 } = renderHook(() => useActiveTab());
      await waitFor(() => expect(r2.current.isLoading).toBe(false));
      expect(r2.current.activeTab).toBe('detailed');
      u2();

      const { result: r3 } = renderHook(() => useActiveTab());
      await waitFor(() => expect(r3.current.isLoading).toBe(false));
      expect(r3.current.activeTab).toBe('detailed');
    });
  });

  describe('test isolation (no stale cache between tests)', () => {
    it('should return default value in isolated test context (first test)', async () => {
      // This test runs with cleared AsyncStorage from beforeEach
      const { result } = renderHook(() => useActiveTab());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should be default 'summary', not influenced by any previous test's state
      expect(result.current.activeTab).toBe('summary');

      // Set to 'detailed' for next test to verify isolation
      await act(async () => {
        await result.current.setActiveTab('detailed');
      });

      expect(result.current.activeTab).toBe('detailed');
    });

    it('should return default value in isolated test context (second test - verifies no cache leak)', async () => {
      // This test runs with cleared AsyncStorage from beforeEach
      // If there was a module-level cache, it would leak 'detailed' from the previous test
      const { result } = renderHook(() => useActiveTab());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should be default 'summary', not 'detailed' from previous test
      expect(result.current.activeTab).toBe('summary');
    });
  });

  describe('persistence and multiple tab changes', () => {
    it('should persist tab changes to AsyncStorage', async () => {
      const { result } = renderHook(() => useActiveTab());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Change the active tab
      await act(async () => {
        await result.current.setActiveTab('byline');
      });

      // Verify state updated
      expect(result.current.activeTab).toBe('byline');

      // Verify persisted to storage
      const storedValue = await AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_TAB);
      expect(storedValue).toBe('byline');
    });

    it('should handle multiple tab changes correctly', async () => {
      const { result } = renderHook(() => useActiveTab());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Change tab multiple times
      await act(async () => {
        await result.current.setActiveTab('byline');
      });
      expect(result.current.activeTab).toBe('byline');

      await act(async () => {
        await result.current.setActiveTab('detailed');
      });
      expect(result.current.activeTab).toBe('detailed');

      await act(async () => {
        await result.current.setActiveTab('summary');
      });
      expect(result.current.activeTab).toBe('summary');

      // Verify final persisted value
      const storedValue = await AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_TAB);
      expect(storedValue).toBe('summary');
    });

    it('should handle invalid stored values gracefully', async () => {
      // Store an invalid value
      await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_TAB, 'invalid-tab-value');

      const { result } = renderHook(() => useActiveTab());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should fall back to default 'summary'
      expect(result.current.activeTab).toBe('summary');
    });

    it('should handle AsyncStorage errors gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('Storage error'));

      const { result } = renderHook(() => useActiveTab());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should fall back to default tab
      expect(result.current.activeTab).toBe('summary');
      expect(result.current.error).not.toBeNull();

      consoleErrorSpy.mockRestore();
    });
  });
});
