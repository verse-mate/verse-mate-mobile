/**
 * usePushNotifications on web.
 *
 * Guards the crash that made the web build render a blank page from 2026-07-20:
 * `Notifications.useLastNotificationResponse()` is unavailable on web and
 * throws, and because the hook is mounted in the root layout the throw took the
 * whole tree down with it.
 *
 * Two assertions, for two different failure modes:
 *
 * 1. The web implementation must not reach for the notifications API at all.
 *    This loads `use-push-notifications.web` by its explicit path, because
 *    jest-expo resolves the native platform and would otherwise hand back the
 *    native file. It is the exact module the web bundle loads.
 * 2. The native implementation is expected to reach for it. Asserting that is
 *    what stops someone "simplifying" the split away: if the native hook ever
 *    stops needing the platform variant, this test says so rather than leaving
 *    a dead file behind.
 *
 * The end-to-end proof is a browser rendering a chapter; Jest cannot load
 * expo-notifications' web shim, so the shim's behaviour is reproduced here.
 */

import { renderHook } from '@testing-library/react-native';

const mockUseLastNotificationResponse = jest.fn(() => {
  const error = new Error(
    'The method or property ExpoNotifications.getLastNotificationResponse is not available on web, are you sure you have linked all the native dependencies properly?'
  );
  (error as Error & { code: string }).code = 'ERR_UNAVAILABLE';
  throw error;
});

jest.mock('expo-notifications', () => ({
  useLastNotificationResponse: () => mockUseLastNotificationResponse(),
  setNotificationHandler: jest.fn(),
  DEFAULT_ACTION_IDENTIFIER: 'expo.modules.notifications.actions.DEFAULT',
}));

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn() },
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}));

jest.mock('@/lib/notifications/push-registration', () => ({
  maybeRegisterOnLogin: jest.fn(),
}));

describe('usePushNotifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('the web implementation never reaches for the notification-response API', () => {
    const { usePushNotifications } = require('@/hooks/use-push-notifications.web');

    expect(() => renderHook(() => usePushNotifications())).not.toThrow();
    expect(mockUseLastNotificationResponse).not.toHaveBeenCalled();
  });

  it('the native implementation does reach for it, which is why the split exists', () => {
    const { usePushNotifications } = require('@/hooks/use-push-notifications');

    // Throws here only because the mock above impersonates the web shim. On a
    // device the call succeeds; the point is that the native file calls it.
    expect(() => renderHook(() => usePushNotifications())).toThrow(/not available on web/);
    expect(mockUseLastNotificationResponse).toHaveBeenCalled();
  });
});
