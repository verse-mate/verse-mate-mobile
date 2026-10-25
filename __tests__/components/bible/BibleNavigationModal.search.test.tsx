/**
 * Bible search in the navigation sheet: "Go to" references, verse results,
 * and search mode (the title and tabs fold away while searching).
 *
 * The verse search hook is mocked here; its service is covered by
 * __tests__/services/bible-search.test.ts.
 */

import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import type React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { mockEastAndWest } from '@/__tests__/mocks/handlers/bible-search.handlers';
import { BibleNavigationModal } from '@/components/bible/BibleNavigationModal';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { useRecentBooks } from '@/hooks/bible/use-recent-books';
import { useVerseSearch } from '@/hooks/bible/use-verse-search';
import type { VerseSearchResult } from '@/lib/bible-search/types';
import { useBibleTestaments, useTopicsSearch } from '@/src/api';

jest.mock('@/src/api');
jest.mock('@/hooks/bible/use-recent-books');
jest.mock('@/hooks/bible/use-verse-search');
jest.mock('@/hooks/use-bible-version', () => ({
  useBibleVersion: () => ({ bibleVersion: 'NASB1995', isLoading: false }),
}));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
}));

beforeAll(() => {
  const { Gesture } = require('react-native-gesture-handler');
  if (!Gesture.Simultaneous) {
    Gesture.Simultaneous = (...gestures: unknown[]) => gestures[0];
  }
});

const books = [
  { id: 19, name: 'Psalms', testament: 'OT' as const, chapterCount: 150 },
  { id: 40, name: 'Matthew', testament: 'NT' as const, chapterCount: 28 },
  { id: 43, name: 'John', testament: 'NT' as const, chapterCount: 21 },
  { id: 45, name: 'Romans', testament: 'NT' as const, chapterCount: 16 },
  { id: 62, name: '1 John', testament: 'NT' as const, chapterCount: 5 },
];

const inactiveSearch = {
  active: false,
  isPending: false,
  isError: false,
  results: [] as VerseSearchResult[],
  totals: null,
  books: null,
  source: 'online' as const,
  hasMore: false,
  isLoadingMore: false,
  loadMore: jest.fn(),
  filters: {},
  setFilters: jest.fn(),
};

const renderSheet = (props: Partial<React.ComponentProps<typeof BibleNavigationModal>> = {}) => {
  const handlers = {
    onClose: jest.fn(),
    onSelectChapter: jest.fn(),
    onSelectVerse: jest.fn(),
  };
  render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}
    >
      <ThemeProvider>
        <BibleNavigationModal
          visible
          currentBookId={43}
          currentChapter={1}
          {...handlers}
          {...props}
        />
      </ThemeProvider>
    </SafeAreaProvider>
  );
  return { ...handlers, input: screen.getByTestId('books-search-input') };
};

describe('BibleNavigationModal search', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useBibleTestaments).mockReturnValue({ data: books } as never);
    jest.mocked(useTopicsSearch).mockReturnValue({ data: [] } as never);
    jest.mocked(useRecentBooks).mockReturnValue({
      recentBooks: [],
      addRecentBook: jest.fn(),
      clearRecentBooks: jest.fn(),
      isLoading: false,
    } as never);
    jest.mocked(useVerseSearch).mockReturnValue(inactiveSearch);
  });

  it('turns a typed reference into a Go to row and opens the verse', () => {
    const { input, onSelectVerse } = renderSheet();
    fireEvent.changeText(input, 'jn 3.16');

    expect(screen.getByText('John 3:16')).toBeTruthy();
    fireEvent.press(screen.getByTestId('go-to-0'));
    expect(onSelectVerse).toHaveBeenCalledWith(43, 3, 16, undefined);
  });

  it('jumps to a typed reference from the keyboard Search key', () => {
    const { input, onSelectVerse } = renderSheet();
    fireEvent.changeText(input, 'Rom 8:28-39');
    fireEvent(input, 'submitEditing');
    expect(onSelectVerse).toHaveBeenCalledWith(45, 8, 28, 39);
  });

  it('goes to a chapter reference without a verse', () => {
    const { input, onSelectChapter, onSelectVerse } = renderSheet();
    fireEvent.changeText(input, 'Ps 23');
    fireEvent.press(screen.getByTestId('go-to-0'));
    expect(onSelectChapter).toHaveBeenCalledWith(19, 23);
    expect(onSelectVerse).not.toHaveBeenCalled();
  });

  it('does not search verse text for a reference', () => {
    const { input } = renderSheet();
    fireEvent.changeText(input, 'John 3:16');
    expect(jest.mocked(useVerseSearch)).toHaveBeenLastCalledWith('John 3:16', 'NASB1995', false);
  });

  it('lists verse results with the matched words in bold, exact phrase first', () => {
    jest.mocked(useVerseSearch).mockReturnValue({
      ...inactiveSearch,
      active: true,
      results: mockEastAndWest.results as VerseSearchResult[],
      totals: mockEastAndWest.totals,
      books: mockEastAndWest.books as never,
    });
    const { input } = renderSheet();
    fireEvent.changeText(input, 'east and west');

    expect(screen.getByText('Exact phrase')).toBeTruthy();
    expect(screen.getByText('All words')).toBeTruthy();
    expect(screen.getByText('2 verses')).toBeTruthy();
    const row = screen.getByTestId('verse-result-40-8-11');
    expect(row).toBeTruthy();
    // The three matched words render as nested bold Text.
    expect(screen.getAllByText('east').length).toBeGreaterThan(0);
  });

  it('opens a verse result in the reader', () => {
    jest.mocked(useVerseSearch).mockReturnValue({
      ...inactiveSearch,
      active: true,
      results: mockEastAndWest.results as VerseSearchResult[],
      totals: mockEastAndWest.totals,
      books: mockEastAndWest.books as never,
    });
    const { input, onSelectVerse } = renderSheet();
    fireEvent.changeText(input, 'east and west');
    fireEvent.press(screen.getByTestId('verse-result-19-103-12'));
    expect(onSelectVerse).toHaveBeenCalledWith(19, 103, 12, undefined);
  });

  it('pushes the reader route when the screen gives no verse handler', () => {
    jest.mocked(useVerseSearch).mockReturnValue({
      ...inactiveSearch,
      active: true,
      results: mockEastAndWest.results as VerseSearchResult[],
      totals: mockEastAndWest.totals,
      books: mockEastAndWest.books as never,
    });
    const { input } = renderSheet({ onSelectVerse: undefined });
    fireEvent.changeText(input, 'east and west');
    fireEvent.press(screen.getByTestId('verse-result-40-8-11'));
    expect(router.push).toHaveBeenCalledWith('/bible/40/8?verse=11');
  });

  it('filters by testament from the chips', () => {
    const setFilters = jest.fn();
    jest.mocked(useVerseSearch).mockReturnValue({
      ...inactiveSearch,
      active: true,
      results: mockEastAndWest.results as VerseSearchResult[],
      totals: mockEastAndWest.totals,
      books: mockEastAndWest.books as never,
      setFilters,
    });
    const { input } = renderSheet();
    fireEvent.changeText(input, 'east and west');
    fireEvent.press(screen.getByTestId('verse-filter-nt'));
    expect(setFilters).toHaveBeenCalledWith({ testament: 'NT' });
  });

  it('says so when nothing matches', () => {
    jest.mocked(useVerseSearch).mockReturnValue({ ...inactiveSearch, active: true });
    const { input } = renderSheet();
    fireEvent.changeText(input, 'zzqx');
    expect(screen.getByTestId('verse-search-status')).toHaveTextContent(
      'No verses match "zzqx". Try fewer words or check the spelling.'
    );
  });

  it('enters search mode when the field is focused, and its arrow leaves it, clearing the text', () => {
    // The arrow is hidden from accessibility until search mode, and the title
    // and tabs are hidden in it; RNTL skips hidden elements by default.
    const hidden = { includeHiddenElements: true };
    const { input } = renderSheet();
    expect(screen.getByTestId('search-chrome')).toBeTruthy();
    expect(screen.queryByTestId('search-mode-back')).toBeNull();

    fireEvent(input, 'focus');
    expect(screen.queryByTestId('search-chrome')).toBeNull();
    expect(screen.getByTestId('search-chrome', hidden).props.pointerEvents).toBe('none');

    fireEvent.changeText(input, 'love');
    fireEvent.press(screen.getByTestId('search-mode-back'));
    expect(screen.getByTestId('search-chrome')).toBeTruthy();
    expect(screen.queryByTestId('search-mode-back')).toBeNull();
    expect(screen.getByTestId('books-search-input').props.value).toBe('');
  });
});
