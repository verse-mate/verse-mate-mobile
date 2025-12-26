/**
 * Signup Screen Tests
 *
 * Focused tests for signup screen functionality:
 * - Form submission flow
 * - Navigation to login
 * - Continue without account
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import Signup from '@/app/auth/signup';
import { useSignup } from '@/hooks/useSignup';

// Mock dependencies
jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    dismiss: jest.fn(),
    canGoBack: jest.fn(() => true),
  },
}));

jest.mock('@/hooks/useSignup');

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

describe('Signup Screen', () => {
  const mockSignup = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useSignup as jest.Mock).mockReturnValue({
      mutate: mockSignup,
      isPending: false,
      error: null,
      isSuccess: false,
    });
  });

  it('renders signup form with all fields', () => {
    render(<Signup />);

    expect(screen.getByText('Create Account')).toBeTruthy();
    expect(screen.getByTestId('signup-first-name')).toBeTruthy();
    expect(screen.getByTestId('signup-last-name')).toBeTruthy();
    expect(screen.getByTestId('signup-email')).toBeTruthy();
    expect(screen.getByTestId('signup-password')).toBeTruthy();
    expect(screen.getByTestId('signup-submit')).toBeTruthy();
  });

  it('submits form with valid data', async () => {
    render(<Signup />);

    // Fill in form
    fireEvent.changeText(screen.getByTestId('signup-first-name'), 'John');
    fireEvent.changeText(screen.getByTestId('signup-last-name'), 'Doe');
    fireEvent.changeText(screen.getByTestId('signup-email'), 'john@example.com');
    fireEvent.changeText(screen.getByTestId('signup-password'), 'password123');

    // Submit form
    fireEvent.press(screen.getByTestId('signup-submit'));

    await waitFor(() => {
      expect(mockSignup).toHaveBeenCalledWith({
        body: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          password: 'password123',
        },
      });
    });
  });

  it('navigates to login when login link is pressed', () => {
    render(<Signup />);

    const loginLink = screen.getByTestId('signup-login-link');
    fireEvent.press(loginLink);

    expect(router.replace).toHaveBeenCalledWith('/auth/login');
  });

  it('dismisses modal when continue without account is pressed', () => {
    render(<Signup />);

    const continueLink = screen.getByTestId('signup-continue-without-account');
    fireEvent.press(continueLink);

    expect(router.dismiss).toHaveBeenCalled();
  });

  it('disables submit button when form is invalid', () => {
    render(<Signup />);

    const submitButton = screen.getByTestId('signup-submit');

    // Initially disabled (empty form)
    expect(submitButton.props.accessibilityState.disabled).toBe(true);

    // Fill in partial form (still invalid)
    fireEvent.changeText(screen.getByTestId('signup-first-name'), 'John');
    fireEvent.changeText(screen.getByTestId('signup-email'), 'john@example.com');

    // Should still be disabled
    expect(submitButton.props.accessibilityState.disabled).toBe(true);
  });
});
