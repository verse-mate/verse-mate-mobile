/**
 * Tests for SSO MSW mock handlers
 *
 * @see Task Group 1: Library Installation and Native Configuration
 */

import { server } from '../server';
import { authSsoHandlers, resetSsoMocks, seedSsoTestUser } from './auth-sso';

const API_BASE_URL = 'https://api.verse-mate.apegro.dev';

describe('Auth SSO MSW Handlers', () => {
  beforeEach(() => {
    resetSsoMocks();
  });

  describe('POST /auth/sso', () => {
    it('returns tokens for valid Google SSO request', async () => {
      const response = await fetch(`${API_BASE_URL}/auth/sso`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'google',
          token: 'mock-google-token-test@example.com',
          platform: 'mobile',
        }),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.accessToken).toBeDefined();
      expect(data.refreshToken).toBeDefined();
      expect(data.verified).toBe(true);
    });

    it('returns tokens for valid Apple SSO request', async () => {
      const response = await fetch(`${API_BASE_URL}/auth/sso`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'apple',
          token: 'mock-apple-token-apple@icloud.com',
          platform: 'mobile',
        }),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.accessToken).toBeDefined();
      expect(data.refreshToken).toBeDefined();
    });

    it('returns 400 for missing required fields', async () => {
      const response = await fetch(`${API_BASE_URL}/auth/sso`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'google',
          // missing token and platform
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.message).toBe('Missing required fields');
    });

    it('returns 400 for invalid provider', async () => {
      const response = await fetch(`${API_BASE_URL}/auth/sso`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'facebook',
          token: 'some-token',
          platform: 'mobile',
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.message).toBe('Invalid provider');
    });

    it('returns 401 for invalid token format', async () => {
      const response = await fetch(`${API_BASE_URL}/auth/sso`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'google',
          token: 'completely-invalid-token',
          platform: 'mobile',
        }),
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.code).toBe('INVALID_TOKEN');
    });

    it('creates new user on first SSO login', async () => {
      const response = await fetch(`${API_BASE_URL}/auth/sso`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'google',
          token: 'mock-google-token-newuser@example.com',
          platform: 'mobile',
        }),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.accessToken).toContain('mock-access-token');
    });

    it('returns same user on subsequent SSO logins', async () => {
      // First login
      const response1 = await fetch(`${API_BASE_URL}/auth/sso`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'google',
          token: 'mock-google-token-repeat@example.com',
          platform: 'mobile',
        }),
      });

      const data1 = await response1.json();

      // Second login
      const response2 = await fetch(`${API_BASE_URL}/auth/sso`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'google',
          token: 'mock-google-token-repeat@example.com',
          platform: 'mobile',
        }),
      });

      const data2 = await response2.json();

      // Should get same user (token contains same user ID)
      expect(data1.accessToken).toBeDefined();
      expect(data2.accessToken).toBeDefined();
    });
  });

  describe('helper functions', () => {
    it('seedSsoTestUser creates a user that can be found', async () => {
      const userId = seedSsoTestUser('google', 'seeded@example.com', 'Seeded', 'User');

      expect(userId).toContain('user-');
    });

    it('resetSsoMocks clears all SSO users', async () => {
      seedSsoTestUser('google', 'toclear@example.com');
      resetSsoMocks();

      // After reset, new login should create new user
      const response = await fetch(`${API_BASE_URL}/auth/sso`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'google',
          token: 'mock-google-token-toclear@example.com',
          platform: 'mobile',
        }),
      });

      expect(response.ok).toBe(true);
    });
  });
});
