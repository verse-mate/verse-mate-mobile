/**
 * Tests for useAppleSignIn hook
 *
 * @see Task Group 3: Apple Sign-In Hook Implementation
 */

import { act, renderHook, waitFor } from '@testing-library/react-native';
// Import mocked modules
import * as AppleAuthentication from 'expo-apple-authentication';
import { Platform } from 'react-native';
import { isAppleSignInEnabled, useAppleSignIn } from '@/hooks/auth/useAppleSignIn';

// Mock expo-apple-authentication before imports
jest.mock('expo-apple-authentication', () => ({
  isAvailableAsync: jest.fn(),
  signInAsync: jest.fn(),
  AppleAuthenticationScope: {
    FULL_NAME: 'FULL_NAME',
    EMAIL: 'EMAIL',
  },
}));

// Mock expo-constants
jest.mock('expo-constants', () => ({
  expoConfig: {
    extra: {
      // Apple SSO enabled by default (no explicit setting)
    },
  },
}));

const mockIsAvailableAsync = AppleAuthentication.isAvailableAsync as jest.Mock;
const mockSignInAsync = AppleAuthentication.signInAsync as jest.Mock;

// Store original Platform.OS
const originalPlatformOS = Platform.OS;

describe('useAppleSignIn', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset Platform.OS to iOS for most tests
    Object.defineProperty(Platform, 'OS', { value: 'ios', writable: true });
    // Reset process.env
    process.env.EXPO_PUBLIC_APPLE_SSO_ENABLED = undefined;
  });

  afterAll(() => {
    // Restore original Platform.OS
    Object.defineProperty(Platform, 'OS', { value: originalPlatformOS, writable: true });
  });

  describe('isAppleSignInEnabled', () => {
    it('returns true on iOS by default', () => {
      expect(isAppleSignInEnabled()).toBe(true);
    });

    it('returns false on Android', () => {
      Object.defineProperty(Platform, 'OS', { value: 'android', writable: true });
      expect(isAppleSignInEnabled()).toBe(false);
    });
  });

  describe('hook initialization', () => {
    it('returns signIn function and availability state', async () => {
      mockIsAvailableAsync.mockResolvedValue(true);

      const { result } = renderHook(() => useAppleSignIn());

      expect(result.current.signIn).toBeDefined();
      expect(typeof result.current.signIn).toBe('function');
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.reset).toBeDefined();
    });

    it('checks availability on mount and sets isAvailable', async () => {
      mockIsAvailableAsync.mockResolvedValue(true);

      const { result } = renderHook(() => useAppleSignIn());

      await waitFor(() => {
        expect(result.current.isAvailable).toBe(true);
      });

      expect(mockIsAvailableAsync).toHaveBeenCalled();
    });

    it('sets isAvailable to false when Apple Auth is not available', async () => {
      mockIsAvailableAsync.mockResolvedValue(false);

      const { result } = renderHook(() => useAppleSignIn());

      await waitFor(() => {
        expect(result.current.isAvailable).toBe(false);
      });
    });
  });

  describe('signIn function', () => {
    it('returns identityToken on successful sign-in', async () => {
      mockIsAvailableAsync.mockResolvedValue(true);
      mockSignInAsync.mockResolvedValue({
        identityToken: 'mock-apple-identity-token',
        email: 'test@example.com',
        fullName: { givenName: 'Test', familyName: 'User' },
      });

      const { result } = renderHook(() => useAppleSignIn());

      await waitFor(() => {
        expect(result.current.isAvailable).toBe(true);
      });

      let token: string | null = null;
      await act(async () => {
        token = await result.current.signIn();
      });

      expect(token).toBe('mock-apple-identity-token');
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('handles user cancellation gracefully', async () => {
      mockIsAvailableAsync.mockResolvedValue(true);
      mockSignInAsync.mockRejectedValue(new Error('ERR_REQUEST_CANCELED'));

      const { result } = renderHook(() => useAppleSignIn());

      await waitFor(() => {
        expect(result.current.isAvailable).toBe(true);
      });

      let token: string | null = null;
      await act(async () => {
        token = await result.current.signIn();
      });

      // Cancellation should not set error
      expect(token).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it('handles invalid response error', async () => {
      mockIsAvailableAsync.mockResolvedValue(true);
      mockSignInAsync.mockRejectedValue(new Error('ERR_INVALID_RESPONSE'));

      const { result } = renderHook(() => useAppleSignIn());

      await waitFor(() => {
        expect(result.current.isAvailable).toBe(true);
      });

      await act(async () => {
        await result.current.signIn();
      });

      expect(result.current.error).toBe('Invalid response from Apple Sign-In');
    });

    it('sets loading state during sign-in process', async () => {
      let resolveSignIn: (value: unknown) => void;
      const signInPromise = new Promise((resolve) => {
        resolveSignIn = resolve;
      });

      mockIsAvailableAsync.mockResolvedValue(true);
      mockSignInAsync.mockReturnValue(signInPromise);

      const { result } = renderHook(() => useAppleSignIn());

      await waitFor(() => {
        expect(result.current.isAvailable).toBe(true);
      });

      // Start sign-in (don't await)
      let signInPromiseResult: Promise<string | null>;
      act(() => {
        signInPromiseResult = result.current.signIn();
      });

      // Should be loading
      expect(result.current.isLoading).toBe(true);

      // Resolve sign-in
      await act(async () => {
        resolveSignIn?.({ identityToken: 'token' });
        await signInPromiseResult;
      });

      // Should no longer be loading
      expect(result.current.isLoading).toBe(false);
    });

    it('returns error when signIn called but not available', async () => {
      mockIsAvailableAsync.mockResolvedValue(false);

      const { result } = renderHook(() => useAppleSignIn());

      await waitFor(() => {
        expect(result.current.isAvailable).toBe(false);
      });

      let token: string | null = null;
      await act(async () => {
        token = await result.current.signIn();
      });

      expect(token).toBeNull();
      expect(result.current.error).toBe('Apple Sign-In is not available');
    });
  });

  describe('reset function', () => {
    it('clears error state', async () => {
      mockIsAvailableAsync.mockResolvedValue(true);
      mockSignInAsync.mockRejectedValue(new Error('Test error'));

      const { result } = renderHook(() => useAppleSignIn());

      await waitFor(() => {
        expect(result.current.isAvailable).toBe(true);
      });

      await act(async () => {
        await result.current.signIn();
      });

      expect(result.current.error).toBe('Test error');

      act(() => {
        result.current.reset();
      });

      expect(result.current.error).toBeNull();
    });
  });
});
