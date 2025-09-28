import type React from 'react';
import '@testing-library/jest-dom';

// Mock fetch for global use
global.fetch = jest.fn() as unknown as typeof fetch;

// Mock AsyncStorage for Jest (React Native components)
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
    clear: jest.fn(() => Promise.resolve()),
    getAllKeys: jest.fn(() => Promise.resolve([])),
    multiGet: jest.fn(() => Promise.resolve([])),
    multiSet: jest.fn(() => Promise.resolve()),
    multiRemove: jest.fn(() => Promise.resolve()),
  },
}));

// Mock React Native modules for Jest
jest.mock('react-native', () => {
  const ReactNative = jest.requireActual('react-native');

  return {
    ...ReactNative,
    Dimensions: {
      get: jest.fn(() => ({ width: 375, height: 812 })),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    },
    Platform: {
      OS: 'ios',
      Version: '14.0',
      select: jest.fn((options: Record<string, unknown>) => options.ios || options.default),
    },
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
      flatten: (styles: Record<string, unknown>) => styles,
    },
  };
});

// Mock react-native-reanimated for Jest
jest.mock('react-native-reanimated', () => {
  const View = 'View';
  const Text = 'Text';
  const ScrollView = 'ScrollView';

  return {
    default: {
      View,
      Text,
      ScrollView,
      createAnimatedComponent: jest.fn((component: React.ComponentType) => component),
    },
    View,
    Text,
    ScrollView,
    useSharedValue: jest.fn((value: unknown) => ({ value })),
    useAnimatedStyle: jest.fn((_callback: () => unknown) => ({})),
    withTiming: jest.fn((value: unknown) => value),
    withRepeat: jest.fn((value: unknown) => value),
    interpolate: jest.fn(
      (_value: unknown, _inputRange: number[], outputRange: unknown[]) => outputRange[0]
    ),
    Easing: {
      bezier: jest.fn(() => jest.fn()),
      ease: jest.fn(),
      elastic: jest.fn(),
      linear: jest.fn(),
    },
    createAnimatedComponent: jest.fn((component: React.ComponentType) => component),
  };
});

// Mock expo modules for Jest
jest.mock('expo-status-bar', () => ({
  StatusBar: 'StatusBar',
  setStatusBarStyle: jest.fn(),
  setStatusBarBackgroundColor: jest.fn(),
}));

jest.mock('expo-router', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    back: jest.fn(),
    replace: jest.fn(),
  })),
  useLocalSearchParams: jest.fn(() => ({})),
  Link: 'Link',
  router: {
    push: jest.fn(),
    back: jest.fn(),
    replace: jest.fn(),
  },
}));
