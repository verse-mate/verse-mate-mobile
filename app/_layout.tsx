/**
 * Root Layout
 *
 * Main application layout that wraps all screens with theme provider
 * and React Query provider. Handles app launch logic to navigate to
 * last read position or default to Genesis 1. Also handles deep links
 * for chapter sharing.
 *
 * @see Task Group 9.5 - Implement app launch logic
 * @see Task Group 4 - Deep Link Handling
 */

import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { AppErrorBoundary } from '@/components/AppErrorBoundary';
import { AuthProvider } from '@/contexts/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { setupClientInterceptors } from '@/lib/api/client-interceptors';
import { parseChapterShareUrl } from '@/utils/sharing/generate-chapter-share-url';

// Keep the splash screen visible while we fetch last read position
SplashScreen.preventAutoHideAsync();

// Create a QueryClient instance (singleton)
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes default stale time
      gcTime: 1000 * 60 * 30, // 30 minutes garbage collection
      retry: 0, // Disable retries until API is configured
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
  },
});

// Set up client interceptors for authentication
// Must be called before any API requests
setupClientInterceptors();

/**
 * Root Layout Component
 *
 * Handles:
 * - Theme provider setup
 * - React Query provider setup
 * - Authentication provider setup
 * - App launch navigation to last read position
 * - Deep link handling for chapter sharing
 * - Splash screen management
 */
export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();

  /**
   * Handle deep link navigation
   *
   * Listens for incoming deep links and navigates to the appropriate chapter.
   * Validates bookId and chapterNumber before navigation.
   * Falls back to Genesis 1 for invalid links.
   */
  useEffect(() => {
    /**
     * Process a deep link URL
     *
     * @param url - The incoming deep link URL
     */
    const handleDeepLink = (url: string | null) => {
      if (!url) return;

      try {
        // TODO: Track analytics - deep_link_opened with { bookId, chapterNumber, source: url }

        // Parse the URL to extract bookId and chapterNumber
        const parsed = parseChapterShareUrl(url);

        if (!parsed) {
          // TODO: Track analytics - deep_link_failed with { url, error: 'invalid_format' }
          console.warn('Failed to parse deep link URL:', url);
          // Fallback to Genesis 1
          router.replace('/bible/1/1');
          return;
        }

        const { bookId, chapterNumber } = parsed;

        // Validate bookId (parser already validates 1-66 range)
        if (bookId < 1 || bookId > 66) {
          console.warn('Invalid bookId in deep link:', bookId);
          router.replace('/bible/1/1'); // Fallback to Genesis 1
          return;
        }

        // Validate chapterNumber (additional validation happens in chapter screen)
        if (chapterNumber < 1) {
          console.warn('Invalid chapterNumber in deep link:', chapterNumber);
          // Navigate to book's first chapter
          router.replace(`/bible/${bookId}/1`);
          return;
        }

        // TODO: Track analytics - deep_link_navigation_success with { bookId, chapterNumber }

        // Navigate to the chapter
        router.replace(`/bible/${bookId}/${chapterNumber}`);
      } catch (error) {
        // TODO: Track analytics - deep_link_failed with { url, error: error.message }
        console.error('Error handling deep link:', error);
        // Fallback to Genesis 1 on any error
        router.replace('/bible/1/1');
      }
    };

    // Handle initial URL (app opened from link)
    const getInitialURL = async () => {
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) {
        handleDeepLink(initialUrl);
      }
    };

    // Handle URLs while app is running
    const subscription = Linking.addEventListener('url', (event) => {
      handleDeepLink(event.url);
    });

    // Get initial URL
    getInitialURL();

    // Cleanup subscription on unmount
    return () => {
      subscription.remove();
    };
  }, [router]);

  // Hide splash screen once the layout is ready
  useEffect(() => {
    async function hideSplash() {
      try {
        await SplashScreen.hideAsync();
      } catch (err) {
        console.error('Error hiding splash screen:', err);
      }
    }
    hideSplash();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AppErrorBoundary>
            <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
              <Stack>
                <Stack.Screen name="index" options={{ headerShown: false }} />
                <Stack.Screen
                  name="bible/[bookId]/[chapterNumber]"
                  options={{
                    headerShown: false,
                    animation: 'none', // Disable route animations - PagerView handles swipe animations
                  }}
                />
                <Stack.Screen
                  name="topics/[topicId]"
                  options={{
                    headerShown: false,
                    animation: 'none',
                  }}
                />
                <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
                <Stack.Screen
                  name="auth"
                  options={{
                    presentation: 'modal',
                    headerShown: false,
                  }}
                />
                <Stack.Screen
                  name="bookmarks"
                  options={{
                    headerShown: false,
                  }}
                />
                <Stack.Screen
                  name="highlights"
                  options={{
                    headerShown: false,
                  }}
                />
              </Stack>
              <StatusBar style="auto" />
            </ThemeProvider>
          </AppErrorBoundary>
        </AuthProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
