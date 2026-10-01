/**
 * The Jesus tabs use the reader's own Insight text styles.
 *
 * Andy, on build 116: "some of the font gets small on Jesus tabs" and "some of
 * the colors aren't consistent w the other pages — like line by line … make all
 * Jesus same as others". By-Line was grey at a fixed 14pt while the reader's
 * By-Line is primary-coloured and follows the font-size setting. These tests
 * pin the sameness itself: the style the Jesus tab hands to the markdown
 * renderer IS the reader's, at whatever size the reader is set to.
 */
import { render } from '@testing-library/react-native';
import { translateFallback as mockTranslate } from '@/__tests__/mocks/i18n';
import { createInsightMarkdownStyles } from '@/components/bible/insightMarkdownStyles';
import { JesusTabBodies } from '@/components/jesus/JesusTabBodies';
import { getColors } from '@/theme/tokens';
import type { JesusEventDetail } from '@/types/jesus';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mockTranslate }),
}));

let mockFontSize = 18;
jest.mock('@/hooks/bible/use-font-size', () => ({
  useFontSize: () => ({ fontSize: mockFontSize }),
}));

/** Record every style the tabs hand the markdown renderer. */
const mockMarkdownStyles: Record<string, { fontSize?: number; color?: string }>[] = [];
jest.mock('@/lib/markdown/Markdown', () => ({
  Markdown: ({ children, style }: { children: string; style: Record<string, object> }) => {
    mockMarkdownStyles.push(style as never);
    const { Text } = require('react-native');
    return <Text>{children}</Text>;
  },
}));

jest.mock('@/hooks/use-preferred-language', () => ({ usePreferredLanguage: () => 'en-US' }));
jest.mock('@/src/api', () => ({
  useBibleByLine: () => ({
    data: { content: '## John 8:1\n> But Jesus went to the Mount of Olives.\n\nHe withdraws.' },
    isPending: false,
  }),
  useStudy: () => ({ data: null, isPending: false }),
}));

const DETAIL = {
  event: {
    slug: 'event-woman',
    title: 'The woman caught in adultery',
    summary: 'He does not condemn her.',
    location: 'the temple',
    people: [{ person: 'the scribes' }],
  },
  passages: [
    {
      book_id: 43,
      book_name: 'John',
      chapter: 8,
      display: 'John 8:1-11',
      is_primary: true,
      verse_start: 1,
      verse_end: 11,
      verses: [],
    },
  ],
  explanation: { overview: 'Early in the morning Jesus comes into the temple.' },
  reveals: { says_about_himself: [], demonstrates: [], others_say: [], narrator_says: [] },
  reactions: [],
} as unknown as JesusEventDetail;

beforeEach(() => {
  mockMarkdownStyles.length = 0;
  mockFontSize = 18;
});

describe.each(['byline', 'summary'] as const)('%s tab', (tab) => {
  it('renders commentary with the reader’s own Insight styles', () => {
    render(<JesusTabBodies tab={tab} detail={DETAIL} />);
    const reader = createInsightMarkdownStyles(getColors('light'), 18);
    expect(mockMarkdownStyles.length).toBeGreaterThan(0);
    for (const style of mockMarkdownStyles) {
      expect(style.body).toEqual(reader.body);
    }
  });

  it('follows the reader’s font-size setting', () => {
    mockFontSize = 24;
    render(<JesusTabBodies tab={tab} detail={DETAIL} />);
    for (const style of mockMarkdownStyles) {
      expect(style.body.fontSize).toBe(24);
    }
  });
});
