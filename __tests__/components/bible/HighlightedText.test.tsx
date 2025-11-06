/**
 * HighlightedText Component Tests
 *
 * Tests for text highlighting rendering and tap detection.
 *
 * @see Task 4.1: Write 2-8 focused tests for text selection
 */

import { fireEvent, render } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { Text } from 'react-native';
import type { ReactTestInstance } from 'react-test-renderer';
import { HighlightedText } from '@/components/bible/HighlightedText';
import { HIGHLIGHT_COLORS } from '@/constants/highlight-colors';
import type { Highlight } from '@/hooks/bible/use-highlights';

// Mock haptics
jest.mock('expo-haptics');

describe('HighlightedText', () => {
  const mockHighlight: Highlight = {
    highlight_id: 1,
    user_id: 'user123',
    chapter_id: 1001,
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
    const { getByText } = render(
      <HighlightedText
        text="In the beginning God created the heavens and the earth."
        verseNumber={1}
        highlights={[]}
      />
    );

    expect(getByText('In the beginning God created the heavens and the earth.')).toBeTruthy();
  });

  it('should render text with semi-transparent highlight background', () => {
    const { root } = render(
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

  it('should trigger onHighlightPress when tapping highlighted text', () => {
    const mockOnHighlightPress = jest.fn();

    const { root } = render(
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

    // Tap on highlighted text
    if (highlightedSegment) {
      fireEvent.press(highlightedSegment);
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

    const { root } = render(
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

  it('should call onTextSelect when text is selected', () => {
    const mockOnTextSelect = jest.fn();

    const { getByText } = render(
      <HighlightedText
        text="In the beginning God created the heavens and the earth."
        verseNumber={1}
        highlights={[]}
        onTextSelect={mockOnTextSelect}
      />
    );

    const textElement = getByText('In the beginning God created the heavens and the earth.');

    // Simulate text selection
    fireEvent(textElement, 'selectionChange', {
      nativeEvent: {
        selection: { start: 7, end: 20 },
      },
    });

    // Verify callback was called with selection data
    expect(mockOnTextSelect).toHaveBeenCalledWith(
      {
        start: 7,
        end: 20,
        text: 'beginning God',
      },
      1
    );
  });

  it('should not call onTextSelect for cursor position (no text selected)', () => {
    const mockOnTextSelect = jest.fn();

    const { getByText } = render(
      <HighlightedText
        text="In the beginning God created the heavens and the earth."
        verseNumber={1}
        highlights={[]}
        onTextSelect={mockOnTextSelect}
      />
    );

    const textElement = getByText('In the beginning God created the heavens and the earth.');

    // Simulate cursor position (start === end)
    fireEvent(textElement, 'selectionChange', {
      nativeEvent: {
        selection: { start: 7, end: 7 },
      },
    });

    // Should not trigger callback for cursor position
    expect(mockOnTextSelect).not.toHaveBeenCalled();
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

    const { root } = render(
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
