import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import type React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import NameDetailScreen from '@/app/names-of-god/[nameId]';
import type { ParsedVerseRef } from '@/utils/names-of-god/parse-verse-ref';

// ── Module mocks ─────────────────────────────────────────────────────────────

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    back: jest.fn(),
    replace: jest.fn(),
    canGoBack: jest.fn().mockReturnValue(true),
  },
  useLocalSearchParams: jest.fn().mockReturnValue({ nameId: 'yahweh' }),
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: jest.fn(({ children }: { children: React.ReactNode }) => children),
  useSafeAreaInsets: jest.fn().mockReturnValue({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('@/hooks/use-bible-version', () => ({
  useBibleVersion: jest.fn().mockReturnValue({ bibleVersion: 'NASB1995', isLoading: false }),
}));

const mockVerseTexts = jest.fn();
jest.mock('@/hooks/names-of-god/use-verse-texts', () => ({
  useVerseTexts: (...args: unknown[]) => mockVerseTexts(...args),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

const mockRef = (
  bookId: number,
  chapter: number,
  verse: number,
  bookName: string
): { ref: ParsedVerseRef; text: string; isLoading: boolean; hasError: boolean } => ({
  ref: { raw: `${bookName} ${chapter}:${verse}`, bookId, bookName, chapter, verse },
  text: `Verse text for ${bookName} ${chapter}:${verse}`,
  isLoading: false,
  hasError: false,
});

const renderScreen = () =>
  render(
    <SafeAreaProvider>
      <NameDetailScreen />
    </SafeAreaProvider>
  );

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('NameDetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: return verse texts for Yahweh's first few refs
    mockVerseTexts.mockReturnValue([
      mockRef(2, 3, 14, 'Exodus'),
      mockRef(2, 6, 2, 'Exodus'),
      mockRef(19, 83, 18, 'Psalms'),
    ]);
  });

  describe('Given name is found', () => {
    it('renders the English name', () => {
      renderScreen();
      const el = screen.getByTestId('name-detail-english');
      expect(el).toBeTruthy();
      expect(el.props.children).toBe('Yahweh');
    });

    it('renders the original script', () => {
      renderScreen();
      const original = screen.getByTestId('name-detail-original');
      expect(original).toBeTruthy();
    });

    it('renders the transliteration', () => {
      renderScreen();
      expect(screen.getByTestId('name-detail-transliteration')).toBeTruthy();
    });

    it('renders the meaning text', () => {
      renderScreen();
      expect(screen.getByTestId('name-detail-meaning')).toBeTruthy();
    });

    it('renders Old Testament badge for Yahweh', () => {
      renderScreen();
      expect(screen.getByText('Old Testament')).toBeTruthy();
    });

    it('renders verse rows for each ref on the page', () => {
      renderScreen();
      expect(screen.getByTestId('verse-row-2-3-14')).toBeTruthy();
      expect(screen.getByTestId('verse-row-2-6-2')).toBeTruthy();
      expect(screen.getByTestId('verse-row-19-83-18')).toBeTruthy();
    });

    it('shows verse text snippet in each row', () => {
      renderScreen();
      expect(screen.getByText('Verse text for Exodus 3:14')).toBeTruthy();
    });

    it('navigates to Bible reader when a verse row is tapped', () => {
      renderScreen();
      fireEvent.press(screen.getByTestId('verse-row-2-3-14'));
      expect(router.push).toHaveBeenCalledWith('/bible/2/3?verse=14');
    });

    it('navigates back when back button is pressed', () => {
      renderScreen();
      fireEvent.press(screen.getByTestId('name-detail-back'));
      expect(router.back).toHaveBeenCalled();
    });
  });

  describe('Given a verse is loading', () => {
    it('shows a loading indicator for that verse', () => {
      mockVerseTexts.mockReturnValue([
        {
          ref: { raw: 'Exodus 3:14', bookId: 2, bookName: 'Exodus', chapter: 3, verse: 14 },
          text: null,
          isLoading: true,
          hasError: false,
        },
      ]);
      renderScreen();
      // The ActivityIndicator has no text — verify the verse row still renders
      expect(screen.getByTestId('verse-row-2-3-14')).toBeTruthy();
    });
  });

  describe('Given a verse has an error', () => {
    it('shows an error message for that verse', () => {
      mockVerseTexts.mockReturnValue([
        {
          ref: { raw: 'Exodus 3:14', bookId: 2, bookName: 'Exodus', chapter: 3, verse: 14 },
          text: null,
          isLoading: false,
          hasError: true,
        },
      ]);
      renderScreen();
      expect(screen.getByText("Couldn't load verse text")).toBeTruthy();
    });
  });

  describe('Given the nameId is not found', () => {
    it('shows not-found error state', () => {
      const { useLocalSearchParams } = require('expo-router');
      useLocalSearchParams.mockReturnValue({ nameId: 'nonexistent-name-xyz' });
      mockVerseTexts.mockReturnValue([]);
      renderScreen();
      expect(screen.getByText('Name not found')).toBeTruthy();
    });
  });

  describe('Given pagination', () => {
    it('does not render pagination controls when all refs fit on one page', () => {
      // Yahweh has 5 refs in the dataset which is < 30
      renderScreen();
      expect(screen.queryByTestId('name-detail-pagination')).toBeNull();
    });
  });
});
