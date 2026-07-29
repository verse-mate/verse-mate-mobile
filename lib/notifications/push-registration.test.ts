/**
 * GH-281 (T-605 / R-002) — push-registration lifecycle gating.
 *
 * Guards the R-001 fix (opted-in users get prompted once on login so the
 * default-ON opt-in actually delivers) and the D-15 logout-unregister.
 * expo-notifications + push-api + storage are mocked inline (no device);
 * notification-permission runs for real against the expo-notifications mock.
 */
import * as Notifications from 'expo-notifications';
import { registerDeviceToken, unregisterDeviceToken } from './push-api';
import {
  getStoredPushToken,
  isDailyVerseNotificationEnabled,
} from './push-token-storage';
import {
  maybeRegisterOnLogin,
  unregisterPushOnLogout,
} from './push-registration';

jest.mock('./push-api', () => ({
  registerDeviceToken: jest.fn().mockResolvedValue(true),
  unregisterDeviceToken: jest.fn().mockResolvedValue(true),
  syncPreferredBibleVersion: jest.fn().mockResolvedValue(true),
}));

jest.mock('./push-token-storage', () => ({
  isDailyVerseNotificationEnabled: jest.fn(),
  getStoredPushToken: jest.fn(),
  setStoredPushToken: jest.fn().mockResolvedValue(undefined),
  clearStoredPushToken: jest.fn().mockResolvedValue(undefined),
  setDailyVerseNotificationEnabled: jest.fn().mockResolvedValue(undefined),
}));

// Inline factory (must not reference outer vars — jest.mock is hoisted).
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest
    .fn()
    .mockResolvedValue({ data: 'ExponentPushToken[test]' }),
  setNotificationChannelAsync: jest.fn().mockResolvedValue(undefined),
  AndroidImportance: { DEFAULT: 3 },
  IosAuthorizationStatus: { AUTHORIZED: 2, PROVISIONAL: 3, EPHEMERAL: 4 },
  PermissionStatus: {
    GRANTED: 'granted',
    DENIED: 'denied',
    UNDETERMINED: 'undetermined',
  },
}));
jest.mock('@/lib/analytics', () => ({
  analytics: { track: jest.fn() },
  AnalyticsEvent: {
    NOTIFICATION_PERMISSION_DENIED: 'NOTIFICATION_PERMISSION_DENIED',
  },
}));

const mockGetPerms = Notifications.getPermissionsAsync as jest.Mock;
const mockReqPerms = Notifications.requestPermissionsAsync as jest.Mock;
const mockIsEnabled = isDailyVerseNotificationEnabled as jest.Mock;
const mockRegister = registerDeviceToken as jest.Mock;
const mockUnregister = unregisterDeviceToken as jest.Mock;
const mockGetStoredToken = getStoredPushToken as jest.Mock;

const granted = { granted: true, status: 'granted', ios: { status: 2 } };
const undetermined = {
  granted: false,
  status: 'undetermined',
  ios: { status: 0 },
};
const denied = { granted: false, status: 'denied', ios: { status: 1 } };

beforeEach(() => {
  jest.clearAllMocks();
});

describe('maybeRegisterOnLogin', () => {
  it('does nothing when the user has opted out', async () => {
    mockIsEnabled.mockResolvedValue(false);
    await maybeRegisterOnLogin();
    expect(mockGetPerms).not.toHaveBeenCalled();
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('registers without prompting when permission is already granted', async () => {
    mockIsEnabled.mockResolvedValue(true);
    mockGetPerms.mockResolvedValue(granted);
    await maybeRegisterOnLogin();
    expect(mockReqPerms).not.toHaveBeenCalled();
    expect(mockRegister).toHaveBeenCalledTimes(1);
  });

  it('prompts once when permission is undetermined, then registers if granted (R-001)', async () => {
    mockIsEnabled.mockResolvedValue(true);
    mockGetPerms.mockResolvedValue(undetermined);
    mockReqPerms.mockResolvedValue(granted);
    await maybeRegisterOnLogin();
    expect(mockReqPerms).toHaveBeenCalledTimes(1);
    expect(mockRegister).toHaveBeenCalledTimes(1);
  });

  it('prompts but does not register when the user declines', async () => {
    mockIsEnabled.mockResolvedValue(true);
    mockGetPerms.mockResolvedValue(undetermined);
    mockReqPerms.mockResolvedValue(denied);
    await maybeRegisterOnLogin();
    expect(mockReqPerms).toHaveBeenCalledTimes(1);
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('does not prompt when permission was previously denied', async () => {
    mockIsEnabled.mockResolvedValue(true);
    mockGetPerms.mockResolvedValue(denied);
    await maybeRegisterOnLogin();
    expect(mockReqPerms).not.toHaveBeenCalled();
    expect(mockRegister).not.toHaveBeenCalled();
  });
});

describe('unregisterPushOnLogout (D-15)', () => {
  it('unregisters the stored token', async () => {
    mockGetStoredToken.mockResolvedValue('ExponentPushToken[test]');
    await unregisterPushOnLogout();
    expect(mockUnregister).toHaveBeenCalledWith('ExponentPushToken[test]');
  });

  it('no-ops when there is no stored token', async () => {
    mockGetStoredToken.mockResolvedValue(null);
    await unregisterPushOnLogout();
    expect(mockUnregister).not.toHaveBeenCalled();
  });
});
