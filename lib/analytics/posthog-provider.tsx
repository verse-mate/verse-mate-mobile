/**
 * PostHog Analytics Provider
 *
 * Wraps the application with PostHog analytics when API key is available.
 * Provides graceful degradation when PostHog is not configured.
 */

import { PostHogProvider, usePostHog } from 'posthog-react-native';
import { useEffect, type ReactNode } from 'react';

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
 * PostHog Initializer - sets the module-level posthogInstance
 * This component must be rendered inside PostHogProvider
 */
function PostHogInitializer({ children }: { children: ReactNode }) {
  const posthog = usePostHog();

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
