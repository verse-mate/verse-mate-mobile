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
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { AppErrorBoundary } from '@/components/AppErrorBoundary';
import { AuthProvider } from '@/contexts/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
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
 * Root Layout Component
 *
 * Handles:
 * - Theme provider setup
 * - React Query provider setup
 * - Authentication provider setup
 * - App launch navigation to last read position
 * - Splash screen management
 */
export default function RootLayout() {
  const colorScheme = useColorScheme();

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
                  name="settings"
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

// AppLaunchNavigator removed - navigation logic moved to RootLayout useEffect
