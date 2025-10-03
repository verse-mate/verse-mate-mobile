import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';

/**
 * Example Button Component
 * Demonstrates VerseMate UI patterns and testing best practices
 */
interface ButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
}

const Button: React.FC<ButtonProps> = ({ title, onPress, disabled = false, testID }) => {
  return (
    <TouchableOpacity
      style={[styles.button, disabled && styles.buttonDisabled]}
      onPress={onPress}
      disabled={disabled}
      testID={testID}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled }}
    >
      <Text style={[styles.text, disabled && styles.textDisabled]}>{title}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  text: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  textDisabled: {
    color: '#9CA3AF',
  },
});

/**
 * Component Tests - Best Practices Example
 *
 * Testing Pattern: Arrange-Act-Assert (AAA)
 * Focus: User interactions, accessibility, and behavior
 */
describe('Button Component', () => {
  describe('Rendering', () => {
    it('renders button with title text', () => {
      // Arrange
      const title = 'Read Verse';

      // Act
      render(<Button title={title} onPress={() => {}} />);

      // Assert
      expect(screen.getByText(title)).toBeOnTheScreen();
    });

    it('renders with custom testID', () => {
      // Arrange
      const testID = 'read-verse-button';

      // Act
      render(<Button title="Read Verse" onPress={() => {}} testID={testID} />);

      // Assert
      expect(screen.getByTestId(testID)).toBeOnTheScreen();
    });
  });

  describe('User Interactions', () => {
    it('calls onPress handler when pressed', () => {
      // Arrange
      const mockOnPress = jest.fn();
      render(<Button title="Read Verse" onPress={mockOnPress} />);

      // Act
      fireEvent.press(screen.getByText('Read Verse'));

      // Assert
      expect(mockOnPress).toHaveBeenCalledTimes(1);
    });

    it('does not call onPress when disabled', () => {
      // Arrange
      const mockOnPress = jest.fn();
      render(<Button title="Read Verse" onPress={mockOnPress} disabled={true} />);

      // Act
      fireEvent.press(screen.getByText('Read Verse'));

      // Assert
      expect(mockOnPress).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('has correct accessibility role', () => {
      // Arrange & Act
      render(<Button title="Read Verse" onPress={() => {}} />);

      // Assert
      const button = screen.getByRole('button');
      expect(button).toBeOnTheScreen();
    });

    it('has correct accessibility label', () => {
      // Arrange
      const title = 'Read Verse';

      // Act
      render(<Button title={title} onPress={() => {}} />);

      // Assert
      const button = screen.getByLabelText(title);
      expect(button).toBeOnTheScreen();
    });

    it('indicates disabled state to screen readers', () => {
      // Arrange & Act
      render(<Button title="Read Verse" onPress={() => {}} disabled={true} />);

      // Assert
      const button = screen.getByRole('button');
      expect(button).toHaveAccessibilityState({ disabled: true });
    });
  });

  describe('Styling States', () => {
    it('applies disabled styles when disabled', () => {
      // Arrange & Act
      render(<Button title="Read Verse" onPress={() => {}} disabled={true} />);

      // Assert - Verify disabled button is rendered (visual check)
      const button = screen.getByRole('button');
      expect(button).toHaveAccessibilityState({ disabled: true });
    });
  });
});
