import '@testing-library/jest-native/extend-expect';
import i18next from 'i18next';
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

// Mock toast context — no-op showToast/hideToast so hooks calling useToast() in
// tests don't blow up on the "must be within ToastProvider" guard.
jest.mock('@/contexts/ToastContext', () => ({
  useToast: () => ({
    showToast: jest.fn(),
    hideToast: jest.fn(),
  }),
  ToastProvider: ({ children }: { children: React.ReactNode }) => children,
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
  OfflineProvider: ({ children }: { children: React.ReactNode }) => children,
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
