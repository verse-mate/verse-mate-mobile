/**
 * HamburgerMenu — Life of Jesus entry.
 *
 * The reader bridge only appears on chapters that carry an event, so the menu
 * is the one place the section can be reached unconditionally. These render the
 * real component and press the real row, rather than re-implementing the
 * handler in the test — a copy of the handler can pass while the menu is empty.
 */
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import type React from 'react';
import { HamburgerMenu } from '@/components/bible/HamburgerMenu';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
}));

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

function renderWithAuth(ui: React.ReactElement) {
  return render(
    <AuthProvider>
      <ThemeProvider>{ui}</ThemeProvider>
    </AuthProvider>
  );
}

describe('HamburgerMenu - Life of Jesus', () => {
  const mockOnClose = jest.fn();
  const user = userEvent.setup();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('offers the Life of Jesus entry', () => {
    renderWithAuth(<HamburgerMenu visible={true} onClose={mockOnClose} />);
    expect(screen.getByTestId('menu-item-jesus')).toBeTruthy();
    expect(screen.getByText('Life of Jesus')).toBeTruthy();
  });

  it('navigates to /jesus when pressed', async () => {
    renderWithAuth(<HamburgerMenu visible={true} onClose={mockOnClose} />);
    await user.press(screen.getByTestId('menu-item-jesus'));
    await waitFor(() => {
      expect(router.push).toHaveBeenCalledWith('/jesus');
    });
  });

  it('closes the menu on the way through', async () => {
    renderWithAuth(<HamburgerMenu visible={true} onClose={mockOnClose} />);
    await user.press(screen.getByTestId('menu-item-jesus'));
    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('gives the same haptic feedback as every other menu row', async () => {
    renderWithAuth(<HamburgerMenu visible={true} onClose={mockOnClose} />);
    await user.press(screen.getByTestId('menu-item-jesus'));
    await waitFor(() => {
      expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
    });
  });
});
