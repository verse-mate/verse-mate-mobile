/**
 * Tests for Highlight Modal Components
 *
 * This test suite covers HighlightSelectionSheet and HighlightEditMenu components
 * with focused tests on critical functionality.
 *
 * @see Task Group 3.1: Write 2-8 focused tests for modals
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { HighlightEditMenu } from '@/components/bible/HighlightEditMenu';
import { HighlightSelectionSheet } from '@/components/bible/HighlightSelectionSheet';

// Mock haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: {
    Light: 'light',
  },
}));

describe('HighlightSelectionSheet', () => {
  const mockOnColorSelect = jest.fn();
  const mockOnClose = jest.fn();

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders with verse range for single verse', () => {
    render(
      <HighlightSelectionSheet
        visible={true}
        verseRange={{ start: 2, end: 2 }}
        onColorSelect={mockOnColorSelect}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('Verse 2')).toBeTruthy();
    expect(screen.getByText('HIGHLIGHT VERSE')).toBeTruthy();
  });

  it('renders with verse range for multiple verses', () => {
    render(
      <HighlightSelectionSheet
        visible={true}
        verseRange={{ start: 1, end: 5 }}
        onColorSelect={mockOnColorSelect}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('Verses 1-5')).toBeTruthy();
  });

  it('displays color picker component', () => {
    render(
      <HighlightSelectionSheet
        visible={true}
        verseRange={{ start: 1, end: 1 }}
        onColorSelect={mockOnColorSelect}
        onClose={mockOnClose}
      />
    );

    // Color picker should render all 6 colors
    expect(screen.getByTestId('color-button-yellow')).toBeTruthy();
    expect(screen.getByTestId('color-button-green')).toBeTruthy();
    expect(screen.getByTestId('color-button-blue')).toBeTruthy();
    expect(screen.getByTestId('color-button-pink')).toBeTruthy();
    expect(screen.getByTestId('color-button-purple')).toBeTruthy();
    expect(screen.getByTestId('color-button-orange')).toBeTruthy();
  });

  it('triggers onColorSelect callback when color is selected', async () => {
    render(
      <HighlightSelectionSheet
        visible={true}
        verseRange={{ start: 1, end: 1 }}
        onColorSelect={mockOnColorSelect}
        onClose={mockOnClose}
      />
    );

    fireEvent.press(screen.getByTestId('color-button-green'));

    await waitFor(() => {
      expect(mockOnColorSelect).toHaveBeenCalledWith('green');
    });
  });

  it('closes modal when backdrop is pressed', async () => {
    render(
      <HighlightSelectionSheet
        visible={true}
        verseRange={{ start: 1, end: 1 }}
        onColorSelect={mockOnColorSelect}
        onClose={mockOnClose}
      />
    );

    fireEvent.press(screen.getByTestId('backdrop'));

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalled();
    });
  });
});

describe('HighlightEditMenu', () => {
  const mockOnColorChange = jest.fn();
  const mockOnDelete = jest.fn();
  const mockOnClose = jest.fn();

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders with current color selected', () => {
    render(
      <HighlightEditMenu
        visible={true}
        currentColor="green"
        onColorChange={mockOnColorChange}
        onDelete={mockOnDelete}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('CHANGE COLOR')).toBeTruthy();
    // Current color should show checkmark
    expect(screen.getByTestId('checkmark-green')).toBeTruthy();
  });

  it('triggers onColorChange callback when color is selected', async () => {
    render(
      <HighlightEditMenu
        visible={true}
        currentColor="yellow"
        onColorChange={mockOnColorChange}
        onDelete={mockOnDelete}
        onClose={mockOnClose}
      />
    );

    fireEvent.press(screen.getByTestId('color-button-blue'));

    await waitFor(() => {
      expect(mockOnColorChange).toHaveBeenCalledWith('blue');
    });
  });

  it('triggers onDelete callback when delete button is pressed', async () => {
    render(
      <HighlightEditMenu
        visible={true}
        currentColor="yellow"
        onColorChange={mockOnColorChange}
        onDelete={mockOnDelete}
        onClose={mockOnClose}
      />
    );

    fireEvent.press(screen.getByText('Delete Highlight'));

    await waitFor(() => {
      expect(mockOnDelete).toHaveBeenCalled();
    });
  });

  it('closes modal when backdrop is pressed', async () => {
    render(
      <HighlightEditMenu
        visible={true}
        currentColor="yellow"
        onColorChange={mockOnColorChange}
        onDelete={mockOnDelete}
        onClose={mockOnClose}
      />
    );

    fireEvent.press(screen.getByTestId('backdrop'));

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalled();
    });
  });
});
