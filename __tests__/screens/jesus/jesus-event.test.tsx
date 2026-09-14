/**
 * JesusEventScreen
 *
 * The event wears the reader's chrome: a Bible / Insight toggle where Bible is
 * the event's own scripture and Insight is the commentary, behind the same
 * Summary / By-Line / Study / Compare pills a chapter uses.
 *
 * The tests pin the two things the first port got wrong — that the scripture is
 * rendered at all (it comes down on the TOP-LEVEL `passages`, which that port
 * recorded as empty), and that the tabs are the reader's four rather than an
 * invented set.
 */
import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { translateFallback as mockTranslate } from '@/__tests__/mocks/i18n';
import JesusEventScreen from '@/app/jesus/event/[slug]';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({ slug: 'event-storm-stilled' }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mockTranslate }),
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
}));

jest.mock('@/components/bible/BibleNavigationModal', () => ({
  BibleNavigationModal: () => null,
}));
jest.mock('@/components/bible/HamburgerMenu', () => ({ HamburgerMenu: () => null }));

const mockEvent = jest.fn();
const mockCompare = jest.fn();
jest.mock('@/hooks/jesus', () => ({
  useJesusEvent: () => mockEvent(),
  useJesusCompare: (slug: string | undefined, enabled: boolean) => mockCompare(slug, enabled),
}));

const DETAIL = {
  event: {
    slug: 'event-storm-stilled',
    title: 'Calming the storm',
    summary: 'Asleep in the stern through a squall.',
    period_name: 'The Galilean Ministry',
    period_slug: 'galilean-ministry',
    chronology_confidence: 'probable',
    gospels: ['Matthew', 'Mark', 'Luke'],
    location: 'the sea',
    approximate_date: 'AD 28',
    people: [{ person: 'His disciples', role: 'disciples' }],
    themes: [{ slug: 'faith', name: 'Faith' }],
    passages: [{ display: 'Matthew 8:23-27' }],
  },
  // The scripture lives HERE, not on event.passages.
  passages: [
    {
      book_id: 40,
      book_name: 'Matthew',
      chapter: 8,
      display: 'Matthew 8:23-27',
      is_primary: true,
      verse_start: 23,
      verse_end: 27,
      verses: [
        { verse_number: 23, text: 'When He got into the boat, His disciples followed Him.' },
        { verse_number: 24, text: 'And behold, there arose a great storm on the sea.' },
      ],
    },
  ],
  words: [
    {
      slug: 'w1',
      title: 'Rebuke of fear',
      text: 'Why are you afraid?',
      reference: 'Matthew 8:26',
      type_slug: 'questions',
    },
  ],
  actions: [{ slug: 'a1', title: 'Rebukes wind and sea', text: null, reference: 'Mark 4:39' }],
  reveals: { says_about_himself: [], demonstrates: [], others_say: [], narrator_says: [] },
  reactions: [],
  explanation: { overview: 'They get into a boat.' },
  related: [],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockEvent.mockReturnValue({ data: DETAIL, isPending: false, fetchStatus: 'idle' });
  mockCompare.mockReturnValue({ data: null, isPending: false, fetchStatus: 'idle' });
});

describe('JesusEventScreen', () => {
  it('renders the scripture, not just the metadata', () => {
    // The whole point of the rebuild: an event reads like a chapter.
    render(<JesusEventScreen />);
    expect(screen.getByText(/When He got into the boat/)).toBeTruthy();
    expect(screen.getByText(/there arose a great storm/)).toBeTruthy();
  });

  it('shows the reference pill for each account', () => {
    render(<JesusEventScreen />);
    expect(screen.getByTestId('jesus-passage-reference-Matthew 8:23-27')).toBeTruthy();
  });

  it('opens the passage in the reader when its pill is tapped', () => {
    render(<JesusEventScreen />);
    fireEvent.press(screen.getByTestId('jesus-passage-reference-Matthew 8:23-27'));
    expect(router.push).toHaveBeenCalledWith('/bible/40/8');
  });

  it('wears the reader chrome rather than a back-arrow header', () => {
    render(<JesusEventScreen />);
    expect(screen.getByTestId('jesus-selector-button')).toBeTruthy();
    expect(screen.getByTestId('jesus-view-bible')).toBeTruthy();
    expect(screen.getByTestId('jesus-view-insight')).toBeTruthy();
  });

  it('hides the insight pills on the Bible side, as the reader does', () => {
    render(<JesusEventScreen />);
    expect(screen.queryByTestId('jesus-event-tabs')).toBeNull();
  });

  it('offers the reader’s own four tabs on the Insight side', () => {
    render(<JesusEventScreen />);
    fireEvent.press(screen.getByTestId('jesus-view-insight'));
    for (const id of ['summary', 'byline', 'study', 'compare']) {
      expect(screen.getByTestId(`jesus-event-tab-${id}`)).toBeTruthy();
    }
  });

  it('opens Insight on Summary', () => {
    render(<JesusEventScreen />);
    fireEvent.press(screen.getByTestId('jesus-view-insight'));
    expect(screen.getByTestId('jesus-event-panel-summary')).toBeTruthy();
    expect(screen.getByText('They get into a boat.')).toBeTruthy();
  });

  it('does not request Compare until its tab is opened', () => {
    render(<JesusEventScreen />);
    fireEvent.press(screen.getByTestId('jesus-view-insight'));
    expect(mockCompare).not.toHaveBeenCalled();
    fireEvent.press(screen.getByTestId('jesus-event-tab-compare'));
    expect(mockCompare).toHaveBeenCalledWith('event-storm-stilled', true);
  });

  it('routes a theme pill to the theme screen', () => {
    render(<JesusEventScreen />);
    fireEvent.press(screen.getByTestId('jesus-event-theme-faith'));
    expect(router.push).toHaveBeenCalledWith('/jesus/theme/faith');
  });

  it('says it is offline rather than claiming the event is missing', () => {
    mockEvent.mockReturnValue({ data: undefined, isPending: true, fetchStatus: 'paused' });
    render(<JesusEventScreen />);
    expect(screen.getByTestId('jesus-event-offline')).toBeTruthy();
    expect(screen.queryByTestId('jesus-event-missing')).toBeNull();
  });

  it('reports a missing event', () => {
    mockEvent.mockReturnValue({ data: null, isPending: false, fetchStatus: 'idle' });
    render(<JesusEventScreen />);
    expect(screen.getByTestId('jesus-event-missing')).toBeTruthy();
  });
});
