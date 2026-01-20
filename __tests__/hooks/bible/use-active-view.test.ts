/**
 * useActiveView Hook Tests
 *
 * Tests for the active view mode persistence hook.
 * This hook manages the user's preferred view mode (Bible or Explanations)
 * and persists it to AsyncStorage across app restarts.
 *
 * Task Group 8.1: Tests for cache behavior without module-level cache
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useActiveView } from '@/hooks/bible/use-active-view';
import { STORAGE_KEYS } from '@/types/bible';

// AsyncStorage is automatically mocked by @react-native-async-storage/async-storage

describe('useActiveView', () => {
  beforeEach(async () => {
    // Clear AsyncStorage before each test
    await AsyncStorage.clear();
  });

  afterEach(async () => {
    // Clean up after each test
    await AsyncStorage.clear();
  });

  describe('initial mount behavior', () => {
    it('should return correct default value (bible) on mount when no stored value exists', async () => {
      const { result } = renderHook(() => useActiveView());

      // Initially loading
      expect(result.current.isLoading).toBe(true);

      // Wait for loading to complete
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should default to 'bible'
      expect(result.current.activeView).toBe('bible');
      expect(result.current.error).toBeNull();
    });

    it('should return correct persisted value on mount when stored value exists', async () => {
      // Pre-populate AsyncStorage with 'explanations'
      await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_VIEW, 'explanations');

      const { result } = renderHook(() => useActiveView());

      // Wait for loading to complete
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should load the stored value
      expect(result.current.activeView).toBe('explanations');
    });
  });

  describe('state updates across component remounts', () => {
    it('should correctly update state and persist across unmount/remount cycle', async () => {
      // First render
      const { result: result1, unmount } = renderHook(() => useActiveView());

      await waitFor(() => {
        expect(result1.current.isLoading).toBe(false);
      });

      // Verify default value
      expect(result1.current.activeView).toBe('bible');

      // Change the active view
      await act(async () => {
        await result1.current.setActiveView('explanations');
      });

      // Verify state updated
      expect(result1.current.activeView).toBe('explanations');

      // Unmount the first hook instance
      unmount();

      // Second render (simulating component remount)
      const { result: result2 } = renderHook(() => useActiveView());

      await waitFor(() => {
        expect(result2.current.isLoading).toBe(false);
      });

      // Should load the persisted value, not a stale cache value
      expect(result2.current.activeView).toBe('explanations');
    });

    it('should handle multiple rapid remounts correctly', async () => {
      // Set initial value
      await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_VIEW, 'explanations');

      // Rapid mount/unmount/mount cycle
      const { result: r1, unmount: u1 } = renderHook(() => useActiveView());
      await waitFor(() => expect(r1.current.isLoading).toBe(false));
      expect(r1.current.activeView).toBe('explanations');
      u1();

      const { result: r2, unmount: u2 } = renderHook(() => useActiveView());
      await waitFor(() => expect(r2.current.isLoading).toBe(false));
      expect(r2.current.activeView).toBe('explanations');
      u2();

      const { result: r3 } = renderHook(() => useActiveView());
      await waitFor(() => expect(r3.current.isLoading).toBe(false));
      expect(r3.current.activeView).toBe('explanations');
    });
  });

  describe('test isolation (no stale cache between tests)', () => {
    it('should return default value in isolated test context (first test)', async () => {
      // This test runs with cleared AsyncStorage from beforeEach
      const { result } = renderHook(() => useActiveView());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should be default 'bible', not influenced by any previous test's state
      expect(result.current.activeView).toBe('bible');

      // Set to explanations for next test to verify isolation
      await act(async () => {
        await result.current.setActiveView('explanations');
      });

      expect(result.current.activeView).toBe('explanations');
    });

    it('should return default value in isolated test context (second test - verifies no cache leak)', async () => {
      // This test runs with cleared AsyncStorage from beforeEach
      // If there was a module-level cache, it would leak 'explanations' from the previous test
      const { result } = renderHook(() => useActiveView());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should be default 'bible', not 'explanations' from previous test
      expect(result.current.activeView).toBe('bible');
    });
  });

  describe('persistence and error handling', () => {
    it('should persist view changes to AsyncStorage', async () => {
      const { result } = renderHook(() => useActiveView());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Change the active view
      await act(async () => {
        await result.current.setActiveView('explanations');
      });

      // Verify persisted to storage
      const storedValue = await AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_VIEW);
      expect(storedValue).toBe('explanations');
    });

    it('should handle invalid stored values gracefully', async () => {
      // Store an invalid value
      await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_VIEW, 'invalid-value');

      const { result } = renderHook(() => useActiveView());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should fall back to default 'bible'
      expect(result.current.activeView).toBe('bible');
    });

    it('should handle AsyncStorage errors gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('Storage error'));

      const { result } = renderHook(() => useActiveView());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should fall back to default view
      expect(result.current.activeView).toBe('bible');
      expect(result.current.error).not.toBeNull();

      consoleErrorSpy.mockRestore();
    });
  });
});
