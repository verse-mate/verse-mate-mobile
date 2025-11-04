/**
 * Authentication Context
 *
 * Provides authentication state and methods throughout the app.
 * Handles login, signup, logout, and session persistence.
 *
 * @see Task Group 4: Authentication Context and Hooks
 */

import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
} from '@/lib/auth/token-storage';
import { setupProactiveRefresh } from '@/lib/auth/token-refresh';
import {
  getAuthSession,
  postAuthLogin,
  postAuthSignup,
} from '@/src/api/generated/sdk.gen';
import type { GetAuthSessionResponse } from '@/src/api/generated/types.gen';
import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useState } from 'react';

/**
 * User type from GetAuthSession response
 */
export type User = GetAuthSessionResponse;

/**
 * Authentication state interface
 */
export interface AuthState {
  /** Current authenticated user or null if not authenticated */
  user: User | null;
  /** Whether the user is currently authenticated */
  isAuthenticated: boolean;
  /** Whether the auth state is currently being loaded (initial restore) */
  isLoading: boolean;
}

/**
 * Authentication methods interface
 */
export interface AuthMethods {
  /**
   * Login with email and password
   * @param email - User email
   * @param password - User password
   * @throws Error if login fails
   */
  login(email: string, password: string): Promise<void>;

  /**
   * Sign up a new user
   * @param firstName - User's first name
   * @param lastName - User's last name
   * @param email - User email
   * @param password - User password
   * @throws Error if signup fails
   */
  signup(
    firstName: string,
    lastName: string,
    email: string,
    password: string,
  ): Promise<void>;

  /**
   * Logout the current user
   * Clears tokens and resets auth state
   */
  logout(): Promise<void>;

  /**
   * Restore session from stored tokens
   * Called automatically on app launch
   */
  restoreSession(): Promise<void>;
}

/**
 * Combined auth context value
 */
export type AuthContextValue = AuthState & AuthMethods;

// Create context with undefined default (will throw error if used outside provider)
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * AuthProvider Props
 */
interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Authentication Provider Component
 *
 * Manages authentication state and provides auth methods to the entire app.
 * Automatically restores session on mount if tokens exist.
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [proactiveRefreshCleanup, setProactiveRefreshCleanup] = useState<
    (() => void) | null
  >(null);

  /**
   * Fetch user session from backend
   * @throws Error if session fetch fails
   */
  const fetchUserSession = async (): Promise<User> => {
    const { data, error } = await getAuthSession();

    if (error || !data) {
      throw new Error('Failed to fetch user session');
    }

    return data;
  };

  /**
   * Login method implementation
   */
  const login = async (email: string, password: string): Promise<void> => {
    const { data, error } = await postAuthLogin({
      body: { email, password },
    });

    if (error || !data) {
      console.error('Login failed:', error?.message || error);
      throw new Error(error?.message || 'Login failed');
    }

    // Store tokens
    await setAccessToken(data.accessToken);
    if (data.refreshToken) {
      await setRefreshToken(data.refreshToken);
    }

    // Setup proactive refresh
    const cleanup = setupProactiveRefresh(data.accessToken);
    setProactiveRefreshCleanup(() => cleanup);

    // Fetch and update user session
    const userSession = await fetchUserSession();
    setUser(userSession);
  };

  /**
   * Signup method implementation
   */
  const signup = async (
    firstName: string,
    lastName: string,
    email: string,
    password: string,
  ): Promise<void> => {
    const { data, error } = await postAuthSignup({
      body: { firstName, lastName, email, password },
    });

    if (error || !data) {
      console.error('Signup failed:', error?.message || error);
      throw new Error(error?.message || 'Signup failed');
    }

    // Store tokens
    await setAccessToken(data.accessToken);
    if (data.refreshToken) {
      await setRefreshToken(data.refreshToken);
    }

    // Setup proactive refresh
    const cleanup = setupProactiveRefresh(data.accessToken);
    setProactiveRefreshCleanup(() => cleanup);

    // Fetch and update user session
    const userSession = await fetchUserSession();
    setUser(userSession);
  };

  /**
   * Logout method implementation
   */
  const logout = async (): Promise<void> => {
    // Cancel proactive refresh timer
    if (proactiveRefreshCleanup) {
      proactiveRefreshCleanup();
      setProactiveRefreshCleanup(null);
    }

    // Clear tokens from storage
    await clearTokens();

    // Reset state
    setUser(null);
  };

  /**
   * Restore session method implementation
   */
  const restoreSession = async (): Promise<void> => {
    try {
      setIsLoading(true);

      // Check for existing tokens
      const accessToken = await getAccessToken();
      const refreshToken = await getRefreshToken();

      if (!accessToken || !refreshToken) {
        // No tokens found - remain unauthenticated
        return;
      }

      // Fetch user session
      const userSession = await fetchUserSession();

      // Setup proactive refresh
      const cleanup = setupProactiveRefresh(accessToken);
      setProactiveRefreshCleanup(() => cleanup);

      // Update state
      setUser(userSession);
    } catch (error) {
      console.error('Failed to restore session:', error);
      // Clear tokens on error
      await clearTokens();
    } finally {
      setIsLoading(false);
    }
  };

  // Restore session on mount
  useEffect(() => {
    restoreSession();
  }, []);

  const value: AuthContextValue = {
    user,
    isAuthenticated: user !== null,
    isLoading,
    login,
    signup,
    logout,
    restoreSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook to access auth context
 *
 * @throws Error if used outside AuthProvider
 * @returns Auth context value with state and methods
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}
