import '@testing-library/jest-native/extend-expect';
import i18next from 'i18next';
import type { ReactNode } from 'react';
import { initReactI18next } from 'react-i18next';
import { FormData, fetch, Headers, Request, Response } from 'undici';
import { resetPostHogMock } from './__tests__/mocks/posthog-mock';
import { server } from './__tests__/mocks/server';
import en from './locales/en.json';

// Initialize i18next synchronously for tests so `useTranslation()` resolves keys
// to English strings. Without this, `t('settings.title')` returns the literal
// key and every getByText/i18n assertion fails. Mirrors lib/i18n/index.ts but
// avoids expo-localization (RN-only, breaks under jest-expo node env).
if (!i18next.isInitialized) {
  i18next.use(initReactI18next).init({
    resources: { en: { translation: en } },
    lng: 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
    returnNull: false,
    returnEmptyString: false,
  });
}

// Worklets 0.10 resolves to its .native files under jest-expo and installs the
// native module at import, which jest does not have, so every suite importing
// Reanimated crashed (`loadUnpackers` of undefined). Its shipped mock is the JS
// implementation it documents for tests.
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));

// Reanimated 4.7's native entry (which jest-expo resolves) registers a CSS event handler at import,
// and its JS fallback throws on that under jest, so every suite importing Reanimated failed to run.
// Its own jest mock is the documented replacement.
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

// jest-expo 58 mocks the `react-native/asset-registry` entry point, but RN 0.88's AssetRegistry
// (what expo-asset and expo-font read) is the private module behind it, so the mock never applied
// and every icon font threw `Module "1" is missing from the asset registry`. Mock that module with
// the same stub jest-expo uses; every asset require is `1` under jest-expo's transformer.
jest.mock('react-native/src/private/assets/AssetRegistry', () => {
  const asset = {
    fileSystemLocation: '/full/path/to/directory',
    httpServerLocation: '/assets/full/path/to/directory',
    scales: [1],
    fileHashes: ['md5'],
    name: 'name',
    exists: true,
    type: 'type',
    hash: 'md5',
    uri: 'uri',
    width: 1,
    height: 1,
  };
  return {
    __esModule: true,
    AssetRegistry: { registerAsset: jest.fn(() => 1), getAssetByID: jest.fn(() => asset) },
  };
});

// The fold probe is a native view; jest has no display, so it reports no regions.
jest.mock('react-native-reserved-regions', () => ({
  // __esModule keeps `import * as` on this object, so a test can jest.spyOn a hook.
  __esModule: true,
  ReservedRegionsProvider: ({ children }: { children: ReactNode }) => children,
  ReservedRegionsGate: ({ children }: { children: ReactNode }) => children,
  useReservedRegions: () => [],
  useReservedRegionsReady: () => true,
}));

// Mock toast context — no-op showToast/hideToast so hooks calling useToast() in
// tests don't blow up on the "must be within ToastProvider" guard.
jest.mock('@/contexts/ToastContext', () => ({
  useToast: () => ({
    showToast: jest.fn(),
    hideToast: jest.fn(),
  }),
  ToastProvider: ({ children }: { children: ReactNode }) => children,
}));

// Mock offline context to avoid SQLite initialization in tests
jest.mock('@/contexts/OfflineContext', () => ({
  useOfflineContext: () => ({
    isAutoSyncEnabled: false,
    setAutoSyncEnabled: jest.fn(),
    isInitialized: true,
    isOnline: true,
    manifest: null,
    downloadedBibleVersions: [],
    downloadedCommentaryLanguages: [],
    downloadedTopicLanguages: [],
    bibleVersionsInfo: [],
    commentaryInfo: [],
    topicsInfo: [],
    languageBundles: [],
    isUserDataSynced: false,
    isSyncing: false,
    syncProgress: null,
    lastSyncTime: null,
    totalStorageUsed: 0,
    refreshManifest: jest.fn(),
    downloadBibleVersion: jest.fn(),
    downloadCommentaries: jest.fn(),
    downloadTopics: jest.fn(),
    deleteBibleVersion: jest.fn(),
    deleteCommentaries: jest.fn(),
    deleteTopics: jest.fn(),
    deleteAllData: jest.fn(),
    checkForUpdates: jest.fn(),
    downloadLanguage: jest.fn(),
    deleteLanguage: jest.fn(),
    syncUserData: jest.fn(),
  }),
  OfflineProvider: ({ children }: { children: ReactNode }) => children,
}));

// Mock react-native-webview — its native module (RNCWebViewModule) isn't
// registered in the Jest test binary, so importing the real package throws
// at module-load time. Rendering as a plain View keeps trees intact for any
// test that touches the BibleProject inline-video card.
jest.mock('react-native-webview', () => {
  const { View } = require('react-native');
  return { WebView: View };
});

// Mock expo-screen-orientation — these are no-op promises in tests since
// orientation changes don't happen in jsdom. The methods are called from
// VisualsPanel when the lightbox opens/closes.
jest.mock('expo-screen-orientation', () => ({
  OrientationLock: { PORTRAIT_UP: 1, ALL: 0 },
  lockAsync: jest.fn(() => Promise.resolve()),
  unlockAsync: jest.fn(() => Promise.resolve()),
}));

// Mock @versemate/studies to keep tests off the dynamic-import code-split path.
// The real package does `await import(...)` per chapter to keep bundles small,
// but jest's CJS environment errors with "dynamic import callback was invoked
// without --experimental-vm-modules". Tests that need real study content (e.g.
// StudyPanel.test.tsx) override this with their own jest.mock.
jest.mock('@versemate/studies', () => ({
  getStudyFor: jest.fn().mockResolvedValue(null),
}));

// Mock device info to avoid AsyncStorage and Dimensions listeners in tests
jest.mock('@/hooks/use-device-info', () => ({
  useDeviceInfo: () => ({
    isTablet: false,
    isLandscape: false,
    screenWidth: 390,
    screenHeight: 844,
    smallerDimension: 390,
    largerDimension: 844,
    useSplitView: false,
    splitRatio: 0.5,
    setSplitRatio: jest.fn(),
    isLoaded: true,
  }),
  useOrientation: () => ({ isLandscape: false, isPortrait: true }),
}));

// Polyfill fetch for Node.js environment (required for MSW v2)
// biome-ignore lint/suspicious/noExplicitAny: Required for polyfilling global fetch types
global.fetch = fetch as any;
// biome-ignore lint/suspicious/noExplicitAny: Required for polyfilling global FormData types
global.FormData = FormData as any;
// biome-ignore lint/suspicious/noExplicitAny: Required for polyfilling global Headers types
global.Headers = Headers as any;
// biome-ignore lint/suspicious/noExplicitAny: Required for polyfilling global Request types
global.Request = Request as any;
// biome-ignore lint/suspicious/noExplicitAny: Required for polyfilling global Response types
global.Response = Response as any;

// Polyfill import.meta for Expo winter runtime without overwriting existing globals
// biome-ignore lint/suspicious/noExplicitAny: Required for accessing global import.meta
const g: any = global as any;
g.import = g.import ?? {};
g.import.meta = g.import.meta ?? {};
g.import.meta.url = g.import.meta.url ?? '';
g.import.meta.resolve = g.import.meta.resolve ?? ((specifier: string) => specifier);

// Store original console methods to restore after tests
let originalError: typeof console.error;
let originalWarn: typeof console.warn;

beforeAll(() => {
  // Start MSW server
  server.listen({ onUnhandledRequest: 'error' });

  // Store original console methods
  originalError = console.error;
  originalWarn = console.warn;

  // Create filtered console methods
  // biome-ignore lint/suspicious/noExplicitAny: Console methods accept any arguments
  const filteredError = (...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Warning: ReactDOM.render') ||
        args[0].includes('Not implemented: HTMLFormElement.prototype.submit') ||
        args[0].includes('Failed to set up proactive refresh') ||
        args[0].includes('Failed to restore session') ||
        args[0].includes('was not wrapped in act') ||
        args[0].includes('Cannot update a component') ||
        args[0].includes('while rendering a different component'))
    ) {
      return;
    }
    originalError(...args);
  };

  // biome-ignore lint/suspicious/noExplicitAny: Console methods accept any arguments
  const filteredWarn = (...args: any[]) => {
    if (typeof args[0] === 'string' && args[0].includes('Animated: `useNativeDriver`')) {
      return;
    }
    originalWarn(...args);
  };

  console.error = filteredError as typeof console.error;
  console.warn = filteredWarn as typeof console.warn;
});

afterEach(() => {
  server.resetHandlers();
  // Reset PostHog mock to ensure test isolation
  resetPostHogMock();
  // Restore console methods after each test in case tests modify them
  console.error = originalError;
  console.warn = originalWarn;
});

afterAll(() => {
  console.error = originalError;
  console.warn = originalWarn;
  server.close();
});
