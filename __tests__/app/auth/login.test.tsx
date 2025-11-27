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
import type React from 'react';
import Login from '@/app/auth/login';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { useLogin } from '@/hooks/useLogin';

// Mock dependencies
jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    dismiss: jest.fn(),
  },
}));

jest.mock('@/hooks/useLogin');

const renderWithTheme = (component: React.ReactElement) => {
  return render(<ThemeProvider>{component}</ThemeProvider>);
};

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
    renderWithTheme(<Login />);

    expect(screen.getByText('Welcome back')).toBeTruthy();
    expect(screen.getByText('Login into your account')).toBeTruthy();
    expect(screen.getByTestId('login-email')).toBeTruthy();
    expect(screen.getByTestId('login-password')).toBeTruthy();
    expect(screen.getByTestId('login-submit')).toBeTruthy();
  });

  it('submits form with valid data', async () => {
    renderWithTheme(<Login />);

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
    renderWithTheme(<Login />);

    const signupLink = screen.getByTestId('login-signup-link');
    fireEvent.press(signupLink);

    expect(router.replace).toHaveBeenCalledWith('/auth/signup');
  });

  it('dismisses modal when continue without account is pressed', () => {
    renderWithTheme(<Login />);

    const continueLink = screen.getByTestId('login-continue-without-account');
    fireEvent.press(continueLink);

    expect(router.dismiss).toHaveBeenCalled();
  });
});
