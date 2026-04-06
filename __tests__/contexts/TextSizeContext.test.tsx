import AsyncStorage from '@react-native-async-storage/async-storage';
import { renderHook, waitFor } from '@testing-library/react-native';
import { act } from 'react-test-renderer';

import {
  PRESET_ORDER,
  SCALE_FACTORS,
  type TextSizePreset,
  TextSizeProvider,
  useTextSize,
} from '@/contexts/TextSizeContext';

jest.unmock('@/contexts/TextSizeContext');

jest.mock('@react-native-async-storage/async-storage');

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

// Mock PostHog
const mockCapture = jest.fn();
jest.mock('@/lib/analytics/posthog-provider', () => ({
  getPostHogInstance: () => ({ capture: mockCapture }),
}));

const createWrapper = () => {
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <TextSizeProvider>{children}</TextSizeProvider>
  );
  return Wrapper;
};

describe('TextSizeContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAsyncStorage.getItem.mockResolvedValue(null);
    mockAsyncStorage.setItem.mockResolvedValue(undefined);
  });

  it('defaults to medium preset with 1.0x scale factor', async () => {
    const { result } = renderHook(() => useTextSize(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.preset).toBe('medium');
    expect(result.current.scaleFactor).toBe(1.0);
  });

  it('loads saved preset from AsyncStorage', async () => {
    mockAsyncStorage.getItem.mockResolvedValue('large');

    const { result } = renderHook(() => useTextSize(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.preset).toBe('large');
    expect(result.current.scaleFactor).toBe(1.15);
  });

  it('falls back to medium for invalid stored values', async () => {
    mockAsyncStorage.getItem.mockResolvedValue('invalid_value');

    const { result } = renderHook(() => useTextSize(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.preset).toBe('medium');
  });

  it('setPreset updates state and AsyncStorage', async () => {
    const { result } = renderHook(() => useTextSize(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.setPreset('extraLarge');
    });

    expect(result.current.preset).toBe('extraLarge');
    expect(result.current.scaleFactor).toBe(1.3);
    expect(mockAsyncStorage.setItem).toHaveBeenCalledWith('text-size-preference', 'extraLarge');
  });

  it('scaledFontSize returns correct values for each preset', async () => {
    const { result } = renderHook(() => useTextSize(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Default medium (1.0x)
    expect(result.current.scaledFontSize(18)).toBe(18);
    expect(result.current.scaledFontSize(24)).toBe(24);

    // Switch to small (0.85x)
    await act(async () => {
      await result.current.setPreset('small');
    });
    expect(result.current.scaledFontSize(18)).toBe(Math.round(18 * 0.85));
    expect(result.current.scaledFontSize(24)).toBe(Math.round(24 * 0.85));

    // Switch to extraLarge (1.3x)
    await act(async () => {
      await result.current.setPreset('extraLarge');
    });
    expect(result.current.scaledFontSize(18)).toBe(Math.round(18 * 1.3));
  });

  it('tracks PostHog analytics on preset change', async () => {
    const { result } = renderHook(() => useTextSize(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.setPreset('large');
    });

    expect(mockCapture).toHaveBeenCalledWith('$set', {
      $set: { text_size_preference: 'large' },
    });
  });

  it('handles AsyncStorage failures gracefully', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockAsyncStorage.setItem.mockRejectedValue(new Error('Storage error'));

    const { result } = renderHook(() => useTextSize(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Should still update state optimistically
    await act(async () => {
      await result.current.setPreset('large');
    });

    expect(result.current.preset).toBe('large');
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('handles AsyncStorage load failure gracefully', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockAsyncStorage.getItem.mockRejectedValue(new Error('Load error'));

    const { result } = renderHook(() => useTextSize(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Should fall back to default
    expect(result.current.preset).toBe('medium');
    consoleSpy.mockRestore();
  });

  it('throws when useTextSize is used outside provider', () => {
    // Suppress console.error for expected error
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      renderHook(() => useTextSize());
    }).toThrow('useTextSize must be used within a TextSizeProvider');

    consoleSpy.mockRestore();
  });

  it('PRESET_ORDER contains all presets in correct order', () => {
    expect(PRESET_ORDER).toEqual(['small', 'medium', 'large', 'extraLarge']);
  });

  it('SCALE_FACTORS has correct values for all presets', () => {
    expect(SCALE_FACTORS.small).toBe(0.85);
    expect(SCALE_FACTORS.medium).toBe(1.0);
    expect(SCALE_FACTORS.large).toBe(1.15);
    expect(SCALE_FACTORS.extraLarge).toBe(1.3);
  });
});
