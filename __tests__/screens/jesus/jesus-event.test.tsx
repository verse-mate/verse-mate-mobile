/**
 * JesusEventScreen
 *
 * The behaviour worth pinning is which tabs appear. They are derived from what
 * the event carries, not shown as a fixed row: Compare is meaningless for a
 * single-account event and Insight is empty until generation has run for it.
 * A tab that opens onto "Nothing recorded yet" is the defect this avoids.
 *
 * Also pinned: Compare is not requested until its tab is opened, and the Story
 * tab reads `event.passages` rather than the top-level `passages`, which this
 * endpoint returns empty.
 */
import { fireEvent, render, screen } from '@testing-library/react-native';
import type React from 'react';
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
    chronology_confidence: 'probable',
    gospels: ['Matthew', 'Mark', 'Luke'],
    location: 'the sea',
    people: [{ person: 'His disciples', role: 'disciples' }],
    passages: [{ display: 'Matthew 8:23-27' }, { display: 'Mark 4:35-41' }],
  },
  words: [
    { slug: 'w1', title: 'Rebuke of fear', text: 'Why are you afraid?', reference: 'Matthew 8:26' },
  ],
  actions: [{ slug: 'a1', title: 'Rebukes wind and sea', text: null, reference: 'Mark 4:39' }],
  // Empty on this endpoint — the real accounts are on `event.passages`.
  passages: [],
  reveals: {
    says_about_himself: [],
    demonstrates: [{ content: 'He rebukes the winds.', source_ref: 'Mark 4:39', provenance: 2 }],
    others_say: [],
    narrator_says: [],
  },
  reactions: [
    { who: 'the disciples', what: 'They were afraid.', source_ref: 'Mark 4:41', provenance: 2 },
  ],
  explanation: { overview: 'They get into a boat.' },
  related: [],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockEvent.mockReturnValue({ data: DETAIL, isLoading: false });
  mockCompare.mockReturnValue({ data: null, isLoading: false });
});

describe('JesusEventScreen', () => {
  it('shows a spinner while loading', () => {
    mockEvent.mockReturnValue({ data: undefined, isLoading: true });
    render(<JesusEventScreen />);
    expect(screen.getByTestId('jesus-event-loading')).toBeTruthy();
  });

  it('reports a failure instead of rendering a blank screen', () => {
    mockEvent.mockReturnValue({ data: null, isLoading: false });
    render(<JesusEventScreen />);
    expect(screen.getByTestId('jesus-event-missing')).toBeTruthy();
  });

  it('quotes what he said on the Said tab', () => {
    // The facet tabs render through their own component, which needs its own
    // `t` — this is the case that caught it missing, since nothing else on the
    // screen reaches that code path until the tab is opened.
    render(<JesusEventScreen />);
    fireEvent.press(screen.getByTestId('jesus-tab-said'));
    expect(screen.getByText('“Why are you afraid?”')).toBeTruthy();
    expect(screen.getByText('Matthew 8:26')).toBeTruthy();
  });

  it('renders the accounts from event.passages', () => {
    render(<JesusEventScreen />);
    expect(screen.getByText('Matthew 8:23-27')).toBeTruthy();
  });

  it('shows reveals and reactions on the story tab', () => {
    render(<JesusEventScreen />);
    expect(screen.getByText('He rebukes the winds.')).toBeTruthy();
    expect(screen.getByText('They were afraid.')).toBeTruthy();
  });

  it('offers Compare when more than one Gospel records the event', () => {
    render(<JesusEventScreen />);
    expect(screen.getByTestId('jesus-tab-compare')).toBeTruthy();
  });

  it('hides Compare for a single-account event', () => {
    mockEvent.mockReturnValue({
      data: { ...DETAIL, event: { ...DETAIL.event, gospels: ['John'] } },
      isLoading: false,
    });
    render(<JesusEventScreen />);
    expect(screen.queryByTestId('jesus-tab-compare')).toBeNull();
  });

  it('hides Insight when nothing has been generated', () => {
    mockEvent.mockReturnValue({ data: { ...DETAIL, explanation: {} }, isLoading: false });
    render(<JesusEventScreen />);
    expect(screen.queryByTestId('jesus-tab-insight')).toBeNull();
  });

  it('does not request Compare until its tab is opened', () => {
    render(<JesusEventScreen />);
    expect(mockCompare).toHaveBeenCalledWith('event-storm-stilled', false);
    fireEvent.press(screen.getByTestId('jesus-tab-compare'));
    expect(mockCompare).toHaveBeenLastCalledWith('event-storm-stilled', true);
  });

  it('shows what a Gospel uniquely adds on the Compare tab', () => {
    mockCompare.mockReturnValue({
      isLoading: false,
      data: {
        note: 'All three record it.',
        accounts: [
          {
            gospel: 'Mark',
            records_it: true,
            passages: [
              {
                display: 'Mark 4:35-41',
                unique_to_account: 'Asleep on the cushion.',
                emphasis: 'vivid detail',
              },
            ],
          },
        ],
      },
    });
    render(<JesusEventScreen />);
    fireEvent.press(screen.getByTestId('jesus-tab-compare'));
    expect(screen.getByText(/Asleep on the cushion\./)).toBeTruthy();
  });
});
