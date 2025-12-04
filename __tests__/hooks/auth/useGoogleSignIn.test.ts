/**
 * Tests for useGoogleSignIn hook
 *
 * @see Task Group 2: Google Sign-In Hook Implementation
 */

// Import the mocked module to get references for test setup
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { isGoogleSignInConfigured, useGoogleSignIn } from '@/hooks/auth/useGoogleSignIn';

// Mock the Google Sign-In module before importing
jest.mock('@react-native-google-signin/google-signin', () => {
  const mockConfigure = jest.fn();
  const mockHasPlayServices = jest.fn();
  const mockSignIn = jest.fn();

  return {
    GoogleSignin: {
      configure: mockConfigure,
      hasPlayServices: mockHasPlayServices,
      signIn: mockSignIn,
    },
    statusCodes: {
      SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
      IN_PROGRESS: 'IN_PROGRESS',
      PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
    },
    isSuccessResponse: (response: { type: string }) => response.type === 'success',
    isErrorWithCode: (error: { code?: string }) => error && typeof error.code === 'string',
  };
});

// Mock expo-constants
jest.mock('expo-constants', () => ({
  expoConfig: {
    extra: {
      EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: 'mock-web-client-id',
      EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: 'mock-ios-client-id',
    },
  },
}));

const mockGoogleSignin = GoogleSignin as jest.Mocked<typeof GoogleSignin>;

describe('useGoogleSignIn', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isGoogleSignInConfigured', () => {
    it('returns true when EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is set', () => {
      expect(isGoogleSignInConfigured()).toBe(true);
    });
  });

  describe('hook initialization', () => {
    it('returns signIn function and loading/error states', async () => {
      const { result } = renderHook(() => useGoogleSignIn());

      await waitFor(() => {
        expect(result.current.signIn).toBeDefined();
      });

      expect(typeof result.current.signIn).toBe('function');
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.reset).toBeDefined();
    });

    it('configures GoogleSignin on mount', async () => {
      renderHook(() => useGoogleSignIn());

      await waitFor(() => {
        expect(mockGoogleSignin.configure).toHaveBeenCalledWith({
          webClientId: 'mock-web-client-id',
          iosClientId: 'mock-ios-client-id',
          offlineAccess: false,
        });
      });
    });
  });

  describe('signIn function', () => {
    it('returns idToken on successful sign-in', async () => {
      (mockGoogleSignin.hasPlayServices as jest.Mock).mockResolvedValue(true);
      (mockGoogleSignin.signIn as jest.Mock).mockResolvedValue({
        type: 'success',
        data: { idToken: 'mock-id-token-123' },
      });

      const { result } = renderHook(() => useGoogleSignIn());

      // Wait for initialization
      await waitFor(() => {
        expect(result.current.isAvailable).toBe(true);
      });

      let idToken: string | null = null;
      await act(async () => {
        idToken = await result.current.signIn();
      });

      expect(idToken).toBe('mock-id-token-123');
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('handles user cancellation gracefully without error', async () => {
      (mockGoogleSignin.hasPlayServices as jest.Mock).mockResolvedValue(true);
      (mockGoogleSignin.signIn as jest.Mock).mockRejectedValue({
        code: 'SIGN_IN_CANCELLED',
        message: 'User cancelled',
      });

      const { result } = renderHook(() => useGoogleSignIn());

      await waitFor(() => {
        expect(result.current.isAvailable).toBe(true);
      });

      let idToken: string | null = null;
      await act(async () => {
        idToken = await result.current.signIn();
      });

      // Cancellation should not set error
      expect(idToken).toBeNull();
      expect(result.current.error).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });

    it('handles play services unavailable error', async () => {
      (mockGoogleSignin.hasPlayServices as jest.Mock).mockRejectedValue({
        code: 'PLAY_SERVICES_NOT_AVAILABLE',
        message: 'Play services not available',
      });

      const { result } = renderHook(() => useGoogleSignIn());

      await waitFor(() => {
        expect(result.current.isAvailable).toBe(true);
      });

      let idToken: string | null = null;
      await act(async () => {
        idToken = await result.current.signIn();
      });

      expect(idToken).toBeNull();
      expect(result.current.error).toBe('Google Play Services not available');
    });

    it('sets loading state during sign-in process', async () => {
      let resolveSignIn: (value: unknown) => void;
      const signInPromise = new Promise((resolve) => {
        resolveSignIn = resolve;
      });

      (mockGoogleSignin.hasPlayServices as jest.Mock).mockResolvedValue(true);
      (mockGoogleSignin.signIn as jest.Mock).mockReturnValue(signInPromise);

      const { result } = renderHook(() => useGoogleSignIn());

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
        resolveSignIn!({
          type: 'success',
          data: { idToken: 'token' },
        });
        await signInPromiseResult;
      });

      // Should no longer be loading
      expect(result.current.isLoading).toBe(false);
    });

    it('handles network error', async () => {
      (mockGoogleSignin.hasPlayServices as jest.Mock).mockResolvedValue(true);
      (mockGoogleSignin.signIn as jest.Mock).mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useGoogleSignIn());

      await waitFor(() => {
        expect(result.current.isAvailable).toBe(true);
      });

      await act(async () => {
        await result.current.signIn();
      });

      expect(result.current.error).toBe('Network error');
    });
  });

  describe('reset function', () => {
    it('clears error state', async () => {
      (mockGoogleSignin.hasPlayServices as jest.Mock).mockRejectedValue(new Error('Test error'));

      const { result } = renderHook(() => useGoogleSignIn());

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
