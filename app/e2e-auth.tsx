/**
 * E2E Auth Deep Link Handler
 *
 * Utility route for Maestro E2E tests to bypass the login form.
 * Accepts an accessToken via URL search params, stores it, and
 * triggers session restore.
 *
 * Deep link: versemate://e2e-auth?accessToken=...
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
import { setAccessToken } from '@/lib/auth/token-storage';

const isE2E = process.env.APP_ENV === 'e2e-test';

export default function E2EAuthScreen() {
  const { accessToken } = useLocalSearchParams<{
    accessToken: string;
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

      if (!accessToken) {
        console.warn('e2e-auth: missing accessToken');
        router.replace('/bible/1/1');
        return;
      }

      try {
        await setAccessToken(accessToken);

        // Restore session — AuthContext will read the stored token
        await restoreSession();

        if (__DEV__) {
          console.log('e2e-auth: session restored, redirecting to Bible');
        }
      } catch (error) {
        console.error('e2e-auth: failed to authenticate', error);
      }

      router.replace('/bible/1/1');
    }

    authenticate();
  }, [accessToken, restoreSession, router]);

  return <View />;
}
