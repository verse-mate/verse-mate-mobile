/**
 * useFontSize is ONE value for the whole app.
 *
 * Each caller used to keep its own copy, so changing the size in Settings
 * reached only the Settings screen; the reader, a topic or a Jesus page already
 * mounted underneath kept the old size until it remounted. Operator: "if you
 * went into settings, changed the size and then clicked the back button the
 * page you were on would still show at the same size" — app-wide.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { __TEST_ONLY_RESET_CACHE, useFontSize } from '@/hooks/bible/use-font-size';

beforeEach(async () => {
  __TEST_ONLY_RESET_CACHE();
  await AsyncStorage.clear();
});

describe('useFontSize', () => {
  it('updates a screen that is already mounted when another one changes the size', async () => {
    // The reader, mounted first…
    const reader = renderHook(() => useFontSize());
    await waitFor(() => expect(reader.result.current.isLoading).toBe(false));
    // …then Settings, on top of it.
    const settings = renderHook(() => useFontSize());

    await act(async () => {
      await settings.result.current.setFontSize(24);
    });

    expect(settings.result.current.fontSize).toBe(24);
    expect(reader.result.current.fontSize).toBe(24);
  });

  it('still persists the size', async () => {
    const { result } = renderHook(() => useFontSize());
    await act(async () => {
      await result.current.setFontSize(22);
    });
    expect(await AsyncStorage.getItem('@versemate:font_size')).toBe('22');
  });

  it('clamps to the allowed range', async () => {
    const { result } = renderHook(() => useFontSize());
    await act(async () => {
      await result.current.setFontSize(99);
    });
    expect(result.current.fontSize).toBe(result.current.maxFontSize);
  });
});
