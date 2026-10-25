/**
 * The By-Line tab renders its commentary OPEN, and folds only when the reader asks.
 *
 * The first version made every verse a collapsed accordion row, so the tab arrived as a bare list of
 * references and reading it cost one tap per verse. Then Andy asked for web's Expand All / Collapse
 * All on the reader's By Line ("expand/contract all missing on line by line"), and this tab shares
 * that component — so the rows can fold now, but they still arrive open.
 *
 * This pins the behaviour rather than the markup: the words are on screen after a plain render,
 * with no press.
 */
import { fireEvent, render, screen } from '@testing-library/react-native';
import { translateFallback as mockTranslate } from '@/__tests__/mocks/i18n';
import { JesusTabBodies } from '@/components/jesus/JesusTabBodies';
import type { JesusEventDetail } from '@/types/jesus';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mockTranslate }),
}));

const mockExplanation = jest.fn();
const mockByLineLanguage = jest.fn();
jest.mock('@/src/api', () => ({
  useBibleByLine: (
    bookId: number,
    chapter: number,
    _version: string | undefined,
    options?: { language?: string }
  ) => {
    mockByLineLanguage(options?.language);
    return mockExplanation(bookId, chapter, 'byline');
  },
  useStudy: () => ({ data: null, isPending: false }),
}));
jest.mock('@/hooks/use-preferred-language', () => ({ usePreferredLanguage: () => 'pt-BR' }));

/** Two accounts of one event, so the per-account grouping is exercised too. */
const DETAIL = {
  event: { slug: 'event-baptism', title: 'The baptism of Jesus' },
  passages: [
    {
      book_id: 40,
      book_name: 'Matthew',
      chapter: 3,
      display: 'Matthew 3:13-17',
      is_primary: true,
      verse_start: 13,
      verse_end: 14,
      verses: [],
    },
    {
      book_id: 41,
      book_name: 'Mark',
      chapter: 1,
      display: 'Mark 1:9-11',
      is_primary: false,
      verse_start: 9,
      verse_end: 9,
      verses: [],
    },
  ],
} as unknown as JesusEventDetail;

const MATTHEW = [
  '## Matthew 3:13',
  '> Then Jesus arrived from Galilee.',
  '',
  'He comes to be baptised.',
  '',
  '## Matthew 3:14',
  '> But John tried to prevent Him.',
  '',
  'John protests the order of it.',
  '',
  // Outside the event's 13-14 span — must be filtered out, open or not.
  '## Matthew 3:17',
  '',
  'The voice from heaven.',
].join('\n');

const MARK = [
  '## Mark 1:9',
  '> In those days Jesus came from Nazareth.',
  '',
  'Mark opens at the Jordan.',
].join('\n');

beforeEach(() => {
  jest.clearAllMocks();
  mockExplanation.mockImplementation((bookId: number) => ({
    data: { content: bookId === 40 ? MATTHEW : MARK },
    isPending: false,
  }));
});

describe('By-Line tab', () => {
  it('shows every verse’s commentary without a tap', () => {
    render(<JesusTabBodies tab="byline" detail={DETAIL} />);

    expect(screen.getByText(/He comes to be baptised/)).toBeTruthy();
    expect(screen.getByText(/John protests the order of it/)).toBeTruthy();
    expect(screen.getByText(/Mark opens at the Jordan/)).toBeTruthy();
  });

  it('folds every account from Collapse All and unfolds it from Expand All', () => {
    render(<JesusTabBodies tab="byline" detail={DETAIL} />);

    fireEvent.press(screen.getByTestId('jesus-byline-toggle-all'));
    expect(screen.queryByText(/He comes to be baptised/)).toBeNull();
    expect(screen.queryByText(/Mark opens at the Jordan/)).toBeNull();
    // The references stay, so a folded tab is still a list to pick from.
    expect(screen.getByText('Matthew 3:13')).toBeTruthy();
    expect(screen.getByText('Expand All')).toBeTruthy();

    fireEvent.press(screen.getByTestId('jesus-byline-toggle-all'));
    expect(screen.getByText(/He comes to be baptised/)).toBeTruthy();
    expect(screen.getByText(/Mark opens at the Jordan/)).toBeTruthy();
    expect(screen.getByText('Collapse All')).toBeTruthy();
  });

  it('folds one verse from its reference and leaves the rest open', () => {
    render(<JesusTabBodies tab="byline" detail={DETAIL} />);

    fireEvent.press(screen.getByTestId('jesus-byline-row-40-3-13-toggle'));
    expect(screen.queryByText(/He comes to be baptised/)).toBeNull();
    expect(screen.getByText(/John protests the order of it/)).toBeTruthy();
    // Something is folded, so the control offers to expand.
    expect(screen.getByText('Expand All')).toBeTruthy();
  });

  it('keeps each account’s rows to the verses the event spans', () => {
    render(<JesusTabBodies tab="byline" detail={DETAIL} />);

    expect(screen.queryByText(/The voice from heaven/)).toBeNull();
  });

  it('names an account whose chapter has no commentary yet', () => {
    mockExplanation.mockImplementation((bookId: number) => ({
      data: { content: bookId === 40 ? MATTHEW : '' },
      isPending: false,
    }));
    render(<JesusTabBodies tab="byline" detail={DETAIL} />);

    // Absent reads as "this verse has no explanation"; named reads as
    // "it has not been written".
    expect(screen.getByTestId('jesus-byline-empty-Mark 1:9-11')).toBeTruthy();
  });

  it("asks for the commentary in the reader's language, not English for everyone", () => {
    mockByLineLanguage.mockClear();
    render(<JesusTabBodies tab="byline" detail={DETAIL} />);
    expect(mockByLineLanguage).toHaveBeenCalledWith('pt-BR');
    expect(mockByLineLanguage).not.toHaveBeenCalledWith(undefined);
  });
});
