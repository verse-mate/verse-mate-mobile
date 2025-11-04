/**
 * Token Refresh Tests
 *
 * Focused tests for token refresh functionality.
 * Tests critical behaviors: 401 refresh, concurrent refresh prevention.
 */

import { refreshAccessToken, setupProactiveRefresh } from '@/lib/auth/token-refresh';
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
} from '@/lib/auth/token-storage';

// Mock expo-secure-store with in-memory storage
const mockStorage = new Map<string, string>();

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn((key: string, value: string) => {
    mockStorage.set(key, value);
    return Promise.resolve();
  }),
  getItemAsync: jest.fn((key: string) => {
    return Promise.resolve(mockStorage.get(key) || null);
  }),
  deleteItemAsync: jest.fn((key: string) => {
    mockStorage.delete(key);
    return Promise.resolve();
  }),
}));

// Mock the generated SDK
let mockPostAuthRefreshResponse: { data?: any; error?: any } = {};

jest.mock('@/src/api/generated/sdk.gen', () => ({
  postAuthRefresh: jest.fn(() => Promise.resolve(mockPostAuthRefreshResponse)),
}));

// Mock jwt-decode
jest.mock('jwt-decode', () => ({
  jwtDecode: jest.fn((token: string) => {
    // For testing: parse exp from token if it contains "exp-"
    const match = token.match(/exp-(\d+)/);
    if (match) {
      return { exp: Number.parseInt(match[1], 10) };
    }
    // Default: token expires in 15 minutes
    return { exp: Math.floor(Date.now() / 1000) + 15 * 60 };
  }),
}));

describe('Token Refresh', () => {
  beforeEach(async () => {
    // Clear mock storage
    mockStorage.clear();
    jest.clearAllMocks();
    // Reset mock response
    mockPostAuthRefreshResponse = {};
  });

  describe('refreshAccessToken', () => {
    it('should refresh access token successfully', async () => {
      // Setup: store initial refresh token
      await setRefreshToken('old-refresh-token');

      // Mock successful refresh response
      mockPostAuthRefreshResponse = {
        data: {
          accessToken: 'new-access-token',
          refreshToken: 'new-refresh-token',
          verified: true,
        },
      };

      // Execute: refresh token
      const newToken = await refreshAccessToken();

      // Verify: new token returned and stored
      expect(newToken).toBe('new-access-token');
      expect(await getAccessToken()).toBe('new-access-token');
      expect(await getRefreshToken()).toBe('new-refresh-token');
    });

    it('should clear tokens and throw on refresh failure', async () => {
      // Setup: store initial refresh token
      await setRefreshToken('invalid-refresh-token');

      // Mock failed refresh response
      mockPostAuthRefreshResponse = {
        error: { message: 'Invalid refresh token' },
      };

      // Execute & Verify: refresh fails and throws
      await expect(refreshAccessToken()).rejects.toThrow('Token refresh failed');

      // Verify: tokens cleared
      expect(await getAccessToken()).toBeNull();
      expect(await getRefreshToken()).toBeNull();
    });

    it('should prevent concurrent refresh attempts (mutex)', async () => {
      // Setup: store initial refresh token
      await setRefreshToken('refresh-token');

      let refreshCallCount = 0;

      // Mock SDK with delay to simulate concurrent requests
      const { postAuthRefresh } = require('@/src/api/generated/sdk.gen');
      postAuthRefresh.mockImplementation(async () => {
        refreshCallCount += 1;
        // Use Promise to simulate async delay without timers
        await Promise.resolve();

        return {
          data: {
            accessToken: 'new-access-token',
            refreshToken: 'new-refresh-token',
            verified: true,
          },
        };
      });

      // Execute: trigger multiple concurrent refresh calls
      const [token1, token2, token3] = await Promise.all([
        refreshAccessToken(),
        refreshAccessToken(),
        refreshAccessToken(),
      ]);

      // Verify: only one API call made (mutex working)
      expect(refreshCallCount).toBe(1);

      // Verify: all calls return same token
      expect(token1).toBe('new-access-token');
      expect(token2).toBe('new-access-token');
      expect(token3).toBe('new-access-token');
    });

    it('should throw when no refresh token available', async () => {
      // Setup: no refresh token stored (clear storage)
      mockStorage.clear();

      // Execute & Verify: throws when no refresh token
      await expect(refreshAccessToken()).rejects.toThrow('No refresh token available');

      // Verify: tokens remain cleared
      expect(await getAccessToken()).toBeNull();
      expect(await getRefreshToken()).toBeNull();
    });
  });

  describe('setupProactiveRefresh', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.runOnlyPendingTimers();
      jest.useRealTimers();
    });

    it('should schedule refresh 2 minutes before expiration', async () => {
      // Create a token that expires in 15 minutes (900 seconds)
      const nowSeconds = Math.floor(Date.now() / 1000);
      const expSeconds = nowSeconds + 900; // 15 minutes from now
      const token = `header.payload-exp-${expSeconds}.signature`;

      // Setup: store refresh token
      await setRefreshToken('refresh-token');

      // Mock successful refresh - use mockImplementation for fresh response
      const { postAuthRefresh } = require('@/src/api/generated/sdk.gen');
      postAuthRefresh.mockImplementation(() =>
        Promise.resolve({
          data: {
            accessToken: 'refreshed-access-token',
            refreshToken: 'refreshed-refresh-token',
            verified: true,
          },
        })
      );

      // Execute: setup proactive refresh
      const cleanup = setupProactiveRefresh(token);

      // Verify: timer scheduled for 13 minutes (15 min - 2 min buffer)
      // Fast-forward to just before refresh time
      jest.advanceTimersByTime(13 * 60 * 1000 - 1000); // 12 min 59 sec

      // Token should NOT be refreshed yet
      expect(await getAccessToken()).toBeNull();

      // Fast-forward past refresh time
      jest.advanceTimersByTime(2000); // +2 seconds

      // Wait for async refresh to complete
      await jest.runAllTimersAsync();

      // Verify: token refreshed
      expect(await getAccessToken()).toBe('refreshed-access-token');

      // Cleanup
      cleanup();
    });

    it('should allow cleanup to cancel scheduled refresh', async () => {
      // Create token expiring in 15 minutes
      const nowSeconds = Math.floor(Date.now() / 1000);
      const expSeconds = nowSeconds + 900;
      const token = `header.payload-exp-${expSeconds}.signature`;

      // Setup: store refresh token
      await setRefreshToken('refresh-token');

      // Track if refresh was called
      const { postAuthRefresh } = require('@/src/api/generated/sdk.gen');
      let refreshCalled = false;
      postAuthRefresh.mockImplementation(() => {
        refreshCalled = true;
        return Promise.resolve({
          data: {
            accessToken: 'new-token',
            refreshToken: 'new-refresh',
            verified: true,
          },
        });
      });

      // Execute: setup and immediately cleanup
      const cleanup = setupProactiveRefresh(token);
      cleanup();

      // Fast-forward past refresh time
      jest.advanceTimersByTime(14 * 60 * 1000);
      await jest.runAllTimersAsync();

      // Verify: refresh was NOT called
      expect(refreshCalled).toBe(false);
      expect(await getAccessToken()).toBeNull();
    });
  });
});
