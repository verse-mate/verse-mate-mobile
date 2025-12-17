/* eslint-disable no-undef */
// Mock import.meta and winter runtime globals for Expo
global.__ExpoImportMetaRegistry = new Map();
global.import = {
  meta: {
    url: '',
    resolve: (specifier) => specifier,
  },
};

// Mock structuredClone if not available
if (typeof global.structuredClone === 'undefined') {
  global.structuredClone = (obj) => JSON.parse(JSON.stringify(obj));
}

// Mock AsyncStorage for tests
// This provides a simple in-memory implementation for testing
jest.mock('@react-native-async-storage/async-storage', () => {
  let storage = {};
  return {
    setItem: jest.fn((key, value) => {
      storage[key] = value;
      return Promise.resolve();
    }),
    getItem: jest.fn((key) => {
      return Promise.resolve(storage[key] || null);
    }),
    removeItem: jest.fn((key) => {
      delete storage[key];
      return Promise.resolve();
    }),
    clear: jest.fn(() => {
      storage = {};
      return Promise.resolve();
    }),
    getAllKeys: jest.fn(() => {
      return Promise.resolve(Object.keys(storage));
    }),
    multiGet: jest.fn((keys) => {
      return Promise.resolve(keys.map((key) => [key, storage[key] || null]));
    }),
    multiSet: jest.fn((keyValuePairs) => {
      keyValuePairs.forEach(([key, value]) => {
        storage[key] = value;
      });
      return Promise.resolve();
    }),
    multiRemove: jest.fn((keys) => {
      keys.forEach((key) => {
        delete storage[key];
      });
      return Promise.resolve();
    }),
  };
});

// Mock react-native-gesture-handler
jest.mock('react-native-gesture-handler', () => {
  const MockView = ({ children }) => children;
  return {
    Swipeable: MockView,
    DrawerLayout: MockView,
    State: {},
    ScrollView: MockView,
    Slider: MockView,
    Switch: MockView,
    TextInput: MockView,
    ToolbarAndroid: MockView,
    ViewPagerAndroid: MockView,
    DrawerLayoutAndroid: MockView,
    WebView: MockView,
    NativeViewGestureHandler: MockView,
    TapGestureHandler: MockView,
    FlingGestureHandler: MockView,
    ForceTouchGestureHandler: MockView,
    LongPressGestureHandler: MockView,
    PanGestureHandler: MockView,
    PinchGestureHandler: MockView,
    RotationGestureHandler: MockView,
    /* Buttons */
    RawButton: MockView,
    BaseButton: MockView,
    RectButton: MockView,
    BorderlessButton: MockView,
    /* Other */
    FlatList: MockView,
    gestureHandlerRootHOC: jest.fn(),
    Directions: {},
    Gesture: {
      Pan: () => {
        const pan = {
          onEnd: jest.fn().mockReturnThis(),
          onUpdate: jest.fn().mockReturnThis(),
          onStart: jest.fn().mockReturnThis(),
          onFinalize: jest.fn().mockReturnThis(),
          minDistance: jest.fn().mockReturnThis(),
          activeOffsetY: jest.fn().mockReturnThis(),
        };
        return pan;
      },
      Native: () => {
        const native = {
          onEnd: jest.fn().mockReturnThis(),
          onUpdate: jest.fn().mockReturnThis(),
          onStart: jest.fn().mockReturnThis(),
          onFinalize: jest.fn().mockReturnThis(),
        };
        return native;
      },
      Tap: () => {
        const tap = {
          onEnd: jest.fn().mockReturnThis(),
          onUpdate: jest.fn().mockReturnThis(),
          onStart: jest.fn().mockReturnThis(),
          onFinalize: jest.fn().mockReturnThis(),
          numberOfTaps: jest.fn().mockReturnThis(),
        };
        return tap;
      },
      Exclusive: (...gestures) => {
        return { gestures };
      },
    },
    GestureDetector: MockView,
    GestureHandlerRootView: MockView,
  };
});

// Global mock for ThemeContext to avoid expo-location dependency issues in tests
// This mock provides a simple default theme that works for all components
// Note: __tests__/contexts/ThemeContext.test.tsx has its own mocks and is not affected by this
jest.mock('@/contexts/ThemeContext', () => ({
  ThemeProvider: ({ children }) => children,
  useTheme: () => ({
    preference: 'auto',
    mode: 'light',
    colors: require('@/constants/bible-design-tokens').colors.light,
    setPreference: jest.fn(),
    isLoading: false,
  }),
}));

// Mock Dictionary native module for tests
// This module uses requireNativeModule which isn't available in Jest
jest.mock('@/modules/dictionary', () => ({
  hasDefinition: jest.fn().mockResolvedValue(false),
  showDefinition: jest.fn().mockResolvedValue(false),
  isNativeDictionaryAvailable: jest.fn().mockReturnValue(false),
}));

// Global cleanup to reduce open handle issues in tests
try {
  const { cleanup } = require('@testing-library/react-native');
  afterEach(() => {
    // Ensure any mounted trees are unmounted
    cleanup();
    // Restore real timers to avoid lingering fake timers between tests
    jest.useRealTimers();
    // Flush any remaining queued timers and clear them
    try {
      jest.runOnlyPendingTimers();
      jest.clearAllTimers();
    } catch {}
  });
} catch (e) {
  // noop if library isn't available
}

// Silence RN Animated warnings and avoid native scheduling side effects
// Note: Some RN versions don't expose NativeAnimatedHelper as a resolvable module.
// If needed, mock at individual test files instead to avoid resolver errors.

// Provide a deterministic requestAnimationFrame for tests
if (typeof global.requestAnimationFrame === 'undefined') {
  global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
}
