/**
 * HighlightedText Component Tests
 *
 * Tests for text highlighting rendering and tap detection.
 *
 * @see Task 4.1: Write 2-8 focused tests for text selection
 */

import { fireEvent, render, waitFor } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import type React from 'react';
import { Text } from 'react-native';
import type { ReactTestInstance } from 'react-test-renderer';
import { HighlightedText } from '@/components/bible/HighlightedText';
import { HIGHLIGHT_COLORS } from '@/constants/highlight-colors';
import { ThemeProvider } from '@/contexts/ThemeContext';
import type { Highlight } from '@/hooks/bible/use-highlights';

// Mock haptics
jest.mock('expo-haptics');

const renderWithTheme = (component: React.ReactElement) => {
  return render(<ThemeProvider>{component}</ThemeProvider>);
};

describe('HighlightedText', () => {
  const mockHighlight: Highlight = {
    highlight_id: 1,
    user_id: 'user123',
    chapter_id: 1001,
    book_id: 1,
    chapter_number: 1,
    start_verse: 1,
    end_verse: 1,
    start_char: 7,
    end_char: 20,
    color: 'yellow',
    selected_text: 'beginning God',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render plain text without highlights', () => {
    const { getByText } = renderWithTheme(
      <HighlightedText
        text="In the beginning God created the heavens and the earth."
        verseNumber={1}
        highlights={[]}
      />
    );

    expect(getByText('In the beginning God created the heavens and the earth.')).toBeTruthy();
  });

  it('should render text with semi-transparent highlight background', () => {
    const { root } = renderWithTheme(
      <HighlightedText
        text="In the beginning God created the heavens and the earth."
        verseNumber={1}
        highlights={[mockHighlight]}
      />
    );

    // Find text elements within the component
    const textElements = root.findAllByType(Text);

    // Check that we have segmented text (plain + highlighted + plain)
    expect(textElements.length).toBeGreaterThan(1);

    // Verify highlight segment has yellow background with opacity
    const highlightedSegment = textElements.find((el: ReactTestInstance) => {
      const style = el.props.style;
      return style?.backgroundColor?.includes(HIGHLIGHT_COLORS.yellow);
    });

    expect(highlightedSegment).toBeTruthy();
    expect(highlightedSegment?.props.children).toBe('beginning God');
  });

  it('should trigger onHighlightPress when long-pressing highlighted text', () => {
    const mockOnHighlightPress = jest.fn();

    const { root } = renderWithTheme(
      <HighlightedText
        text="In the beginning God created the heavens and the earth."
        verseNumber={1}
        highlights={[mockHighlight]}
        onHighlightPress={mockOnHighlightPress}
      />
    );

    // Find highlighted text segment
    const textElements = root.findAllByType(Text);
    const highlightedSegment = textElements.find((el: ReactTestInstance) => {
      const style = el.props.style;
      return style?.backgroundColor;
    });

    // Long-press on highlighted text
    if (highlightedSegment) {
      fireEvent(highlightedSegment, 'longPress');
    }

    // Verify callback was called with highlight_id
    expect(mockOnHighlightPress).toHaveBeenCalledWith(1);

    // Verify haptic feedback
    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
  });

  it('should handle multiple non-overlapping highlights in same verse', () => {
    const highlights: Highlight[] = [
      {
        ...mockHighlight,
        highlight_id: 1,
        start_char: 7,
        end_char: 20,
        color: 'yellow',
        selected_text: 'beginning God',
      },
      {
        ...mockHighlight,
        highlight_id: 2,
        start_char: 29,
        end_char: 40,
        color: 'green',
        selected_text: 'the heavens',
      },
    ];

    const { root } = renderWithTheme(
      <HighlightedText
        text="In the beginning God created the heavens and the earth."
        verseNumber={1}
        highlights={highlights}
      />
    );

    const textElements = root.findAllByType(Text);

    // Should have segments: plain + yellow + plain + green + plain
    expect(textElements.length).toBeGreaterThan(3);

    // Verify yellow highlight
    const yellowSegment = textElements.find((el: ReactTestInstance) => {
      const style = el.props.style;
      return style?.backgroundColor?.includes(HIGHLIGHT_COLORS.yellow);
    });
    expect(yellowSegment).toBeTruthy();

    // Verify green highlight
    const greenSegment = textElements.find((el: ReactTestInstance) => {
      const style = el.props.style;
      return style?.backgroundColor?.includes(HIGHLIGHT_COLORS.green);
    });
    expect(greenSegment).toBeTruthy();
  });

  it('should call onVerseLongPress when verse is long-pressed', async () => {
    const mockOnVerseLongPress = jest.fn();

    const { UNSAFE_root } = renderWithTheme(
      <HighlightedText
        text="In the beginning God created the heavens and the earth."
        verseNumber={1}
        highlights={[]}
        onVerseLongPress={mockOnVerseLongPress}
      />
    );

    // Find ALL elements recursively, not just by type
    const findElementWithHandler = (node: any): any => {
      if (node?.props?.onLongPress) {
        return node;
      }
      if (node?.children) {
        for (const child of node.children) {
          const found = findElementWithHandler(child);
          if (found) return found;
        }
      }
      return null;
    };

    const parentElement = findElementWithHandler(UNSAFE_root);

    // Simulate long press on parent element
    if (parentElement) {
      fireEvent(parentElement, 'longPress');
    }

    // Wait for async handler to complete
    await waitFor(() => {
      expect(mockOnVerseLongPress).toHaveBeenCalledWith(1);
    });

    // Verify haptic feedback
    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Medium);
  });

  it('should not call onVerseLongPress when callback not provided', () => {
    const { root } = renderWithTheme(
      <HighlightedText
        text="In the beginning God created the heavens and the earth."
        verseNumber={1}
        highlights={[]}
      />
    );

    // Find the parent Text element that has the onLongPress handler
    const textElements = root.findAllByType(Text);
    const parentTextElement = textElements.find((el: ReactTestInstance) => {
      return el.props.onLongPress !== undefined;
    });

    // Should not throw error when long-pressing without callback
    expect(() => {
      if (parentTextElement) {
        fireEvent(parentTextElement, 'longPress');
      }
    }).not.toThrow();
  });

  it('should handle multi-verse highlight spanning first verse', () => {
    const multiVerseHighlight: Highlight = {
      ...mockHighlight,
      start_verse: 1,
      end_verse: 2,
      start_char: 29,
      end_char: 25, // End in verse 2
      selected_text: 'the heavens and the earth...',
    };

    const { root } = renderWithTheme(
      <HighlightedText
        text="In the beginning God created the heavens and the earth."
        verseNumber={1}
        highlights={[multiVerseHighlight]}
      />
    );

    const textElements = root.findAllByType(Text);

    // Should have plain text before highlight + highlighted portion
    const highlightedSegment = textElements.find((el: ReactTestInstance) => {
      const style = el.props.style;
      return style?.backgroundColor;
    });

    expect(highlightedSegment).toBeTruthy();
    // First verse should be highlighted from char 29 to end
    expect(highlightedSegment?.props.children).toBe('the heavens and the earth.');
  });
});
