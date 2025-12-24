/**
 * Login Screen Tests
 *
 * Focused tests for login screen functionality:
 * - Form submission flow
 * - Navigation to signup
 * - Continue without account
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import Login from '@/app/auth/login';
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
}));

jest.mock('@/hooks/useLogin');

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

jest.mock('@/hooks/auth/useSSOLogin', () => ({
  useSSOLogin: () => ({
    signInWithGoogle: jest.fn(),
    signInWithApple: jest.fn(),
    isGoogleLoading: false,
    isAppleLoading: false,
    error: null,
    resetError: jest.fn(),
  }),
}));

describe('Login Screen', () => {
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

  it('renders login form with all fields', () => {
    render(<Login />);

    expect(screen.getByText('Welcome back')).toBeTruthy();
    expect(screen.getByText('Login into your account')).toBeTruthy();
    expect(screen.getByTestId('login-email')).toBeTruthy();
    expect(screen.getByTestId('login-password')).toBeTruthy();
    expect(screen.getByTestId('login-submit')).toBeTruthy();
  });

  it('submits form with valid data', async () => {
    render(<Login />);

    // Fill in form
    fireEvent.changeText(screen.getByTestId('login-email'), 'john@example.com');
    fireEvent.changeText(screen.getByTestId('login-password'), 'password123');

    // Submit form
    fireEvent.press(screen.getByTestId('login-submit'));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        body: {
          email: 'john@example.com',
          password: 'password123',
        },
      });
    });
  });

  it('navigates to signup when create account link is pressed', () => {
    render(<Login />);

    const signupLink = screen.getByTestId('login-signup-link');
    fireEvent.press(signupLink);

    expect(router.replace).toHaveBeenCalledWith('/auth/signup');
  });

  it('dismisses modal when continue without account is pressed', () => {
    render(<Login />);

    const continueLink = screen.getByTestId('login-continue-without-account');
    fireEvent.press(continueLink);

    expect(router.dismiss).toHaveBeenCalled();
  });
});
