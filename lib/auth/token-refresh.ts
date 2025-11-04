/**
 * Token Refresh Module
 *
 * Implements token refresh logic with mutex pattern to prevent concurrent refresh attempts.
 * Provides both reactive (on-demand) and proactive (timer-based) refresh strategies.
 *
 * Reference: ../verse-mate/packages/backend-api/src/eden.ts (lines 36-159)
 */

import { postAuthRefresh } from '@/src/api/generated/sdk.gen';
import { jwtDecode } from 'jwt-decode';
import {
  clearTokens,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
} from './token-storage';

// Mutex pattern to prevent concurrent refresh attempts
let isRefreshing = false;
let refreshPromise: Promise<string> | null = null;

/**
 * Refresh the access token using the stored refresh token.
 *
 * Uses a mutex pattern to prevent multiple simultaneous refresh attempts.
 * If a refresh is already in progress, subsequent calls will wait for the same promise.
 *
 * @returns New access token
 * @throws Error if refresh fails or no refresh token available
 */
export async function refreshAccessToken(): Promise<string> {
  // Return existing refresh promise if already refreshing
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      // Get refresh token from storage
      const refreshToken = await getRefreshToken();
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      // Call refresh endpoint
      const { data, error } = await postAuthRefresh({
        body: { refreshToken },
      });

      if (error || !data) {
        // Refresh failed - clear tokens and throw
        await clearTokens();
        throw new Error('Token refresh failed');
      }

      // Update tokens in storage
      await setAccessToken(data.accessToken);
      if (data.refreshToken) {
        await setRefreshToken(data.refreshToken);
      }

      return data.accessToken;
    } catch (error) {
      // Clear tokens on any error
      await clearTokens();
      throw error;
    } finally {
      // Reset mutex state
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/**
 * Set up proactive token refresh before expiration.
 *
 * Parses the JWT access token to extract expiration time and schedules
 * a refresh 2 minutes before expiration (13 minutes for 15-minute tokens).
 *
 * @param accessToken - JWT access token to parse
 * @returns Cleanup function to cancel the scheduled refresh
 */
export function setupProactiveRefresh(accessToken: string): () => void {
  try {
    // Parse JWT to get expiration claim
    const decoded = jwtDecode<{ exp: number }>(accessToken);
    const expiresAt = decoded.exp * 1000; // Convert to milliseconds
    const now = Date.now();

    // Calculate time until expiration
    const timeUntilExpiration = expiresAt - now;

    // Schedule refresh 2 minutes (120 seconds = 120000 ms) before expiration
    const REFRESH_BUFFER = 2 * 60 * 1000; // 2 minutes in milliseconds
    const refreshDelay = Math.max(0, timeUntilExpiration - REFRESH_BUFFER);

    // Set up timer to refresh token
    const timerId = setTimeout(() => {
      // Silently refresh token in background
      refreshAccessToken().catch((error) => {
        console.error('Proactive token refresh failed:', error);
        // Note: Errors are logged but not thrown to avoid breaking the app
        // Reactive refresh (401 interceptor) will handle the next API call
      });
    }, refreshDelay);

    // Return cleanup function
    return () => {
      clearTimeout(timerId);
    };
  } catch (error) {
    console.error('Failed to set up proactive refresh:', error);
    // Return no-op cleanup function
    return () => {};
  }
}
