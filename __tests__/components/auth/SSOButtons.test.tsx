/**
 * Tests for SSOButtons component
 *
 * @see Task Group 4: SSO Buttons Component
 */

import { fireEvent, render, screen } from '@testing-library/react-native';
import type React from 'react';
import { Platform, View } from 'react-native';

import { SSOButtons } from '@/components/auth/SSOButtons';
import { isAppleSignInEnabled } from '@/hooks/auth/useAppleSignIn';
import { isGoogleSignInConfigured } from '@/hooks/auth/useGoogleSignIn';

// Mock the hooks
jest.mock('@/hooks/auth/useGoogleSignIn', () => ({
  isGoogleSignInConfigured: jest.fn(),
}));

jest.mock('@/hooks/auth/useAppleSignIn', () => ({
  isAppleSignInEnabled: jest.fn(),
}));

// Mock ThemeContext
jest.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      background: '#ffffff',
      backgroundElevated: '#f5f5f5',
      textPrimary: '#1a1a1a',
      textSecondary: '#666666',
      error: '#f44336',
      border: '#cccccc',
      divider: '#e0e0e0',
    },
  }),
}));

const mockIsGoogleConfigured = isGoogleSignInConfigured as jest.Mock;
const mockIsAppleEnabled = isAppleSignInEnabled as jest.Mock;

// Wrapper component to test null rendering
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <View testID="test-wrapper">{children}</View>
);

describe('SSOButtons', () => {
  const originalPlatformOS = Platform.OS;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(Platform, 'OS', { value: 'ios', writable: true });
  });

  afterAll(() => {
    Object.defineProperty(Platform, 'OS', { value: originalPlatformOS, writable: true });
  });

  describe('graceful degradation', () => {
    it('returns null when no SSO providers are configured', () => {
      mockIsGoogleConfigured.mockReturnValue(false);
      mockIsAppleEnabled.mockReturnValue(false);

      const { queryByTestId } = render(
        <TestWrapper>
          <SSOButtons />
        </TestWrapper>
      );

      // Component should return null, so no SSO buttons or divider
      expect(queryByTestId('sso-google-button')).toBeNull();
      expect(queryByTestId('sso-apple-button')).toBeNull();
      expect(screen.queryByText('or')).toBeNull();
    });

    it('renders Google button when EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is set', () => {
      mockIsGoogleConfigured.mockReturnValue(true);
      mockIsAppleEnabled.mockReturnValue(false);

      render(<SSOButtons />);

      expect(screen.getByTestId('sso-google-button')).toBeTruthy();
      expect(screen.queryByTestId('sso-apple-button')).toBeNull();
    });

    it('renders Apple button on iOS when enabled', () => {
      mockIsGoogleConfigured.mockReturnValue(false);
      mockIsAppleEnabled.mockReturnValue(true);
      Object.defineProperty(Platform, 'OS', { value: 'ios', writable: true });

      render(<SSOButtons />);

      expect(screen.getByTestId('sso-apple-button')).toBeTruthy();
      expect(screen.queryByTestId('sso-google-button')).toBeNull();
    });

    it('does not render Apple button on Android', () => {
      mockIsGoogleConfigured.mockReturnValue(true);
      mockIsAppleEnabled.mockReturnValue(true);
      Object.defineProperty(Platform, 'OS', { value: 'android', writable: true });

      render(<SSOButtons />);

      expect(screen.getByTestId('sso-google-button')).toBeTruthy();
      expect(screen.queryByTestId('sso-apple-button')).toBeNull();
    });

    it('renders both buttons on iOS when both configured', () => {
      mockIsGoogleConfigured.mockReturnValue(true);
      mockIsAppleEnabled.mockReturnValue(true);
      Object.defineProperty(Platform, 'OS', { value: 'ios', writable: true });

      render(<SSOButtons />);

      expect(screen.getByTestId('sso-google-button')).toBeTruthy();
      expect(screen.getByTestId('sso-apple-button')).toBeTruthy();
    });
  });

  describe('button callbacks', () => {
    it('triggers onGooglePress callback when Google button is pressed', () => {
      mockIsGoogleConfigured.mockReturnValue(true);
      mockIsAppleEnabled.mockReturnValue(false);

      const onGooglePress = jest.fn();
      render(<SSOButtons onGooglePress={onGooglePress} />);

      fireEvent.press(screen.getByTestId('sso-google-button'));

      expect(onGooglePress).toHaveBeenCalledTimes(1);
    });

    it('triggers onApplePress callback when Apple button is pressed', () => {
      mockIsGoogleConfigured.mockReturnValue(false);
      mockIsAppleEnabled.mockReturnValue(true);
      Object.defineProperty(Platform, 'OS', { value: 'ios', writable: true });

      const onApplePress = jest.fn();
      render(<SSOButtons onApplePress={onApplePress} />);

      fireEvent.press(screen.getByTestId('sso-apple-button'));

      expect(onApplePress).toHaveBeenCalledTimes(1);
    });
  });

  describe('loading states', () => {
    it('disables buttons and shows loading text when Google is loading', () => {
      mockIsGoogleConfigured.mockReturnValue(true);
      mockIsAppleEnabled.mockReturnValue(true);
      Object.defineProperty(Platform, 'OS', { value: 'ios', writable: true });

      render(<SSOButtons isGoogleLoading={true} />);

      const googleButton = screen.getByTestId('sso-google-button');
      expect(googleButton.props.accessibilityState.disabled).toBe(true);
      expect(screen.getByText('Signing in with Google...')).toBeTruthy();
    });

    it('disables buttons when Apple is loading', () => {
      mockIsGoogleConfigured.mockReturnValue(true);
      mockIsAppleEnabled.mockReturnValue(true);
      Object.defineProperty(Platform, 'OS', { value: 'ios', writable: true });

      render(<SSOButtons isAppleLoading={true} />);

      const appleButton = screen.getByTestId('sso-apple-button');
      expect(appleButton.props.accessibilityState.disabled).toBe(true);
      expect(screen.getByText('Signing in with Apple...')).toBeTruthy();
    });
  });

  describe('error display', () => {
    it('renders error message when error prop is provided', () => {
      mockIsGoogleConfigured.mockReturnValue(true);
      mockIsAppleEnabled.mockReturnValue(false);

      render(<SSOButtons error="SSO failed" />);

      expect(screen.getByText('SSO failed')).toBeTruthy();
    });

    it('does not render error container when error is null', () => {
      mockIsGoogleConfigured.mockReturnValue(true);
      mockIsAppleEnabled.mockReturnValue(false);

      render(<SSOButtons error={null} />);

      expect(screen.queryByText('SSO failed')).toBeNull();
    });
  });

  describe('divider', () => {
    it('renders "or" divider when buttons are shown', () => {
      mockIsGoogleConfigured.mockReturnValue(true);
      mockIsAppleEnabled.mockReturnValue(false);

      render(<SSOButtons />);

      expect(screen.getByText('or')).toBeTruthy();
    });
  });
});
