/**
 * Login Screen SSO Navigation Tests
 *
 * Focused tests for SSO success navigation in login screen:
 * - Navigation triggers when isSSOSuccess becomes true
 * - Navigation destination respects fromOnboarding parameter
 */

import { render, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Login from '@/app/auth/login';
import { useSSOLogin } from '@/hooks/auth/useSSOLogin';
import { useLogin } from '@/hooks/useLogin';

// Mock dependencies
jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    dismiss: jest.fn(),
    canGoBack: jest.fn(() => true),
  },
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    dismiss: jest.fn(),
    canGoBack: jest.fn(() => true),
  }),
  useLocalSearchParams: jest.fn(() => ({})),
}));

jest.mock('@/hooks/useLogin');
jest.mock('@/hooks/auth/useSSOLogin');

// Mock SSO dependencies
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn().mockResolvedValue(true),
    signIn: jest.fn().mockResolvedValue({ data: { idToken: 'mock-id-token' } }),
  },
  statusCodes: {
    SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
    IN_PROGRESS: 'IN_PROGRESS',
    PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
  },
}));

jest.mock('expo-apple-authentication', () => ({
  signInAsync: jest.fn(),
  isAvailableAsync: jest.fn().mockResolvedValue(false),
  AppleAuthenticationScope: {
    FULL_NAME: 0,
    EMAIL: 1,
  },
}));

describe('Login Screen SSO Navigation', () => {
  const mockLogin = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useLogin as jest.Mock).mockReturnValue({
      mutate: mockLogin,
      isPending: false,
      error: null,
      isSuccess: false,
    });
  });

  it('triggers navigation when isSSOSuccess becomes true (fromOnboarding=false)', async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({});

    (useSSOLogin as jest.Mock).mockReturnValue({
      signInWithGoogle: jest.fn(),
      signInWithApple: jest.fn(),
      isGoogleLoading: false,
      isAppleLoading: false,
      error: null,
      resetError: jest.fn(),
      isSuccess: true,
      resetSuccess: jest.fn(),
      isGoogleAvailable: true,
      isAppleAvailable: true,
    });

    render(<Login />);

    await waitFor(() => {
      expect(router.dismiss).toHaveBeenCalled();
    });
  });

  it('navigates to /bible/1/1 when isSSOSuccess is true and fromOnboarding=true', async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({ fromOnboarding: 'true' });

    (useSSOLogin as jest.Mock).mockReturnValue({
      signInWithGoogle: jest.fn(),
      signInWithApple: jest.fn(),
      isGoogleLoading: false,
      isAppleLoading: false,
      error: null,
      resetError: jest.fn(),
      isSuccess: true,
      resetSuccess: jest.fn(),
      isGoogleAvailable: true,
      isAppleAvailable: true,
    });

    render(<Login />);

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith('/bible/1/1');
    });
  });

  it('does not trigger navigation when isSSOSuccess is false', () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({});

    (useSSOLogin as jest.Mock).mockReturnValue({
      signInWithGoogle: jest.fn(),
      signInWithApple: jest.fn(),
      isGoogleLoading: false,
      isAppleLoading: false,
      error: null,
      resetError: jest.fn(),
      isSuccess: false,
      resetSuccess: jest.fn(),
      isGoogleAvailable: true,
      isAppleAvailable: true,
    });

    render(<Login />);

    expect(router.dismiss).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });
});
