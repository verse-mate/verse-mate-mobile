/**
 * Token Storage Tests
 *
 * Per spec feat-auth-platform br-auth-001 (D-005) + Phase 1 decision D-024:
 * tokens migrated to SecureStore. Refresh tokens eliminated. Tests cover
 * SecureStore primary path + one-time migration from legacy AsyncStorage.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { clearTokens, getAccessToken, setAccessToken } from '@/lib/auth/token-storage';

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

describe('token-storage (D-024 SecureStore migration)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('setAccessToken writes to SecureStore', async () => {
    await setAccessToken('test-token');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('versemate_access_token', 'test-token');
  });

  it('getAccessToken reads from SecureStore when present', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('secure-token');
    const result = await getAccessToken();
    expect(result).toBe('secure-token');
    expect(AsyncStorage.getItem).not.toHaveBeenCalled();
  });

  it('getAccessToken migrates legacy AsyncStorage token to SecureStore', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('legacy-token');

    const result = await getAccessToken();

    expect(result).toBe('legacy-token');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('versemate_access_token', 'legacy-token');
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('versemate_access_token');
  });

  it('getAccessToken returns null when neither store has a token', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

    const result = await getAccessToken();

    expect(result).toBeNull();
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  });

  it('clearTokens removes from SecureStore + sweeps legacy AsyncStorage entries', async () => {
    await clearTokens();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('versemate_access_token');
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('versemate_access_token');
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('versemate_refresh_token');
  });
});
