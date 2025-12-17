/**
 * Client Interceptors Module
 *
 * Sets up HTTP interceptors for the generated API client.
 * Handles:
 * - Automatic token injection in request headers
 * - 401 response handling with automatic token refresh and retry
 * - Network error tracking with PostHog (4xx/5xx responses)
 *
 * NOTE: The generated client uses @hey-api/client-fetch (Fetch API), not axios.
 * Interceptors are implemented using the client's middleware system.
 */

import { client } from '@/src/api/generated/client.gen';
import type { ResolvedRequestOptions } from '@/src/api/generated/client/types.gen';
import { getAccessToken } from '@/lib/auth/token-storage';
import { refreshAccessToken } from '@/lib/auth/token-refresh';

// Track retry attempts per request to prevent infinite loops
const retryAttempts = new WeakMap<Request, number>();

// PostHog instance for error tracking
// Set by setPostHogInstance function called from app initialization
let posthogInstance: { captureException: (error: unknown, context?: unknown) => void } | null = null;

/**
 * Set PostHog instance for error tracking
 * Called during app initialization after PostHog is set up
 */
export function setPostHogInstance(posthog: { captureException: (error: unknown, context?: unknown) => void } | null) {
  posthogInstance = posthog;
}

/**
 * Request interceptor: Add Authorization header with access token
 */
async function requestInterceptor(
  request: Request,
  _options: ResolvedRequestOptions,
): Promise<Request> {
  // Get access token from storage
  const token = await getAccessToken();

  // If token exists and Authorization header not already set, add it
  if (token && !request.headers.has('Authorization')) {
    const headers = new Headers(request.headers);
    headers.set('Authorization', `Bearer ${token}`);

    // Create new request with updated headers
    return new Request(request, { headers });
  }

  return request;
}

/**
 * Check if a path is an auth endpoint that should skip error tracking
 */
function isAuthEndpoint(path: string): boolean {
  return (
    path.includes('/auth/login') ||
    path.includes('/auth/signup') ||
    path.includes('/auth/refresh')
  );
}

/**
 * Response interceptor: Handle 401 responses with token refresh and retry,
 * and track 4xx/5xx errors with PostHog
 */
async function responseInterceptor(
  response: Response,
  request: Request,
  _options: ResolvedRequestOptions,
): Promise<Response> {
  // Extract path from URL
  const url = new URL(request.url);
  const path = url.pathname;

  // Track 4xx/5xx errors (except 401) with PostHog
  if (response.status >= 400 && response.status !== 401) {
    // Skip auth endpoints to avoid noise
    if (!isAuthEndpoint(path)) {
      const errorContext = {
        context: 'network-error',
        statusCode: response.status,
        endpoint: path,
        method: request.method,
        url: request.url,
      };

      // Create error with status text
      const error = new Error(
        `HTTP ${response.status}: ${response.statusText || 'Network Error'} - ${request.method} ${path}`
      );

      // Capture with PostHog if available
      posthogInstance?.captureException(error, errorContext);
    }
  }

  // Only handle 401 responses for token refresh
  if (response.status !== 401) {
    return response;
  }

  // Skip refresh for auth endpoints to prevent loops
  if (isAuthEndpoint(path)) {
    return response;
  }

  // Check retry count (max 1 retry per request)
  const currentRetries = retryAttempts.get(request) || 0;
  if (currentRetries >= 1) {
    // Already retried once, don't retry again
    return response;
  }

  try {
    // Attempt to refresh the access token
    const newToken = await refreshAccessToken();

    // Update retry count
    retryAttempts.set(request, currentRetries + 1);

    // Create new request with updated Authorization header
    const headers = new Headers(request.headers);
    headers.set('Authorization', `Bearer ${newToken}`);

    const newRequest = new Request(request, { headers });

    // Retry the original request with new token
    const retryResponse = await fetch(newRequest);

    return retryResponse;
  } catch (error) {
    // Refresh failed - return original 401 response
    // Auth context will handle logout based on 401
    console.error('Token refresh failed in interceptor:', error);
    return response;
  }
}

/**
 * Set up client interceptors for authentication.
 *
 * Should be called once during app initialization, after QueryClient setup.
 * Configures both request and response interceptors on the global client instance.
 * Also sets the baseUrl from environment variable (overrides hardcoded value in generated client).
 */
export function setupClientInterceptors(): void {
  // Override baseUrl from environment variable
  // The generated client has a hardcoded baseUrl, but we want to use the env var for flexibility
  const apiUrl = process.env.EXPO_PUBLIC_API_URL;
  if (apiUrl) {
    client.setConfig({ baseUrl: apiUrl });
  }

  // Add request interceptor for token injection
  client.interceptors.request.use(requestInterceptor);

  // Add response interceptor for 401 handling and error tracking
  client.interceptors.response.use(responseInterceptor);
}
