/**
 * JesusHubScreen
 *
 * The hub renders from the API's taxonomy rather than a hardcoded list, so the
 * tests pin the two behaviours that depend on that: a category with nothing
 * behind it is not offered, and tapping one routes by its slug.
 */
import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import type React from 'react';
import { translateFallback as mockTranslate } from '@/__tests__/mocks/i18n';
import JesusHubScreen from '@/app/jesus/index';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
  Stack: { Screen: () => null },
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mockTranslate }),
}));

const mockUseOverview = jest.fn();
jest.mock('@/hooks/jesus', () => ({
  useJesusOverview: () => mockUseOverview(),
}));

const OVERVIEW = {
  total_events: 207,
  total_facets: 915,
  sections: [
    {
      section: 'words',
      label: 'His Words',
      blurb: 'What He said',
      types: [
        { type: 'QUESTION', slug: 'questions', label: 'Questions', facet_count: 292 },
        // Empty categories must not be offered — they were the reason the hub
        // showed doors onto "Nothing here yet".
        { type: 'PRAYER', slug: 'prayers', label: 'Prayers', facet_count: 0 },
      ],
    },
  ],
  periods: [],
  themes: [],
  collections: [{ slug: 'the-i-am-statements', name: 'The I AM statements', subtitle: null }],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUseOverview.mockReturnValue({ data: OVERVIEW, isLoading: false });
});

describe('JesusHubScreen', () => {
  it('shows a spinner while the overview loads', () => {
    mockUseOverview.mockReturnValue({ data: undefined, isLoading: true });
    render(<JesusHubScreen />);
    expect(screen.getByTestId('jesus-hub-loading')).toBeTruthy();
  });

  it('offers a category that has content', () => {
    render(<JesusHubScreen />);
    expect(screen.getByTestId('jesus-category-questions')).toBeTruthy();
    expect(screen.getByText('292')).toBeTruthy();
  });

  it('does not offer a category with no content', () => {
    render(<JesusHubScreen />);
    expect(screen.queryByTestId('jesus-category-prayers')).toBeNull();
  });

  it('routes to browse by the category slug', () => {
    render(<JesusHubScreen />);
    fireEvent.press(screen.getByTestId('jesus-category-questions'));
    expect(router.push).toHaveBeenCalledWith('/jesus/browse/questions');
  });

  it('routes to Follow His Life', () => {
    render(<JesusHubScreen />);
    fireEvent.press(screen.getByTestId('jesus-hub-life'));
    expect(router.push).toHaveBeenCalledWith('/jesus/life');
  });

  it('routes to a collection', () => {
    render(<JesusHubScreen />);
    fireEvent.press(screen.getByTestId('jesus-collection-the-i-am-statements'));
    expect(router.push).toHaveBeenCalledWith('/jesus/collection/the-i-am-statements');
  });

  it('renders an empty state when the taxonomy is empty', () => {
    mockUseOverview.mockReturnValue({
      data: { ...OVERVIEW, sections: [], collections: [] },
      isLoading: false,
    });
    render(<JesusHubScreen />);
    expect(screen.getByTestId('jesus-hub-empty')).toBeTruthy();
  });
});
