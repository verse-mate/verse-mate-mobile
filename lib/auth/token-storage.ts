/**
 * Token Storage Module
 *
 * Provides secure token storage using Expo SecureStore.
 * Tokens are stored in platform-native encrypted storage (iOS Keychain / Android Keystore).
 *
 * Token lifespans:
 * - Access token: 15 minutes
 * - Refresh token: 90 days
 */

import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'versemate_access_token';
const REFRESH_TOKEN_KEY = 'versemate_refresh_token';

/**
 * Store access token in SecureStore
 * @param token - JWT access token
 * @throws Error if SecureStore operation fails
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
 * Retrieve access token from SecureStore
 * @returns JWT access token or null if not found
 * @throws Error if SecureStore operation fails
 */
export async function getAccessToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  } catch (error) {
    console.error('Failed to retrieve access token:', error);
    throw error;
  }
}

/**
 * Store refresh token in SecureStore
 * @param token - JWT refresh token
 * @throws Error if SecureStore operation fails
 */
export async function setRefreshToken(token: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
  } catch (error) {
    console.error('Failed to store refresh token:', error);
    throw error;
  }
}

/**
 * Retrieve refresh token from SecureStore
 * @returns JWT refresh token or null if not found
 * @throws Error if SecureStore operation fails
 */
export async function getRefreshToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  } catch (error) {
    console.error('Failed to retrieve refresh token:', error);
    throw error;
  }
}

/**
 * Clear both access and refresh tokens from SecureStore
 * Used during logout or when token refresh fails
 * @throws Error if SecureStore operation fails
 */
export async function clearTokens(): Promise<void> {
  try {
    await Promise.all([
      SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
      SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
    ]);
  } catch (error) {
    console.error('Failed to clear tokens:', error);
    throw error;
  }
}
