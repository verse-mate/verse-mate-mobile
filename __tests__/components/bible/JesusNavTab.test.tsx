/**
 * The Jesus tab inside the book selector.
 *
 * This is the entry point the first port missed entirely — it put the feature
 * behind a hamburger-menu item, where web has a fourth tab in the same selector
 * a reader opens for any book. The tests pin the browse rows, the hub link, and
 * that searching switches to FACETS rather than events, because someone typing
 * "born again" wants the saying and not the scene around it.
 */
import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { translateFallback as mockTranslate } from '@/__tests__/mocks/i18n';
import { JesusNavTab } from '@/components/bible/JesusNavTab';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
}));

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: mockTranslate }) }));

const mockOverview = jest.fn();
const mockSearch = jest.fn();
jest.mock('@/hooks/jesus', () => ({
  useJesusEntriesOverview: () => mockOverview(),
  useJesusEntrySearch: (q: string) => mockSearch(q),
}));

const OVERVIEW = {
  total_entries: 231,
  periods: [{ slug: 'galilee', name: 'Galilee', entry_count: 120 }],
  sections: [
    {
      section: 'words',
      label: 'His Words',
      kinds: [{ kind: 'TEACHING', slug: 'teachings', label: 'Teachings', entry_count: 70 }],
    },
  ],
  themes: [],
  collections: [{ slug: 'the-i-am-statements', name: 'The I AM statements', entry_count: 8 }],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockOverview.mockReturnValue({ data: OVERVIEW, isPending: false, fetchStatus: 'idle' });
  mockSearch.mockReturnValue({ data: undefined, isPending: false, fetchStatus: 'idle' });
});

describe('JesusNavTab', () => {
  it('lists Follow His Life, every kind, and every study', () => {
    render(<JesusNavTab query="" onNavigate={jest.fn()} />);
    expect(screen.getByTestId('jesus-tab-follow-his-life')).toBeTruthy();
    expect(screen.getByTestId('jesus-tab-kind-teachings')).toBeTruthy();
    expect(screen.getByTestId('jesus-tab-study-the-i-am-statements')).toBeTruthy();
  });

  it('sums the periods for the Follow His Life count', () => {
    // There is no total on the wire for this; web sums it the same way.
    render(<JesusNavTab query="" onNavigate={jest.fn()} />);
    expect(screen.getByText('120')).toBeTruthy();
  });

  it('offers a way through to the hub', () => {
    const onNavigate = jest.fn();
    render(<JesusNavTab query="" onNavigate={onNavigate} />);
    fireEvent.press(screen.getByTestId('jesus-tab-open-hub'));
    expect(onNavigate).toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith('/jesus');
  });

  it('routes a kind to its browse screen', () => {
    render(<JesusNavTab query="" onNavigate={jest.fn()} />);
    fireEvent.press(screen.getByTestId('jesus-tab-kind-teachings'));
    expect(router.push).toHaveBeenCalledWith('/jesus/browse/teachings');
  });

  it('searches facets, not events, and opens the entry', () => {
    mockSearch.mockReturnValue({
      data: [
        {
          slug: 'you-must-be-born-again',
          title: 'You must be born again',
          kind_label: 'Claim',
          references: [{ display: 'John 3:3' }],
        },
      ],
      isPending: false,
      fetchStatus: 'idle',
    });
    render(<JesusNavTab query="born again" onNavigate={jest.fn()} />);
    expect(screen.getByTestId('jesus-tab-results')).toBeTruthy();
    fireEvent.press(screen.getByTestId('jesus-tab-entry-you-must-be-born-again'));
    expect(router.push).toHaveBeenCalledWith('/jesus/entry/you-must-be-born-again');
  });

  it('says so when a search matches nothing', () => {
    mockSearch.mockReturnValue({ data: [], isPending: false, fetchStatus: 'idle' });
    render(<JesusNavTab query="zzz" onNavigate={jest.fn()} />);
    expect(screen.queryByTestId('jesus-tab-results')).toBeNull();
    expect(screen.getByText(/Nothing matches/)).toBeTruthy();
  });
});
