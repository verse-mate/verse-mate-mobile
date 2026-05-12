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
 *
 * On web, `expo-secure-store` has no native module — its methods throw
 * `getValueWithKeyAsync is not a function`. The web build falls back to
 * AsyncStorage (which is backed by `localStorage`) so the request
 * interceptor can complete and API fetches actually fire.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const ACCESS_TOKEN_KEY = 'versemate_access_token';
const LEGACY_REFRESH_TOKEN_KEY = 'versemate_refresh_token';

// Resolved per-call (not cached) so tests can flip Platform.OS without
// re-importing the module.
const isWebPlatform = (): boolean => Platform.OS === 'web';

/**
 * Store access token in SecureStore (encrypted at rest via OS keychain).
 * On web, falls back to AsyncStorage / localStorage.
 */
export async function setAccessToken(token: string): Promise<void> {
  try {
    if (isWebPlatform()) {
      await AsyncStorage.setItem(ACCESS_TOKEN_KEY, token);
      return;
    }
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
 *
 * On web, reads from AsyncStorage directly (no SecureStore on web).
 */
export async function getAccessToken(): Promise<string | null> {
  try {
    if (isWebPlatform()) {
      return await AsyncStorage.getItem(ACCESS_TOKEN_KEY);
    }

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
 * Clear access token from SecureStore + sweep legacy AsyncStorage entries.
 * Used during logout.
 */
export async function clearTokens(): Promise<void> {
  try {
    if (isWebPlatform()) {
      await Promise.all([
        AsyncStorage.removeItem(ACCESS_TOKEN_KEY),
        AsyncStorage.removeItem(LEGACY_REFRESH_TOKEN_KEY),
      ]);
      return;
    }

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
