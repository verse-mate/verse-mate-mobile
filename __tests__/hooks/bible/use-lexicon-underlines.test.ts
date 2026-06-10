/**
 * useLexiconUnderlines Hook Tests
 *
 * Tests for the lexicon-underline preference hook (MOBILE-1001 #7): default
 * value, AsyncStorage persistence round-trip, and the module-level pub/sub
 * that keeps every mounted consumer (e.g. the reader) in sync with a Settings
 * toggle without a remount.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import {
  __TEST_ONLY_RESET_CACHE,
  useLexiconUnderlines,
} from '@/hooks/bible/use-lexicon-underlines';

const STORAGE_KEY = '@versemate:lexicon_underlines';

// AsyncStorage is automatically mocked by @react-native-async-storage/async-storage

describe('useLexiconUnderlines', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    __TEST_ONLY_RESET_CACHE();
  });

  afterEach(async () => {
    await AsyncStorage.clear();
  });

  it('defaults to true (underlines shown) when no stored value exists', async () => {
    const { result } = renderHook(() => useLexiconUnderlines());

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.showUnderlines).toBe(true);
  });

  it('loads a persisted "off" preference from AsyncStorage on mount', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, 'false');

    const { result } = renderHook(() => useLexiconUnderlines());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.showUnderlines).toBe(false);
  });

  it('persists changes to AsyncStorage', async () => {
    const { result } = renderHook(() => useLexiconUnderlines());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.setShowUnderlines(false);
    });

    expect(result.current.showUnderlines).toBe(false);
    expect(await AsyncStorage.getItem(STORAGE_KEY)).toBe('false');
  });

  it('notifies all mounted consumers live when the preference changes', async () => {
    // Two independent consumers (e.g. the reader + the settings toggle).
    const a = renderHook(() => useLexiconUnderlines());
    const b = renderHook(() => useLexiconUnderlines());

    await waitFor(() => {
      expect(a.result.current.isLoading).toBe(false);
      expect(b.result.current.isLoading).toBe(false);
    });

    // Toggle off via consumer A...
    await act(async () => {
      await a.result.current.setShowUnderlines(false);
    });

    // ...consumer B reflects it without a remount (module-level pub/sub).
    expect(a.result.current.showUnderlines).toBe(false);
    expect(b.result.current.showUnderlines).toBe(false);
  });
});
