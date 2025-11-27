/**
 * Theme Context
 *
 * Manages theme preference (auto/light/dark) with AsyncStorage persistence.
 * Resolves 'auto' preference to system color scheme and provides theme-aware
 * colors from bible-design-tokens.
 *
 * Pattern based on useBibleVersion hook for AsyncStorage persistence.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { LightSensor } from 'expo-sensors';
import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import SunCalc from 'suncalc';

import { getColors, type ThemeMode } from '@/constants/bible-design-tokens';

// ============================================================================
// Types
// ============================================================================

/**
 * User's theme preference setting
 * - 'auto': Follow system color scheme
 * - 'light': Always use light theme
 * - 'dark': Always use dark theme
 * - 'sunrise_sunset': Switch based on calculated solar position
 * - 'ambient': Switch based on ambient light sensor
 */
export type ThemePreference = 'auto' | 'light' | 'dark' | 'sunrise_sunset' | 'ambient';

/**
 * Theme context value provided to all consumers
 */
export interface ThemeContextValue {
  /** User's theme preference (what they selected) */
  preference: ThemePreference;
  /** Resolved theme mode (actual light/dark in use) */
  mode: ThemeMode;
  /** Current color palette for the active theme */
  colors: ReturnType<typeof getColors>;
  /** Update theme preference and persist to AsyncStorage */
  setPreference: (preference: ThemePreference) => Promise<void>;
  /** Whether theme is still loading from AsyncStorage */
  isLoading: boolean;
}

// ============================================================================
// Context
// ============================================================================

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

// ============================================================================
// Constants
// ============================================================================

const THEME_PREFERENCE_KEY = 'theme-preference';
const DEFAULT_PREFERENCE: ThemePreference = 'auto';

// ============================================================================
// Provider Component
// ============================================================================

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const systemColorScheme = useColorScheme();

  // State
  const [preference, setPreferenceState] = useState<ThemePreference>(DEFAULT_PREFERENCE);
  const [isLoading, setIsLoading] = useState(true);
  const [coords, setCoords] = useState<Location.LocationObjectCoords | null>(null);
  const [now, setNow] = useState(new Date());
  const [ambientMode, setAmbientMode] = useState<ThemeMode>('light');

  // Handle ambient light sensor
  useEffect(() => {
    if (preference !== 'ambient') return;

    // Set update interval to 1s to save battery and reduce jitter
    LightSensor.setUpdateInterval(3000);

    const subscription = LightSensor.addListener(({ illuminance }) => {
      // Hysteresis to prevent flickering:
      // Dark if < 60 lux (dim room/night)
      // Light if > 90 lux (bright room/day)
      // No change in between (dead zone)
      if (illuminance < 60) {
        setAmbientMode('dark');
      } else if (illuminance > 90) {
        setAmbientMode('light');
      }
    });

    return () => {
      subscription.remove();
    };
  }, [preference]);

  // Update time every minute to check for sunrise/sunset transitions
  useEffect(() => {
    if (preference !== 'sunrise_sunset') return;

    const interval = setInterval(() => {
      setNow(new Date());
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [preference]);

  // Request location when sunrise_sunset is selected
  useEffect(() => {
    if (preference === 'sunrise_sunset' && !coords) {
      (async () => {
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== 'granted') {
            console.warn('Permission to access location was denied');
            // We could revert to 'auto' here, but keeping 'sunrise_sunset'
            // with a fallback (e.g. 6am/6pm default) might be better UX
            // or just defaulting to light/dark until permission is granted.
            return;
          }

          const location = await Location.getCurrentPositionAsync({});
          setCoords(location.coords);
        } catch (error) {
          console.error('Error getting location:', error);
        }
      })();
    }
  }, [preference, coords]);

  // Calculate sunrise/sunset mode
  let sunriseSunsetMode: ThemeMode = 'light'; // Default fallback
  if (coords) {
    const times = SunCalc.getTimes(now, coords.latitude, coords.longitude);
    // valid times are dates, invalid are "Invalid Date"
    if (!isNaN(times.sunrise.getTime()) && !isNaN(times.sunset.getTime())) {
      if (now >= times.sunrise && now < times.sunset) {
        sunriseSunsetMode = 'light';
      } else {
        sunriseSunsetMode = 'dark';
      }
    }
  }

  // Resolve preference to actual theme mode
  // If preference is 'auto', use system color scheme
  // If 'sunrise_sunset', use calculated mode based on location
  // If 'ambient', use mode from light sensor
  const mode: ThemeMode = preference === 'auto'
    ? (systemColorScheme === 'dark' ? 'dark' : 'light')
    : preference === 'sunrise_sunset'
      ? sunriseSunsetMode
      : preference === 'ambient'
        ? ambientMode
        : preference;

  // Get colors for current mode
  const colors = getColors(mode);

  // Load theme preference from AsyncStorage on mount
  useEffect(() => {
    const loadThemePreference = async () => {
      try {
        const stored = await AsyncStorage.getItem(THEME_PREFERENCE_KEY);
        if (stored && (
          stored === 'auto' ||
          stored === 'light' ||
          stored === 'dark' ||
          stored === 'sunrise_sunset' ||
          stored === 'ambient'
        )) {
          setPreferenceState(stored as ThemePreference);
        }
      } catch (error) {
        console.error('Failed to load theme preference:', error);
        // Continue with default preference on error
      } finally {
        setIsLoading(false);
      }
    };

    loadThemePreference();
  }, []);

  // Listen to system color scheme changes when preference is 'auto'
  // This ensures theme updates when user changes system dark mode while app is active
  useEffect(() => {
    if (preference === 'auto') {
      // Mode will automatically update due to dependency on systemColorScheme
      // No action needed here, just documenting the behavior
    }
  }, [preference, systemColorScheme]);

  // Function to update theme preference and persist to AsyncStorage
  const setPreference = async (newPreference: ThemePreference) => {
    try {
      // Optimistically update state first for immediate UI feedback
      setPreferenceState(newPreference);

      // Persist to AsyncStorage
      await AsyncStorage.setItem(THEME_PREFERENCE_KEY, newPreference);
    } catch (error) {
      console.error('Failed to save theme preference:', error);

      // Check if it's a quota exceeded error
      if (error instanceof Error && error.message.includes('QuotaExceededError')) {
        // Still keep the optimistic update - preference changes even if save fails
        console.warn('Storage quota exceeded. Theme preference not persisted.');
      }

      // Don't throw - we want to allow theme changes even if storage fails
      // The preference will revert to previous value on next app launch
    }
  };

  const value: ThemeContextValue = {
    preference,
    mode,
    colors,
    setPreference,
    isLoading,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook to access theme context
 *
 * @throws Error if used outside ThemeProvider
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { colors, mode, preference, setPreference } = useTheme();
 *
 *   return (
 *     <View style={{ backgroundColor: colors.background }}>
 *       <Text style={{ color: colors.textPrimary }}>
 *         Current theme: {mode}
 *       </Text>
 *     </View>
 *   );
 * }
 * ```
 */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);

  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }

  return context;
}
