/**
 * MSW Handlers for SSO Authentication API
 *
 * Mock handlers for SSO-related endpoints:
 * - POST /auth/sso
 */

import { HttpResponse, http } from 'msw';

// API Base URL - matches the generated SDK default
const API_BASE_URL = 'https://api.verse-mate.apegro.dev';

// SSO Provider types
export type SSOProvider = 'google' | 'apple';

// SSO Request body type
export interface PostAuthSsoBody {
  provider: SSOProvider;
  token: string;
  platform: 'web' | 'mobile';
}

// SSO Response type (same as AuthPayload)
export interface PostAuthSsoResponse {
  accessToken: string;
  refreshToken?: string;
  verified?: boolean;
}

// Mock SSO users storage - maps provider+email to user data
const ssoUsers = new Map<
  string,
  {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    provider: SSOProvider;
    is_admin: boolean;
    preferred_language: string;
  }
>();

// Mock valid refresh tokens storage
const validRefreshTokens = new Set<string>();

/**
 * Decode a mock ID token to get user info
 * In tests, we use the format: mock-{provider}-token-{email}
 * or a JSON-encoded token with user info
 */
function decodeMockToken(
  token: string,
  provider: SSOProvider
): { email: string; firstName?: string; lastName?: string } | null {
  // Format 1: mock-{provider}-token-{email}
  const simpleMatch = token.match(/^mock-(google|apple)-token-(.+)$/);
  if (simpleMatch) {
    const email = simpleMatch[2];
    return { email };
  }

  // Format 2: JSON encoded { email, firstName, lastName }
  try {
    const decoded = JSON.parse(atob(token));
    if (decoded.email) {
      return decoded;
    }
  } catch {
    // Not a JSON token
  }

  // Invalid token format
  return null;
}

/**
 * POST /auth/sso
 * Authenticates user via SSO provider (Google or Apple)
 */
export const postAuthSsoHandler = http.post(`${API_BASE_URL}/auth/sso`, async ({ request }) => {
  const body = (await request.json()) as PostAuthSsoBody;

  // Validate request body
  if (!body?.provider || !body?.token || !body?.platform) {
    return new HttpResponse(
      JSON.stringify({
        message: 'Missing required fields',
        errors: [
          { field: 'provider', message: 'Provider is required' },
          { field: 'token', message: 'Token is required' },
          { field: 'platform', message: 'Platform is required' },
        ],
      }),
      { status: 400 }
    );
  }

  // Validate provider
  if (body.provider !== 'google' && body.provider !== 'apple') {
    return new HttpResponse(
      JSON.stringify({
        message: 'Invalid provider',
        errors: [{ field: 'provider', message: 'Provider must be google or apple' }],
      }),
      { status: 400 }
    );
  }

  // Decode the mock token
  const tokenData = decodeMockToken(body.token, body.provider);
  if (!tokenData) {
    return new HttpResponse(
      JSON.stringify({
        message: 'Invalid token',
        code: 'INVALID_TOKEN',
      }),
      { status: 401 }
    );
  }

  // Check if user exists (by provider + email)
  const userKey = `${body.provider}:${tokenData.email}`;
  let user = ssoUsers.get(userKey);

  if (!user) {
    // Create new user for SSO
    const userId = `user-${Date.now()}`;
    user = {
      id: userId,
      email: tokenData.email,
      firstName: tokenData.firstName || 'SSO',
      lastName: tokenData.lastName || 'User',
      provider: body.provider,
      is_admin: false,
      preferred_language: 'en',
    };
    ssoUsers.set(userKey, user);
  }

  // Generate tokens
  const accessToken = `mock-access-token-${user.id}`;
  const refreshToken = `mock-refresh-token-${user.id}`;
  validRefreshTokens.add(refreshToken);

  const response: PostAuthSsoResponse = {
    accessToken,
    refreshToken,
    verified: true,
  };

  return HttpResponse.json(response);
});

/**
 * Error handler for SSO - tests error scenarios
 */
export const postAuthSsoErrorHandler = http.post(
  `${API_BASE_URL}/auth/sso`,
  async ({ request }) => {
    const body = (await request.json()) as PostAuthSsoBody;

    // Handle specific test error scenarios based on token content
    if (body.token === 'invalid-token') {
      return new HttpResponse(
        JSON.stringify({
          message: 'Token verification failed',
          code: 'TOKEN_VERIFICATION_FAILED',
        }),
        { status: 401 }
      );
    }

    if (body.token === 'sso-only-account') {
      return new HttpResponse(
        JSON.stringify({
          message: 'This account uses SSO. Please sign in with your SSO provider.',
          code: 'SSO_ACCOUNT_NO_PASSWORD',
          provider: body.provider,
        }),
        { status: 400 }
      );
    }

    // Default success
    return HttpResponse.json({
      accessToken: 'mock-access-token-sso',
      refreshToken: 'mock-refresh-token-sso',
      verified: true,
    });
  }
);

/**
 * Helper function to reset mock data (for tests)
 */
export const resetSsoMocks = () => {
  ssoUsers.clear();
  validRefreshTokens.clear();
};

/**
 * Helper function to seed SSO test user
 */
export const seedSsoTestUser = (
  provider: SSOProvider,
  email: string,
  firstName = 'SSO',
  lastName = 'User'
) => {
  const userId = `user-${Date.now()}`;
  const userKey = `${provider}:${email}`;
  ssoUsers.set(userKey, {
    id: userId,
    email,
    firstName,
    lastName,
    provider,
    is_admin: false,
    preferred_language: 'en',
  });
  return userId;
};

/**
 * Helper to get user by email (for session handler integration)
 */
export const getSsoUserByEmail = (email: string) => {
  for (const [key, user] of ssoUsers) {
    if (user.email === email) {
      return user;
    }
  }
  return null;
};

// Export all SSO auth handlers
export const authSsoHandlers = [postAuthSsoHandler];
