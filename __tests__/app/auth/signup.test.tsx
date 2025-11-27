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
import type React from 'react';
import Signup from '@/app/auth/signup';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { useSignup } from '@/hooks/useSignup';

// Mock dependencies
jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    dismiss: jest.fn(),
  },
}));

jest.mock('@/hooks/useSignup');

const renderWithTheme = (component: React.ReactElement) => {
  return render(<ThemeProvider>{component}</ThemeProvider>);
};

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
    renderWithTheme(<Signup />);

    expect(screen.getByText('Create Account')).toBeTruthy();
    expect(screen.getByTestId('signup-first-name')).toBeTruthy();
    expect(screen.getByTestId('signup-last-name')).toBeTruthy();
    expect(screen.getByTestId('signup-email')).toBeTruthy();
    expect(screen.getByTestId('signup-password')).toBeTruthy();
    expect(screen.getByTestId('signup-submit')).toBeTruthy();
  });

  it('submits form with valid data', async () => {
    renderWithTheme(<Signup />);

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
    renderWithTheme(<Signup />);

    const loginLink = screen.getByTestId('signup-login-link');
    fireEvent.press(loginLink);

    expect(router.replace).toHaveBeenCalledWith('/auth/login');
  });

  it('dismisses modal when continue without account is pressed', () => {
    renderWithTheme(<Signup />);

    const continueLink = screen.getByTestId('signup-continue-without-account');
    fireEvent.press(continueLink);

    expect(router.dismiss).toHaveBeenCalled();
  });

  it('disables submit button when form is invalid', () => {
    renderWithTheme(<Signup />);

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
