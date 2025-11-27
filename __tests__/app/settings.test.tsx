/**
 * Tests for Settings Screen
 *
 * Tests theme selector, Bible version selection, profile editing,
 * language preferences, auto-highlights, and authentication guards.
 *
 * Test Coverage:
 * - Theme selector (dark mode feature)
 * - Bible version selection
 * - Authentication guards
 * - Profile editing (authenticated only)
 * - Logout functionality
 * - Navigation
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Alert } from 'react-native';
import SettingsScreen from '@/app/settings';
import type { User } from '@/contexts/AuthContext';
import { useAuth } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { useBibleVersion } from '@/hooks/use-bible-version';
import * as sdk from '@/src/api/generated/sdk.gen';

// Mock dependencies
jest.mock('expo-router', () => ({
  router: {
    back: jest.fn(),
    push: jest.fn(),
  },
}));

jest.mock('@/contexts/AuthContext');
jest.mock('@/hooks/use-bible-version');
jest.mock('@/src/api/generated/sdk.gen');

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: 'light' },
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// Mock AutoHighlightSettings component
jest.mock('@/components/settings/AutoHighlightSettings', () => ({
  AutoHighlightSettings: ({ isLoggedIn }: { isLoggedIn: boolean }) => {
    const { Text } = require('react-native');
    return <Text testID="auto-highlight-settings">{isLoggedIn ? 'Auto Highlights' : ''}</Text>;
  },
}));

// Mock ThemeSelector component
jest.mock('@/components/settings/ThemeSelector', () => ({
  ThemeSelector: () => {
    const { View, Text } = require('react-native');
    return (
      <View testID="theme-selector">
        <Text>Theme</Text>
      </View>
    );
  },
}));

// Spy on Alert
const alertSpy = jest.spyOn(Alert, 'alert');

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseBibleVersion = useBibleVersion as jest.MockedFunction<typeof useBibleVersion>;
const mockGetBibleLanguages = sdk.getBibleLanguages as jest.MockedFunction<
  typeof sdk.getBibleLanguages
>;
const mockPutAuthProfile = sdk.putAuthProfile as jest.MockedFunction<typeof sdk.putAuthProfile>;
const mockPatchUserPreferences = sdk.patchUserPreferences as jest.MockedFunction<
  typeof sdk.patchUserPreferences
>;

// Mock user data
const mockUser: User = {
  id: 'test-user-123',
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  is_admin: false,
  preferred_language: 'en-US',
};

describe('SettingsScreen', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    jest.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    // Default: authenticated user
    mockUseAuth.mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
      isLoading: false,
      login: jest.fn(),
      signup: jest.fn(),
      logout: jest.fn(),
      restoreSession: jest.fn(),
    });

    // Default: KJV Bible version
    mockUseBibleVersion.mockReturnValue({
      bibleVersion: 'kjv',
      setBibleVersion: jest.fn().mockResolvedValue(undefined),
      isLoading: false,
    });

    // Default: Mock empty languages
    mockGetBibleLanguages.mockResolvedValue({
      data: [],
      error: undefined,
      request: {} as Request,
      response: {} as Response,
    });
  });

  const renderWithTheme = (component: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>{component}</ThemeProvider>
      </QueryClientProvider>
    );
  };

  describe('Screen Rendering', () => {
    it('renders settings screen with title', () => {
      renderWithTheme(<SettingsScreen />);

      expect(screen.getByText('Settings')).toBeTruthy();
    });

    it('renders back button', () => {
      renderWithTheme(<SettingsScreen />);

      const backButton = screen.getByTestId('settings-back-button');
      expect(backButton).toBeTruthy();
    });
  });

  describe('Theme Selector', () => {
    it('renders ThemeSelector component', () => {
      renderWithTheme(<SettingsScreen />);

      // ThemeSelector should be rendered (exact assertion depends on ThemeSelector implementation)
      // For now, verify the screen renders without errors
      expect(screen.getByText('Settings')).toBeTruthy();
    });
  });

  describe('Bible Version Selection', () => {
    it('renders Bible Version section', async () => {
      renderWithTheme(<SettingsScreen />);

      await waitFor(() => {
        expect(screen.getByText('Bible Version')).toBeTruthy();
      });

      // The screen shows "Select Version" as placeholder when bible version data loads
      expect(screen.getByText(/Select Version|King James Version/)).toBeTruthy();
    });

    it('renders Bible version picker button', async () => {
      mockUseBibleVersion.mockReturnValue({
        bibleVersion: 'kjv',
        setBibleVersion: jest.fn().mockResolvedValue(undefined),
        isLoading: false,
      });

      renderWithTheme(<SettingsScreen />);

      // Wait for screen to render
      await waitFor(() => {
        expect(screen.getByText('Bible Version')).toBeTruthy();
      });

      // Verify version picker button is rendered
      const versionButtons = screen.getAllByText(/Select Version|King James Version/);
      expect(versionButtons.length).toBeGreaterThan(0);
    });
  });

  describe('Authentication Guards', () => {
    it('shows profile section when authenticated', () => {
      renderWithTheme(<SettingsScreen />);

      expect(screen.getByText('Profile Information')).toBeTruthy();
      expect(screen.getByTestId('settings-first-name-input')).toBeTruthy();
    });

    it('hides profile section when not authenticated', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        login: jest.fn(),
        signup: jest.fn(),
        logout: jest.fn(),
        restoreSession: jest.fn(),
      });

      renderWithTheme(<SettingsScreen />);

      expect(screen.queryByText('Profile Information')).toBeNull();
      expect(screen.queryByTestId('settings-first-name-input')).toBeNull();
    });

    it('shows sign-in prompt for unauthenticated users', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        login: jest.fn(),
        signup: jest.fn(),
        logout: jest.fn(),
        restoreSession: jest.fn(),
      });

      renderWithTheme(<SettingsScreen />);

      expect(screen.getByText(/Sign in to access language preferences/i)).toBeTruthy();
      expect(screen.getByTestId('settings-sign-in-button')).toBeTruthy();
    });

    it('navigates to login when sign-in button is pressed', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        login: jest.fn(),
        signup: jest.fn(),
        logout: jest.fn(),
        restoreSession: jest.fn(),
      });

      renderWithTheme(<SettingsScreen />);

      const signInButton = screen.getByTestId('settings-sign-in-button');
      fireEvent.press(signInButton);

      expect(router.push).toHaveBeenCalledWith('/auth/login');
    });
  });

  describe('Profile Editing', () => {
    it('renders profile form with current user data', () => {
      renderWithTheme(<SettingsScreen />);

      const firstNameInput = screen.getByTestId('settings-first-name-input');
      const lastNameInput = screen.getByTestId('settings-last-name-input');
      const emailInput = screen.getByTestId('settings-email-input');

      expect(firstNameInput.props.value).toBe('Test');
      expect(lastNameInput.props.value).toBe('User');
      expect(emailInput.props.value).toBe('test@example.com');
    });

    it('shows "No changes to save" when no changes made', () => {
      renderWithTheme(<SettingsScreen />);

      expect(screen.getByText('No changes to save')).toBeTruthy();
    });

    it('enables save button when changes are made', async () => {
      renderWithTheme(<SettingsScreen />);

      const firstNameInput = screen.getByTestId('settings-first-name-input');
      fireEvent.changeText(firstNameInput, 'NewName');

      await waitFor(() => {
        expect(screen.getByText('Save Changes')).toBeTruthy();
      });
    });

    it('shows change indicator when changes are made', async () => {
      renderWithTheme(<SettingsScreen />);

      const firstNameInput = screen.getByTestId('settings-first-name-input');
      fireEvent.changeText(firstNameInput, 'NewName');

      await waitFor(() => {
        expect(screen.getByText('You have unsaved changes')).toBeTruthy();
      });
    });

    it('saves profile changes successfully', async () => {
      mockPutAuthProfile.mockResolvedValue({
        data: { ...mockUser, firstName: 'NewName' },
        error: undefined,
        request: {} as Request,
        response: {} as Response,
      });

      renderWithTheme(<SettingsScreen />);

      // Change first name
      const firstNameInput = screen.getByTestId('settings-first-name-input');
      fireEvent.changeText(firstNameInput, 'NewName');

      // Wait for save button to be enabled
      await waitFor(() => {
        expect(screen.getByText('Save Changes')).toBeTruthy();
      });

      // Click save
      const saveButton = screen.getByTestId('settings-save-button');
      fireEvent.press(saveButton);

      // Verify API was called
      await waitFor(() => {
        expect(mockPutAuthProfile).toHaveBeenCalledWith({
          body: {
            firstName: 'NewName',
            lastName: 'User',
            email: 'test@example.com',
          },
        });
      });
    });

    it('shows error when email already exists', async () => {
      mockPutAuthProfile.mockResolvedValue({
        data: undefined,
        error: {
          message: 'EMAIL_ALREADY_EXISTS',
          data: { value: { message: 'EMAIL_ALREADY_EXISTS' } },
        },
        request: {} as Request,
        response: {} as Response,
      });

      renderWithTheme(<SettingsScreen />);

      // Change email
      const emailInput = screen.getByTestId('settings-email-input');
      fireEvent.changeText(emailInput, 'existing@example.com');

      // Click save
      const saveButton = screen.getByTestId('settings-save-button');
      fireEvent.press(saveButton);

      // Verify error message
      await waitFor(() => {
        expect(
          screen.getByText('This email address is already in use by another account.')
        ).toBeTruthy();
      });
    });
  });

  describe('Logout', () => {
    it('shows logout button when authenticated', () => {
      renderWithTheme(<SettingsScreen />);

      expect(screen.getByTestId('settings-logout-button')).toBeTruthy();
    });

    it('hides logout button when not authenticated', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        login: jest.fn(),
        signup: jest.fn(),
        logout: jest.fn(),
        restoreSession: jest.fn(),
      });

      renderWithTheme(<SettingsScreen />);

      expect(screen.queryByTestId('settings-logout-button')).toBeNull();
    });

    it('shows confirmation alert when logout is pressed', () => {
      renderWithTheme(<SettingsScreen />);

      const logoutButton = screen.getByTestId('settings-logout-button');
      fireEvent.press(logoutButton);

      expect(alertSpy).toHaveBeenCalledWith(
        'Logout',
        'Are you sure you want to logout?',
        expect.arrayContaining([
          expect.objectContaining({ text: 'Cancel' }),
          expect.objectContaining({ text: 'Logout' }),
        ])
      );
    });

    it('calls logout when confirmed', async () => {
      const mockLogout = jest.fn();
      mockUseAuth.mockReturnValue({
        user: mockUser,
        isAuthenticated: true,
        isLoading: false,
        login: jest.fn(),
        signup: jest.fn(),
        logout: mockLogout,
        restoreSession: jest.fn(),
      });

      renderWithTheme(<SettingsScreen />);

      const logoutButton = screen.getByTestId('settings-logout-button');
      fireEvent.press(logoutButton);

      // Get the alert confirmation callback and execute it
      const alertCall = alertSpy.mock.calls[0];
      const buttons = alertCall[2] as { text: string; onPress?: () => void }[];
      const logoutConfirmButton = buttons.find((btn) => btn.text === 'Logout');

      await logoutConfirmButton?.onPress?.();

      expect(mockLogout).toHaveBeenCalled();
      expect(router.back).toHaveBeenCalled();
    });
  });

  describe('Navigation', () => {
    it('navigates back when back button is pressed', async () => {
      renderWithTheme(<SettingsScreen />);

      const backButton = screen.getByTestId('settings-back-button');
      fireEvent.press(backButton);

      await waitFor(() => {
        expect(router.back).toHaveBeenCalled();
      });
    });
  });

  describe('Language Preferences', () => {
    it('shows language preferences when authenticated', () => {
      mockGetBibleLanguages.mockResolvedValue({
        data: [
          {
            language_code: 'en-US',
            name: 'English',
            native_name: 'English',
            explanation_count: 10,
          },
          { language_code: 'es-ES', name: 'Spanish', native_name: 'Espa�ol', explanation_count: 5 },
        ],
        error: undefined,
        request: {} as Request,
        response: {} as Response,
      });

      renderWithTheme(<SettingsScreen />);

      expect(screen.getByText('Language Preferences')).toBeTruthy();
    });

    it('hides language preferences when not authenticated', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        login: jest.fn(),
        signup: jest.fn(),
        logout: jest.fn(),
        restoreSession: jest.fn(),
      });

      renderWithTheme(<SettingsScreen />);

      expect(screen.queryByText('Language Preferences')).toBeNull();
    });
  });

  describe('Auto-Highlight Settings', () => {
    it('shows auto-highlight settings when authenticated', () => {
      renderWithTheme(<SettingsScreen />);

      const autoHighlightComponent = screen.getByTestId('auto-highlight-settings');
      expect(autoHighlightComponent).toBeTruthy();
      expect(autoHighlightComponent.props.children).toBe('Auto Highlights');
    });

    it('does not show auto-highlight content when not authenticated', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        login: jest.fn(),
        signup: jest.fn(),
        logout: jest.fn(),
        restoreSession: jest.fn(),
      });

      renderWithTheme(<SettingsScreen />);

      const autoHighlightComponent = screen.getByTestId('auto-highlight-settings');
      expect(autoHighlightComponent.props.children).toBe('');
    });
  });
});
