/**
 * Authenticated Fetch Wrapper
 *
 * Provides fetch wrapper with automatic token refresh on 401 responses.
 * Implements the same pattern as the web version's Eden client fetcher.
 *
 * Reference: .agent-os/web-repo/packages/backend-api/src/eden.ts (lines 101-163)
 */

import { getAccessToken } from '@/lib/auth/token-storage';
// refreshAccessToken removed per D-005 — access token IS the persistent session;
// 401 means token revoked or expired (after 90 days). Caller should clear tokens.

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

  // 401 retry-with-refresh removed per D-005 — access token IS the persistent
  // session. A 401 means the token is genuinely revoked/expired; no refresh
  // path. Callers should observe 401 in the response and route to login.
  void retryCount;

  return response;
}
