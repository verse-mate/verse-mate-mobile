// Unmock the ThemeContext so we test the actual implementation
import AsyncStorage from '@react-native-async-storage/async-storage';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { LocationPermissionResponse } from 'expo-location';
import * as Location from 'expo-location';
import { Platform } from 'react-native';
import { act } from 'react-test-renderer';
import SunCalc, { type GetTimesResult } from 'suncalc';

import { type ThemePreference, ThemeProvider, useTheme } from '@/contexts/ThemeContext';

jest.unmock('@/contexts/ThemeContext');

// Mock dependencies
jest.mock('@react-native-async-storage/async-storage');
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));
jest.mock('expo-sensors', () => ({
  LightSensor: {
    setUpdateInterval: jest.fn(),
    addListener: jest.fn(() => ({ remove: jest.fn() })),
  },
}));
jest.mock('expo-navigation-bar', () => ({
  setBackgroundColorAsync: jest.fn(),
  setButtonStyleAsync: jest.fn(),
  setPositionAsync: jest.fn(),
}));
jest.mock('expo-system-ui', () => ({
  setBackgroundColorAsync: jest.fn(),
}));
jest.mock('suncalc');
jest.mock('react-native', () => ({
  useColorScheme: jest.fn(),
  Platform: {
    OS: 'ios',
    select: jest.fn((objs: Record<string, any>) => objs.ios),
  },
}));

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const mockLocation = Location as jest.Mocked<typeof Location>;
const mockSunCalc = SunCalc as jest.Mocked<typeof SunCalc>;
const mockUseColorScheme = require('react-native').useColorScheme as jest.MockedFunction<
  typeof import('react-native').useColorScheme
>;

describe('ThemeContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAsyncStorage.getItem.mockResolvedValue(null);
    mockAsyncStorage.setItem.mockResolvedValue(undefined);
    mockUseColorScheme.mockReturnValue('light'); // Default system scheme
    jest.useFakeTimers();
    Platform.OS = 'ios'; // Ensure Platform.OS is iOS for most tests

    // Default mock for location permissions and getting current position
    mockLocation.requestForegroundPermissionsAsync.mockResolvedValue({
      status: 'granted',
      granted: true,
      expires: 'never',
      canAskAgain: true,
      denied: false,
    } as LocationPermissionResponse);
    mockLocation.getCurrentPositionAsync.mockResolvedValue({
      coords: {
        latitude: 34.052235,
        longitude: -118.243683,
        accuracy: 5,
        altitude: 0,
        altitudeAccuracy: 5,
        heading: 0,
        speed: 0,
      },
      timestamp: Date.now(),
    });

    // Default mock for SunCalc to return fixed times for predictability
    // Using UTC to avoid timezone issues in tests
    const mockDate = new Date('2025-11-27T12:00:00.000Z');
    jest.setSystemTime(mockDate); // Set current time for tests

    mockSunCalc.getTimes.mockReturnValue({
      sunrise: new Date('2025-11-27T06:00:00.000Z'), // 6 AM UTC
      sunset: new Date('2025-11-27T18:00:00.000Z'), // 6 PM UTC
      solarNoon: new Date('2025-11-27T12:00:00.000Z'),
      goldenHourEnd: new Date('2025-11-27T07:00:00.000Z'),
      sunsetStart: new Date('2025-11-27T17:30:00.000Z'),
      dawn: new Date('2025-11-27T05:30:00.000Z'),
      dusk: new Date('2025-11-27T18:30:00.000Z'),
      nauticalDusk: new Date('2025-11-27T19:00:00.000Z'),
      nauticalDawn: new Date('2025-11-27T05:00:00.000Z'),
      nightEnd: new Date('2025-11-27T04:30:00.000Z'),
      night: new Date('2025-11-27T19:30:00.000Z'),
      goldenHour: new Date('2025-11-27T17:00:00.000Z'),
      nadir: new Date('2025-11-27T00:00:00.000Z'), // Added
      sunriseEnd: new Date('2025-11-27T06:30:00.000Z'), // Added
    } as GetTimesResult);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const createWrapper = () => {
    const Wrapper = ({ children }: { children: React.ReactNode }) => (
      <ThemeProvider>{children}</ThemeProvider>
    );
    return Wrapper;
  };

  // Test 1: Initial state and default preference
  it('should initialize with default "auto" preference and resolve to system theme', async () => {
    mockUseColorScheme.mockReturnValue('dark');
    const { result } = renderHook(() => useTheme(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.preference).toBe('auto');
    expect(result.current.mode).toBe('dark');
  });

  // Test 2: Set preference to light
  it('should set preference to "light" and update mode', async () => {
    const { result } = renderHook(() => useTheme(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.setPreference('light');
    });

    expect(result.current.preference).toBe('light');
    expect(result.current.mode).toBe('light');
    expect(mockAsyncStorage.setItem).toHaveBeenCalledWith('theme-preference', 'light');
  });

  // Test 3: Set preference to dark
  it('should set preference to "dark" and update mode', async () => {
    const { result } = renderHook(() => useTheme(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.setPreference('dark');
    });

    expect(result.current.preference).toBe('dark');
    expect(result.current.mode).toBe('dark');
    expect(mockAsyncStorage.setItem).toHaveBeenCalledWith('theme-preference', 'dark');
  });

  // Test 4: Stored preference is loaded on mount
  it('should load stored preference from AsyncStorage on mount', async () => {
    mockAsyncStorage.getItem.mockResolvedValue('dark');
    const { result } = renderHook(() => useTheme(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.preference).toBe('dark');
    expect(result.current.mode).toBe('dark');
  });

  // Test 5: 'auto' preference responds to system color scheme changes
  it('should update mode when system color scheme changes and preference is "auto"', async () => {
    mockUseColorScheme.mockReturnValue('light');
    const { result, rerender } = renderHook(() => useTheme(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.mode).toBe('light');

    act(() => {
      mockUseColorScheme.mockReturnValue('dark');
    });

    // Force re-render to pick up the new mock value
    rerender({});

    await waitFor(() => expect(result.current.mode).toBe('dark'));
  });

  // Test 6: 'sunrise_sunset' preference during the day
  it('should set mode to "light" for "sunrise_sunset" preference during the day', async () => {
    // Current time is 12 PM UTC, sunrise at 6 AM, sunset at 6 PM. So it's day.
    const { result } = renderHook(() => useTheme(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.setPreference('sunrise_sunset');
    });

    await waitFor(() => expect(mockLocation.requestForegroundPermissionsAsync).toHaveBeenCalled());
    await waitFor(() => expect(mockLocation.getCurrentPositionAsync).toHaveBeenCalled());
    await waitFor(() => expect(result.current.mode).toBe('light'));
    expect(result.current.preference).toBe('sunrise_sunset');
  });

  // Test 7: 'sunrise_sunset' preference during the night
  it('should set mode to "dark" for "sunrise_sunset" preference during the night', async () => {
    // Set current time to 8 PM UTC (after sunset)
    jest.setSystemTime(new Date('2025-11-27T20:00:00.000Z'));

    const { result } = renderHook(() => useTheme(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.setPreference('sunrise_sunset');
    });

    await waitFor(() => expect(result.current.mode).toBe('dark'));
    expect(result.current.preference).toBe('sunrise_sunset');
  });

  // Test 8: 'sunrise_sunset' handles location permission denied
  it('should handle location permission denied for "sunrise_sunset" preference', async () => {
    mockLocation.requestForegroundPermissionsAsync.mockResolvedValue({
      status: 'denied',
      granted: false,
      expires: 'never',
      canAskAgain: true,
      denied: true,
    } as LocationPermissionResponse);

    const { result } = renderHook(() => useTheme(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.setPreference('sunrise_sunset');
    });

    // It should still be 'sunrise_sunset' preference, but the mode will fallback (e.g., to 'light' as per default)
    expect(result.current.preference).toBe('sunrise_sunset');
    // Our current fallback is 'light' if coords are null, so it should be 'light'
    await waitFor(() => expect(result.current.mode).toBe('light'));
    expect(mockLocation.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  // Test 9: 'sunrise_sunset' updates mode as time passes from day to night
  it('should transition from light to dark mode with "sunrise_sunset" as time passes', async () => {
    // Start at 12 PM UTC (day)
    jest.setSystemTime(new Date('2025-11-27T12:00:00.000Z'));

    const { result } = renderHook(() => useTheme(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.setPreference('sunrise_sunset');
    });
    await waitFor(() => expect(result.current.mode).toBe('light'));

    // Advance time past sunset (e.g., to 7 PM UTC)
    act(() => {
      jest.setSystemTime(new Date('2025-11-27T19:00:00.000Z'));
      jest.runOnlyPendingTimers(); // Advance timers for the minute interval
    });

    // SunCalc needs to be re-mocked or its internal date updated if it caches
    // For now, we'll assume it re-calculates based on system time.
    // In a more complex mock, SunCalc.getTimes would return different values based on jest.getSystemTime()

    await waitFor(() => expect(result.current.mode).toBe('dark'), { timeout: 2000 }); // Increase timeout for timer dependent tests
  });

  // Test 10: 'sunrise_sunset' updates mode as time passes from night to day
  it('should transition from dark to light mode with "sunrise_sunset" as time passes', async () => {
    // Start at 2 AM UTC (night)
    jest.setSystemTime(new Date('2025-11-27T02:00:00.000Z'));

    const { result } = renderHook(() => useTheme(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.setPreference('sunrise_sunset');
    });
    await waitFor(() => expect(result.current.mode).toBe('dark'));

    // Advance time past sunrise (e.g., to 7 AM UTC)
    act(() => {
      jest.setSystemTime(new Date('2025-11-27T07:00:00.000Z'));
      jest.runOnlyPendingTimers(); // Advance timers for the minute interval
    });

    await waitFor(() => expect(result.current.mode).toBe('light'), { timeout: 2000 });
  });

  // Test 11: useTheme hook should throw error when used outside ThemeProvider
  it('should throw error when useTheme is used outside ThemeProvider', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      renderHook(() => useTheme());
    }).toThrow('useTheme must be used within a ThemeProvider');

    consoleSpy.mockRestore();
  });

  // Test 12: AsyncStorage error during save should not crash app
  it('should not crash if AsyncStorage fails to save preference', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    mockAsyncStorage.setItem.mockRejectedValue(new Error('QuotaExceededError'));

    const { result } = renderHook(() => useTheme(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.setPreference('dark');
    });

    expect(result.current.preference).toBe('dark'); // Optimistic update still happens
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to save theme preference:',
      expect.any(Error)
    );

    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  // Test 13: 'ambient' preference switches to light mode when bright
  it('should switch to light mode in "ambient" preference when environment is bright', async () => {
    Platform.OS = 'android'; // Temporarily set to Android for this test
    const { LightSensor } = require('expo-sensors');
    const { result } = renderHook(() => useTheme(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.setPreference('ambient');
    });

    expect(LightSensor.setUpdateInterval).toHaveBeenCalledWith(3000);
    expect(LightSensor.addListener).toHaveBeenCalled();

    // Get the most recent listener callback
    const calls = LightSensor.addListener.mock.calls;
    const callback = calls[calls.length - 1][0];

    act(() => {
      callback({ illuminance: 150 }); // > 100 lux -> light
    });

    await waitFor(() => expect(result.current.mode).toBe('light'));
  });

  // Test 14: 'ambient' preference switches to dark mode when dim
  it('should switch to dark mode in "ambient" preference when environment is dim', async () => {
    Platform.OS = 'android'; // Temporarily set to Android for this test
    const { LightSensor } = require('expo-sensors');
    const { result } = renderHook(() => useTheme(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.setPreference('ambient');
    });

    const calls = LightSensor.addListener.mock.calls;
    const callback = calls[calls.length - 1][0];

    act(() => {
      callback({ illuminance: 30 }); // < 50 lux -> dark
    });

    await waitFor(() => expect(result.current.mode).toBe('dark'));
  });

  // Test 15: 'ambient' preference respects hysteresis (no change in dead zone)
  it('should not change mode in "ambient" preference when light level is in hysteresis zone', async () => {
    Platform.OS = 'android'; // Temporarily set to Android for this test
    const { LightSensor } = require('expo-sensors');
    const { result } = renderHook(() => useTheme(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Start with ambient
    await act(async () => {
      await result.current.setPreference('ambient');
    });

    const calls = LightSensor.addListener.mock.calls;
    const callback = calls[calls.length - 1][0];

    // Force to dark first
    act(() => {
      callback({ illuminance: 10 });
    });
    await waitFor(() => expect(result.current.mode).toBe('dark'));

    // Update to 65 (between 50 and 80) -> should stay dark
    act(() => {
      callback({ illuminance: 65 });
    });

    // Should still be dark
    expect(result.current.mode).toBe('dark');

    // Update to 100 -> light
    act(() => {
      callback({ illuminance: 100 });
    });
    await waitFor(() => expect(result.current.mode).toBe('light'));

    // Update to 60 (between 50 and 80) -> should stay light
    act(() => {
      callback({ illuminance: 60 });
    });

    expect(result.current.mode).toBe('light');
  });

  // Test 16: Android Navigation Bar updates on theme change
  it('should update Android System UI (Background & Nav Bar) when theme changes', async () => {
    const { Platform } = require('react-native');
    const NavigationBar = require('expo-navigation-bar');
    const SystemUI = require('expo-system-ui');

    // Switch to Android for this test
    Platform.OS = 'android';

    const { result } = renderHook(() => useTheme(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Switch to dark mode
    await act(async () => {
      await result.current.setPreference('dark');
    });

    expect(SystemUI.setBackgroundColorAsync).toHaveBeenCalled(); // Check it was called with a color
    expect(NavigationBar.setButtonStyleAsync).toHaveBeenCalledWith('light');

    // Switch to light mode
    await act(async () => {
      await result.current.setPreference('light');
    });

    expect(SystemUI.setBackgroundColorAsync).toHaveBeenCalled();
    expect(NavigationBar.setButtonStyleAsync).toHaveBeenCalledWith('dark');

    // Reset Platform to ios
    Platform.OS = 'ios';
  });
});
