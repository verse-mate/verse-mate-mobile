/**
 * Apple Sign-In Hook
 *
 * Provides Apple authentication functionality for the VerseMate app.
 * Only available on iOS devices with Apple ID configured.
 *
 * @see Task Group 3: Apple Sign-In Hook Implementation
 */

import * as AppleAuthentication from 'expo-apple-authentication';
import Constants from 'expo-constants';
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';

/**
 * Apple Sign-In hook return type
 */
export interface UseAppleSignInReturn {
  /** Trigger Apple Sign-In flow */
  signIn: () => Promise<string | null>;
  /** Whether sign-in is currently in progress */
  isLoading: boolean;
  /** Error message if sign-in failed */
  error: string | null;
  /** Reset error state */
  reset: () => void;
  /** Whether Apple Sign-In is available on this device */
  isAvailable: boolean;
}

/**
 * Check if Apple Sign-In is enabled via environment variable
 * Requires explicit opt-in via EXPO_PUBLIC_APPLE_SSO_ENABLED=true
 */
export function isAppleSignInEnabled(): boolean {
  // Apple Sign-In is iOS only
  if (Platform.OS !== 'ios') {
    return false;
  }

  // Require explicit opt-in via env var
  const enabledEnvVar =
    Constants.expoConfig?.extra?.EXPO_PUBLIC_APPLE_SSO_ENABLED ||
    process.env.EXPO_PUBLIC_APPLE_SSO_ENABLED;

  // Only enable if explicitly set to 'true'
  return enabledEnvVar === 'true';
}

/**
 * Custom hook for Apple Sign-In authentication
 *
 * @returns Object with signIn function, loading state, error state, and availability
 *
 * @example
 * ```tsx
 * const { signIn, isLoading, error, reset, isAvailable } = useAppleSignIn();
 *
 * const handleAppleSignIn = async () => {
 *   if (!isAvailable) return;
 *
 *   const identityToken = await signIn();
 *   if (identityToken) {
 *     // Send identityToken to backend for verification
 *     await loginWithSSO('apple', identityToken);
 *   }
 * };
 * ```
 */
export function useAppleSignIn(): UseAppleSignInReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAvailable, setIsAvailable] = useState(false);

  // Check availability on mount
  useEffect(() => {
    const checkAvailability = async () => {
      // Check if enabled via env var
      if (!isAppleSignInEnabled()) {
        setIsAvailable(false);
        return;
      }

      // Check if Apple Authentication is available on this device
      try {
        const available = await AppleAuthentication.isAvailableAsync();
        setIsAvailable(available);
      } catch {
        setIsAvailable(false);
      }
    };

    checkAvailability();
  }, []);

  /**
   * Reset error state
   */
  const reset = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Trigger Apple Sign-In flow
   *
   * @returns Identity token on success, null on failure or cancellation
   */
  const signIn = useCallback(async (): Promise<string | null> => {
    if (!isAvailable) {
      setError('Apple Sign-In is not available');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Request Apple authentication with email and full name scopes
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      // Extract identity token
      const identityToken = credential.identityToken;
      if (!identityToken) {
        setError('Failed to get identity token from Apple');
        return null;
      }

      return identityToken;
    } catch (err: unknown) {
      // Handle Apple authentication errors
      // Prefer structured error codes when available, fall back to message matching
      const e = err as { code?: string; message?: string };

      if (e?.code) {
        // Check structured error codes first
        if (e.code === 'ERR_REQUEST_CANCELED') {
          // User cancelled - not an error state
          return null;
        }
        if (e.code === 'ERR_INVALID_RESPONSE') {
          setError('Invalid response from Apple Sign-In');
          return null;
        }
        if (e.code === 'ERR_REQUEST_NOT_HANDLED') {
          setError('Apple Sign-In is not available on this device');
          return null;
        }
      } else if (e?.message) {
        // Fall back to message matching for compatibility
        if (e.message.includes('ERR_REQUEST_CANCELED') || e.message.includes('1001')) {
          // User cancelled - not an error state
          return null;
        }
        if (e.message.includes('ERR_INVALID_RESPONSE')) {
          setError('Invalid response from Apple Sign-In');
          return null;
        }
        if (e.message.includes('ERR_REQUEST_NOT_HANDLED')) {
          setError('Apple Sign-In is not available on this device');
          return null;
        }
      }

      setError(e?.message || 'Unknown error occurred during Apple Sign-In');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [isAvailable]);

  return {
    signIn,
    isLoading,
    error,
    reset,
    isAvailable,
  };
}
