import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useAuth } from '../../contexts/AuthContext';
import {
  notifyLanguageChanged,
  resetCachedLanguage,
  usePreferredLanguage,
} from '../../hooks/use-preferred-language';

// Mock dependencies
jest.mock('../../contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

describe('usePreferredLanguage', () => {
  const mockUseAuth = useAuth as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    resetCachedLanguage();
    mockUseAuth.mockReturnValue({ user: { preferred_language: 'en-US' } });
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
  });

  it('returns session language by default', async () => {
    const { result } = renderHook(() => usePreferredLanguage());

    expect(result.current).toBe('en-US');

    await waitFor(() => {
      expect(AsyncStorage.getItem).toHaveBeenCalledWith('@versemate:preferred_language');
    });
  });

  it('prefers offline-stored language if available', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('ro');

    const { result } = renderHook(() => usePreferredLanguage());

    await waitFor(() => {
      expect(result.current).toBe('ro');
    });
  });

  it('updates when notifyLanguageChanged is called', async () => {
    const { result } = renderHook(() => usePreferredLanguage());

    expect(result.current).toBe('en-US');

    // Simulate language change in settings
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('es');

    await act(async () => {
      notifyLanguageChanged();
    });

    await waitFor(() => {
      expect(result.current).toBe('es');
    });
  });

  it('falls back to en-US if user has no preference and nothing stored', async () => {
    mockUseAuth.mockReturnValue({ user: null });
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

    const { result } = renderHook(() => usePreferredLanguage());

    await waitFor(() => {
      expect(result.current).toBe('en-US');
    });
  });
});
