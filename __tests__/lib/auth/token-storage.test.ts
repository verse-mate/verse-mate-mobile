/**
 * Token Storage Tests
 *
 * Focused tests for secure token storage using Expo SecureStore.
 * Tests only critical behaviors: store, retrieve, and clear tokens.
 */

import * as SecureStore from 'expo-secure-store';
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
} from '@/lib/auth/token-storage';

// Mock expo-secure-store
jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

describe('Token Storage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('setAccessToken', () => {
    it('should store access token in SecureStore', async () => {
      const token = 'test-access-token';

      await setAccessToken(token);

      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('versemate_access_token', token);
    });

    it('should handle SecureStore errors', async () => {
      const error = new Error('SecureStore failed');
      (SecureStore.setItemAsync as jest.Mock).mockRejectedValueOnce(error);

      await expect(setAccessToken('token')).rejects.toThrow('SecureStore failed');
    });
  });

  describe('getAccessToken', () => {
    it('should retrieve access token from SecureStore', async () => {
      const token = 'stored-access-token';
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(token);

      const result = await getAccessToken();

      expect(SecureStore.getItemAsync).toHaveBeenCalledWith('versemate_access_token');
      expect(result).toBe(token);
    });

    it('should return null when no token exists', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(null);

      const result = await getAccessToken();

      expect(result).toBeNull();
    });
  });

  describe('setRefreshToken', () => {
    it('should store refresh token in SecureStore', async () => {
      const token = 'test-refresh-token';

      await setRefreshToken(token);

      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('versemate_refresh_token', token);
    });
  });

  describe('getRefreshToken', () => {
    it('should retrieve refresh token from SecureStore', async () => {
      const token = 'stored-refresh-token';
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(token);

      const result = await getRefreshToken();

      expect(SecureStore.getItemAsync).toHaveBeenCalledWith('versemate_refresh_token');
      expect(result).toBe(token);
    });
  });

  describe('clearTokens', () => {
    it('should delete both access and refresh tokens', async () => {
      await clearTokens();

      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('versemate_access_token');
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('versemate_refresh_token');
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledTimes(2);
    });

    it('should clear tokens even if one deletion fails', async () => {
      const error = new Error('Delete failed');
      (SecureStore.deleteItemAsync as jest.Mock).mockRejectedValueOnce(error);

      await expect(clearTokens()).rejects.toThrow('Delete failed');
      // Both deletions should still be attempted
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledTimes(2);
    });
  });
});
