/**
 * Token Storage Module
 *
 * Stores the JWT access token securely.
 *
 * Per spec feat-auth-platform br-auth-001 (D-005): the access token IS the
 * persistent session token (90-day TTL, server-validated against Redis cache).
 * Refresh tokens have been eliminated.
 *
 * Per Phase 1 decision D-024: tokens migrate from plaintext AsyncStorage to
 * iOS Keychain / Android Keystore via `expo-secure-store`. AsyncStorage is
 * checked once per launch as a one-time migration: if a legacy token is
 * found there, it's copied to SecureStore and removed.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'versemate_access_token';
const LEGACY_REFRESH_TOKEN_KEY = 'versemate_refresh_token';

/**
 * Store access token in SecureStore (encrypted at rest via OS keychain).
 */
export async function setAccessToken(token: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token);
  } catch (error) {
    console.error('Failed to store access token:', error);
    throw error;
  }
}

/**
 * Retrieve access token from SecureStore.
 *
 * Performs a one-time migration on first call: if a legacy AsyncStorage token
 * exists (from before D-024) it's copied into SecureStore and the AsyncStorage
 * entry removed.
 */
export async function getAccessToken(): Promise<string | null> {
  try {
    const secure = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
    if (secure) return secure;

    // One-time migration from legacy AsyncStorage.
    const legacy = await AsyncStorage.getItem(ACCESS_TOKEN_KEY);
    if (legacy) {
      await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, legacy);
      await AsyncStorage.removeItem(ACCESS_TOKEN_KEY);
      return legacy;
    }

    return null;
  } catch (error) {
    console.error('Failed to retrieve access token:', error);
    throw error;
  }
}

/**
 * @deprecated Refresh tokens are eliminated per D-005. Stub kept until
 * the companion PR removes all callers. No-op.
 */
export async function setRefreshToken(_token: string): Promise<void> {
  // intentional no-op
}

/**
 * @deprecated Refresh tokens are eliminated per D-005. Stub kept until
 * the companion PR removes all callers. Always returns null.
 */
export async function getRefreshToken(): Promise<string | null> {
  return null;
}

/**
 * Clear access token from SecureStore + sweep legacy AsyncStorage entries.
 * Used during logout.
 */
export async function clearTokens(): Promise<void> {
  try {
    await Promise.all([
      SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
      // Sweep legacy entries (refresh-token D-005 + AsyncStorage migration D-024)
      AsyncStorage.removeItem(ACCESS_TOKEN_KEY),
      AsyncStorage.removeItem(LEGACY_REFRESH_TOKEN_KEY),
    ]);
  } catch (error) {
    console.error('Failed to clear tokens:', error);
    throw error;
  }
}
