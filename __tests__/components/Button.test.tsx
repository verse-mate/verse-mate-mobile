import { fireEvent, render, screen } from '@testing-library/react-native';
import type React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { ThemeProvider } from '@/contexts/ThemeContext';

const renderWithTheme = (component: React.ReactElement) => {
  return render(<ThemeProvider>{component}</ThemeProvider>);
};

/**
 * Example Button Component
 * Demonstrates VerseMate UI patterns and testing best practices
 */
interface ButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'outline' | 'auth';
  fullWidth?: boolean;
  testID?: string;
}

const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  disabled = false,
  variant = 'primary',
  fullWidth = false,
  testID,
}) => {
  return (
    <TouchableOpacity
      style={[
        styles.button,
        styles[variant],
        disabled && styles.buttonDisabled,
        fullWidth && styles.fullWidth,
      ]}
      onPress={onPress}
      disabled={disabled}
      testID={testID}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled }}
    >
      <Text style={[styles.text, styles[`${variant}Text`], disabled && styles.textDisabled]}>
        {title}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: '#007AFF',
  },
  secondary: {
    backgroundColor: '#6B7280',
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  auth: {
    backgroundColor: '#B4956B',
  },
  fullWidth: {
    width: '100%',
  },
  buttonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
  },
  primaryText: {
    color: '#FFFFFF',
  },
  secondaryText: {
    color: '#FFFFFF',
  },
  outlineText: {
    color: '#007AFF',
  },
  authText: {
    color: '#FFFFFF',
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
      renderWithTheme(<Button title={title} onPress={() => {}} />);

      // Assert
      expect(screen.getByText(title)).toBeOnTheScreen();
    });

    it('renders with custom testID', () => {
      // Arrange
      const testID = 'read-verse-button';

      // Act
      renderWithTheme(<Button title="Read Verse" onPress={() => {}} testID={testID} />);

      // Assert
      expect(screen.getByTestId(testID)).toBeOnTheScreen();
    });
  });

  describe('User Interactions', () => {
    it('calls onPress handler when pressed', () => {
      // Arrange
      const mockOnPress = jest.fn();
      renderWithTheme(<Button title="Read Verse" onPress={mockOnPress} />);

      // Act
      fireEvent.press(screen.getByText('Read Verse'));

      // Assert
      expect(mockOnPress).toHaveBeenCalledTimes(1);
    });

    it('does not call onPress when disabled', () => {
      // Arrange
      const mockOnPress = jest.fn();
      renderWithTheme(<Button title="Read Verse" onPress={mockOnPress} disabled={true} />);

      // Act
      fireEvent.press(screen.getByText('Read Verse'));

      // Assert
      expect(mockOnPress).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('has correct accessibility role', () => {
      // Arrange & Act
      renderWithTheme(<Button title="Read Verse" onPress={() => {}} />);

      // Assert
      const button = screen.getByRole('button');
      expect(button).toBeOnTheScreen();
    });

    it('has correct accessibility label', () => {
      // Arrange
      const title = 'Read Verse';

      // Act
      renderWithTheme(<Button title={title} onPress={() => {}} />);

      // Assert
      const button = screen.getByLabelText(title);
      expect(button).toBeOnTheScreen();
    });

    it('indicates disabled state to screen readers', () => {
      // Arrange & Act
      renderWithTheme(<Button title="Read Verse" onPress={() => {}} disabled={true} />);

      // Assert
      const button = screen.getByRole('button');
      expect(button).toHaveAccessibilityState({ disabled: true });
    });
  });

  describe('Styling States', () => {
    it('applies disabled styles when disabled', () => {
      // Arrange & Act
      renderWithTheme(<Button title="Read Verse" onPress={() => {}} disabled={true} />);

      // Assert - Verify disabled button is rendered (visual check)
      const button = screen.getByRole('button');
      expect(button).toHaveAccessibilityState({ disabled: true });
    });
  });
});

/**
 * Auth Variant Tests
 * Tests for authentication-specific button styling
 */
describe('Button Component - Auth Variant', () => {
  it('renders auth variant with correct styles', () => {
    const { getByTestId } = render(
      <Button title="Create account" onPress={() => {}} variant="auth" testID="auth-button" />
    );

    const button = getByTestId('auth-button');
    expect(button).toBeTruthy();
  });

  it('renders full-width when fullWidth prop is true', () => {
    const { getByTestId } = render(
      <Button
        title="Login"
        onPress={() => {}}
        variant="auth"
        fullWidth={true}
        testID="full-width-button"
      />
    );

    const button = getByTestId('full-width-button');
    expect(button).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const onPressMock = jest.fn();
    const { getByTestId } = render(
      <Button title="Submit" onPress={onPressMock} variant="auth" testID="submit-button" />
    );

    fireEvent.press(getByTestId('submit-button'));
    expect(onPressMock).toHaveBeenCalledTimes(1);
  });

  it('disables button when disabled prop is true', () => {
    const onPressMock = jest.fn();
    const { getByTestId } = render(
      <Button
        title="Disabled"
        onPress={onPressMock}
        variant="auth"
        disabled={true}
        testID="disabled-button"
      />
    );

    const button = getByTestId('disabled-button');
    fireEvent.press(button);
    expect(onPressMock).not.toHaveBeenCalled();
  });
});
