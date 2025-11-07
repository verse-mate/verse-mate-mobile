/**
 * Tests for HighlightColorPicker Component
 *
 * Focused tests for color picker display and interaction.
 * Tests cover critical behaviors: rendering colors, selection state, callbacks.
 *
 * @see Task Group 2.1: Write 2-8 focused tests for color picker
 */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { HighlightColorPicker } from '@/components/bible/HighlightColorPicker';
import { HIGHLIGHT_COLOR_ORDER } from '@/constants/highlight-colors';

// Mock haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: {
    Light: 'light',
  },
}));

describe('HighlightColorPicker', () => {
  const mockOnColorSelect = jest.fn();

  const defaultProps = {
    selectedColor: 'yellow' as const,
    onColorSelect: mockOnColorSelect,
    variant: 'light' as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render all 6 color buttons', () => {
    render(<HighlightColorPicker {...defaultProps} />);

    // Check that all 6 colors are rendered
    HIGHLIGHT_COLOR_ORDER.forEach((color) => {
      expect(screen.getByTestId(`color-button-${color}`)).toBeTruthy();
    });
  });

  it('should show checkmark on selected color', () => {
    render(<HighlightColorPicker {...defaultProps} selectedColor="green" />);

    // Green should have checkmark
    expect(screen.getByTestId('checkmark-green')).toBeTruthy();

    // Other colors should not have checkmark
    expect(screen.queryByTestId('checkmark-yellow')).toBeNull();
    expect(screen.queryByTestId('checkmark-blue')).toBeNull();
    expect(screen.queryByTestId('checkmark-pink')).toBeNull();
    expect(screen.queryByTestId('checkmark-purple')).toBeNull();
    expect(screen.queryByTestId('checkmark-orange')).toBeNull();
  });

  it('should call onColorSelect when color button is pressed', async () => {
    render(<HighlightColorPicker {...defaultProps} />);

    const blueButton = screen.getByTestId('color-button-blue');

    await act(async () => {
      fireEvent.press(blueButton);
    });

    await waitFor(() => {
      expect(mockOnColorSelect).toHaveBeenCalledWith('blue');
      expect(mockOnColorSelect).toHaveBeenCalledTimes(1);
    });
  });

  it('should trigger haptic feedback on color press', async () => {
    render(<HighlightColorPicker {...defaultProps} />);

    const pinkButton = screen.getByTestId('color-button-pink');

    await act(async () => {
      fireEvent.press(pinkButton);
    });

    await waitFor(() => {
      expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
    });
  });

  it('should render with light variant styling', () => {
    render(<HighlightColorPicker {...defaultProps} variant="light" />);

    // Component should render without errors
    expect(screen.getByTestId('color-button-yellow')).toBeTruthy();
  });

  it('should render with dark variant styling', () => {
    render(<HighlightColorPicker {...defaultProps} variant="dark" />);

    // Component should render without errors
    expect(screen.getByTestId('color-button-yellow')).toBeTruthy();
  });

  it('should have correct accessibility labels', () => {
    render(<HighlightColorPicker {...defaultProps} />);

    const yellowButton = screen.getByTestId('color-button-yellow');
    expect(yellowButton.props.accessibilityLabel).toBe('yellow highlight color');
    expect(yellowButton.props.accessibilityRole).toBe('button');
  });

  it('should update accessibility state when color is selected', () => {
    render(<HighlightColorPicker {...defaultProps} selectedColor="purple" />);

    const purpleButton = screen.getByTestId('color-button-purple');
    const greenButton = screen.getByTestId('color-button-green');

    expect(purpleButton.props.accessibilityState.selected).toBe(true);
    expect(greenButton.props.accessibilityState.selected).toBe(false);
  });
});
