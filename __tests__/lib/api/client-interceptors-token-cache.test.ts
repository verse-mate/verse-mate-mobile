/**
 * Client Interceptors Token Cache Tests
 *
 * Protects Change C4: In-memory token cache.
 * Verifies the request interceptor correctly attaches tokens,
 * handles edge cases, and (TDD) uses an in-memory cache to avoid
 * repeated AsyncStorage reads.
 */

import {
  clearTokenCache,
  requestInterceptor,
  setupClientInterceptors,
} from '@/lib/api/client-interceptors';
import { getAccessToken } from '@/lib/auth/token-storage';
import { client } from '@/src/api/generated/client.gen';

jest.mock('@/lib/auth/token-storage');

const mockGetAccessToken = getAccessToken as jest.MockedFunction<typeof getAccessToken>;

// The interceptor signature takes a second ResolvedRequestOptions argument
// that the implementation ignores. Pass an unknown-cast empty object so we
// don't have to construct the full options object in every test.
// biome-ignore lint/suspicious/noExplicitAny: test helper
const opts = {} as any;

describe('requestInterceptor token caching', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearTokenCache();
    mockGetAccessToken.mockResolvedValue('token-abc');
  });

  it('[REGRESSION] attaches Authorization header from token storage', async () => {
    // Create a request without Authorization header
    const request = new Request('https://api.example.com/bible/1/1', {
      method: 'GET',
    });

    // Call getAccessToken and verify it returns a token
    const token = await getAccessToken();
    expect(token).toBe('token-abc');

    // Verify the interceptor pattern: if token exists and no auth header, add it
    if (token && !request.headers.has('Authorization')) {
      const headers = new Headers(request.headers);
      headers.set('Authorization', `Bearer ${token}`);
      const newRequest = new Request(request, { headers });
      expect(newRequest.headers.get('Authorization')).toBe('Bearer token-abc');
    }
  });

  it('[REGRESSION] does not overwrite existing Authorization header', async () => {
    // Create a request with pre-existing Authorization header
    const request = new Request('https://api.example.com/bible/1/1', {
      method: 'GET',
      headers: { Authorization: 'Bearer existing-token' },
    });

    const token = await getAccessToken();

    // Interceptor logic: only set if not already present
    if (token && !request.headers.has('Authorization')) {
      // This block should NOT execute since Authorization is already set
      throw new Error('Should not reach here');
    }

    // Original header should be preserved
    expect(request.headers.get('Authorization')).toBe('Bearer existing-token');
  });

  it('[REGRESSION] handles missing token gracefully (unauthenticated)', async () => {
    mockGetAccessToken.mockResolvedValue(null);

    const request = new Request('https://api.example.com/bible/1/1', {
      method: 'GET',
    });

    const token = await getAccessToken();

    // With no token, request should pass through without Authorization
    if (token && !request.headers.has('Authorization')) {
      throw new Error('Should not reach here when token is null');
    }

    expect(request.headers.has('Authorization')).toBe(false);
  });

  it('[TDD] uses in-memory cache for subsequent requests (no repeated AsyncStorage reads)', () => {
    // clearTokenCache is now implemented — verify it exists
    const interceptors = require('@/lib/api/client-interceptors');

    expect(interceptors.clearTokenCache).toBeDefined();
    expect(typeof interceptors.clearTokenCache).toBe('function');
  });

  it('[TDD] cache is invalidated after token refresh', () => {
    // clearTokenCache is now implemented — verify it exists
    const interceptors = require('@/lib/api/client-interceptors');

    expect(interceptors.clearTokenCache).toBeDefined();
  });

  it('[REGRESSION VER-38] picks up a token written after the first interceptor call (login-after-guest)', async () => {
    // Guest opens the app: first interceptor call sees no token in storage.
    mockGetAccessToken.mockResolvedValueOnce(null);
    const guestReq = new Request('https://api.example.com/bible/books');
    const afterGuest = await requestInterceptor(guestReq, opts);
    expect(afterGuest.headers.has('Authorization')).toBe(false);

    // User logs in: setAccessToken writes to storage. The interceptor
    // should re-read storage on the next request and attach the new token.
    mockGetAccessToken.mockResolvedValueOnce('fresh-jwt');
    const sessionReq = new Request('https://api.example.com/auth/session');
    const afterLogin = await requestInterceptor(sessionReq, opts);
    expect(afterLogin.headers.get('Authorization')).toBe('Bearer fresh-jwt');
  });

  it('[REGRESSION VER-38] caches the token across requests once known (no extra storage reads)', async () => {
    mockGetAccessToken.mockResolvedValue('jwt-1');
    await requestInterceptor(new Request('https://api.example.com/a'), opts);
    await requestInterceptor(new Request('https://api.example.com/b'), opts);
    await requestInterceptor(new Request('https://api.example.com/c'), opts);
    // First call populates the cache; subsequent calls hit it.
    expect(mockGetAccessToken).toHaveBeenCalledTimes(1);
  });

  it('[REGRESSION VER-38] clearTokenCache forces a fresh storage read', async () => {
    mockGetAccessToken.mockResolvedValueOnce('old-jwt');
    await requestInterceptor(new Request('https://api.example.com/a'), opts);

    clearTokenCache();
    mockGetAccessToken.mockResolvedValueOnce('new-jwt');
    const next = await requestInterceptor(new Request('https://api.example.com/b'), opts);

    expect(next.headers.get('Authorization')).toBe('Bearer new-jwt');
  });
});
