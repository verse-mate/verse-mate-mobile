/**
 * HighlightedText Component Tests
 *
 * Tests for text highlighting rendering, tap detection, and native text selection.
 *
 * @see Task 4.1: Write 2-8 focused tests for text selection
 * @see Task 7.3: Add highlight color dark variants
 */

import { fireEvent, render } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { Text } from 'react-native';
import type { ReactTestInstance } from 'react-test-renderer';
import { HighlightedText } from '@/components/bible/HighlightedText';
import { HIGHLIGHT_COLORS, HIGHLIGHT_COLORS_DARK } from '@/constants/highlight-colors';
import type { Highlight } from '@/hooks/bible/use-highlights';

// Mock haptics
jest.mock('expo-haptics');

// Mock useTheme to control theme mode in tests
const mockUseTheme = jest.fn();
jest.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => mockUseTheme(),
}));

// Helper to recursively extract text from React element children
const extractText = (children: any): string => {
  if (typeof children === 'string') return children;
  if (Array.isArray(children)) {
    return children.map((c) => extractText(c)).join('');
  }
  if (children?.props?.children) {
    return extractText(children.props.children);
  }
  return '';
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
    // Default to light mode
    mockUseTheme.mockReturnValue({
      mode: 'light',
      preference: 'light',
      colors: {},
      setPreference: jest.fn(),
      isLoading: false,
    });
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

  it('should have selectable={true} on root Text for native text selection', () => {
    const { root } = render(
      <HighlightedText
        text="In the beginning God created the heavens and the earth."
        verseNumber={1}
        highlights={[]}
      />
    );

    // Root Text should be the verse-text testID element
    const rootText = root.findByProps({ testID: 'verse-text-1' });
    expect(rootText.props.selectable).toBe(true);
  });

  it('should have onLongPress handlers on segment Text elements for dictionary lookup', () => {
    const { root } = render(
      <HighlightedText
        text="In the beginning God created the heavens and the earth."
        verseNumber={1}
        highlights={[mockHighlight]}
      />
    );

    const textElements = root.findAllByType(Text);

    // Segment Text elements should have onLongPress for dictionary
    const elementsWithLongPress = textElements.filter(
      (el: ReactTestInstance) => el.props.onLongPress !== undefined
    );
    expect(elementsWithLongPress.length).toBeGreaterThan(0);
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

    // Tokenized rendering nests words as children — use recursive extraction
    const highlightedTexts = textElements
      .filter((el: ReactTestInstance) => {
        const style = el.props.style;
        return style?.backgroundColor?.includes(HIGHLIGHT_COLORS.yellow);
      })
      .map((el: ReactTestInstance) => extractText(el.props.children))
      .join('');
    expect(highlightedTexts).toBe('beginning God');
  });

  it('should use dark mode highlight colors when theme is dark', () => {
    // Set theme to dark mode
    mockUseTheme.mockReturnValue({
      mode: 'dark',
      preference: 'dark',
      colors: {},
      setPreference: jest.fn(),
      isLoading: false,
    });

    const { root } = render(
      <HighlightedText
        text="In the beginning God created the heavens and the earth."
        verseNumber={1}
        highlights={[mockHighlight]}
      />
    );

    // Find text elements within the component
    const textElements = root.findAllByType(Text);

    // Verify highlight segment uses dark mode yellow color
    const highlightedSegment = textElements.find((el: ReactTestInstance) => {
      const style = el.props.style;
      return style?.backgroundColor?.includes(HIGHLIGHT_COLORS_DARK.yellow);
    });

    expect(highlightedSegment).toBeTruthy();

    const highlightedTexts = textElements
      .filter((el: ReactTestInstance) => {
        const style = el.props.style;
        return style?.backgroundColor?.includes(HIGHLIGHT_COLORS_DARK.yellow);
      })
      .map((el: ReactTestInstance) => extractText(el.props.children))
      .join('');
    expect(highlightedTexts).toBe('beginning God');
  });

  it('should use different colors for different highlights in dark mode', () => {
    // Set theme to dark mode
    mockUseTheme.mockReturnValue({
      mode: 'dark',
      preference: 'dark',
      colors: {},
      setPreference: jest.fn(),
      isLoading: false,
    });

    const greenHighlight: Highlight = {
      ...mockHighlight,
      highlight_id: 2,
      start_char: 29,
      end_char: 40,
      color: 'green',
      selected_text: 'the heavens',
    };

    const { root } = render(
      <HighlightedText
        text="In the beginning God created the heavens and the earth."
        verseNumber={1}
        highlights={[mockHighlight, greenHighlight]}
      />
    );

    const textElements = root.findAllByType(Text);

    // Verify dark mode yellow highlight
    const yellowSegment = textElements.find((el: ReactTestInstance) => {
      const style = el.props.style;
      return style?.backgroundColor?.includes(HIGHLIGHT_COLORS_DARK.yellow);
    });
    expect(yellowSegment).toBeTruthy();

    // Verify dark mode green highlight
    const greenSegment = textElements.find((el: ReactTestInstance) => {
      const style = el.props.style;
      return style?.backgroundColor?.includes(HIGHLIGHT_COLORS_DARK.green);
    });
    expect(greenSegment).toBeTruthy();
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

  it('should call onVerseTap with haptic feedback when plain text is tapped', async () => {
    jest.useFakeTimers();
    const mockOnVerseTap = jest.fn();

    const { root } = render(
      <HighlightedText
        text="In the beginning God created the heavens and the earth."
        verseNumber={1}
        highlights={[]}
        onVerseTap={mockOnVerseTap}
      />
    );

    const textElements = root.findAllByType(Text);
    // Find a segment with onPress (plain text segment)
    const pressableSegment = textElements.find(
      (el: ReactTestInstance) => el.props.onPress !== undefined
    );

    expect(pressableSegment).toBeTruthy();
    if (pressableSegment) {
      fireEvent.press(pressableSegment);
    }

    // onPress is debounced by 300ms to distinguish from double-tap
    jest.advanceTimersByTime(300);

    expect(mockOnVerseTap).toHaveBeenCalledWith(1);
    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
  });

  it('should NOT call onVerseTap on double-tap (native selection)', () => {
    jest.useFakeTimers();
    const mockOnVerseTap = jest.fn();

    const { root } = render(
      <HighlightedText
        text="In the beginning God created the heavens and the earth."
        verseNumber={1}
        highlights={[]}
        onVerseTap={mockOnVerseTap}
      />
    );

    const textElements = root.findAllByType(Text);
    const pressableSegment = textElements.find(
      (el: ReactTestInstance) => el.props.onPress !== undefined
    );

    // Simulate double-tap: two presses within 300ms
    if (pressableSegment) {
      fireEvent.press(pressableSegment);
      fireEvent.press(pressableSegment);
    }

    jest.advanceTimersByTime(300);

    // Should NOT have been called — double-tap cancels the debounced handler
    expect(mockOnVerseTap).not.toHaveBeenCalled();
  });

  it('should cancel pending tap when long-press fires (dictionary)', () => {
    jest.useFakeTimers();
    const mockOnVerseTap = jest.fn();

    const { root } = render(
      <HighlightedText
        text="In the beginning God created the heavens and the earth."
        verseNumber={1}
        highlights={[]}
        onVerseTap={mockOnVerseTap}
        onWordSelect={jest.fn()}
      />
    );

    const textElements = root.findAllByType(Text);
    // Find an element with both onPress and onLongPress
    const element = textElements.find(
      (el: ReactTestInstance) => el.props.onPress && el.props.onLongPress
    );

    expect(element).toBeTruthy();
    if (element) {
      // Tap first (starts 300ms timer)
      fireEvent.press(element);
      // Then long-press (should cancel the pending tap)
      fireEvent(element, 'longPress', {
        nativeEvent: { pageX: 100, pageY: 200, locationX: 50, locationY: 10 },
      });
    }

    jest.advanceTimersByTime(300);

    // Tooltip should NOT have fired — long-press cancelled it
    expect(mockOnVerseTap).not.toHaveBeenCalled();
  });

  it('should call onHighlightTap when highlighted text is tapped', () => {
    jest.useFakeTimers();
    const mockOnHighlightTap = jest.fn();

    const { root } = render(
      <HighlightedText
        text="In the beginning God created the heavens and the earth."
        verseNumber={1}
        highlights={[mockHighlight]}
        onHighlightTap={mockOnHighlightTap}
      />
    );

    const textElements = root.findAllByType(Text);

    // With tokenized rendering, individual word children have onPress.
    // Find a word element inside a highlighted segment that has onPress.
    const pressableWord =
      textElements.find((el: ReactTestInstance) => {
        return (
          el.props.onPress !== undefined &&
          el.parent?.props?.style?.backgroundColor?.includes(HIGHLIGHT_COLORS.yellow)
        );
      }) ||
      textElements.find((el: ReactTestInstance) => {
        // Fallback: find any element with onPress inside the highlight tree
        const style = el.props.style;
        return (
          el.props.onPress !== undefined &&
          style?.backgroundColor?.includes(HIGHLIGHT_COLORS.yellow)
        );
      });

    expect(pressableWord).toBeTruthy();
    if (pressableWord) {
      fireEvent.press(pressableWord);
    }

    // onPress is debounced by 300ms
    jest.advanceTimersByTime(300);

    expect(mockOnHighlightTap).toHaveBeenCalledWith(1);
    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
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
    const highlightedTexts = textElements
      .filter((el: ReactTestInstance) => {
        const style = el.props.style;
        return style?.backgroundColor;
      })
      .map((el: ReactTestInstance) => extractText(el.props.children))
      .join('');
    expect(highlightedTexts).toBe('the heavens and the earth.');
  });
});
