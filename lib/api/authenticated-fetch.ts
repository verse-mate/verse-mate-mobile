/**
 * Authenticated Fetch Wrapper
 *
 * Provides fetch wrapper with automatic token refresh on 401 responses.
 * Implements the same pattern as the web version's Eden client fetcher.
 *
 * Reference: .agent-os/web-repo/packages/backend-api/src/eden.ts (lines 101-163)
 */

import { getAccessToken } from '@/lib/auth/token-storage';
import { refreshAccessToken } from '@/lib/auth/token-refresh';

/**
 * Fetch wrapper with automatic 401 handling and token refresh
 *
 * @param url - Request URL
 * @param init - Fetch init options
 * @param retryCount - Internal retry counter (defaults to 0)
 * @returns Fetch response
 * @throws Error if request fails after retry
 */
export async function authenticatedFetch(
  url: string,
  init?: RequestInit,
  retryCount = 0,
): Promise<Response> {
  // Get current access token
  const accessToken = await getAccessToken();

  // Build headers with authorization
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string>),
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  // Make the request
  const response = await fetch(url, {
    ...init,
    headers,
  });

  // If 401 and not already retrying, attempt token refresh
  if (response.status === 401 && retryCount === 0) {
    // Don't refresh on auth endpoints themselves
    const isAuthEndpoint =
      url.includes('/auth/login') ||
      url.includes('/auth/signup') ||
      url.includes('/auth/refresh');

    if (!isAuthEndpoint) {
      try {
        // Refresh the access token
        const newAccessToken = await refreshAccessToken();

        if (newAccessToken) {
          // Retry the request with the new token
          const retryHeaders = {
            ...headers,
            Authorization: `Bearer ${newAccessToken}`,
          };

          return authenticatedFetch(url, { ...init, headers: retryHeaders }, retryCount + 1);
        }
      } catch (error) {
        console.error('Token refresh failed during 401 retry:', error);
        // Fall through to return the original 401 response
      }
    }
  }

  return response;
}
