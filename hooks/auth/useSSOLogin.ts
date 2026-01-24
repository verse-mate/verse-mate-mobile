/**
 * SSO Login Hook
 *
 * Composition hook that combines Google and Apple Sign-In hooks
 * with AuthContext for complete SSO authentication flow.
 *
 * @see Task Group 5: Login/Signup Screen Integration
 */

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAppleSignIn } from './useAppleSignIn';
import { useGoogleSignIn } from './useGoogleSignIn';

/**
 * SSO Login hook return type
 */
export interface UseSSOLoginReturn {
  /** Sign in with Google and authenticate with backend */
  signInWithGoogle: () => Promise<void>;
  /** Sign in with Apple and authenticate with backend */
  signInWithApple: () => Promise<void>;
  /** Whether Google sign-in is in progress */
  isGoogleLoading: boolean;
  /** Whether Apple sign-in is in progress */
  isAppleLoading: boolean;
  /** Combined error from SSO flow */
  error: string | null;
  /** Reset error state */
  resetError: () => void;
  /** Whether Google Sign-In is available */
  isGoogleAvailable: boolean;
  /** Whether Apple Sign-In is available */
  isAppleAvailable: boolean;
  /** Whether SSO login was successful */
  isSuccess: boolean;
  /** Reset success state */
  resetSuccess: () => void;
}

/**
 * Custom hook for complete SSO login flow
 *
 * Handles:
 * 1. Native SDK authentication (Google or Apple)
 * 2. Sending ID token to backend
 * 3. Storing tokens and updating auth state
 *
 * @returns Object with sign-in functions, loading states, and error handling
 *
 * @example
 * ```tsx
 * const {
 *   signInWithGoogle,
 *   signInWithApple,
 *   isGoogleLoading,
 *   isAppleLoading,
 *   error,
 *   resetError,
 *   isSuccess,
 *   resetSuccess,
 * } = useSSOLogin();
 *
 * // Use with SSOButtons component
 * <SSOButtons
 *   onGooglePress={signInWithGoogle}
 *   onApplePress={signInWithApple}
 *   isGoogleLoading={isGoogleLoading}
 *   isAppleLoading={isAppleLoading}
 *   error={error}
 * />
 * ```
 */
export function useSSOLogin(): UseSSOLoginReturn {
  const { loginWithSSO } = useAuth();
  const googleSignIn = useGoogleSignIn();
  const appleSignIn = useAppleSignIn();

  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isAppleLoading, setIsAppleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // Track mounted state to prevent state updates after unmount
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  /**
   * Reset error state
   */
  const resetError = () => {
    setError(null);
    googleSignIn.reset();
    appleSignIn.reset();
  };

  /**
   * Reset success state
   */
  const resetSuccess = () => {
    setIsSuccess(false);
  };

  /**
   * Sign in with Google
   */
  const signInWithGoogle = async () => {
    setError(null);
    setIsSuccess(false);
    setIsGoogleLoading(true);

    try {
      // Get ID token from Google
      const idToken = await googleSignIn.signIn();

      // If no token (user cancelled), just return
      if (!idToken) {
        // Check if there was an error from the hook
        if (googleSignIn.error && isMountedRef.current) {
          setError(googleSignIn.error);
        }
        return;
      }

      // Authenticate with backend
      await loginWithSSO('google', idToken);

      // Only update state if still mounted
      if (isMountedRef.current) {
        setIsSuccess(true);
      }
    } catch (err) {
      // Handle backend errors (only if still mounted)
      if (isMountedRef.current) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to complete Google Sign-In';
        setError(errorMessage);
      }
    } finally {
      // Only update loading state if still mounted
      if (isMountedRef.current) {
        setIsGoogleLoading(false);
      }
    }
  };

  /**
   * Sign in with Apple
   */
  const signInWithApple = async () => {
    setError(null);
    setIsSuccess(false);
    setIsAppleLoading(true);

    try {
      // Get identity token from Apple
      const identityToken = await appleSignIn.signIn();

      // If no token (user cancelled), just return
      if (!identityToken) {
        // Check if there was an error from the hook
        if (appleSignIn.error && isMountedRef.current) {
          setError(appleSignIn.error);
        }
        return;
      }

      // Authenticate with backend
      await loginWithSSO('apple', identityToken);

      // Only update state if still mounted
      if (isMountedRef.current) {
        setIsSuccess(true);
      }
    } catch (err) {
      // Handle backend errors (only if still mounted)
      if (isMountedRef.current) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to complete Apple Sign-In';
        setError(errorMessage);
      }
    } finally {
      // Only update loading state if still mounted
      if (isMountedRef.current) {
        setIsAppleLoading(false);
      }
    }
  };

  return {
    signInWithGoogle,
    signInWithApple,
    isGoogleLoading,
    isAppleLoading,
    error,
    resetError,
    isGoogleAvailable: googleSignIn.isAvailable,
    isAppleAvailable: appleSignIn.isAvailable,
    isSuccess,
    resetSuccess,
  };
}
