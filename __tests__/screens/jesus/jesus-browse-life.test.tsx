/**
 * JesusBrowseScreen and JesusLifeScreen.
 *
 * Both render server-side grouping — topics for browse, periods for the
 * timeline — rather than bucketing client-side, so the tests pin that the
 * groups survive into sections and that an empty response is a stated empty
 * state rather than a blank scroll.
 */
import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import type React from 'react';
import { translateFallback as mockTranslate } from '@/__tests__/mocks/i18n';
import JesusBrowseScreen from '@/app/jesus/browse/[type]';
import JesusLifeScreen from '@/app/jesus/life';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({ type: 'questions' }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mockTranslate }),
}));

const mockBrowse = jest.fn();
const mockLife = jest.fn();
jest.mock('@/hooks/jesus', () => ({
  useJesusBrowse: () => mockBrowse(),
  useJesusLife: () => mockLife(),
}));

const EVENT = {
  slug: 'event-storm-stilled',
  title: 'Calming the storm',
  summary: 'Asleep in the stern.',
  chronology_confidence: 'probable',
  gospels: ['Matthew', 'Mark', 'Luke'],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockBrowse.mockReturnValue({
    isPending: false,
    fetchStatus: 'idle',
    data: {
      type: { label: 'Questions', intro: 'Jesus asked far more than He answered.' },
      topics: [
        { slug: 'kingdom', name: 'Kingdom', description: 'The reign of God.', events: [EVENT] },
      ],
      truncated: false,
    },
  });
  mockLife.mockReturnValue({
    isPending: false,
    fetchStatus: 'idle',
    data: [
      {
        slug: 'galilean',
        name: 'The Galilean Ministry',
        subtitle: 'Around the lake',
        events: [EVENT],
      },
    ],
  });
});

describe('JesusBrowseScreen', () => {
  it('renders the server topic groups as sections', () => {
    render(<JesusBrowseScreen />);
    expect(screen.getByText('Kingdom')).toBeTruthy();
    expect(screen.getByText('The reign of God.')).toBeTruthy();
  });

  it('routes to the event', () => {
    render(<JesusBrowseScreen />);
    fireEvent.press(screen.getByTestId('jesus-event-event-storm-stilled'));
    expect(router.push).toHaveBeenCalledWith('/jesus/event/event-storm-stilled');
  });

  it('keeps every event tappable even when its saying is quoted above', () => {
    // The points are quotes, not links. Dropping the events whose facet was
    // already quoted left a topic with nothing to tap — web keeps the card and
    // only hides the repeated quote on it.
    mockBrowse.mockReturnValue({
      isPending: false,
      fetchStatus: 'idle',
      data: {
        type: { label: 'Miracles', plural: 'miracles' },
        topics: [
          {
            slug: 'kingdom',
            name: 'Kingdom',
            description: null,
            points: [{ slug: EVENT.slug, title: 'A saying', text: 'Why are you afraid?' }],
            events: [EVENT],
          },
        ],
        truncated: false,
      },
    });
    render(<JesusBrowseScreen />);
    fireEvent.press(screen.getByTestId(`jesus-event-${EVENT.slug}`));
    expect(router.push).toHaveBeenCalledWith(`/jesus/event/${EVENT.slug}`);
  });

  it('leads an action facet with its deed, not an empty pair of quote marks', () => {
    // A WORD facet carries `text` (the saying); an ACTION facet does not. The
    // browse screen quoted it unconditionally, so every miracle card opened
    // with a bare “” above its summary.
    mockBrowse.mockReturnValue({
      isPending: false,
      fetchStatus: 'idle',
      data: {
        type: { label: 'Miracles', plural: 'miracles' },
        topics: [
          {
            slug: 'kingdom',
            name: 'Kingdom',
            description: null,
            events: [],
            points: [
              {
                slug: 'water-into-wine',
                title: 'Water into wine at Cana',
                text: null,
                summary: 'He turns six stone jars of water into the best wine.',
                reference: 'John 2:1-11',
              },
            ],
          },
        ],
        truncated: false,
      },
    });
    render(<JesusBrowseScreen />);
    expect(screen.getByText('Water into wine at Cana')).toBeTruthy();
    expect(screen.queryByText('“”')).toBeNull();
  });

  it('states an empty category rather than showing a blank list', () => {
    mockBrowse.mockReturnValue({
      isPending: false,
      fetchStatus: 'idle',
      data: { type: {}, topics: [], truncated: false },
    });
    render(<JesusBrowseScreen />);
    expect(screen.getByTestId('jesus-browse-empty')).toBeTruthy();
  });

  it('says so when the server cut the category short', () => {
    mockBrowse.mockReturnValue({
      isPending: false,
      fetchStatus: 'idle',
      data: {
        type: { label: 'Questions' },
        topics: [{ slug: 'k', name: 'Kingdom', description: null, events: [EVENT], points: [] }],
        truncated: true,
      },
    });
    render(<JesusBrowseScreen />);
    expect(screen.getByTestId('jesus-topic-truncated')).toBeTruthy();
  });
});

describe('JesusLifeScreen', () => {
  it('renders periods in the order the corpus curated', () => {
    render(<JesusLifeScreen />);
    expect(screen.getByText('The Galilean Ministry')).toBeTruthy();
    expect(screen.getByText('Around the lake')).toBeTruthy();
  });

  it('states an empty timeline rather than showing nothing', () => {
    mockLife.mockReturnValue({ isPending: false, fetchStatus: 'idle', data: [] });
    render(<JesusLifeScreen />);
    expect(screen.getByTestId('jesus-life-empty')).toBeTruthy();
  });

  it('drops a period with nothing catalogued in it', () => {
    // A SectionList draws the header of an empty section regardless, so an
    // unfiltered period reads as a heading the app forgot to fill.
    mockLife.mockReturnValue({
      isPending: false,
      fetchStatus: 'idle',
      data: [
        { slug: 'hidden', name: 'The Hidden Years', subtitle: null, events: [] },
        { slug: 'galilee', name: 'The Galilean Ministry', subtitle: null, events: [EVENT] },
      ],
    });
    render(<JesusLifeScreen />);
    expect(screen.queryByText('The Hidden Years')).toBeNull();
    expect(screen.getByText('The Galilean Ministry')).toBeTruthy();
  });

  it('reports an all-empty timeline as empty, not as a list of bare headings', () => {
    mockLife.mockReturnValue({
      isPending: false,
      fetchStatus: 'idle',
      data: [{ slug: 'hidden', name: 'The Hidden Years', subtitle: null, events: [] }],
    });
    render(<JesusLifeScreen />);
    expect(screen.getByTestId('jesus-life-empty')).toBeTruthy();
  });
});
