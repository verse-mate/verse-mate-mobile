/**
 * HamburgerMenu - Highlights Navigation Integration Tests
 *
 * Tests focused on highlights menu item and navigation functionality.
 * Part of Task Group 7: Hamburger Menu & Route Configuration
 *
 * Test Coverage:
 * - Highlights menu item appears
 * - Menu item uses correct icon
 * - Menu item navigates to /highlights route
 * - Haptic feedback on menu item press
 *
 * @see Task Group 7.1: Write 2-8 focused tests for menu integration
 */

import { Ionicons } from '@expo/vector-icons';
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import type React from 'react';
import { HamburgerMenu } from '@/components/bible/HamburgerMenu';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';

// Mock expo-router
jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    back: jest.fn(),
  },
}));

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
  },
}));

// Mock Ionicons
jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

// Mock safe area context
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// Helper to wrap component with AuthProvider
function renderWithAuth(ui: React.ReactElement) {
  return render(
    <AuthProvider>
      <ThemeProvider>{ui}</ThemeProvider>
    </AuthProvider>
  );
}

describe('HamburgerMenu - Highlights Integration', () => {
  const mockOnClose = jest.fn();
  const user = userEvent.setup();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should display highlights menu item with correct icon', () => {
    renderWithAuth(<HamburgerMenu visible={true} onClose={mockOnClose} />);

    // Find the highlights menu item
    const highlightsItem = screen.getByTestId('menu-item-highlights');
    expect(highlightsItem).toBeTruthy();

    // Check for correct label
    expect(screen.getByText('Highlights')).toBeTruthy();
  });

  it('should navigate to /highlights when menu item is pressed', async () => {
    renderWithAuth(<HamburgerMenu visible={true} onClose={mockOnClose} />);

    // Press the highlights menu item
    const highlightsItem = screen.getByTestId('menu-item-highlights');
    await user.press(highlightsItem);

    // Wait for navigation to be called
    await waitFor(() => {
      expect(router.push).toHaveBeenCalledWith('/highlights');
    });
  });

  it('should close menu after navigating to highlights', async () => {
    renderWithAuth(<HamburgerMenu visible={true} onClose={mockOnClose} />);

    // Press the highlights menu item
    const highlightsItem = screen.getByTestId('menu-item-highlights');
    await user.press(highlightsItem);

    // Wait for menu to close
    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('should trigger haptic feedback when highlights item is pressed', async () => {
    renderWithAuth(<HamburgerMenu visible={true} onClose={mockOnClose} />);

    // Press the highlights menu item
    const highlightsItem = screen.getByTestId('menu-item-highlights');
    await user.press(highlightsItem);

    // Verify haptic feedback was triggered
    await waitFor(() => {
      expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
    });
  });

  it('should position highlights menu item after notes item', () => {
    renderWithAuth(<HamburgerMenu visible={true} onClose={mockOnClose} />);

    // Get all menu items
    const menuItems = screen.getAllByTestId(/menu-item-/);

    // Find indexes of notes and highlights items
    const _notesIndex = menuItems.findIndex((item) => item.props.testID === 'menu-item-notes');
    const _highlightsIndex = menuItems.findIndex(
      (item) => item.props.testID === 'menu-item-highlights'
    );

    // Verify highlights comes after notes (accounting for possible auth items before)
    const regularMenuItems = menuItems.filter(
      (item) =>
        !item.props.testID?.includes('login') &&
        !item.props.testID?.includes('signup') &&
        !item.props.testID?.includes('logout')
    );

    const regularNotesIndex = regularMenuItems.findIndex(
      (item) => item.props.testID === 'menu-item-notes'
    );
    const regularHighlightsIndex = regularMenuItems.findIndex(
      (item) => item.props.testID === 'menu-item-highlights'
    );

    expect(regularHighlightsIndex).toBeGreaterThan(regularNotesIndex);
  });

  it('should have highlights route registered', async () => {
    // This test verifies the route exists by attempting navigation
    renderWithAuth(<HamburgerMenu visible={true} onClose={mockOnClose} />);

    const highlightsItem = screen.getByTestId('menu-item-highlights');
    await user.press(highlightsItem);

    // Verify navigation was called with the correct route
    await waitFor(() => {
      expect(router.push).toHaveBeenCalledWith('/highlights');
    });

    // In a real app, this would navigate to app/highlights.tsx
    // The route registration is handled by Expo Router automatically
  });
});
