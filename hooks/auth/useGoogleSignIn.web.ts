/**
 * Google Sign-In Hook — Web Implementation
 *
 * Uses Google Identity Services (GIS) to provide Google authentication on web.
 * Returns the same interface as the native hook so consumers don't need platform checks.
 *
 * Flow: prompt() (One Tap / FedCM) → fallback to hidden rendered button click → credential callback
 */

import Constants from 'expo-constants';
import { useCallback, useEffect, useRef, useState } from 'react';

// ---------- Types ----------

export interface UseGoogleSignInReturn {
  signIn: () => Promise<string | null>;
  isLoading: boolean;
  error: string | null;
  reset: () => void;
  isAvailable: boolean;
}

interface CredentialResponse {
  credential: string;
  select_by: string;
}

interface PromptNotification {
  isDisplayed: () => boolean;
  isNotDisplayed: () => boolean;
  isSkippedMoment: () => boolean;
  getNotDisplayedReason: () => string;
  getSkippedReason: () => string;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: CredentialResponse) => void;
            auto_select?: boolean;
            use_fedcm_for_prompt?: boolean;
          }) => void;
          renderButton: (
            element: HTMLElement,
            config: { type?: string; size?: string; width?: number }
          ) => void;
          prompt: (callback?: (notification: PromptNotification) => void) => void;
        };
      };
    };
  }
}

// ---------- Helpers ----------

function getWebClientId(): string | undefined {
  return (
    Constants.expoConfig?.extra?.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
  );
}

export function isGoogleSignInConfigured(): boolean {
  const clientId = getWebClientId();
  return Boolean(clientId && clientId.length > 0);
}

let gisLoadPromise: Promise<void> | null = null;

function loadGisScript(): Promise<void> {
  if (typeof window !== 'undefined' && window.google?.accounts) {
    return Promise.resolve();
  }
  if (gisLoadPromise) return gisLoadPromise;

  gisLoadPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(script);
  });

  return gisLoadPromise;
}

// ---------- Hook ----------

export function useGoogleSignIn(): UseGoogleSignInReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAvailable, setIsAvailable] = useState(false);

  const pendingResolve = useRef<((token: string | null) => void) | null>(null);
  const hiddenContainer = useRef<HTMLDivElement | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    const clientId = getWebClientId();
    if (!clientId) {
      setIsAvailable(false);
      return;
    }

    loadGisScript()
      .then(() => {
        if (initializedRef.current) return;
        initializedRef.current = true;

        window.google!.accounts.id.initialize({
          client_id: clientId,
          callback: (response: CredentialResponse) => {
            if (pendingResolve.current) {
              pendingResolve.current(response.credential || null);
              pendingResolve.current = null;
            }
          },
          auto_select: false,
          use_fedcm_for_prompt: true,
        });

        // Prepare hidden button as fallback for when prompt() can't display
        const container = document.createElement('div');
        container.style.cssText =
          'position:fixed;top:-9999px;left:-9999px;opacity:0.01;pointer-events:none;';
        document.body.appendChild(container);
        hiddenContainer.current = container;

        window.google!.accounts.id.renderButton(container, {
          type: 'standard',
          size: 'large',
          width: 200,
        });

        setIsAvailable(true);
      })
      .catch(() => {
        setIsAvailable(false);
      });

    return () => {
      if (hiddenContainer.current?.parentNode) {
        hiddenContainer.current.parentNode.removeChild(hiddenContainer.current);
        hiddenContainer.current = null;
      }
    };
  }, []);

  const reset = useCallback(() => setError(null), []);

  const signIn = useCallback(async (): Promise<string | null> => {
    if (!isAvailable || !window.google?.accounts) {
      setError('Google Sign-In is not available');
      return null;
    }

    setIsLoading(true);
    setError(null);

    return new Promise<string | null>((resolve) => {
      const finish = (token: string | null) => {
        pendingResolve.current = null;
        setIsLoading(false);
        resolve(token);
      };

      pendingResolve.current = finish;

      // Timeout: if nothing happens after 2 minutes, cancel
      const timeout = setTimeout(() => {
        if (pendingResolve.current) {
          finish(null);
        }
      }, 120_000);

      const originalFinish = finish;
      pendingResolve.current = (token: string | null) => {
        clearTimeout(timeout);
        originalFinish(token);
      };

      // Try One Tap / FedCM first (fast, seamless)
      window.google!.accounts.id.prompt((notification: PromptNotification) => {
        if (notification.isDisplayed()) {
          // Prompt is showing — wait for credential callback
          return;
        }

        // One Tap not available — click the hidden rendered button to open popup
        const btn = hiddenContainer.current?.querySelector('[role="button"]') as HTMLElement | null;

        if (btn) {
          const container = hiddenContainer.current!;
          container.style.pointerEvents = 'auto';
          btn.click();
          container.style.pointerEvents = 'none';

          // Detect popup close: when window regains focus without a credential
          const handleFocus = () => {
            setTimeout(() => {
              if (pendingResolve.current) {
                // Popup was closed without signing in
                pendingResolve.current(null);
              }
            }, 500);
          };
          window.addEventListener('focus', handleFocus, { once: true });
        } else {
          // Neither prompt nor button available
          pendingResolve.current = null;
          clearTimeout(timeout);
          setIsLoading(false);
          setError('Unable to open Google Sign-In. Please check your popup blocker settings.');
          resolve(null);
        }
      });
    });
  }, [isAvailable]);

  return { signIn, isLoading, error, reset, isAvailable };
}
