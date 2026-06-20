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

import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import NetInfo from '@react-native-community/netinfo';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import {
  MutationCache,
  onlineManager,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import * as NavigationBar from 'expo-navigation-bar';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus, InteractionManager, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { AppErrorBoundary } from '@/components/AppErrorBoundary';
import { MobileAudioPlayerRoot } from '@/components/bible/MobileAudioPlayerRoot';
import { AudioPlayerProvider } from '@/contexts/AudioPlayerContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { DeviceInfoProvider } from '@/contexts/DeviceInfoContext';
import { OfflineProvider } from '@/contexts/OfflineContext';
import { ThemeProvider as CustomThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { preloadAllTopicsCache } from '@/hooks/topics/use-cached-topics';
import { AnalyticsEvent, analytics } from '@/lib/analytics';
import {
  trackAudioPlaybackCompleted,
  trackAudioPlaybackPaused,
  trackAudioPlaybackStarted,
} from '@/lib/analytics/audio-events';
import { AppPostHogProvider } from '@/lib/analytics/posthog-provider';
import { handleReactQueryError } from '@/lib/analytics/react-query-error-tracking';
import { authenticatedFetch } from '@/lib/api/authenticated-fetch';
import { setupClientInterceptors } from '@/lib/api/client-interceptors';
import { ExpoAudioEngine } from '@/lib/audio/expoAudioEngine';
import { StubAudioEngine } from '@/lib/audio/stubAudioEngine';
import { I18nProvider } from '@/lib/i18n/I18nProvider';
import { UpgradePromptScreen } from '@/src/screens/UpgradePromptScreen';
import { checkVersionPolicy } from '@/src/services/versionPolicy';
import {
  buildWidgetVerseRoute,
  parseChapterShareUrl,
} from '@/utils/sharing/generate-chapter-share-url';
import { parseTopicShareUrl } from '@/utils/sharing/generate-topic-share-url';
import { ONBOARDING_KEY, WHATS_NEW_KEY, WHATS_NEW_VERSION } from './onboarding';

// Keep the splash screen visible while we fetch last read position
SplashScreen.preventAutoHideAsync();

// TASK-009 / TASK-017: single AudioPlayerProvider instance, app-lifecycle.
// E2E test runs use the in-memory StubAudioEngine to avoid native deps;
// every other build uses the real expo-audio engine.
// Mounted here (not inside the provider tree) so the engine's event
// listeners survive React re-renders.
const audioEngine =
  process.env.APP_ENV === 'e2e-test' ? new StubAudioEngine() : new ExpoAudioEngine();

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

// Bridge React Query's onlineManager to React Native's connectivity signal so
// queries with `refetchOnReconnect` automatically retry the moment NetInfo
// reports a real connection — replaces ad-hoc per-screen offline→online
// refetch effects.
onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => {
    setOnline(state.isConnected === true);
  })
);

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
  const [upgradeState, setUpgradeState] = useState<{
    mustUpgrade: boolean;
    currentVersion: string;
    minVersion: string;
    dismissed: boolean;
  }>({ mustUpgrade: false, currentVersion: '', minVersion: '', dismissed: false });

  // Check version policy on app startup (T8)
  // biome-ignore lint/correctness/useExhaustiveDependencies: run once on mount
  useEffect(() => {
    async function runVersionCheck() {
      if (Platform.OS === 'web') return;
      const currentVersion =
        (await import('expo-constants')).default.expoConfig?.version ?? '0.0.0';
      const result = await checkVersionPolicy(currentVersion);
      if (result.mustUpgrade) {
        setUpgradeState({
          mustUpgrade: true,
          currentVersion,
          minVersion: result.minVersion,
          dismissed: false,
        });
      }
    }
    runVersionCheck();
  }, []);

  // Check onboarding status
  // biome-ignore lint/correctness/useExhaustiveDependencies: router.replace is stable but not typed as such
  useEffect(() => {
    async function checkOnboarding() {
      // Skip during SSR on web (no window/localStorage)
      if (Platform.OS === 'web' && typeof window === 'undefined') return;

      // Avoid redirecting if already on the onboarding screen
      if (segments[0] === 'onboarding') return;

      try {
        const hasSeenOnboarding = await AsyncStorage.getItem(ONBOARDING_KEY);
        if (hasSeenOnboarding !== 'true') {
          // New user / first run: show the full feature tour.
          router.replace('/onboarding');
          return;
        }
        // Existing user who just updated: show only the new feature cards once.
        const seenWhatsNew = await AsyncStorage.getItem(WHATS_NEW_KEY);
        if (seenWhatsNew !== WHATS_NEW_VERSION) {
          router.replace({ pathname: '/onboarding', params: { mode: 'whatsnew' } });
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
        // Handle names-of-god deep links: versemate://names-of-god/:nameId
        const namesOfGodMatch = url.match(
          /(?:versemate:\/\/|https?:\/\/[^/]+)\/names-of-god\/([^/?#]+)/
        );
        if (namesOfGodMatch) {
          const nameId = namesOfGodMatch[1];
          router.replace(`/names-of-god/${nameId}`);
          return;
        }

        // Try parsing as topic URL first
        const topicParsed = parseTopicShareUrl(url);

        if (topicParsed) {
          // Track analytics - deep_link_opened with { category, slug, source: url }

          const { category, slug } = topicParsed;

          if (__DEV__) console.log('Topic deep link detected:', { category, slug });

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
                if (__DEV__) console.warn('Topic deep link not found:', { category, slug });
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
          if (__DEV__) console.warn('Failed to parse deep link URL:', url);
          // Fallback to Genesis 1
          router.replace('/bible/1/1');
          return;
        }

        const { bookId, chapterNumber, verseStart, verseEnd } = chapterParsed;

        // Validate bookId (parser already validates 1-66 range)
        if (bookId < 1 || bookId > 66) {
          if (__DEV__) console.warn('Invalid bookId in deep link:', bookId);
          router.replace('/bible/1/1'); // Fallback to Genesis 1
          return;
        }

        // Validate chapterNumber (additional validation happens in chapter screen)
        if (chapterNumber < 1) {
          if (__DEV__) console.warn('Invalid chapterNumber in deep link:', chapterNumber);
          // Navigate to book's first chapter
          router.replace(`/bible/${bookId}/1`);
          return;
        }

        // Verse-of-the-day widget deep link carries ?verseStart (and ?src=widget).
        // Forward to the reader's existing `verse`/`endVerse` params (scroll +
        // highlight) and emit the re-entry analytics event.
        const isWidget = url.includes('src=widget');
        if (verseStart) {
          if (isWidget) {
            analytics.track(AnalyticsEvent.WIDGET_TAPPED, {
              bookId,
              chapterNumber,
              verseStart,
              verseEnd,
              source: 'verse-of-the-day',
            });
          }
          router.replace(
            buildWidgetVerseRoute(bookId, chapterNumber, verseStart, verseEnd, isWidget)
          );
          return;
        }

        // Navigate to the chapter
        router.replace(`/bible/${bookId}/${chapterNumber}`);
      } catch (error) {
        // TODO: Track analytics - deep_link_failed with { url, error: error.message }
        console.error('Error handling deep link:', error);
        // Fallback to Genesis 1 on any error
        router.replace('/bible/1/1');
      }
    };

    // On web, Expo Router handles URL routing natively — skip deep link handling
    // to avoid parsing localhost URLs as deep links and causing redirect loops.
    if (Platform.OS === 'web') return;

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

  // Best-effort Android widget-install detection (GH-265, Task 18.4).
  // On every foreground, query whether the Verse-of-the-Day widget is on the
  // home screen via react-native-android-widget's getWidgetInfo. Emit
  // WIDGET_INSTALLED once (guarded by an AsyncStorage flag so it fires a single
  // time per install, not on every foreground). Android-only and fully
  // best-effort — any failure is swallowed.
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const WIDGET_INSTALLED_TRACKED_KEY = 'widget-installed-tracked';

    const checkWidgetInstalled = async () => {
      try {
        const alreadyTracked = await AsyncStorage.getItem(WIDGET_INSTALLED_TRACKED_KEY);
        if (alreadyTracked === 'true') return;

        const { getWidgetInfo } = await import('react-native-android-widget');
        const widgets = await getWidgetInfo('VerseOfTheDay');
        if (widgets.length > 0) {
          analytics.track(AnalyticsEvent.WIDGET_INSTALLED, { platform: 'android' });
          await AsyncStorage.setItem(WIDGET_INSTALLED_TRACKED_KEY, 'true');
        }
      } catch {
        // Best-effort: widget module unavailable or query failed — ignore.
      }
    };

    // Run on mount (covers cold start) and on each foreground transition.
    checkWidgetInstalled();
    const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') checkWidgetInstalled();
    });

    return () => subscription.remove();
  }, []);

  // Web: copy data-testid → id for Maestro web E2E compatibility
  // Maestro's web driver uses Selenium which matches `id` attribute, not `data-testid`.
  // This MutationObserver mirrors testIDs to id attributes so the same flows work on web.
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const sync = () => {
      document.querySelectorAll('[data-testid]').forEach((el) => {
        const testId = el.getAttribute('data-testid')!;
        if (el.id !== testId) el.id = testId;
      });
    };

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-testid'],
    });
    return () => observer.disconnect();
  }, []);

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

      // Preload topics cache in background for instant navigation modal access
      preloadAllTopicsCache().catch((err) => {
        console.error('Error preloading topics cache:', err);
      });
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
          <Stack.Screen
            name="manage-downloads"
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="names-of-god"
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="e2e-auth"
            options={{
              headerShown: false,
              animation: 'none',
            }}
          />
        </Stack>
        <StatusBar style="auto" />
        {upgradeState.mustUpgrade && !upgradeState.dismissed && (
          <UpgradePromptScreen
            currentVersion={upgradeState.currentVersion}
            minVersion={upgradeState.minVersion}
            onDismiss={() => setUpgradeState((prev) => ({ ...prev, dismissed: true }))}
          />
        )}
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
      <BottomSheetModalProvider>
        <I18nProvider>
          <AppPostHogProvider>
            <QueryClientProvider client={queryClient}>
              <AuthProvider>
                <CustomThemeProvider>
                  <DeviceInfoProvider>
                    <OfflineProvider>
                      <ToastProvider>
                        <AudioPlayerProvider
                          engine={audioEngine}
                          onPlaybackStarted={(track, args) =>
                            trackAudioPlaybackStarted({
                              explanationId: track.explanation_id,
                              explanationType: track.explanation_type,
                              bookId: track.book_id,
                              chapterNumber: track.chapter_number,
                              voice: track.voice,
                              languageCode: track.language_code,
                              isResume: args.isResume,
                              resumePositionSeconds: args.resumePositionSeconds,
                              ttsProvider: track.tts_provider,
                            })
                          }
                          onPlaybackPaused={(track, positionSeconds, reason) =>
                            trackAudioPlaybackPaused({
                              explanationId: track.explanation_id,
                              positionSeconds,
                              durationSeconds: track.duration_seconds,
                              reason,
                            })
                          }
                          onPlaybackCompleted={(track) =>
                            trackAudioPlaybackCompleted({
                              explanationId: track.explanation_id,
                              durationSeconds: track.duration_seconds,
                              completedBy: 'natural',
                            })
                          }
                        >
                          <RootLayoutInner />
                          <MobileAudioPlayerRoot />
                        </AudioPlayerProvider>
                      </ToastProvider>
                    </OfflineProvider>
                  </DeviceInfoProvider>
                </CustomThemeProvider>
              </AuthProvider>
            </QueryClientProvider>
          </AppPostHogProvider>
        </I18nProvider>
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
}
