/**
 * Apple Sign-In Hook — Web Implementation
 *
 * Uses Apple's Sign In with Apple JS SDK for web authentication.
 * Requires Apple Developer configuration:
 *   1. Create a Services ID in Apple Developer Portal
 *   2. Configure the domain and redirect URL
 *   3. Set EXPO_PUBLIC_APPLE_WEB_CLIENT_ID and EXPO_PUBLIC_APPLE_WEB_REDIRECT_URI
 *
 * @see https://developer.apple.com/documentation/sign_in_with_apple/sign_in_with_apple_js
 */

import { useCallback, useEffect, useState } from 'react';
import type { UseAppleSignInReturn } from './useAppleSignIn';

const APPLE_SCRIPT_URL = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js';

declare global {
  interface Window {
    AppleID?: {
      auth: {
        init: (config: {
          clientId: string;
          scope: string;
          redirectURI: string;
          usePopup: boolean;
        }) => void;
        signIn: () => Promise<{
          authorization: {
            id_token: string;
            code: string;
          };
        }>;
      };
    };
  }
}

function loadAppleScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.AppleID) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = APPLE_SCRIPT_URL;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Apple Sign-In script'));
    document.head.appendChild(script);
  });
}

export function isAppleSignInEnabled(): boolean {
  const clientId = process.env.EXPO_PUBLIC_APPLE_WEB_CLIENT_ID;
  return !!clientId;
}

export function useAppleSignIn(): UseAppleSignInReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAvailable, setIsAvailable] = useState(false);

  const clientId = process.env.EXPO_PUBLIC_APPLE_WEB_CLIENT_ID || '';
  const redirectURI = process.env.EXPO_PUBLIC_APPLE_WEB_REDIRECT_URI || window.location.origin;

  useEffect(() => {
    if (!isAppleSignInEnabled()) {
      setIsAvailable(false);
      return;
    }

    loadAppleScript()
      .then(() => {
        window.AppleID?.auth.init({
          clientId,
          scope: 'name email',
          redirectURI,
          usePopup: true,
        });
        setIsAvailable(true);
      })
      .catch(() => {
        setIsAvailable(false);
      });
  }, []);

  const reset = useCallback(() => setError(null), []);

  const signIn = useCallback(async (): Promise<string | null> => {
    if (!isAvailable || !window.AppleID) {
      setError('Apple Sign-In is not available');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await window.AppleID.auth.signIn();
      return response.authorization.id_token;
    } catch (err: unknown) {
      const e = err as { error?: string };
      if (e?.error === 'popup_closed_by_user') {
        // User cancelled — not an error
        return null;
      }
      setError('Apple Sign-In failed. Please try again.');
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
