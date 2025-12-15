/**
 * Google Sign-In Hook
 *
 * Provides Google authentication functionality for the VerseMate app.
 * Handles Google Sign-In initialization, sign-in flow, and error handling.
 *
 * @see Task Group 2: Google Sign-In Hook Implementation
 */

import Constants from 'expo-constants';
import { useCallback, useEffect, useRef, useState } from 'react';

// Safely import Google Sign-In module to prevent crashes in Expo Go
// biome-ignore lint/suspicious/noExplicitAny: Dynamic import for optional native module
let GoogleSignin: any;
// biome-ignore lint/suspicious/noExplicitAny: Dynamic import for optional native module
let statusCodes: any;
// biome-ignore lint/suspicious/noExplicitAny: Dynamic import for optional native module
let isSuccessResponse: any;
// biome-ignore lint/suspicious/noExplicitAny: Dynamic import for optional native module
let isErrorWithCode: any;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const googleSigninModule = require('@react-native-google-signin/google-signin');
  GoogleSignin = googleSigninModule.GoogleSignin;
  statusCodes = googleSigninModule.statusCodes;
  isSuccessResponse = googleSigninModule.isSuccessResponse;
  isErrorWithCode = googleSigninModule.isErrorWithCode;
} catch (_e) {
  console.log('Google Sign-In native module not found (running in Expo Go?)');
}

/**
 * Google Sign-In hook return type
 */
export interface UseGoogleSignInReturn {
  /** Trigger Google Sign-In flow */
  signIn: () => Promise<string | null>;
  /** Whether sign-in is currently in progress */
  isLoading: boolean;
  /** Error message if sign-in failed */
  error: string | null;
  /** Reset error state */
  reset: () => void;
  /** Whether Google Sign-In is available (configured) */
  isAvailable: boolean;
}

/**
 * Google Sign-In hook configuration
 */
interface GoogleSignInConfig {
  webClientId?: string;
  iosClientId?: string;
}

/**
 * Get Google Sign-In configuration from environment
 */
function getGoogleConfig(): GoogleSignInConfig {
  return {
    webClientId:
      Constants.expoConfig?.extra?.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
      process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId:
      Constants.expoConfig?.extra?.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ||
      process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  };
}

/**
 * Check if Google Sign-In is configured (has required client ID)
 */
export function isGoogleSignInConfigured(): boolean {
  const config = getGoogleConfig();
  return Boolean(config.webClientId && config.webClientId.length > 0);
}

/**
 * Custom hook for Google Sign-In authentication
 *
 * @returns Object with signIn function, loading state, error state, and reset function
 *
 * @example
 * ```tsx
 * const { signIn, isLoading, error, reset, isAvailable } = useGoogleSignIn();
 *
 * const handleGoogleSignIn = async () => {
 *   const idToken = await signIn();
 *   if (idToken) {
 *     // Send idToken to backend for verification
 *     await loginWithSSO('google', idToken);
 *   }
 * };
 * ```
 */
export function useGoogleSignIn(): UseGoogleSignInReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAvailable, setIsAvailable] = useState(false);
  const isConfigured = useRef(false);

  // Initialize Google Sign-In on mount
  useEffect(() => {
    // If native module is missing, disable
    if (!GoogleSignin) {
      setIsAvailable(false);
      return;
    }

    const config = getGoogleConfig();

    // Check if Google Sign-In is configured
    if (!config.webClientId) {
      setIsAvailable(false);
      return;
    }

    // Configure Google Sign-In
    try {
      GoogleSignin.configure({
        webClientId: config.webClientId,
        iosClientId: config.iosClientId,
        offlineAccess: false,
      });
      isConfigured.current = true;
      setIsAvailable(true);
    } catch (err) {
      console.error('Failed to configure Google Sign-In:', err);
      setIsAvailable(false);
    }
  }, []);

  /**
   * Reset error state
   */
  const reset = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Trigger Google Sign-In flow
   *
   * @returns ID token on success, null on failure or cancellation
   */
  const signIn = useCallback(async (): Promise<string | null> => {
    if (!GoogleSignin) {
      setError('Google Sign-In is not supported in this environment');
      return null;
    }

    if (!isConfigured.current) {
      setError('Google Sign-In is not configured');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Check for Google Play Services (required on Android)
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

      // Trigger sign-in
      const response = await GoogleSignin.signIn();

      // Check if sign-in was successful
      if (isSuccessResponse(response)) {
        const idToken = response.data?.idToken;
        if (!idToken) {
          setError('Failed to get ID token from Google');
          return null;
        }
        return idToken;
      }

      // Sign-in was not successful
      setError('Google Sign-In failed');
      return null;
    } catch (err) {
      // Handle specific Google Sign-In errors if module is available
      if (isErrorWithCode && statusCodes && isErrorWithCode(err)) {
        // biome-ignore lint/suspicious/noExplicitAny: Google Error type
        const googleError = err as any;
        switch (googleError.code) {
          case statusCodes.SIGN_IN_CANCELLED:
            // User cancelled - not an error state
            return null;

          case statusCodes.IN_PROGRESS:
            setError('Sign-in already in progress');
            return null;

          case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
            setError('Google Play Services not available');
            return null;

          default:
            // biome-ignore lint/suspicious/noExplicitAny: Error type is unknown
            setError((err as any).message || 'Google Sign-In failed');
            return null;
        }
      }

      // Unknown error
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    signIn,
    isLoading,
    error,
    reset,
    isAvailable,
  };
}
