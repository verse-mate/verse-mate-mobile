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
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import * as NavigationBar from 'expo-navigation-bar';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useRef } from 'react';
import { InteractionManager, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { AppErrorBoundary } from '@/components/AppErrorBoundary';
import { AuthProvider } from '@/contexts/AuthContext';
import { DeviceInfoProvider } from '@/contexts/DeviceInfoContext';
import { ThemeProvider as CustomThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { AppPostHogProvider } from '@/lib/analytics/posthog-provider';
import { handleReactQueryError } from '@/lib/analytics/react-query-error-tracking';
import { authenticatedFetch } from '@/lib/api/authenticated-fetch';
import { setupClientInterceptors } from '@/lib/api/client-interceptors';
import { parseChapterShareUrl } from '@/utils/sharing/generate-chapter-share-url';
import { parseTopicShareUrl } from '@/utils/sharing/generate-topic-share-url';
import { ONBOARDING_KEY } from './onboarding';

// Keep the splash screen visible while we fetch last read position
SplashScreen.preventAutoHideAsync();

// Create a QueryClient instance (singleton)
const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => handleReactQueryError(error as Error),
  }),
  mutationCache: new MutationCache({
    onError: (error) => handleReactQueryError(error as Error),
  }),
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
 * Inner Layout Component
 *
 * Handles React Navigation theme, deep link navigation, and splash screen management.
 * Must be inside ThemeProvider to access theme context.
 */
function RootLayoutInner() {
  const { mode, colors, isLoading: themeLoading } = useTheme();
  const router = useRouter();
  const segments = useSegments();
  const hasInitialized = useRef(false);

  // Check onboarding status
  // biome-ignore lint/correctness/useExhaustiveDependencies: router.replace is stable but not typed as such
  useEffect(() => {
    async function checkOnboarding() {
      // Avoid redirecting if already on the onboarding screen
      if (segments[0] === 'onboarding') return;

      try {
        const hasSeenOnboarding = await AsyncStorage.getItem(ONBOARDING_KEY);
        if (hasSeenOnboarding !== 'true') {
          router.replace('/onboarding');
        }
      } catch (error) {
        console.error('Error checking onboarding status:', error);
      }
    }

    if (!themeLoading) {
      checkOnboarding();
    }
  }, [themeLoading, segments]);

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
     * Handles both Bible chapter and topic deep links:
     * - Bible chapters: /bible/{bookSlug|bookId}/{chapterNumber}
     * - Topics: /topic/{category-slug}/{topic-slug}
     *
     * @param url - The incoming deep link URL
     */
    const handleDeepLink = async (url: string | null) => {
      if (!url) return;

      try {
        // Try parsing as topic URL first
        const topicParsed = parseTopicShareUrl(url);

        if (topicParsed) {
          // Track analytics - deep_link_opened with { category, slug, source: url }

          const { category, slug } = topicParsed;

          console.log('Topic deep link detected:', { category, slug });

          try {
            const baseUrl = process.env.EXPO_PUBLIC_API_URL;
            if (!baseUrl) {
              throw new Error('EXPO_PUBLIC_API_URL is not configured');
            }

            // Fetch topic details to get topic_id
            const response = await authenticatedFetch(
              `${baseUrl}/topics/by-slug?category=${category}&slug=${slug}`
            );

            if (!response.ok) {
              if (response.status === 404) {
                console.warn('Topic deep link not found:', { category, slug });
              } else {
                console.error('Topic deep link API error:', response.status);
              }
              // Fallback to Bible
              router.replace('/bible/1/1');
              return;
            }

            const topicData = await response.json();

            if (topicData?.topic_id) {
              // Navigate to the topic
              router.replace(`/topics/${topicData.topic_id}`);
            } else {
              console.error('Invalid topic response data:', topicData);
              router.replace('/bible/1/1');
            }
          } catch (error) {
            console.error('Error handling topic deep link:', error);
            // Fallback to Bible on network or other errors
            router.replace('/bible/1/1');
          }
          return;
        }

        // Try parsing as Bible chapter URL
        const chapterParsed = parseChapterShareUrl(url);

        if (!chapterParsed) {
          // TODO: Track analytics - deep_link_failed with { url, error: 'invalid_format' }
          console.warn('Failed to parse deep link URL:', url);
          // Fallback to Genesis 1
          router.replace('/bible/1/1');
          return;
        }

        const { bookId, chapterNumber } = chapterParsed;

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
    const listener = (event: { url: string }) => {
      handleDeepLink(event.url);
    };

    const subscription = Linking.addEventListener('url', listener);

    // Get initial URL
    getInitialURL();

    // Cleanup subscription on unmount
    return () => {
      // Robust cleanup that handles different SDK versions
      if (subscription && typeof subscription.remove === 'function') {
        subscription.remove();
      }
      // biome-ignore lint/suspicious/noExplicitAny: legacy API support for older Expo SDK versions
      else if (typeof (Linking as any).removeEventListener === 'function') {
        // legacy API support
        // biome-ignore lint/suspicious/noExplicitAny: legacy API support for older Expo SDK versions
        (Linking as any).removeEventListener('url', listener);
      }
    };
  }, [router]);

  // System UI setup for Android
  // Note: edgeToEdgeEnabled is set in app.json, which makes nav bar transparent automatically
  useEffect(() => {
    if (Platform.OS !== 'android' || themeLoading || hasInitialized.current) {
      return;
    }

    const applySystemUI = async () => {
      try {
        // Update background color to match theme
        await SystemUI.setBackgroundColorAsync(colors.background);
        // Update nav bar button style (light buttons on dark theme, dark on light)
        await NavigationBar.setButtonStyleAsync(mode === 'dark' ? 'light' : 'dark');
        // Ensure nav bar is visible (reverting hidden state)
        await NavigationBar.setVisibilityAsync('visible');
      } catch (error) {
        console.error('Failed to apply system UI settings:', error);
      }
    };

    applySystemUI();
    hasInitialized.current = true;
  }, [themeLoading, colors.background, mode]);

  // Hide splash screen with delay to ensure window layout is ready
  useEffect(() => {
    if (!themeLoading) {
      async function hideSplash() {
        try {
          // Wait for interactions to complete before hiding splash
          await new Promise((resolve) => {
            InteractionManager.runAfterInteractions(() => {
              setTimeout(resolve, 200);
            });
          });
          await SplashScreen.hideAsync();
        } catch (err) {
          console.error('Error hiding splash screen:', err);
        }
      }
      hideSplash();
    }
  }, [themeLoading]);

  // Select React Navigation theme based on resolved mode
  const navigationTheme = mode === 'dark' ? DarkTheme : DefaultTheme;

  return (
    <AppErrorBoundary>
      <ThemeProvider value={navigationTheme}>
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
          <Stack.Screen
            name="settings"
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="notes"
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="help"
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="onboarding"
            options={{
              headerShown: false,
              animation: 'fade',
            }}
          />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </AppErrorBoundary>
  );
}

/**
 * Root Layout Component
 *
 * Handles:
 * - Theme provider setup (custom + React Navigation)
 * - React Query provider setup
 * - Authentication provider setup
 * - PostHog analytics provider setup
 * - Deep link handling for chapter sharing
 * - Splash screen management
 */
export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppPostHogProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <CustomThemeProvider>
              <DeviceInfoProvider>
                <ToastProvider>
                  <RootLayoutInner />
                </ToastProvider>
              </DeviceInfoProvider>
            </CustomThemeProvider>
          </AuthProvider>
        </QueryClientProvider>
      </AppPostHogProvider>
    </GestureHandlerRootView>
  );
}
