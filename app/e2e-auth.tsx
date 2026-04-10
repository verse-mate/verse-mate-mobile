/**
 * E2E Auth Deep Link Handler
 *
 * Utility route for Maestro E2E tests to bypass the login form.
 * Accepts accessToken and refreshToken via URL search params,
 * stores them, and triggers session restore.
 *
 * Deep link: versemate://e2e-auth?accessToken=...&refreshToken=...
 *
 * SECURITY: Only enabled in __DEV__ mode or when APP_ENV=e2e-test.
 * In production builds this route rejects all requests.
 *
 * @see https://github.com/mobile-dev-inc/maestro/issues/1061
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { setAccessToken, setRefreshToken } from '@/lib/auth/token-storage';

const isE2E = process.env.EXPO_PUBLIC_APP_ENV === 'e2e-test';

export default function E2EAuthScreen() {
  const { accessToken, refreshToken } = useLocalSearchParams<{
    accessToken: string;
    refreshToken: string;
  }>();
  const { restoreSession } = useAuth();
  const router = useRouter();
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    async function authenticate() {
      // Guard: only allow in dev or e2e-test builds
      if (!__DEV__ && !isE2E) {
        console.warn('e2e-auth: rejected in production build');
        router.replace('/bible/1/1');
        return;
      }

      if (!accessToken || !refreshToken) {
        console.warn('e2e-auth: missing accessToken or refreshToken');
        router.replace('/bible/1/1');
        return;
      }

      try {
        // Store tokens
        await setAccessToken(accessToken);
        await setRefreshToken(refreshToken);

        // Restore session — AuthContext will read the stored tokens
        await restoreSession();

        if (__DEV__) {
          console.log('e2e-auth: session restored, redirecting to Bible');
        }
      } catch (error) {
        console.error('e2e-auth: failed to authenticate', error);
      }

      // Navigate to Bible screen
      router.replace('/bible/1/1');
    }

    authenticate();
  }, [accessToken, refreshToken, restoreSession, router]);

  // Render nothing — this is a utility route
  return <View />;
}
