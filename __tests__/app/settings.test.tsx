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
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router, useFocusEffect } from 'expo-router';
import i18next from 'i18next';
import React from 'react';
import { Alert } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import SettingsScreen from '@/app/settings';
import type { User } from '@/contexts/AuthContext';
import { useAuth } from '@/contexts/AuthContext';
import { useOfflineContext } from '@/contexts/OfflineContext';
import { useBibleVersion } from '@/hooks/use-bible-version';
import { useDeleteAccount } from '@/hooks/useDeleteAccount';
import es from '@/locales/es.json';
import * as sdk from '@/src/api/generated/sdk.gen';

// Mock dependencies
jest.mock('expo-router', () => ({
  router: {
    back: jest.fn(),
    push: jest.fn(),
  },
  useFocusEffect: jest.fn((callback) => {
    // Call the callback immediately in tests to simulate mount
    // The cleanup function (if any) will be called when component unmounts
    const cleanup = callback();
    return cleanup;
  }),
}));

jest.mock('@/contexts/AuthContext');
jest.mock('@/contexts/OfflineContext', () => ({
  useOfflineContext: jest.fn().mockReturnValue({
    commentaryInfo: [],
    topicsInfo: [],
    downloadedCommentaryLanguages: [],
    downloadedTopicLanguages: [],
  }),
}));
jest.mock('@/hooks/use-bible-version');
jest.mock('@/hooks/bible/use-offline-status', () => ({
  useOfflineStatus: jest.fn().mockReturnValue({
    isOffline: false,
    isConnected: true,
    networkType: 'wifi',
  }),
}));
jest.mock('@/hooks/useDeleteAccount');
jest.mock('@/src/api/generated/sdk.gen');

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: 'light' },
}));

// Mock PostHog
jest.mock('posthog-react-native', () => ({
  PostHogProvider: ({ children }: { children: React.ReactNode }) => children,
  usePostHog: () => ({
    capture: jest.fn(),
    identify: jest.fn(),
    reset: jest.fn(),
  }),
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: jest.fn(({ children }) => children),
  SafeAreaView: jest.fn(({ children }) => children),
  useSafeAreaInsets: jest.fn(() => ({ top: 0, bottom: 0, left: 0, right: 0 })),
}));

// Mock AutoHighlightSettings component
jest.mock('@/components/settings/AutoHighlightSettings', () => ({
  AutoHighlightSettings: ({ isLoggedIn }: { isLoggedIn: boolean }) => {
    const { Text } = require('react-native');
    return <Text testID="auto-highlight-settings">{isLoggedIn ? 'Auto Highlights' : ''}</Text>;
  },
}));

// Mock the narration-voice control. It fetches the Bible Brain catalogue
// through TanStack Query, and this suite mocks the whole generated SDK away —
// leaving the query to hang against fake timers. Covered by its own suite.
jest.mock('@/components/bible-brain/ScriptureVoiceSetting', () => ({
  ScriptureVoiceSetting: () => {
    const { View, Text } = require('react-native');
    return (
      <View testID="scripture-voice-setting">
        <Text>Narration voice</Text>
      </View>
    );
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

// Mock Delete Account modals
jest.mock('@/components/account/DeleteAccountWarningModal', () => ({
  DeleteAccountWarningModal: () => null,
}));

jest.mock('@/components/account/DeleteAccountPasswordModal', () => ({
  DeleteAccountPasswordModal: () => null,
}));

jest.mock('@/components/account/DeleteAccountFinalModal', () => ({
  DeleteAccountFinalModal: () => null,
}));

// Spy on Alert
const alertSpy = jest.spyOn(Alert, 'alert');

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseBibleVersion = useBibleVersion as jest.MockedFunction<typeof useBibleVersion>;
const mockUseDeleteAccount = useDeleteAccount as jest.MockedFunction<typeof useDeleteAccount>;
const mockGetBibleLanguages = sdk.getBibleLanguages as jest.MockedFunction<
  typeof sdk.getBibleLanguages
>;
const mockPutAuthProfile = sdk.putAuthProfile as jest.MockedFunction<typeof sdk.putAuthProfile>;
const _mockPatchUserPreferences = sdk.patchUserPreferences as jest.MockedFunction<
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
  imageSrc: undefined,
  hasPassword: true,
  pendingEmail: null,
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
      loginWithSSO: jest.fn(),
      restoreSession: jest.fn(),
    });

    // Default: KJV Bible version
    mockUseBibleVersion.mockReturnValue({
      bibleVersion: 'kjv',
      setBibleVersion: jest.fn().mockResolvedValue(undefined),
      isLoading: false,
    });

    // Default: Mock useDeleteAccount hook
    mockUseDeleteAccount.mockReturnValue({
      deleteAccount: jest.fn().mockResolvedValue(true),
      isDeleting: false,
      error: null,
      clearError: jest.fn(),
    });

    // Default: Mock empty languages
    mockGetBibleLanguages.mockResolvedValue({
      data: [],
      error: undefined,
      request: {} as Request,
      response: {} as Response,
    });

    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const renderWithProviders = (component: React.ReactElement) => {
    return render(
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>{component}</QueryClientProvider>
      </SafeAreaProvider>
    );
  };

  describe('Screen Rendering', () => {
    it('renders settings screen with title', () => {
      renderWithProviders(<SettingsScreen />);

      expect(screen.getByText('Settings')).toBeTruthy();
    });

    it('renders back button', () => {
      renderWithProviders(<SettingsScreen />);

      const backButton = screen.getByTestId('settings-back-button');
      expect(backButton).toBeTruthy();
    });
  });

  describe('Theme Selector', () => {
    it('renders ThemeSelector component', () => {
      renderWithProviders(<SettingsScreen />);

      // ThemeSelector should be rendered (exact assertion depends on ThemeSelector implementation)
      // For now, verify the screen renders without errors
      expect(screen.getByText('Settings')).toBeTruthy();
    });
  });

  describe('Bible Version Selection', () => {
    it('renders Bible Version section', async () => {
      renderWithProviders(<SettingsScreen />);

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

      renderWithProviders(<SettingsScreen />);

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
      renderWithProviders(<SettingsScreen />);

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
        loginWithSSO: jest.fn(),
        restoreSession: jest.fn(),
      });

      renderWithProviders(<SettingsScreen />);

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
        loginWithSSO: jest.fn(),
        restoreSession: jest.fn(),
      });

      renderWithProviders(<SettingsScreen />);

      expect(screen.getByText(/Sign in to access auto-highlights/i)).toBeTruthy();
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
        loginWithSSO: jest.fn(),
        restoreSession: jest.fn(),
      });

      renderWithProviders(<SettingsScreen />);

      const signInButton = screen.getByTestId('settings-sign-in-button');
      fireEvent.press(signInButton);

      expect(router.push).toHaveBeenCalledWith('/auth/login');
    });
  });

  describe('Profile Editing', () => {
    it('renders profile form with current user data', () => {
      renderWithProviders(<SettingsScreen />);

      const firstNameInput = screen.getByTestId('settings-first-name-input');
      const lastNameInput = screen.getByTestId('settings-last-name-input');
      const emailInput = screen.getByTestId('settings-email-input');

      expect(firstNameInput.props.value).toBe('Test');
      expect(lastNameInput.props.value).toBe('User');
      expect(emailInput.props.value).toBe('test@example.com');
    });

    it('auto-saves profile changes after debounce', async () => {
      mockPutAuthProfile.mockResolvedValue({
        data: { ...mockUser, firstName: 'NewName' },
        error: undefined,
        request: {} as Request,
        response: {} as Response,
      });

      renderWithProviders(<SettingsScreen />);

      // Change first name
      const firstNameInput = screen.getByTestId('settings-first-name-input');
      fireEvent.changeText(firstNameInput, 'NewName');

      // Fast-forward debounce timer (1000ms)
      act(() => {
        jest.advanceTimersByTime(1000);
      });

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
  });

  describe('Logout', () => {
    it('shows logout button when authenticated', () => {
      renderWithProviders(<SettingsScreen />);

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
        loginWithSSO: jest.fn(),
        restoreSession: jest.fn(),
      });

      renderWithProviders(<SettingsScreen />);

      expect(screen.queryByTestId('settings-logout-button')).toBeNull();
    });

    it('shows confirmation alert when logout is pressed', () => {
      renderWithProviders(<SettingsScreen />);

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
        loginWithSSO: jest.fn(),
        restoreSession: jest.fn(),
      });

      renderWithProviders(<SettingsScreen />);

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
      renderWithProviders(<SettingsScreen />);

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
          { language_code: 'es-ES', name: 'Spanish', native_name: 'Espanol', explanation_count: 5 },
        ],
        error: undefined,
        request: {} as Request,
        response: {} as Response,
      });

      renderWithProviders(<SettingsScreen />);

      expect(screen.getByText('Language Preferences')).toBeTruthy();
    });

    it('shows language preferences even when not authenticated', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        login: jest.fn(),
        signup: jest.fn(),
        logout: jest.fn(),
        loginWithSSO: jest.fn(),
        restoreSession: jest.fn(),
      });

      renderWithProviders(<SettingsScreen />);

      expect(screen.queryByText('Language Preferences')).toBeTruthy();
    });
  });

  describe('Pending email notice', () => {
    const NOTICE = 'settings-pending-email';
    const noticeText = (address: string) =>
      `Check ${address} for a message from us to finish changing your email.`;
    const offline = useOfflineContext as jest.Mock;
    const offlineDefault = offline();

    let sessionUser: User;
    let serverPending: string | null;
    const restoreSession = jest.fn(async () => {
      sessionUser = { ...sessionUser, pendingEmail: serverPending };
    });

    const start = (opts: { session?: string | null; server?: string | null } = {}) => {
      sessionUser = { ...mockUser, pendingEmail: opts.session ?? null };
      serverPending = opts.server === undefined ? (opts.session ?? null) : opts.server;
    };

    const savesLikeTheBackend = () => {
      mockPutAuthProfile.mockImplementation((async ({ body }: { body: { email?: string } }) => {
        const email = body.email?.trim().toLowerCase();
        if (email && email !== sessionUser.email) serverPending = email;
        return {
          data: { ...sessionUser, pendingEmail: serverPending },
          error: undefined,
          request: {} as Request,
          response: {} as Response,
        };
      }) as never);
    };

    const refusesWithTooMany = () => {
      mockPutAuthProfile.mockResolvedValue({
        data: undefined,
        error: { error: 'TOO_MANY_REQUESTS', message: 'Too many email changes. Try again later.' },
        request: {} as Request,
        response: {} as Response,
      } as never);
    };

    const tree = () => (
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <SettingsScreen />
        </QueryClientProvider>
      </SafeAreaProvider>
    );

    const open = async () => {
      const view = render(tree());
      await settle(view.rerender);
      return view;
    };

    const settle = async (rerender: (el: React.ReactElement) => void) => {
      await act(async () => {});
      rerender(tree());
      await act(async () => {});
    };

    const typeAndSave = async (
      rerender: (el: React.ReactElement) => void,
      testID: string,
      value: string
    ) => {
      fireEvent.changeText(screen.getByTestId(testID), value);
      act(() => {
        jest.advanceTimersByTime(1000);
      });
      await waitFor(() => expect(mockPutAuthProfile).toHaveBeenCalled());
      await settle(rerender);
    };

    const focusOnce = (callback: () => undefined | (() => void)) =>
      // biome-ignore lint/correctness/useExhaustiveDependencies: a screen gains focus once per mount here
      React.useEffect(callback, []);
    const focusDefault = jest.mocked(useFocusEffect).getMockImplementation();

    beforeEach(() => {
      restoreSession.mockClear();
      jest.mocked(useFocusEffect).mockImplementation(focusOnce as never);
      offline.mockReturnValue({ ...offlineDefault, isOnline: true });
      mockUseAuth.mockImplementation(() => ({
        user: sessionUser,
        isAuthenticated: true,
        isLoading: false,
        login: jest.fn(),
        signup: jest.fn(),
        logout: jest.fn(),
        loginWithSSO: jest.fn(),
        restoreSession,
      }));
      start();
      savesLikeTheBackend();
    });

    afterEach(() => {
      if (focusDefault) jest.mocked(useFocusEffect).mockImplementation(focusDefault);
      offline.mockReturnValue(offlineDefault);
    });

    it('Notice appears right after requesting a change', async () => {
      const { rerender } = await open();
      expect(screen.queryByTestId(NOTICE)).toBeNull();
      await typeAndSave(rerender, 'settings-email-input', 'new@example.com');
      expect(screen.getByTestId(NOTICE)).toHaveTextContent(noticeText('new@example.com'));
      expect(screen.getByTestId('settings-email-input').props.value).toBe('test@example.com');
    });

    it('Requesting an address that belongs to another account', async () => {
      const { rerender } = await open();
      await typeAndSave(rerender, 'settings-email-input', 'taken@example.com');
      expect(screen.getByTestId(NOTICE)).toHaveTextContent(noticeText('taken@example.com'));
      expect(screen.queryByText(/already in use/i)).toBeNull();
    });

    it('Notice is shown again when settings reopen, and on other signed-in devices', async () => {
      start({ session: null, server: 'new@example.com' });
      await open();
      expect(restoreSession).toHaveBeenCalled();
      expect(screen.getByTestId(NOTICE)).toHaveTextContent(noticeText('new@example.com'));
      expect(screen.getByTestId('settings-email-input').props.value).toBe('test@example.com');
    });

    it('No notice without a pending change', async () => {
      await open();
      expect(restoreSession).toHaveBeenCalled();
      expect(screen.queryByTestId(NOTICE)).toBeNull();
    });

    it('Saving the current address again keeps the pending change', async () => {
      start({ session: 'new@example.com' });
      const { rerender } = await open();
      fireEvent.changeText(screen.getByTestId('settings-email-input'), 'test@example.com');
      await typeAndSave(rerender, 'settings-last-name-input', 'Userson');
      expect(screen.getByTestId(NOTICE)).toHaveTextContent(noticeText('new@example.com'));
      expect(screen.getByTestId('settings-email-input').props.value).toBe('test@example.com');
    });

    it('Saving the pending address again', async () => {
      start({ session: 'new@example.com' });
      const { rerender } = await open();
      await typeAndSave(rerender, 'settings-email-input', 'new@example.com');
      expect(screen.getByTestId(NOTICE)).toHaveTextContent(noticeText('new@example.com'));
    });

    it('A newer request replaces the pending address', async () => {
      start({ session: 'first@example.com' });
      const { rerender } = await open();
      await typeAndSave(rerender, 'settings-email-input', 'second@example.com');
      expect(screen.getByTestId(NOTICE)).toHaveTextContent(noticeText('second@example.com'));
    });

    it('A refused request', async () => {
      start({ session: 'first@example.com' });
      refusesWithTooMany();
      const { rerender } = await open();
      await typeAndSave(rerender, 'settings-email-input', 'second@example.com');
      expect(screen.getByText('An error occurred while saving your changes.')).toBeTruthy();
      expect(screen.getByTestId(NOTICE)).toHaveTextContent(noticeText('first@example.com'));
    });

    it('A refused request does not block saving the name afterwards', async () => {
      refusesWithTooMany();
      const { rerender } = await open();
      await typeAndSave(rerender, 'settings-email-input', 'second@example.com');
      expect(screen.getByTestId('settings-email-input').props.value).toBe('test@example.com');
      mockPutAuthProfile.mockClear();
      savesLikeTheBackend();
      await typeAndSave(rerender, 'settings-last-name-input', 'Userson');
      expect(mockPutAuthProfile).toHaveBeenCalledWith({
        body: { firstName: 'Test', lastName: 'Userson', email: 'test@example.com' },
      });
    });

    it('Typing during a save keeps what was typed', async () => {
      let finishSave!: () => void;
      mockPutAuthProfile.mockImplementation(
        (() =>
          new Promise((resolve) => {
            finishSave = () => {
              serverPending = 'new@example.com';
              resolve({ data: sessionUser, error: undefined, request: {}, response: {} });
            };
          })) as never
      );
      const { rerender } = await open();
      await typeAndSave(rerender, 'settings-email-input', 'new@example.com');
      fireEvent.changeText(screen.getByTestId('settings-email-input'), 'newer@example.co');
      await act(async () => {
        finishSave();
      });
      await settle(rerender);
      expect(screen.getByTestId(NOTICE)).toHaveTextContent(noticeText('new@example.com'));
      expect(screen.getByTestId('settings-email-input').props.value).toBe('newer@example.co');
    });

    it.each([
      ['Notice clears when the request expires'],
      ['Notice clears when the requesting session signs out'],
    ])('%s', async () => {
      start({ session: 'new@example.com', server: null });
      await open();
      expect(restoreSession).toHaveBeenCalled();
      expect(screen.queryByTestId(NOTICE)).toBeNull();
    });

    it('Notice in the selected language', async () => {
      i18next.addResourceBundle('es', 'translation', es, true, true);
      await act(async () => {
        await i18next.changeLanguage('es');
      });
      try {
        start({ session: 'nuevo@example.com' });
        await open();
        expect(screen.getByTestId(NOTICE)).toHaveTextContent(
          'Busca en nuevo@example.com un mensaje nuestro para terminar de cambiar tu correo electrónico.'
        );
      } finally {
        await act(async () => {
          await i18next.changeLanguage('en');
        });
      }
    });

    it.each(['en', 'es', 'fr', 'de', 'pt'])('the %s notice names the address', (lng) => {
      const catalog = require(`@/locales/${lng}.json`);
      expect(catalog.settings.pending_email).toContain('{{email}}');
    });
  });
});
