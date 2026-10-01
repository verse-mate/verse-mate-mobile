/**
 * JesusPassageLink — the reader bridge.
 *
 * This is the only route into the Jesus corpus that a reader can find without
 * already knowing the section exists, so the tests pin the two properties that
 * make it safe to sit inside the reader: it costs nothing on the chapters that
 * have no event (most of the Bible), and it never renders an error when the
 * lookup fails, because a reader must not be interrupted by a Jesus API outage.
 */
import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { translateFallback as mockTranslate } from '@/__tests__/mocks/i18n';
import { JesusPassageLink } from '@/components/jesus/JesusPassageLink';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mockTranslate }),
}));

const mockForPassage = jest.fn();
jest.mock('@/hooks/jesus', () => ({
  useJesusForPassage: (args: unknown) => mockForPassage(args),
}));

const event = (slug: string, title: string) => ({
  slug,
  title,
  event_type: 'miracle',
  chronology_confidence: 'high',
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('JesusPassageLink', () => {
  it('renders nothing when the chapter carries no event', () => {
    mockForPassage.mockReturnValue({ data: [] });
    render(<JesusPassageLink bookId={1} chapter={1} />);
    expect(screen.queryByTestId('jesus-passage-link')).toBeNull();
  });

  it('renders nothing when the lookup failed, rather than an error', () => {
    mockForPassage.mockReturnValue({ data: undefined, error: new Error('offline') });
    render(<JesusPassageLink bookId={41} chapter={4} />);
    expect(screen.queryByTestId('jesus-passage-link')).toBeNull();
  });

  it('offers the events that touch the passage', () => {
    mockForPassage.mockReturnValue({ data: [event('calming-the-storm', 'Calming the storm')] });
    render(<JesusPassageLink bookId={41} chapter={4} />);
    expect(screen.getByTestId('jesus-passage-link')).toBeTruthy();
    expect(screen.getByText('Calming the storm')).toBeTruthy();
  });

  it('routes to the event by slug', () => {
    mockForPassage.mockReturnValue({ data: [event('calming-the-storm', 'Calming the storm')] });
    render(<JesusPassageLink bookId={41} chapter={4} />);
    fireEvent.press(screen.getByText('Calming the storm'));
    expect(router.push).toHaveBeenCalledWith('/jesus/event/calming-the-storm');
  });

  it('caps a busy chapter rather than pushing the footer off the screen', () => {
    // Mark 5 alone carries several. The reader is still reading; this is a
    // pointer, not a table of contents.
    mockForPassage.mockReturnValue({
      data: [
        event('a', 'Event A'),
        event('b', 'Event B'),
        event('c', 'Event C'),
        event('d', 'Event D'),
        event('e', 'Event E'),
      ],
    });
    render(<JesusPassageLink bookId={41} chapter={5} />);
    expect(screen.queryByText('Event D')).toBeNull();
  });

  it('passes the verse through so a selection narrows the lookup', () => {
    mockForPassage.mockReturnValue({ data: [] });
    render(<JesusPassageLink bookId={41} chapter={4} verse={39} />);
    expect(mockForPassage).toHaveBeenCalledWith(
      expect.objectContaining({ bookId: 41, chapter: 4, verse: 39 })
    );
  });
});
