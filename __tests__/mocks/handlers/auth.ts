/**
 * MSW Handlers for Authentication API
 *
 * Mock handlers for all auth-related endpoints:
 * - POST /auth/signup
 * - POST /auth/login
 * - POST /auth/refresh
 * - GET /auth/session
 */

import { HttpResponse, http } from 'msw';
import type {
  GetAuthSessionResponse,
  PostAuthLoginData,
  PostAuthLoginResponse,
  PostAuthRefreshData,
  PostAuthRefreshResponse,
  PostAuthSignupData,
  PostAuthSignupResponse,
} from '../../../src/api/generated';

// API Base URL - matches the generated SDK default (localhost:4000 in development)
const API_BASE_URL = 'http://localhost:4000';

// Mock user data for testing
const mockUsers = new Map<
  string,
  {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    password: string;
    is_admin: boolean;
    preferred_language: string;
  }
>();

// Mock tokens storage (for refresh validation)
const validRefreshTokens = new Set<string>();

/**
 * POST /auth/signup
 * Creates a new user account and returns tokens
 */
export const postAuthSignupHandler = http.post(
  `${API_BASE_URL}/auth/signup`,
  async ({ request }) => {
    const body = (await request.json()) as PostAuthSignupData['body'];

    // Validate request body
    if (!body?.firstName || !body?.lastName || !body?.email || !body?.password) {
      return new HttpResponse(
        JSON.stringify({
          message: 'Missing required fields',
          errors: [
            { field: 'firstName', message: 'First name is required' },
            { field: 'lastName', message: 'Last name is required' },
            { field: 'email', message: 'Email is required' },
            { field: 'password', message: 'Password is required' },
          ],
        }),
        { status: 400 }
      );
    }

    // Check if user already exists
    if (mockUsers.has(body.email)) {
      return new HttpResponse(
        JSON.stringify({
          message: 'User already exists',
          errors: [{ field: 'email', message: 'Email already registered' }],
        }),
        { status: 400 }
      );
    }

    // Validate password requirements
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(body.password)) {
      return new HttpResponse(
        JSON.stringify({
          message: 'Password does not meet requirements',
          errors: [
            {
              field: 'password',
              message: 'Password must be at least 8 characters with 1 letter and 1 number',
            },
          ],
        }),
        { status: 400 }
      );
    }

    // Create new user
    const userId = `user-${Date.now()}`;
    mockUsers.set(body.email, {
      id: userId,
      email: body.email,
      firstName: body.firstName,
      lastName: body.lastName,
      password: body.password,
      is_admin: false,
      preferred_language: 'en',
    });

    // Generate tokens
    const accessToken = `mock-access-token-${userId}`;
    const refreshToken = `mock-refresh-token-${userId}`;
    validRefreshTokens.add(refreshToken);

    const response: PostAuthSignupResponse = {
      accessToken,
      refreshToken,
      verified: false,
    };

    return HttpResponse.json(response, { status: 201 });
  }
);

/**
 * POST /auth/login
 * Authenticates user and returns tokens
 */
export const postAuthLoginHandler = http.post(`${API_BASE_URL}/auth/login`, async ({ request }) => {
  const body = (await request.json()) as PostAuthLoginData['body'];

  // Validate request body
  if (!body?.email || !body?.password) {
    return new HttpResponse(
      JSON.stringify({
        message: 'Missing required fields',
        errors: [
          { field: 'email', message: 'Email is required' },
          { field: 'password', message: 'Password is required' },
        ],
      }),
      { status: 400 }
    );
  }

  // Check if user exists
  const user = mockUsers.get(body.email);
  if (!user || user.password !== body.password) {
    return new HttpResponse(
      JSON.stringify({
        message: 'Invalid credentials',
        errors: [{ field: 'email', message: 'Invalid email or password' }],
      }),
      { status: 401 }
    );
  }

  // Generate tokens
  const accessToken = `mock-access-token-${user.id}`;
  const refreshToken = `mock-refresh-token-${user.id}`;
  validRefreshTokens.add(refreshToken);

  const response: PostAuthLoginResponse = {
    accessToken,
    refreshToken,
    verified: true,
  };

  return HttpResponse.json(response);
});

/**
 * POST /auth/refresh
 * Refreshes access token using refresh token
 */
export const postAuthRefreshHandler = http.post(
  `${API_BASE_URL}/auth/refresh`,
  async ({ request }) => {
    const body = (await request.json()) as PostAuthRefreshData['body'];

    // Validate request body
    if (!body?.refreshToken) {
      return new HttpResponse(
        JSON.stringify({
          message: 'Missing refresh token',
        }),
        { status: 400 }
      );
    }

    // Validate refresh token
    if (!validRefreshTokens.has(body.refreshToken)) {
      return new HttpResponse(
        JSON.stringify({
          message: 'Invalid refresh token',
        }),
        { status: 401 }
      );
    }

    // Extract user ID from refresh token (mock pattern)
    const userIdMatch = body.refreshToken.match(/user-(\d+)/);
    const userId = userIdMatch ? `user-${userIdMatch[1]}` : 'user-unknown';

    // Generate new tokens
    const newAccessToken = `mock-access-token-${userId}-refreshed-${Date.now()}`;
    const newRefreshToken = `mock-refresh-token-${userId}-refreshed-${Date.now()}`;

    // Remove old refresh token and add new one
    validRefreshTokens.delete(body.refreshToken);
    validRefreshTokens.add(newRefreshToken);

    const response: PostAuthRefreshResponse = {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      verified: true,
    };

    return HttpResponse.json(response);
  }
);

/**
 * GET /auth/session
 * Returns current authenticated user's data
 */
export const getAuthSessionHandler = http.get(`${API_BASE_URL}/auth/session`, ({ request }) => {
  // Extract token from Authorization header
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new HttpResponse(
      JSON.stringify({
        message: 'Unauthorized - No token provided',
      }),
      { status: 401 }
    );
  }

  const token = authHeader.replace('Bearer ', '');

  // Extract user ID from token (mock pattern)
  const userIdMatch = token.match(/user-(\d+)/);
  if (!userIdMatch) {
    return new HttpResponse(
      JSON.stringify({
        message: 'Invalid token',
      }),
      { status: 401 }
    );
  }

  const userId = `user-${userIdMatch[1]}`;

  // Find user by ID
  const user = Array.from(mockUsers.values()).find((u) => u.id === userId);
  if (!user) {
    return new HttpResponse(
      JSON.stringify({
        message: 'User not found',
      }),
      { status: 404 }
    );
  }

  const response: GetAuthSessionResponse = {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    is_admin: user.is_admin,
    preferred_language: user.preferred_language,
  };

  return HttpResponse.json(response);
});

/**
 * Helper function to reset mock data (for tests)
 */
export const resetAuthMocks = () => {
  mockUsers.clear();
  validRefreshTokens.clear();
};

/**
 * Helper function to seed test users (for tests)
 */
export const seedTestUser = (
  email: string,
  password: string,
  firstName = 'Test',
  lastName = 'User'
) => {
  const userId = `user-${Date.now()}`;
  mockUsers.set(email, {
    id: userId,
    email,
    firstName,
    lastName,
    password,
    is_admin: false,
    preferred_language: 'en',
  });
  return userId;
};

// Export all auth handlers
export const authHandlers = [
  postAuthSignupHandler,
  postAuthLoginHandler,
  postAuthRefreshHandler,
  getAuthSessionHandler,
];
