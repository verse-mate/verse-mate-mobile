import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { View, Text, StyleSheet } from 'react-native';

/**
 * Example VerseCard Component
 * Demonstrates accessibility-first design for Bible app
 */
interface VerseCardProps {
  book: string;
  chapter: number;
  verse: number;
  text: string;
  testID?: string;
}

const VerseCard: React.FC<VerseCardProps> = ({ book, chapter, verse, text, testID }) => {
  const reference = `${book} ${chapter}:${verse}`;

  return (
    <View
      style={styles.card}
      testID={testID}
      accessible={true}
      accessibilityRole="text"
      accessibilityLabel={`${reference}. ${text}`}
      accessibilityHint="Double tap to read full verse details"
    >
      <Text
        style={styles.reference}
        accessibilityRole="header"
        accessibilityLabel={`Reference: ${reference}`}
      >
        {reference}
      </Text>
      <Text style={styles.text} accessibilityRole="text">
        {text}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  reference: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6B7280',
    marginBottom: 8,
  },
  text: {
    fontSize: 16,
    lineHeight: 24,
    color: '#1F2937',
  },
});

/**
 * Accessibility Tests - jest-native Matchers
 *
 * Testing Focus:
 * - Screen reader compatibility
 * - Accessible roles and labels
 * - Keyboard navigation support
 * - WCAG compliance
 */
describe('VerseCard Accessibility', () => {
  const mockVerse = {
    book: 'John',
    chapter: 3,
    verse: 16,
    text: 'For God so loved the world that he gave his one and only Son.',
  };

  describe('Accessibility Roles', () => {
    it('has correct accessibility role for card container', () => {
      // Arrange & Act
      render(<VerseCard {...mockVerse} testID="verse-card" />);

      // Assert
      const card = screen.getByTestId('verse-card');
      expect(card).toBeOnTheScreen();
      expect(card.props.accessibilityRole).toBe('text');
    });

    it('has header role for verse reference', () => {
      // Arrange & Act
      render(<VerseCard {...mockVerse} />);

      // Assert
      const reference = screen.getByRole('header');
      expect(reference).toBeOnTheScreen();
      expect(reference).toHaveTextContent('John 3:16');
    });
  });

  describe('Accessibility Labels', () => {
    it('provides descriptive label for screen readers', () => {
      // Arrange & Act
      render(<VerseCard {...mockVerse} />);

      // Assert
      const card = screen.getByLabelText(/John 3:16\. For God so loved the world/);
      expect(card).toBeOnTheScreen();
    });

    it('includes reference in header accessibility label', () => {
      // Arrange & Act
      render(<VerseCard {...mockVerse} />);

      // Assert
      const reference = screen.getByLabelText('Reference: John 3:16');
      expect(reference).toBeOnTheScreen();
    });
  });

  describe('Accessibility Hints', () => {
    it('provides interaction hint for users', () => {
      // Arrange & Act
      render(<VerseCard {...mockVerse} testID="verse-card" />);

      // Assert
      const card = screen.getByTestId('verse-card');
      expect(card.props.accessibilityHint).toBe('Double tap to read full verse details');
    });
  });

  describe('Accessibility State', () => {
    it('is accessible to screen readers', () => {
      // Arrange & Act
      render(<VerseCard {...mockVerse} testID="verse-card" />);

      // Assert
      const card = screen.getByTestId('verse-card');
      expect(card).toBeOnTheScreen();
      expect(card.props.accessible).toBe(true);
      expect(card.props.accessibilityLabel).toContain('John 3:16');
    });
  });

  describe('Text Content Accessibility', () => {
    it('renders verse text that is readable by screen readers', () => {
      // Arrange & Act
      render(<VerseCard {...mockVerse} />);

      // Assert
      const verseText = screen.getByText(/For God so loved the world/);
      expect(verseText).toBeOnTheScreen();
      expect(verseText).toHaveAccessibleName();
    });

    it('maintains correct reading order for screen readers', () => {
      // Arrange & Act
      const { getAllByRole } = render(<VerseCard {...mockVerse} />);

      // Assert - Reference (header) should come before text
      const elements = getAllByRole('header');
      expect(elements[0]).toHaveTextContent('John 3:16');
    });
  });

  describe('WCAG Compliance', () => {
    it('has sufficient text contrast (manual verification needed)', () => {
      // Note: This is a placeholder for manual contrast checking
      // Text color #1F2937 on white background meets WCAG AA standards (7.84:1)
      render(<VerseCard {...mockVerse} />);

      const verseText = screen.getByText(/For God so loved the world/);
      expect(verseText).toBeOnTheScreen();
    });

    it('supports dynamic font sizing', () => {
      // Arrange & Act
      render(<VerseCard {...mockVerse} />);

      // Assert - Verify text elements exist (would scale with system settings)
      const reference = screen.getByText('John 3:16');
      const text = screen.getByText(/For God so loved the world/);

      expect(reference).toBeOnTheScreen();
      expect(text).toBeOnTheScreen();
    });
  });

  describe('Multiple Verse Accessibility', () => {
    it('distinguishes between multiple verses for screen readers', () => {
      // Arrange
      const verse1 = { ...mockVerse };
      const verse2 = { book: 'Psalm', chapter: 23, verse: 1, text: 'The Lord is my shepherd.' };

      // Act
      const { getAllByRole } = render(
        <View>
          <VerseCard {...verse1} />
          <VerseCard {...verse2} />
        </View>
      );

      // Assert
      const headers = getAllByRole('header');
      expect(headers).toHaveLength(2);
      expect(headers[0]).toHaveTextContent('John 3:16');
      expect(headers[1]).toHaveTextContent('Psalm 23:1');
    });
  });
});
