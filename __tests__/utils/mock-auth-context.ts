/**
 * Mock Auth Context Helpers
 *
 * Provides consistent mock values for AuthContext across all tests.
 * Centralizes the mock structure to avoid breaking tests when AuthContext changes.
 */

import type { AuthContextValue, User } from '@/contexts/AuthContext';

/**
 * Default mock user for authenticated tests
 */
export const mockUser: User = {
  id: 'test-user-123',
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  is_admin: false,
  preferred_language: 'en',
};

/**
 * Creates a mock AuthContextValue for authenticated state
 */
export function createAuthenticatedMock(
  overrides?: Partial<AuthContextValue>,
  userOverrides?: Partial<User>
): AuthContextValue {
  return {
    user: userOverrides ? { ...mockUser, ...userOverrides } : mockUser,
    isAuthenticated: true,
    isLoading: false,
    login: jest.fn(),
    signup: jest.fn(),
    loginWithSSO: jest.fn(),
    logout: jest.fn(),
    restoreSession: jest.fn(),
    refreshTokens: jest.fn(),
    ...overrides,
  };
}

/**
 * Creates a mock AuthContextValue for unauthenticated state
 */
export function createUnauthenticatedMock(overrides?: Partial<AuthContextValue>): AuthContextValue {
  return {
    user: null,
    isAuthenticated: false,
    isLoading: false,
    login: jest.fn(),
    signup: jest.fn(),
    loginWithSSO: jest.fn(),
    logout: jest.fn(),
    restoreSession: jest.fn(),
    refreshTokens: jest.fn(),
    ...overrides,
  };
}

/**
 * Creates a mock AuthContextValue for loading state
 */
export function createLoadingMock(overrides?: Partial<AuthContextValue>): AuthContextValue {
  return {
    user: null,
    isAuthenticated: false,
    isLoading: true,
    login: jest.fn(),
    signup: jest.fn(),
    loginWithSSO: jest.fn(),
    logout: jest.fn(),
    restoreSession: jest.fn(),
    refreshTokens: jest.fn(),
    ...overrides,
  };
}
