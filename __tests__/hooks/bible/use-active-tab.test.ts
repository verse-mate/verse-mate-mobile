/**
 * useActiveTab Hook Tests
 *
 * Tests for the active tab persistence hook.
 * This hook manages the user's preferred reading mode (Summary, By Line, Detailed)
 * and persists it to AsyncStorage across app restarts.
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
    // Reset modules to clear any cached state in hooks
    jest.resetModules();
  });

  afterEach(async () => {
    // Clean up after each test
    await AsyncStorage.clear();
  });

  it('should default to "summary" when no stored value exists', async () => {
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

  it('should load persisted tab from AsyncStorage on mount', async () => {
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
});
