/**
 * Token Storage Tests
 *
 * Per spec feat-auth-platform br-auth-001 (D-005) + Phase 1 decision D-024:
 * tokens migrated to SecureStore. Refresh tokens eliminated. Tests cover
 * SecureStore primary path + one-time migration from legacy AsyncStorage.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
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

describe('token-storage on web (VER-15 SecureStore fallback)', () => {
  // expo-secure-store has no web implementation; reads/writes there throw
  // `getValueWithKeyAsync is not a function`, which crashed the request
  // interceptor before any API fetch could fire. On web we fall back to
  // AsyncStorage (localStorage) so the chapter screen actually fetches.
  const originalOS = Platform.OS;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
  });

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true });
  });

  it('setAccessToken writes to AsyncStorage on web (not SecureStore)', async () => {
    await setAccessToken('web-token');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('versemate_access_token', 'web-token');
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  });

  it('getAccessToken reads from AsyncStorage on web (not SecureStore)', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('web-token');
    const result = await getAccessToken();
    expect(result).toBe('web-token');
    expect(SecureStore.getItemAsync).not.toHaveBeenCalled();
  });

  it('clearTokens removes only AsyncStorage entries on web', async () => {
    await clearTokens();
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('versemate_access_token');
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('versemate_refresh_token');
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
  });
});
