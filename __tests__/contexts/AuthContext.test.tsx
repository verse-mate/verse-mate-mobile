/**
 * AuthContext Tests
 *
 * Focused tests for authentication context functionality.
 * Tests only critical behaviors: login, logout, session restore.
 *
 * Limit: 2-8 highly focused tests maximum
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import * as tokenRefresh from '@/lib/auth/token-refresh';
import * as tokenStorage from '@/lib/auth/token-storage';
import { getAuthSession, postAuthLogin, postAuthSignup } from '@/src/api/generated/sdk.gen';

// Mock dependencies
jest.mock('@/lib/auth/token-storage');
jest.mock('@/lib/auth/token-refresh');
jest.mock('@/src/api/generated/sdk.gen');

const mockTokenStorage = tokenStorage as jest.Mocked<typeof tokenStorage>;
const mockTokenRefresh = tokenRefresh as jest.Mocked<typeof tokenRefresh>;
const mockGetAuthSession = getAuthSession as jest.MockedFunction<typeof getAuthSession>;
const mockPostAuthLogin = postAuthLogin as jest.MockedFunction<typeof postAuthLogin>;
const mockPostAuthSignup = postAuthSignup as jest.MockedFunction<typeof postAuthSignup>;

describe('AuthContext', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    // Create a new QueryClient for each test
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    // Reset all mocks
    jest.clearAllMocks();

    // Default mock implementations
    mockTokenStorage.getAccessToken.mockResolvedValue(null);
    mockTokenStorage.getRefreshToken.mockResolvedValue(null);
    mockTokenStorage.setAccessToken.mockResolvedValue(undefined);
    mockTokenStorage.setRefreshToken.mockResolvedValue(undefined);
    mockTokenStorage.clearTokens.mockResolvedValue(undefined);
    mockTokenRefresh.setupProactiveRefresh.mockReturnValue(() => {});
  });

  const createWrapper = () => {
    const Wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    );
    return Wrapper;
  };

  // Test 1: Initial state should be unauthenticated with loading false
  it('should initialize with unauthenticated state', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  // Test 2: Login should store tokens, fetch user session, and update state
  it('should authenticate user on successful login', async () => {
    const mockTokens = {
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
      verified: true,
    };

    const mockUser = {
      id: '123',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      is_admin: false,
      preferred_language: 'en',
    };

    mockPostAuthLogin.mockResolvedValue({
      data: mockTokens,
      error: undefined,
      request: {} as Request,
      response: {} as Response,
    });

    mockGetAuthSession.mockResolvedValue({
      data: mockUser,
      error: undefined,
      request: {} as Request,
      response: {} as Response,
    });

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Perform login
    await result.current.login('test@example.com', 'password123');

    // Verify tokens were stored
    expect(mockTokenStorage.setAccessToken).toHaveBeenCalledWith('mock-access-token');
    expect(mockTokenStorage.setRefreshToken).toHaveBeenCalledWith('mock-refresh-token');

    // Verify proactive refresh was setup
    expect(mockTokenRefresh.setupProactiveRefresh).toHaveBeenCalledWith('mock-access-token');

    // Verify state was updated
    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user).toEqual(mockUser);
    });
  });

  // Test 3: Signup should store tokens, fetch user session, and update state
  it('should authenticate user on successful signup', async () => {
    const mockTokens = {
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
      verified: false,
    };

    const mockUser = {
      id: '456',
      email: 'newuser@example.com',
      firstName: 'New',
      lastName: 'User',
      is_admin: false,
      preferred_language: 'en',
    };

    mockPostAuthSignup.mockResolvedValue({
      data: mockTokens,
      error: undefined,
      request: {} as Request,
      response: {} as Response,
    });

    mockGetAuthSession.mockResolvedValue({
      data: mockUser,
      error: undefined,
      request: {} as Request,
      response: {} as Response,
    });

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Perform signup
    await result.current.signup('New', 'User', 'newuser@example.com', 'password123');

    // Verify tokens were stored
    expect(mockTokenStorage.setAccessToken).toHaveBeenCalledWith('mock-access-token');
    expect(mockTokenStorage.setRefreshToken).toHaveBeenCalledWith('mock-refresh-token');

    // Verify proactive refresh was setup
    expect(mockTokenRefresh.setupProactiveRefresh).toHaveBeenCalledWith('mock-access-token');

    // Verify state was updated
    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user).toEqual(mockUser);
    });
  });

  // Test 4: Logout should clear tokens and reset state
  it('should clear auth state on logout', async () => {
    const mockTokens = {
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
      verified: true,
    };

    const mockUser = {
      id: '123',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      is_admin: false,
      preferred_language: 'en',
    };

    mockPostAuthLogin.mockResolvedValue({
      data: mockTokens,
      error: undefined,
      request: {} as Request,
      response: {} as Response,
    });

    mockGetAuthSession.mockResolvedValue({
      data: mockUser,
      error: undefined,
      request: {} as Request,
      response: {} as Response,
    });

    const mockCleanup = jest.fn();
    mockTokenRefresh.setupProactiveRefresh.mockReturnValue(mockCleanup);

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

    // Login first
    await result.current.login('test@example.com', 'password123');

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });

    // Logout
    await result.current.logout();

    // Verify cleanup was called
    expect(mockCleanup).toHaveBeenCalled();

    // Verify tokens were cleared
    expect(mockTokenStorage.clearTokens).toHaveBeenCalled();

    // Verify state was reset
    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
    });
  });

  // Test 5: Session restore should fetch user when tokens exist
  it('should restore session when tokens exist', async () => {
    const mockUser = {
      id: '789',
      email: 'existing@example.com',
      firstName: 'Existing',
      lastName: 'User',
      is_admin: false,
      preferred_language: 'en',
    };

    // Mock existing tokens
    mockTokenStorage.getAccessToken.mockResolvedValue('existing-access-token');
    mockTokenStorage.getRefreshToken.mockResolvedValue('existing-refresh-token');

    mockGetAuthSession.mockResolvedValue({
      data: mockUser,
      error: undefined,
      request: {} as Request,
      response: {} as Response,
    });

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

    // Wait for session restoration
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Verify proactive refresh was setup
    expect(mockTokenRefresh.setupProactiveRefresh).toHaveBeenCalledWith('existing-access-token');

    // Verify state was restored
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual(mockUser);
  });

  // Test 6: Session restore should handle missing tokens gracefully
  it('should remain unauthenticated when no tokens exist', async () => {
    mockTokenStorage.getAccessToken.mockResolvedValue(null);
    mockTokenStorage.getRefreshToken.mockResolvedValue(null);

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(mockGetAuthSession).not.toHaveBeenCalled();
  });

  // Test 7: Login failure should not update auth state
  it('should handle login failure without updating state', async () => {
    mockPostAuthLogin.mockResolvedValue({
      data: undefined,
      error: {
        error: 'Invalid credentials',
        message: 'Invalid credentials',
        data: null,
      },
      request: {} as Request,
      response: {} as Response,
    });

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Attempt login
    await expect(result.current.login('test@example.com', 'wrongpassword')).rejects.toThrow();

    // Verify state remains unauthenticated
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(mockTokenStorage.setAccessToken).not.toHaveBeenCalled();
    expect(mockTokenStorage.setRefreshToken).not.toHaveBeenCalled();
  });

  // Test 8: useAuth hook should throw error when used outside AuthProvider
  it('should throw error when useAuth is used outside AuthProvider', () => {
    // Suppress console.error for this test
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      renderHook(() => useAuth());
    }).toThrow('useAuth must be used within an AuthProvider');

    consoleSpy.mockRestore();
  });
});
