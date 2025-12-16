/**
 * PostHog Analytics Provider
 *
 * Wraps the application with PostHog analytics when API key is available.
 * Provides graceful degradation when PostHog is not configured.
 *
 * @see Task 4.5 - Language and country settings on app launch
 * @see Task 4.6 - Platform super property and is_registered tracking
 */

import { PostHogProvider, usePostHog } from 'posthog-react-native';
import { useEffect, useRef, type ReactNode } from 'react';
import { Platform } from 'react-native';
import * as Localization from 'expo-localization';

import { setPostHogInstance } from '@/lib/api/client-interceptors';

// PostHog instance for error tracking (set after initialization)
let posthogInstance: ReturnType<typeof usePostHog> | null = null;

/**
 * Get the current PostHog instance
 * Used by error tracking in error boundary and React Query
 */
export function getPostHogInstance() {
  return posthogInstance;
}

/**
 * PostHog configuration from environment variables
 */
const posthogApiKey = process.env.EXPO_PUBLIC_POSTHOG_KEY;
const posthogHost = process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com';
const sessionReplayEnabled = process.env.EXPO_PUBLIC_POSTHOG_SESSION_REPLAY === 'true';

/**
 * Extract language and country from device locale
 *
 * @returns { language: string, country: string | undefined }
 */
function getLocaleInfo(): { language: string; country: string | undefined } {
  // Get the primary locale from device
  const locales = Localization.getLocales();
  const primaryLocale = locales[0];

  if (!primaryLocale) {
    return { language: 'en', country: undefined };
  }

  // Language code (e.g., 'en', 'pt', 'es')
  const language = primaryLocale.languageCode || 'en';

  // Country/region code (e.g., 'US', 'BR', 'ES')
  const country = primaryLocale.regionCode || undefined;

  return { language, country };
}

/**
 * PostHog Initializer - sets the module-level posthogInstance
 * This component must be rendered inside PostHogProvider
 *
 * Also handles:
 * - Registering platform super property (Task 4.6)
 * - Setting language and country user properties (Task 4.5)
 * - Setting is_registered: false for anonymous users (Task 4.6)
 */
function PostHogInitializer({ children }: { children: ReactNode }) {
  const posthog = usePostHog();
  const hasInitialized = useRef(false);

  // Set PostHog instance for React Query error tracking and client interceptors
  useEffect(() => {
    posthogInstance = posthog;
    setPostHogInstance(
      posthog as { captureException: (error: unknown, context?: unknown) => void }
    );

    return () => {
      posthogInstance = null;
      setPostHogInstance(null);
    };
  }, [posthog]);

  // Initialize analytics properties on first mount only (Task 4.5, 4.6)
  // This runs once per session, not on every re-render
  useEffect(() => {
    if (!posthog || hasInitialized.current) {
      return;
    }

    hasInitialized.current = true;

    // Register platform super property (Task 4.6)
    // This ensures every event automatically includes platform: 'mobile'
    posthog.register({ platform: 'mobile' });

    // Get device locale information (Task 4.5)
    const { language, country } = getLocaleInfo();

    // Set user properties for language and country (Task 4.5)
    // Also set is_registered: false for anonymous users (Task 4.6)
    // Use $set to update person properties for both anonymous and identified users
    posthog.capture('$set', {
      $set: {
        language_setting: language,
        ...(country && { country }),
        is_registered: false, // Will be updated to true on login/signup
      },
    });
  }, [posthog]);

  return <>{children}</>;
}

/**
 * Wraps children with PostHog provider if API key is available
 * Otherwise renders children directly (graceful degradation)
 */
export function AppPostHogProvider({ children }: { children: ReactNode }) {
  if (!posthogApiKey) {
    // No PostHog key - render children without analytics
    return <>{children}</>;
  }

  return (
    <PostHogProvider
      apiKey={posthogApiKey}
      options={{
        host: posthogHost,
        // Enable session replay based on environment variable
        enableSessionReplay: sessionReplayEnabled,
        // Note: captureScreens is not a valid option in current PostHog SDK
        // Screen tracking is enabled by default with Expo Router
      }}
    >
      <PostHogInitializer>{children}</PostHogInitializer>
    </PostHogProvider>
  );
}
