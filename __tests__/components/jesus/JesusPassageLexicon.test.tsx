/**
 * Dotted lexicon words in Jesus scripture, as in the reader.
 *
 * The passage renders through the reader's ParagraphText, so it gets the same
 * underlines when it is given the chapter's alignment; a tap on one must open
 * the same LexiconPopover. Maestro cannot tap into the native text view (it
 * cannot in the reader either), so the wiring is pinned here instead.
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { JesusPassageBlock } from '@/components/jesus/JesusPassageBlock';
import { ThemeProvider } from '@/contexts/ThemeContext';
import type { JesusEventPassage } from '@/types/jesus';

const mockAlignment = { tokens: [] };
jest.mock('@/hooks/use-chapter-alignment', () => ({
  useChapterAlignment: () => mockAlignment,
  isEnglishVersion: () => true,
}));
jest.mock('@/hooks/bible/use-native-text', () => ({
  useNativeText: () => ({ useNativeText: true }),
}));
jest.mock('@/hooks/bible/use-font-size', () => ({
  useFontSize: () => ({ fontSize: 18 }),
}));
jest.mock('@versemate/lexicon', () => ({
  lookupLemma: jest.fn(() => Promise.resolve(null)),
}));

const mockParagraphProps: Record<string, unknown>[] = [];
jest.mock('@/lib/text/ParagraphText', () => ({
  ParagraphText: (props: Record<string, unknown>) => {
    mockParagraphProps.push(props);
    return null;
  },
}));
jest.mock('@/components/bible/LexiconPopover', () => ({
  LexiconPopover: ({ surface }: { surface: string }) => {
    const { Text } = require('react-native');
    return <Text testID="lexicon-popover">{surface}</Text>;
  },
}));

const passage: JesusEventPassage = {
  book_id: 40,
  book_name: 'Matthew',
  chapter: 8,
  verse_start: 28,
  verse_end: 29,
  is_primary: true,
  display: 'Matthew 8:28-29',
  verses: [
    { verse_number: 28, text: 'When He came to the other side' },
    { verse_number: 29, text: 'And they cried out' },
  ],
};

it("hands ParagraphText the chapter's alignment and opens the definition on a word tap", () => {
  render(
    <ThemeProvider>
      <JesusPassageBlock passage={passage} onOpen={jest.fn()} />
    </ThemeProvider>
  );
  // ParagraphText only mounts once the block knows its width.
  fireEvent(screen.getByTestId('jesus-scripture-Matthew 8:28-29'), 'layout', {
    nativeEvent: { layout: { width: 360, height: 100, x: 0, y: 0 } },
  });
  const props = mockParagraphProps.at(-1) as {
    alignment: unknown;
    onLexiconWordPress: (args: unknown) => void;
  };
  expect(props.alignment).toBe(mockAlignment);

  act(() => {
    props.onLexiconWordPress({
      surface: 'country',
      token: { lemma: 'G5561' },
      entry: { lemma: 'χώρα' },
      isTheme: false,
    });
  });
  expect(screen.getByTestId('lexicon-popover')).toHaveTextContent('country');
});
