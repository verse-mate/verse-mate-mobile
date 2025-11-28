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
import * as NavigationBar from 'expo-navigation-bar';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useRef } from 'react';
import { InteractionManager, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { AppErrorBoundary } from '@/components/AppErrorBoundary';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider as CustomThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { setupClientInterceptors } from '@/lib/api/client-interceptors';

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

// Removed anchor setting - no tabs directory exists

/**
 * Inner Layout Component
 *
 * Handles React Navigation theme and splash screen management.
 * Must be inside ThemeProvider to access theme context.
 */
function RootLayoutInner() {
  const { mode, colors, isLoading: themeLoading } = useTheme();
  const hasInitialized = useRef(false);

  // Multi-strategy edge-to-edge initialization for Android
  // Tries multiple timing strategies to ensure nav bar transparency activates
  useEffect(() => {
    if (Platform.OS !== 'android' || themeLoading || hasInitialized.current) {
      return;
    }

    const applyEdgeToEdge = async () => {
      try {
        await SystemUI.setBackgroundColorAsync(colors.background);
        await NavigationBar.setButtonStyleAsync(mode === 'dark' ? 'light' : 'dark');
        await NavigationBar.setVisibilityAsync('visible');
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        if (!errorMsg.includes('edge-to-edge')) {
          console.error('Failed to apply edge-to-edge:', error);
        }
      }
    };

    // Strategy 1: Immediate application
    applyEdgeToEdge();

    // Strategy 2: After current interactions complete
    const interactionHandle = InteractionManager.runAfterInteractions(() => {
      applyEdgeToEdge();
    });

    // Strategy 3: Multiple retry attempts with increasing delays
    const timers = [
      setTimeout(() => applyEdgeToEdge(), 50),
      setTimeout(() => applyEdgeToEdge(), 150),
      setTimeout(() => applyEdgeToEdge(), 300),
    ];

    hasInitialized.current = true;

    return () => {
      interactionHandle.cancel();
      for (const timer of timers) {
        clearTimeout(timer);
      }
    };
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
 * - App launch navigation to last read position
 * - Splash screen management
 */
export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <CustomThemeProvider>
            <RootLayoutInner />
          </CustomThemeProvider>
        </AuthProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

// AppLaunchNavigator removed - navigation logic moved to RootLayout useEffect
