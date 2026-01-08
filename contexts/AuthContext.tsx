/**
 * Authentication Context
 *
 * Provides authentication state and methods throughout the app.
 * Handles login, signup, SSO login, logout, and session persistence.
 *
 * @see Task Group 4: Authentication Context and Hooks
 * @see Task Group 5: SSO Integration
 * @see Time-Based Analytics Spec - Phase 1: last_login_at user property
 */

import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
} from '@/lib/auth/token-storage';
import { setupProactiveRefresh } from '@/lib/auth/token-refresh';
import { analytics, AnalyticsEvent } from '@/lib/analytics';
import {
  getAuthSession,
  postAuthLogin,
  postAuthRefresh,
  postAuthSignup,
} from '@/src/api/generated/sdk.gen';
import type { GetAuthSessionResponse } from '@/src/api/generated/types.gen';
import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import { usePostHog } from 'posthog-react-native';

/**
 * User type from GetAuthSession response
 * Extended with SSO and profile picture fields
 */
export type User = GetAuthSessionResponse & {
  /**
   * Indicates if user has password auth (vs SSO-only)
   * @see sso-account-deletion-migration.md
   */
  hasPassword?: boolean;
  /**
   * Profile picture URL from SSO provider or uploaded
   * Backend returns as 'profile_picture_url' but mapped to 'imageSrc' for frontend consistency
   * @see profile-pictures-sso.md
   */
  imageSrc?: string;
  /**
   * Raw profile_picture_url from backend (in case both naming conventions exist)
   */
  profile_picture_url?: string;
};

/**
 * SSO Provider types
 */
export type SSOProvider = 'google' | 'apple';

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
   * Login with SSO provider (Google or Apple)
   * @param provider - SSO provider ('google' or 'apple')
   * @param idToken - ID token from the SSO provider
   * @throws Error if SSO login fails
   */
  loginWithSSO(provider: SSOProvider, idToken: string): Promise<void>;

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

  /**
   * Force a token refresh
   * Useful when user claims (like language) change
   */
  refreshTokens(): Promise<void>;
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
 * SSO API Response type
 */
interface SSOAuthResponse {
  accessToken: string;
  refreshToken?: string;
  verified?: boolean;
  isNewUser?: boolean;
}

/**
 * SSO API Error response type
 */
interface SSOErrorResponse {
  message?: string;
  code?: string;
  provider?: string;
}

/**
 * Call SSO authentication endpoint
 * Since the endpoint may not be in the generated SDK yet, we call it directly
 */
async function postAuthSso(body: {
  provider: SSOProvider;
  token: string;
  platform: 'mobile';
}): Promise<{ data?: SSOAuthResponse; error?: SSOErrorResponse }> {
  const baseUrl = process.env.EXPO_PUBLIC_API_URL || 'https://api.versemate.org';

  try {
    const response = await fetch(`${baseUrl}/auth/sso`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return { error: data as SSOErrorResponse };
    }

    return { data: data as SSOAuthResponse };
  } catch (err) {
    return {
      error: {
        message: err instanceof Error ? err.message : 'Network error',
      },
    };
  }
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

  // Get PostHog instance for analytics
  const posthog = usePostHog();

  /**
   * Fetch user session from backend
   * @throws Error if session fetch fails
   */
  const fetchUserSession = async (): Promise<User> => {
    const { data, error } = await getAuthSession();

    if (error || !data) {
      throw new Error('Failed to fetch user session');
    }

    return data as User;
  };

  /**
   * Login method implementation
   * Sets last_login_at timestamp for time-based analytics tracking
   */
  const login = async (email: string, password: string): Promise<void> => {
    const { data, error } = await postAuthLogin({
      body: { email, password },
    });

    if (error || !data) {
      // Check for SSO-only account error
      const errorMessage = error?.message || 'Login failed';
      console.error('Login failed:', errorMessage);
      throw new Error(errorMessage);
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

    // Identify user in PostHog
    posthog?.identify(userSession.id, {
      email: userSession.email,
      firstName: userSession.firstName,
      lastName: userSession.lastName,
    });

    // Track analytics: identify with account_type, last_login_at, and fire LOGIN_COMPLETED event
    // last_login_at is set here (new login) but NOT on restoreSession() (Time-Based Analytics Phase 1)
    analytics.identify(userSession.id, {
      email: userSession.email,
      firstName: userSession.firstName,
      lastName: userSession.lastName,
      account_type: 'email',
      is_registered: true,
      last_login_at: new Date().toISOString(),
    });
    analytics.track(AnalyticsEvent.LOGIN_COMPLETED, { method: 'email' });
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

    // Identify user in PostHog
    posthog?.identify(userSession.id, {
      email: userSession.email,
      firstName: userSession.firstName,
      lastName: userSession.lastName,
    });

    // Track analytics: identify with account_type and fire SIGNUP_COMPLETED event
    analytics.identify(userSession.id, {
      email: userSession.email,
      firstName: userSession.firstName,
      lastName: userSession.lastName,
      account_type: 'email',
      is_registered: true,
    });
    analytics.track(AnalyticsEvent.SIGNUP_COMPLETED, { method: 'email' });
  };

  /**
   * SSO Login method implementation
   * Sets last_login_at timestamp for time-based analytics tracking
   */
  const loginWithSSO = async (
    provider: SSOProvider,
    idToken: string,
  ): Promise<void> => {
    const { data, error } = await postAuthSso({
      provider,
      token: idToken,
      platform: 'mobile',
    });

    if (error || !data) {
      // Handle SSO-specific error codes
      if (error?.code === 'SSO_ACCOUNT_NO_PASSWORD') {
        const providerName = provider === 'google' ? 'Google' : 'Apple';
        throw new Error(
          `This account uses ${providerName} Sign-In. Please use that method to log in.`,
        );
      }

      console.error('SSO login failed:', error?.message || error);
      throw new Error(error?.message || 'SSO login failed');
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

    // Identify user in PostHog with SSO provider info
    posthog?.identify(userSession.id, {
      email: userSession.email,
      firstName: userSession.firstName,
      lastName: userSession.lastName,
      ssoProvider: provider,
    });

    // Track analytics: identify with account_type, last_login_at, and fire appropriate event
    // last_login_at is set here (new login) but NOT on restoreSession() (Time-Based Analytics Phase 1)
    analytics.identify(userSession.id, {
      email: userSession.email,
      firstName: userSession.firstName,
      lastName: userSession.lastName,
      account_type: provider,
      is_registered: true,
      last_login_at: new Date().toISOString(),
    });

    // For SSO, we track LOGIN_COMPLETED. If backend indicates new user, also track SIGNUP_COMPLETED
    if (data.isNewUser) {
      analytics.track(AnalyticsEvent.SIGNUP_COMPLETED, { method: provider });
    }
    analytics.track(AnalyticsEvent.LOGIN_COMPLETED, { method: provider });
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

    // Track analytics: fire LOGOUT event before resetting identity
    analytics.track(AnalyticsEvent.LOGOUT, {});

    // Clear tokens from storage
    await clearTokens();

    // Reset PostHog identity
    posthog?.reset();

    // Reset state
    setUser(null);
  };

  /**
   * Restore session method implementation
   * Note: Does NOT set last_login_at as session restore is not a new login
   * (Time-Based Analytics Phase 1)
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

      // Identify user in PostHog after session restore
      posthog?.identify(userSession.id, {
        email: userSession.email,
        firstName: userSession.firstName,
        lastName: userSession.lastName,
      });

      // Track analytics: identify user on session restore (no LOGIN event - just restoring existing session)
      // Note: last_login_at is intentionally NOT set here (Time-Based Analytics Phase 1)
      // Session restore is not a login - last_login_at should only be updated on actual login
      analytics.identify(userSession.id, {
        email: userSession.email,
        firstName: userSession.firstName,
        lastName: userSession.lastName,
        is_registered: true,
      });
    } catch (error) {
      console.error('Failed to restore session:', error);
      // Clear tokens on error
      await clearTokens();
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Refresh tokens manually
   */
  const refreshTokens = async (): Promise<void> => {
    try {
      const refreshToken = await getRefreshToken();
      if (!refreshToken) return;

      const { data, error } = await postAuthRefresh({
        body: { refreshToken },
      });

      if (error || !data) {
        throw new Error('Failed to refresh tokens');
      }

      await setAccessToken(data.accessToken);
      if (data.refreshToken) {
        await setRefreshToken(data.refreshToken);
      }

      // Fetch and update user session
      const userSession = await fetchUserSession();
      setUser(userSession);
    } catch (error) {
      console.error('Failed to refresh tokens manually:', error);
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
    loginWithSSO,
    logout,
    restoreSession,
    refreshTokens,
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
