/**
 * Token Storage Tests
 *
 * Focused tests for token storage using AsyncStorage.
 * Tests only critical behaviors: store, retrieve, and clear tokens.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
} from '@/lib/auth/token-storage';

// Mock @react-native-async-storage/async-storage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn(),
  multiRemove: jest.fn(),
}));

describe('Token Storage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('setAccessToken', () => {
    it('should store access token in AsyncStorage', async () => {
      const token = 'test-access-token';

      await setAccessToken(token);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith('versemate_access_token', token);
    });

    it('should handle AsyncStorage errors', async () => {
      const error = new Error('AsyncStorage failed');
      (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(error);

      await expect(setAccessToken('token')).rejects.toThrow('AsyncStorage failed');
    });
  });

  describe('getAccessToken', () => {
    it('should retrieve access token from AsyncStorage', async () => {
      const token = 'stored-access-token';
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(token);

      const result = await getAccessToken();

      expect(AsyncStorage.getItem).toHaveBeenCalledWith('versemate_access_token');
      expect(result).toBe(token);
    });

    it('should return null when no token exists', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);

      const result = await getAccessToken();

      expect(result).toBeNull();
    });
  });

  describe('setRefreshToken', () => {
    it('should store refresh token in AsyncStorage', async () => {
      const token = 'test-refresh-token';

      await setRefreshToken(token);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith('versemate_refresh_token', token);
    });
  });

  describe('getRefreshToken', () => {
    it('should retrieve refresh token from AsyncStorage', async () => {
      const token = 'stored-refresh-token';
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(token);

      const result = await getRefreshToken();

      expect(AsyncStorage.getItem).toHaveBeenCalledWith('versemate_refresh_token');
      expect(result).toBe(token);
    });
  });

  describe('clearTokens', () => {
    it('should delete both access and refresh tokens', async () => {
      await clearTokens();

      expect(AsyncStorage.multiRemove).toHaveBeenCalledWith([
        'versemate_access_token',
        'versemate_refresh_token',
      ]);
    });

    it('should handle multiRemove errors', async () => {
      const error = new Error('multiRemove failed');
      (AsyncStorage.multiRemove as jest.Mock).mockRejectedValueOnce(error);

      await expect(clearTokens()).rejects.toThrow('multiRemove failed');
    });
  });
});
