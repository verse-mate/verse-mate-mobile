/**
 * Root Layout
 *
 * Main application layout that wraps all screens with theme provider
 * and React Query provider. Handles app launch logic to navigate to
 * last read position or default to Genesis 1.
 *
 * @see Task Group 9.5 - Implement app launch logic
 */

import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useLastRead } from '@/src/api/bible/hooks';

// Keep the splash screen visible while we fetch last read position
SplashScreen.preventAutoHideAsync();

// Create a QueryClient instance (singleton)
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes default stale time
      gcTime: 1000 * 60 * 30, // 30 minutes garbage collection
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
  },
});

export const unstable_settings = {
  anchor: '(tabs)',
};

/**
 * Root Layout Component
 *
 * Handles:
 * - Theme provider setup
 * - React Query provider setup
 * - App launch navigation to last read position
 * - Splash screen management
 */
export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [_appIsReady, setAppIsReady] = useState(false);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AppLaunchNavigator onReady={() => setAppIsReady(true)} />
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
          <Stack.Screen name="bible/[bookId]/[chapterNumber]" options={{ headerShown: false }} />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

/**
 * App Launch Navigator
 *
 * Fetches user's last read position and navigates to it on app launch.
 * Falls back to Genesis 1 if no position found or error occurs.
 *
 * @see Task Group 9.5 - Implement app launch logic
 * @see Spec lines 542-550, 733-742 (Reading position)
 */
function AppLaunchNavigator({ onReady }: { onReady: () => void }) {
  const [hasNavigated, setHasNavigated] = useState(false);

  // Fetch last read position for guest user
  // TODO: Replace 'guest' with actual user ID when auth is added
  const { data: lastRead, isLoading } = useLastRead('guest');

  useEffect(() => {
    async function navigateToLastRead() {
      // Don't navigate if already done
      if (hasNavigated) {
        return;
      }

      // Wait for loading to complete
      if (isLoading) {
        return;
      }

      try {
        // Maximum wait time: 2 seconds
        const timeoutId = setTimeout(() => {
          if (!hasNavigated) {
            // Timeout reached, navigate to Genesis 1
            router.replace('/bible/1/1' as never);
            setHasNavigated(true);
            SplashScreen.hideAsync();
            onReady();
          }
        }, 2000);

        if (lastRead?.book_id && lastRead?.chapter_number) {
          // Navigate to last read position
          clearTimeout(timeoutId);
          router.replace(`/bible/${lastRead.book_id}/${lastRead.chapter_number}` as never);
        } else {
          // No last read position found, navigate to Genesis 1
          clearTimeout(timeoutId);
          router.replace('/bible/1/1' as never);
        }

        setHasNavigated(true);
        await SplashScreen.hideAsync();
        onReady();
      } catch (err) {
        // Error occurred, navigate to Genesis 1 as fallback
        console.error('Error navigating to last read:', err);
        router.replace('/bible/1/1' as never);
        setHasNavigated(true);
        await SplashScreen.hideAsync();
        onReady();
      }
    }

    navigateToLastRead();
  }, [lastRead, isLoading, hasNavigated, onReady]);

  // Return null - this is just a navigation handler
  return null;
}
