/**
 * Token Storage Module
 *
 * Provides token storage using AsyncStorage.
 * Note: AsyncStorage is not encrypted. For production apps requiring higher security,
 * consider migrating to expo-secure-store when Xcode compatibility issues are resolved.
 *
 * Token lifespans:
 * - Access token: 15 minutes
 * - Refresh token: 90 days
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const ACCESS_TOKEN_KEY = 'versemate_access_token';
const REFRESH_TOKEN_KEY = 'versemate_refresh_token';

/**
 * Store access token in AsyncStorage
 * @param token - JWT access token
 * @throws Error if AsyncStorage operation fails
 */
export async function setAccessToken(token: string): Promise<void> {
  try {
    await AsyncStorage.setItem(ACCESS_TOKEN_KEY, token);
  } catch (error) {
    console.error('Failed to store access token:', error);
    throw error;
  }
}

/**
 * Retrieve access token from AsyncStorage
 * @returns JWT access token or null if not found
 * @throws Error if AsyncStorage operation fails
 */
export async function getAccessToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(ACCESS_TOKEN_KEY);
  } catch (error) {
    console.error('Failed to retrieve access token:', error);
    throw error;
  }
}

/**
 * Store refresh token in AsyncStorage
 * @param token - JWT refresh token
 * @throws Error if AsyncStorage operation fails
 */
export async function setRefreshToken(token: string): Promise<void> {
  try {
    await AsyncStorage.setItem(REFRESH_TOKEN_KEY, token);
  } catch (error) {
    console.error('Failed to store refresh token:', error);
    throw error;
  }
}

/**
 * Retrieve refresh token from AsyncStorage
 * @returns JWT refresh token or null if not found
 * @throws Error if AsyncStorage operation fails
 */
export async function getRefreshToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
  } catch (error) {
    console.error('Failed to retrieve refresh token:', error);
    throw error;
  }
}

/**
 * Clear both access and refresh tokens from AsyncStorage
 * Used during logout or when token refresh fails
 * @throws Error if AsyncStorage operation fails
 */
export async function clearTokens(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY]);
  } catch (error) {
    console.error('Failed to clear tokens:', error);
    throw error;
  }
}
