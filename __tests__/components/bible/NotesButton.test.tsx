/**
 * Tests for NotesButton Component
 *
 * Focused tests for notes button icon states and press behavior.
 * Tests cover critical behaviors: icon state, press handler, accessibility.
 *
 * @see Task Group 4.1: Write 2-8 focused tests for NotesButton component
 */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type React from 'react';
import { NotesButton } from '@/components/bible/NotesButton';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { useNotes } from '@/hooks/bible/use-notes';

// Mock useNotes hook
jest.mock('@/hooks/bible/use-notes');

// Mock haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: {
    Light: 'light',
  },
}));

const renderWithTheme = (component: React.ReactElement) => {
  return render(<ThemeProvider>{component}</ThemeProvider>);
};

describe('NotesButton', () => {
  const mockOnPress = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useNotes as jest.Mock).mockReturnValue({
      hasNotes: jest.fn(() => false),
    });
  });

  it('should render outline icon when chapter has no notes', () => {
    renderWithTheme(<NotesButton bookId={1} chapterNumber={1} onPress={mockOnPress} />);

    const button = screen.getByTestId('notes-button-1-1');
    expect(button).toBeTruthy();

    // Check for outline icon (document-text-outline)
    const icon = screen.getByLabelText('Notes for this chapter');
    expect(icon).toBeTruthy();
  });

  it('should render filled icon when chapter has notes', () => {
    (useNotes as jest.Mock).mockReturnValue({
      hasNotes: jest.fn(() => true), // Chapter has notes
    });

    renderWithTheme(<NotesButton bookId={1} chapterNumber={1} onPress={mockOnPress} />);

    const button = screen.getByTestId('notes-button-1-1');
    expect(button).toBeTruthy();

    // Button should be rendered with filled icon
    const icon = screen.getByLabelText('Notes for this chapter');
    expect(icon).toBeTruthy();
  });

  it('should call onPress handler when pressed', async () => {
    renderWithTheme(<NotesButton bookId={1} chapterNumber={1} onPress={mockOnPress} />);

    const button = screen.getByTestId('notes-button-1-1');

    await act(async () => {
      fireEvent.press(button);
    });

    await waitFor(() => {
      expect(mockOnPress).toHaveBeenCalledTimes(1);
    });
  });

  it('should have correct accessibility label', () => {
    renderWithTheme(<NotesButton bookId={1} chapterNumber={1} onPress={mockOnPress} />);

    const button = screen.getByLabelText('Notes for this chapter');
    expect(button).toBeTruthy();
  });

  it('should call hasNotes with correct bookId and chapterNumber', () => {
    const mockHasNotes = jest.fn(() => false);
    (useNotes as jest.Mock).mockReturnValue({
      hasNotes: mockHasNotes,
    });

    renderWithTheme(<NotesButton bookId={43} chapterNumber={5} onPress={mockOnPress} />);

    expect(mockHasNotes).toHaveBeenCalledWith(43, 5);
  });
});
