/**
 * Tests for Settings Screen
 *
 * Tests settings functionality including Bible version selection,
 * language preferences, profile editing, and authentication states
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import SettingsScreen from '@/app/settings';
import { AuthProvider } from '@/contexts/AuthContext';

// Mock expo-router
jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    back: jest.fn(),
  },
  Stack: {
    Screen: ({ children, ...props }: any) => children,
  },
  useLocalSearchParams: jest.fn(() => ({})),
}));

// Mock useBibleVersion hook
jest.mock('@/hooks/use-bible-version', () => ({
  useBibleVersion: jest.fn(() => ({
    bibleVersion: 'NASB1995',
    setBibleVersion: jest.fn(),
    isLoading: false,
  })),
}));

// Mock safe area insets
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

function renderWithProviders(component: React.ReactElement) {
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{component}</AuthProvider>
    </QueryClientProvider>
  );
}

describe('SettingsScreen', () => {
  beforeEach(() => {
    queryClient.clear();
  });

  describe('Unauthenticated State', () => {
    it('should render unauthenticated view with sign in prompt', async () => {
      renderWithProviders(<SettingsScreen />);

      await waitFor(() => {
        expect(screen.getByText(/Sign in to access language preferences/i)).toBeTruthy();
      });

      expect(screen.getByText('Sign In')).toBeTruthy();
    });

    it('should show Bible Version section for unauthenticated users', async () => {
      renderWithProviders(<SettingsScreen />);

      await waitFor(() => {
        expect(screen.getByText('Bible Version')).toBeTruthy();
      });

      expect(screen.getByText(/New American Standard Bible 1995/i)).toBeTruthy();
    });

    it('should not show language preferences for unauthenticated users', async () => {
      renderWithProviders(<SettingsScreen />);

      await waitFor(() => {
        expect(screen.queryByText('Language Preferences')).toBeNull();
      });
    });

    it('should not show profile section for unauthenticated users', async () => {
      renderWithProviders(<SettingsScreen />);

      await waitFor(() => {
        expect(screen.queryByText('Profile Information')).toBeNull();
      });
    });

    it('should navigate to login when Sign In is pressed', async () => {
      const { router } = require('expo-router');
      const user = userEvent.setup();

      renderWithProviders(<SettingsScreen />);

      await waitFor(() => {
        expect(screen.getByText('Sign In')).toBeTruthy();
      });

      await user.press(screen.getByText('Sign In'));

      expect(router.push).toHaveBeenCalledWith('/auth/login');
    });
  });

  describe('Bible Version Selection', () => {
    it('should display selected Bible version', async () => {
      renderWithProviders(<SettingsScreen />);

      await waitFor(() => {
        expect(screen.getByText(/New American Standard Bible 1995/)).toBeTruthy();
      });
    });

    it('should toggle version picker when pressed', async () => {
      const user = userEvent.setup();
      renderWithProviders(<SettingsScreen />);

      await waitFor(() => {
        expect(screen.getByText('Bible Version')).toBeTruthy();
      });

      const versionButton = screen.getByText(/New American Standard Bible 1995/);

      // Before press, only one instance
      expect(screen.getAllByText(/New American Standard Bible 1995/).length).toBe(1);

      await user.press(versionButton);

      // After press, picker should show (now 2 instances - button + picker item)
      await waitFor(() => {
        expect(screen.getAllByText(/New American Standard Bible 1995/).length).toBeGreaterThan(1);
      });
    });

    it('should call setBibleVersion when a version is selected', async () => {
      const { useBibleVersion } = require('@/hooks/use-bible-version');
      const mockSetBibleVersion = jest.fn().mockResolvedValue(undefined);
      useBibleVersion.mockReturnValue({
        bibleVersion: 'NASB1995',
        setBibleVersion: mockSetBibleVersion,
        isLoading: false,
      });

      const user = userEvent.setup();
      renderWithProviders(<SettingsScreen />);

      await waitFor(() => {
        expect(screen.getByText('Bible Version')).toBeTruthy();
      });

      // Open picker
      const versionButton = screen.getByText(/New American Standard Bible 1995/);
      await user.press(versionButton);

      // Wait for picker to appear
      await waitFor(() => {
        expect(screen.getAllByText(/New American Standard Bible 1995/).length).toBeGreaterThan(1);
      });

      // Select same version (find the one in the picker via testID or role)
      const versionOptions = screen.getAllByText(/New American Standard Bible 1995/);
      // Press the second one (the picker item, not the button)
      await user.press(versionOptions[1]);

      await waitFor(
        () => {
          expect(mockSetBibleVersion).toHaveBeenCalledWith('NASB1995');
        },
        { timeout: 3000 }
      );
    });

    it('should show error alert if Bible version save fails', async () => {
      const { useBibleVersion } = require('@/hooks/use-bible-version');
      const mockSetBibleVersion = jest.fn().mockRejectedValue(new Error('Save failed'));
      useBibleVersion.mockReturnValue({
        bibleVersion: 'NASB1995',
        setBibleVersion: mockSetBibleVersion,
        isLoading: false,
      });

      const alertSpy = jest.spyOn(require('react-native').Alert, 'alert');
      const user = userEvent.setup();
      renderWithProviders(<SettingsScreen />);

      await waitFor(() => {
        expect(screen.getByText('Bible Version')).toBeTruthy();
      });

      // Open picker and select version
      const versionButton = screen.getByText(/New American Standard Bible 1995/);
      await user.press(versionButton);

      // Wait for picker to appear
      await waitFor(() => {
        expect(screen.getAllByText(/New American Standard Bible 1995/).length).toBeGreaterThan(1);
      });

      const versionOptions = screen.getAllByText(/New American Standard Bible 1995/);
      await user.press(versionOptions[1]);

      await waitFor(
        () => {
          expect(alertSpy).toHaveBeenCalledWith('Error', 'Failed to save Bible version selection');
        },
        { timeout: 3000 }
      );
    });
  });

  describe('Authenticated State', () => {
    beforeEach(() => {
      // Mock authenticated user
      const { useAuth } = require('@/contexts/AuthContext');
      jest.spyOn(require('@/contexts/AuthContext'), 'useAuth').mockReturnValue({
        user: {
          id: 1,
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com',
          preferred_language: 'en',
        },
        isAuthenticated: true,
        isLoading: false,
        login: jest.fn(),
        signup: jest.fn(),
        logout: jest.fn(),
        restoreSession: jest.fn(),
      });
    });

    it('should render authenticated view with all sections', async () => {
      renderWithProviders(<SettingsScreen />);

      await waitFor(() => {
        expect(screen.getByText('Bible Version')).toBeTruthy();
        expect(screen.getByText('Language Preferences')).toBeTruthy();
        expect(screen.getByText('Auto-Highlights')).toBeTruthy();
        expect(screen.getByText('Profile Information')).toBeTruthy();
        expect(screen.getByText('Account Actions')).toBeTruthy();
      });
    });

    it('should populate profile form with user data', async () => {
      renderWithProviders(<SettingsScreen />);

      await waitFor(() => {
        expect(screen.getByDisplayValue('John')).toBeTruthy();
        expect(screen.getByDisplayValue('Doe')).toBeTruthy();
        expect(screen.getByDisplayValue('john.doe@example.com')).toBeTruthy();
      });
    });

    it('should show Auto-Highlights section', async () => {
      renderWithProviders(<SettingsScreen />);

      await waitFor(() => {
        expect(screen.getByText('Auto-Highlights')).toBeTruthy();
      });
    });

    it('should disable Save Changes button when no changes', async () => {
      renderWithProviders(<SettingsScreen />);

      await waitFor(() => {
        const saveButton = screen.getByText('No changes to save');
        expect(saveButton).toBeTruthy();
        expect(saveButton).toBeDisabled();
      });
    });

    it('should enable Save Changes button when profile is edited', async () => {
      const user = userEvent.setup();
      renderWithProviders(<SettingsScreen />);

      await waitFor(() => {
        expect(screen.getByDisplayValue('John')).toBeTruthy();
      });

      const firstNameInput = screen.getByDisplayValue('John');
      await user.clear(firstNameInput);
      await user.type(firstNameInput, 'Jane');

      await waitFor(() => {
        const saveButton = screen.getByText('Save Changes');
        expect(saveButton).toBeTruthy();
        expect(saveButton).not.toBeDisabled();
      });
    });

    it('should show logout confirmation dialog', async () => {
      const alertSpy = jest.spyOn(require('react-native').Alert, 'alert');
      const user = userEvent.setup();
      renderWithProviders(<SettingsScreen />);

      await waitFor(() => {
        expect(screen.getByText('Logout')).toBeTruthy();
      });

      await user.press(screen.getByText('Logout'));

      expect(alertSpy).toHaveBeenCalledWith(
        'Logout',
        'Are you sure you want to logout?',
        expect.arrayContaining([
          expect.objectContaining({ text: 'Cancel' }),
          expect.objectContaining({ text: 'Logout' }),
        ])
      );
    });
  });

  describe('Language Preferences (Authenticated)', () => {
    beforeEach(() => {
      // Mock authenticated user
      jest.spyOn(require('@/contexts/AuthContext'), 'useAuth').mockReturnValue({
        user: {
          id: 1,
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com',
          preferred_language: null,
        },
        isAuthenticated: true,
        isLoading: false,
        login: jest.fn(),
        signup: jest.fn(),
        logout: jest.fn(),
        restoreSession: jest.fn(),
      });
    });

    it('should show "Automatic" when no language preference is set', async () => {
      renderWithProviders(<SettingsScreen />);

      await waitFor(() => {
        expect(screen.getByText('Automatic (Based on Bible Version)')).toBeTruthy();
      });
    });

    it('should toggle language picker when pressed', async () => {
      const user = userEvent.setup();
      renderWithProviders(<SettingsScreen />);

      await waitFor(() => {
        expect(screen.getByText('Language Preferences')).toBeTruthy();
      });

      const languageButton = screen.getByText('Automatic (Based on Bible Version)');
      await user.press(languageButton);

      // Language picker should be visible
      await waitFor(() => {
        expect(screen.getAllByText('Automatic (Based on Bible Version)').length).toBeGreaterThan(1);
      });
    });
  });

  describe('Profile Editing (Authenticated)', () => {
    beforeEach(() => {
      jest.spyOn(require('@/contexts/AuthContext'), 'useAuth').mockReturnValue({
        user: {
          id: 1,
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com',
          preferred_language: null,
        },
        isAuthenticated: true,
        isLoading: false,
        login: jest.fn(),
        signup: jest.fn(),
        logout: jest.fn(),
        restoreSession: jest.fn(),
      });
    });

    it('should show error if required fields are empty', async () => {
      const user = userEvent.setup();
      renderWithProviders(<SettingsScreen />);

      await waitFor(() => {
        expect(screen.getByDisplayValue('John')).toBeTruthy();
      });

      // Clear first name
      const firstNameInput = screen.getByDisplayValue('John');
      await user.clear(firstNameInput);

      // Try to save
      const saveButton = screen.getByText('Save Changes');
      await user.press(saveButton);

      await waitFor(() => {
        expect(screen.getByText('All fields are required.')).toBeTruthy();
      });
    });

    it('should show change indicator when form is dirty', async () => {
      const user = userEvent.setup();
      renderWithProviders(<SettingsScreen />);

      await waitFor(() => {
        expect(screen.getByDisplayValue('John')).toBeTruthy();
      });

      const firstNameInput = screen.getByDisplayValue('John');
      await user.clear(firstNameInput);
      await user.type(firstNameInput, 'Jane');

      await waitFor(() => {
        expect(screen.getByText('You have unsaved changes')).toBeTruthy();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper accessibility labels', async () => {
      renderWithProviders(<SettingsScreen />);

      await waitFor(() => {
        expect(screen.getByText('Bible Version')).toBeTruthy();
      });

      const firstNameInput = screen.getByLabelText('First Name');
      expect(firstNameInput).toBeTruthy();
    });
  });
});
