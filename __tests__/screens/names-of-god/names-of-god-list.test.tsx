import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import type React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import NamesOfGodListScreen from '@/app/names-of-god/index';

// ── Module mocks ─────────────────────────────────────────────────────────────

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    back: jest.fn(),
    replace: jest.fn(),
    canGoBack: jest.fn().mockReturnValue(true),
  },
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: jest.fn(({ children }: { children: React.ReactNode }) => children),
  useSafeAreaInsets: jest.fn().mockReturnValue({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

const mockGetAll = jest.fn();
jest.mock('@/services/names-of-god-repository', () => ({
  getAll: (...args: unknown[]) => mockGetAll(...args),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const YAHWEH = {
  id: 'yahweh',
  nameEn: 'Yahweh',
  nameOriginal: 'יהוה',
  transliteration: 'YHWH',
  language: 'Hebrew',
  category: 'Personal Name',
  meaning: 'I AM WHO I AM',
  testament: 'OT',
  verseRefs: ['Exodus 3:14'],
};

const THEOS = {
  id: 'theos',
  nameEn: 'Theos',
  nameOriginal: 'Θεός',
  transliteration: 'Theos',
  language: 'Greek',
  category: 'Title',
  meaning: 'God',
  testament: 'NT',
  verseRefs: ['John 1:1'],
};

const ELOHIM = {
  id: 'elohim',
  nameEn: 'Elohim',
  nameOriginal: 'אֱלֹהִים',
  transliteration: 'Elohim',
  language: 'Hebrew',
  category: 'Title',
  meaning: 'God (plural of majesty)',
  testament: 'OT',
  verseRefs: ['Genesis 1:1'],
};

const ALL_NAMES = [YAHWEH, THEOS, ELOHIM];

// ── Helpers ───────────────────────────────────────────────────────────────────

const renderScreen = () =>
  render(
    <SafeAreaProvider>
      <NamesOfGodListScreen />
    </SafeAreaProvider>
  );

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('NamesOfGodListScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAll.mockReturnValue(ALL_NAMES);
  });

  describe('initial render', () => {
    it('renders the screen container', () => {
      renderScreen();
      expect(screen.getByTestId('names-of-god-list-screen')).toBeTruthy();
    });

    it('renders all names from the dataset', () => {
      renderScreen();
      expect(screen.getByText('Yahweh')).toBeTruthy();
      expect(screen.getByText('Theos')).toBeTruthy();
      expect(screen.getByText('Elohim')).toBeTruthy();
    });

    it('shows the name count label', () => {
      renderScreen();
      expect(screen.getByText('3 names')).toBeTruthy();
    });

    it('renders all filter chips', () => {
      renderScreen();
      expect(screen.getByTestId('filter-chip-All')).toBeTruthy();
      expect(screen.getByTestId('filter-chip-Hebrew')).toBeTruthy();
      expect(screen.getByTestId('filter-chip-Greek')).toBeTruthy();
    });

    it('renders the search input', () => {
      renderScreen();
      expect(screen.getByTestId('names-search-input')).toBeTruthy();
    });
  });

  describe('search', () => {
    it('filters list in real-time as user types', async () => {
      renderScreen();
      const input = screen.getByTestId('names-search-input');
      fireEvent.changeText(input, 'yahweh');

      await waitFor(() => {
        expect(screen.getByText('Yahweh')).toBeTruthy();
        expect(screen.queryByText('Theos')).toBeNull();
      });
    });

    it('shows empty state when search returns no results', async () => {
      renderScreen();
      const input = screen.getByTestId('names-search-input');
      fireEvent.changeText(input, 'zzznomatch');

      await waitFor(() => {
        expect(screen.getByText('No names match your search.')).toBeTruthy();
      });
    });

    it('clears search when clear button pressed', async () => {
      renderScreen();
      const input = screen.getByTestId('names-search-input');
      fireEvent.changeText(input, 'yahweh');

      await waitFor(() => expect(screen.getByTestId('names-search-clear')).toBeTruthy());
      fireEvent.press(screen.getByTestId('names-search-clear'));

      await waitFor(() => {
        expect(screen.getByText('Yahweh')).toBeTruthy();
        expect(screen.getByText('Theos')).toBeTruthy();
      });
    });
  });

  describe('filter chips', () => {
    it('filters to Hebrew names when Hebrew chip pressed', async () => {
      renderScreen();
      fireEvent.press(screen.getByTestId('filter-chip-Hebrew'));

      await waitFor(() => {
        expect(screen.getByText('Yahweh')).toBeTruthy();
        expect(screen.getByText('Elohim')).toBeTruthy();
        expect(screen.queryByText('Theos')).toBeNull();
      });
    });

    it('filters to Greek names when Greek chip pressed', async () => {
      renderScreen();
      fireEvent.press(screen.getByTestId('filter-chip-Greek'));

      await waitFor(() => {
        expect(screen.getByText('Theos')).toBeTruthy();
        expect(screen.queryByText('Yahweh')).toBeNull();
      });
    });

    it('shows all names when All chip pressed after filter', async () => {
      renderScreen();
      fireEvent.press(screen.getByTestId('filter-chip-Hebrew'));
      fireEvent.press(screen.getByTestId('filter-chip-All'));

      await waitFor(() => {
        expect(screen.getByText('Yahweh')).toBeTruthy();
        expect(screen.getByText('Theos')).toBeTruthy();
        expect(screen.getByText('Elohim')).toBeTruthy();
      });
    });
  });

  describe('navigation', () => {
    it('navigates to NameDetailScreen when a name row is tapped', () => {
      renderScreen();
      fireEvent.press(screen.getByTestId('name-row-yahweh'));
      expect(router.push).toHaveBeenCalledWith('/names-of-god/yahweh');
    });

    it('calls router.back when back button pressed and canGoBack is true', () => {
      renderScreen();
      fireEvent.press(screen.getByTestId('names-list-back'));
      expect(router.back).toHaveBeenCalled();
    });
  });
});
