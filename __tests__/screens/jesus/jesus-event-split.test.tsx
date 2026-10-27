/**
 * JesusEventScreen on a split-view tablet (landscape iPad).
 *
 * The reader and a topic lay out there as scripture left, insight right; an
 * event does the same rather than stretching the phone layout across the
 * screen. The menu moves to the insight pane, as on the reader's and the
 * topic's, so it is still reachable when the scripture pane is collapsed.
 */
import { fireEvent, render, screen } from '@testing-library/react-native';
import { translateFallback as mockTranslate } from '@/__tests__/mocks/i18n';
import JesusEventScreen from '@/app/jesus/event/[slug]';

jest.mock('@/hooks/use-device-info', () => ({
  useDeviceInfo: () => ({
    isTablet: true,
    isLandscape: true,
    screenWidth: 1180,
    screenHeight: 820,
    smallerDimension: 820,
    largerDimension: 1180,
    useSplitView: true,
    splitRatio: 0.5,
    setSplitRatio: jest.fn(),
    splitViewMode: 'split',
    setSplitViewMode: jest.fn(),
    isLoaded: true,
  }),
  useOrientation: () => ({ isLandscape: true, isPortrait: false }),
}));

// SplitView's divider gestures need the native gesture handler; the panes are what is under test.
jest.mock('@/components/ui/SplitView', () => {
  const { View } = require('react-native');
  return {
    SplitView: ({ leftContent, rightContent }: { leftContent: unknown; rightContent: unknown }) => (
      <View>
        {leftContent}
        {rightContent}
      </View>
    ),
  };
});

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
  Stack: { Screen: () => null },
  useNavigation: () => ({ getState: () => undefined, dispatch: jest.fn() }),
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
const mockMenu = jest.fn();
jest.mock('@/components/bible/HamburgerMenu', () => ({
  HamburgerMenu: (props: { visible: boolean }) => {
    mockMenu(props.visible);
    return null;
  },
}));
jest.mock('@/hooks/use-chapter-alignment', () => ({
  useChapterAlignment: () => null,
  isEnglishVersion: () => true,
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

describe('JesusEventScreen — split view', () => {
  it('shows the scripture and the insight side by side', () => {
    render(<JesusEventScreen />);
    expect(screen.getByText(/When He got into the boat/)).toBeTruthy();
    expect(screen.getByTestId('jesus-insight-pane')).toBeTruthy();
    expect(screen.getByTestId('jesus-event-panel-summary')).toBeTruthy();
    expect(screen.getByText('They get into a boat.')).toBeTruthy();
  });

  it('names the pane the way the topic pane is named', () => {
    render(<JesusEventScreen />);
    expect(screen.getByText('Calming the storm Insights')).toBeTruthy();
  });

  it('drops the Bible / Insight toggle, since both are on screen', () => {
    render(<JesusEventScreen />);
    expect(screen.queryByTestId('jesus-view-bible')).toBeNull();
    expect(screen.queryByTestId('jesus-view-insight')).toBeNull();
  });

  it('keeps the back arrow and the selector on the scripture side', () => {
    render(<JesusEventScreen />);
    expect(screen.getByTestId('jesus-event-back')).toBeTruthy();
    expect(screen.getByTestId('jesus-selector-button')).toBeTruthy();
  });

  it('switches the insight with the tab row, scripture staying put', () => {
    render(<JesusEventScreen />);
    fireEvent.press(screen.getByTestId('jesus-event-tab-compare'));
    expect(screen.getByTestId('jesus-event-panel-compare')).toBeTruthy();
    expect(mockCompare).toHaveBeenCalledWith('event-storm-stilled', true);
    expect(screen.getByText(/When He got into the boat/)).toBeTruthy();
  });

  it('has one menu button, on the insight pane, and it opens the menu', () => {
    render(<JesusEventScreen />);
    const buttons = screen.getAllByTestId('hamburger-menu-button');
    expect(buttons).toHaveLength(1);
    fireEvent.press(buttons[0]);
    expect(mockMenu).toHaveBeenLastCalledWith(true);
  });

  it('falls back to the single-pane layout while loading', () => {
    mockEvent.mockReturnValue({ data: undefined, isPending: true, fetchStatus: 'fetching' });
    render(<JesusEventScreen />);
    expect(screen.queryByTestId('jesus-insight-pane')).toBeNull();
    expect(screen.getByTestId('jesus-event-loading')).toBeTruthy();
  });
});
