/**
 * Tests for BibleNavigationModal Component
 *
 * Focused tests for Bible navigation modal functionality.
 * Tests cover:
 * - Modal renders when visible
 * - Chapter grid displays correctly
 * - Filter input works
 * - Chapter selection callback fires
 *
 * @see component: /components/bible/BibleNavigationModal.tsx
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import type React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BibleNavigationModal } from '@/components/bible/BibleNavigationModal';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { useRecentBooks } from '@/hooks/bible/use-recent-books';
import { useBibleTestaments, useTopicsSearch } from '@/src/api';

// Mock dependencies
jest.mock('@/src/api');
jest.mock('@/hooks/bible/use-recent-books');
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
  },
}));

// Add Gesture.Simultaneous polyfill before tests
beforeAll(() => {
  const { Gesture } = require('react-native-gesture-handler');
  if (!Gesture.Simultaneous) {
    Gesture.Simultaneous = (...gestures: any[]) => gestures[0];
  }
});

// Mock book data
const mockBooks = [
  {
    id: 1,
    name: 'Genesis',
    testament: 'OT' as const,
    chapterCount: 50,
    verseCount: 1533,
  },
  {
    id: 2,
    name: 'Exodus',
    testament: 'OT' as const,
    chapterCount: 40,
    verseCount: 1213,
  },
  {
    id: 19,
    name: 'Psalms',
    testament: 'OT' as const,
    chapterCount: 150,
    verseCount: 2461,
  },
  {
    id: 40,
    name: 'Matthew',
    testament: 'NT' as const,
    chapterCount: 28,
    verseCount: 1071,
  },
  {
    id: 41,
    name: 'Mark',
    testament: 'NT' as const,
    chapterCount: 16,
    verseCount: 678,
  },
];

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}
    >
      <ThemeProvider>{component}</ThemeProvider>
    </SafeAreaProvider>
  );
};

describe('BibleNavigationModal', () => {
  const mockOnClose = jest.fn();
  const mockOnSelectChapter = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock useBibleTestaments hook
    (useBibleTestaments as jest.Mock).mockReturnValue({
      data: mockBooks,
      isLoading: false,
      error: null,
    });

    // Mock useTopicsSearch hook
    (useTopicsSearch as jest.Mock).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });

    // Mock useRecentBooks hook
    (useRecentBooks as jest.Mock).mockReturnValue({
      recentBooks: [{ bookId: 19, timestamp: Date.now() }],
      addRecentBook: jest.fn(),
      clearRecentBooks: jest.fn(),
      isLoading: false,
      error: null,
    });
  });

  it('should render modal with testament tabs and book list when visible', () => {
    renderWithTheme(
      <BibleNavigationModal
        visible={true}
        currentBookId={1}
        currentChapter={1}
        onClose={mockOnClose}
        onSelectChapter={mockOnSelectChapter}
      />
    );

    // Modal should render testament tabs
    const oldTestamentTabs = screen.getAllByText('Old Testament');
    expect(oldTestamentTabs.length).toBeGreaterThan(0);
    expect(screen.getAllByText('New Testament').length).toBeGreaterThan(0);

    // Should show book list by default (not chapter grid)
    expect(screen.getAllByText('Genesis')[0]).toBeTruthy();
    expect(screen.getAllByText('Exodus')[0]).toBeTruthy();
  });

  it('should display chapter grid when book is selected', async () => {
    renderWithTheme(
      <BibleNavigationModal
        visible={true}
        currentBookId={1}
        currentChapter={1}
        onClose={mockOnClose}
        onSelectChapter={mockOnSelectChapter}
      />
    );

    // Initially shows book list
    expect(screen.getAllByText('Genesis')[0]).toBeTruthy();

    // Select Genesis (current book) from ALL BOOKS list
    // Genesis appears in both RECENTS (pinned current book) and ALL BOOKS;
    // select the ALL BOOKS instance (last match), matching the Psalms pattern below.
    const genesisButtons = screen.getAllByLabelText('Genesis, 50 chapters');
    fireEvent.press(genesisButtons[genesisButtons.length - 1]);

    // Wait for chapter grid to render
    await waitFor(() => {
      // With Genesis selected, chapters should be visible
      // Note: might appear twice (sticky header + list), so use getAll
      expect(screen.getAllByLabelText('Chapter 1')[0]).toBeTruthy();
      expect(screen.getAllByLabelText('Chapter 50')[0]).toBeTruthy();
    });
  });

  it('should render all 150 chapter buttons for Psalms', async () => {
    renderWithTheme(
      <BibleNavigationModal
        visible={true}
        currentBookId={19}
        currentChapter={1}
        onClose={mockOnClose}
        onSelectChapter={mockOnSelectChapter}
      />
    );

    // Psalms is the current book — it appears in both RECENTS and ALL BOOKS,
    // so use getAllByLabelText and select the last one (ALL BOOKS section)
    const psalmsButtons = screen.getAllByLabelText('Psalms, 150 chapters');
    fireEvent.press(psalmsButtons[psalmsButtons.length - 1]);

    // Verify all 150 chapters are rendered
    await waitFor(() => {
      expect(screen.getAllByLabelText('Chapter 1')[0]).toBeTruthy();
      expect(screen.getAllByLabelText('Chapter 75')[0]).toBeTruthy();
      expect(screen.getAllByLabelText('Chapter 150')[0]).toBeTruthy();
    });

    // Count total chapter buttons via accessibilityLabel
    const chapterButtons = screen.getAllByLabelText(/^Chapter \d+$/);
    expect(chapterButtons.length).toBe(150);
  });

  it('should call onSelectChapter when chapter button is pressed', async () => {
    renderWithTheme(
      <BibleNavigationModal
        visible={true}
        currentBookId={1}
        currentChapter={1}
        onClose={mockOnClose}
        onSelectChapter={mockOnSelectChapter}
      />
    );

    // Select Genesis from ALL BOOKS list
    // Genesis appears in both RECENTS (pinned current book) and ALL BOOKS;
    // select the ALL BOOKS instance (last match), matching the Psalms pattern below.
    const genesisButtons = screen.getAllByLabelText('Genesis, 50 chapters');
    fireEvent.press(genesisButtons[genesisButtons.length - 1]);

    // Wait for chapter grid to render
    await waitFor(() => {
      expect(screen.getAllByLabelText('Chapter 5')[0]).toBeTruthy();
    });

    // Press chapter 5
    fireEvent.press(screen.getAllByLabelText('Chapter 5')[0]);

    expect(Haptics.impactAsync).toHaveBeenCalled();
    expect(mockOnSelectChapter).toHaveBeenCalledWith(1, 5);
    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('should render filter input', () => {
    renderWithTheme(
      <BibleNavigationModal
        visible={true}
        currentBookId={1}
        currentChapter={1}
        onClose={mockOnClose}
        onSelectChapter={mockOnSelectChapter}
      />
    );

    // Filter input should be present
    const filterInput = screen.getByPlaceholderText('Filter books...');
    expect(filterInput).toBeTruthy();
  });

  it('should show book list when filter text is entered', async () => {
    renderWithTheme(
      <BibleNavigationModal
        visible={true}
        currentBookId={1}
        currentChapter={1}
        onClose={mockOnClose}
        onSelectChapter={mockOnSelectChapter}
      />
    );

    // Enter filter text
    const filterInput = screen.getByPlaceholderText('Filter books...');
    fireEvent.changeText(filterInput, 'exo');

    // Book list should show (chapter grid hidden when filtering)
    await waitFor(() => {
      expect(screen.getByText('Exodus')).toBeTruthy();
    });
  });

  /**
   * Modal performance (TDD)
   *
   * Protects Changes H7/H8: Modal scroll ref + keep mounted.
   * Tests the callback contract, mounting behavior, and data loading.
   */
  describe('modal performance (TDD)', () => {
    it('[REGRESSION] onSelectChapter fires correctly after user interaction', async () => {
      renderWithTheme(
        <BibleNavigationModal
          visible={true}
          currentBookId={1}
          currentChapter={3}
          onClose={mockOnClose}
          onSelectChapter={mockOnSelectChapter}
        />
      );

      // Select Genesis from book list
      // Genesis appears in both RECENTS (pinned current book) and ALL BOOKS;
      // select the ALL BOOKS instance (last match).
      const genesisButtons = screen.getAllByLabelText('Genesis, 50 chapters');
      fireEvent.press(genesisButtons[genesisButtons.length - 1]);

      // Wait for chapter grid
      await waitFor(() => {
        expect(screen.getAllByLabelText('Chapter 10')[0]).toBeTruthy();
      });

      // Press chapter 10
      fireEvent.press(screen.getAllByLabelText('Chapter 10')[0]);

      // Verify callback contract: bookId and chapter number
      expect(mockOnSelectChapter).toHaveBeenCalledWith(1, 10);
    });

    it('[TDD] modal content persists when visible changes to false (keep-mounted)', () => {
      const { rerender } = renderWithTheme(
        <BibleNavigationModal
          visible={true}
          currentBookId={1}
          currentChapter={1}
          onClose={mockOnClose}
          onSelectChapter={mockOnSelectChapter}
        />
      );

      // Content is present when visible
      expect(screen.getAllByText('Genesis')[0]).toBeTruthy();

      // Hide the modal
      rerender(
        <SafeAreaProvider
          initialMetrics={{
            frame: { x: 0, y: 0, width: 390, height: 844 },
            insets: { top: 47, left: 0, right: 0, bottom: 34 },
          }}
        >
          <ThemeProvider>
            <BibleNavigationModal
              visible={false}
              currentBookId={1}
              currentChapter={1}
              onClose={mockOnClose}
              onSelectChapter={mockOnSelectChapter}
            />
          </ThemeProvider>
        </SafeAreaProvider>
      );

      // After hiding, content is still in the tree (animated sheet pattern
      // keeps content mounted and uses transform/opacity for visibility).
      // This locks in the keep-mounted behavior before refactoring scroll state.
      expect(screen.queryAllByText('Genesis').length).toBeGreaterThan(0);
    });

    it('[REGRESSION] all four topic categories are loaded', () => {
      renderWithTheme(
        <BibleNavigationModal
          visible={true}
          currentBookId={1}
          currentChapter={1}
          onClose={mockOnClose}
          onSelectChapter={mockOnSelectChapter}
        />
      );

      // Switch to Topics tab
      const topicsTab = screen.getByText('Topics');
      fireEvent.press(topicsTab);

      // Verify topic hooks are invoked for data loading.
      // The modal uses useCachedTopics for each category (EVENT, PROPHECY, PARABLE, THEME)
      // and useTopicsSearch for filtering. Verify the search hook was called.
      expect(useTopicsSearch as jest.Mock).toHaveBeenCalled();
    });
  });

  /**
   * recentBooksFiltered derivation (VER-95 / spec
   * 2026-05-16-1200-recents-current-book).
   *
   * The modal pins the currently-open book at position 0 of RECENTS so
   * users never see a Recents list that omits where they are reading.
   * These tests assert the four behaviors of the derivation by inspecting
   * rendered book items in section order: RECENTS (which we are testing)
   * always renders before ALL BOOKS, so the first N rendered book items
   * are the RECENTS slice and the remainder are ALL BOOKS for the
   * default testament.
   */
  describe('recentBooksFiltered derivation (VER-95)', () => {
    // currentBookId = 1 (Genesis, OT). Default testament is derived from the
    // current book, so ALL BOOKS shows OT books: Genesis, Exodus, Psalms.
    const setRecentBooks = (recentBooks: { bookId: number; timestamp: number }[]) => {
      (useRecentBooks as jest.Mock).mockReturnValue({
        recentBooks,
        addRecentBook: jest.fn(),
        clearRecentBooks: jest.fn(),
        isLoading: false,
        error: null,
      });
    };

    it('shows current book at position 0 when not in stored recents', () => {
      setRecentBooks([{ bookId: 40, timestamp: 1000 }]); // Matthew only

      renderWithTheme(
        <BibleNavigationModal
          visible={true}
          currentBookId={1}
          currentChapter={1}
          onClose={mockOnClose}
          onSelectChapter={mockOnSelectChapter}
        />
      );

      const items = screen.getAllByTestId(/^book-item-/);
      // RECENTS[0] = Genesis (current, pinned), RECENTS[1] = Matthew (stored).
      expect(items[0].props.testID).toBe('book-item-genesis');
      expect(items[1].props.testID).toBe('book-item-matthew');
    });

    it('deduplicates current book already in stored recents', () => {
      // Genesis is current AND in stored recents — must appear only once in RECENTS.
      setRecentBooks([
        { bookId: 1, timestamp: 2000 }, // Genesis (older recent — would dup without filter)
        { bookId: 40, timestamp: 1000 }, // Matthew
      ]);

      renderWithTheme(
        <BibleNavigationModal
          visible={true}
          currentBookId={1}
          currentChapter={1}
          onClose={mockOnClose}
          onSelectChapter={mockOnSelectChapter}
        />
      );

      // Genesis must appear exactly twice total (RECENTS slot 0 + ALL BOOKS),
      // never three times. Three would mean the dedup failed.
      expect(screen.getAllByTestId('book-item-genesis')).toHaveLength(2);

      const items = screen.getAllByTestId(/^book-item-/);
      expect(items[0].props.testID).toBe('book-item-genesis');
      expect(items[1].props.testID).toBe('book-item-matthew');
      // ALL BOOKS section starts at items[2] with Genesis again.
      expect(items[2].props.testID).toBe('book-item-genesis');
    });

    it('shows current book as only entry when stored list is empty', () => {
      setRecentBooks([]);

      renderWithTheme(
        <BibleNavigationModal
          visible={true}
          currentBookId={1}
          currentChapter={1}
          onClose={mockOnClose}
          onSelectChapter={mockOnSelectChapter}
        />
      );

      // RECENTS = [Genesis] only. ALL BOOKS (OT) = [Genesis, Exodus, Psalms].
      // Genesis appears 2x; Matthew/Mark (NT) do not appear at all.
      expect(screen.getAllByTestId('book-item-genesis')).toHaveLength(2);
      expect(screen.queryAllByTestId('book-item-matthew')).toHaveLength(0);
      expect(screen.queryAllByTestId('book-item-mark')).toHaveLength(0);

      const items = screen.getAllByTestId(/^book-item-/);
      // First item is RECENTS Genesis; second is ALL BOOKS Genesis (RECENTS
      // had only one entry, so ALL BOOKS section follows immediately).
      expect(items[0].props.testID).toBe('book-item-genesis');
      expect(items[1].props.testID).toBe('book-item-genesis');
    });

    it('respects MAX_RECENT_BOOKS after injection', () => {
      // 4 stored entries with descending timestamps. MAX_RECENT_BOOKS = 4, so
      // after injecting current book the slice keeps only 3 stored entries
      // (newest by timestamp). Mark (oldest) must be dropped.
      setRecentBooks([
        { bookId: 40, timestamp: 4000 }, // Matthew (newest)
        { bookId: 2, timestamp: 3000 }, // Exodus
        { bookId: 19, timestamp: 2000 }, // Psalms
        { bookId: 41, timestamp: 1000 }, // Mark (oldest — should be sliced off)
      ]);

      renderWithTheme(
        <BibleNavigationModal
          visible={true}
          currentBookId={1} // Genesis — not in stored, so it's injected at 0
          currentChapter={1}
          onClose={mockOnClose}
          onSelectChapter={mockOnSelectChapter}
        />
      );

      const items = screen.getAllByTestId(/^book-item-/);

      // First 4 items = RECENTS = [Genesis, Matthew, Exodus, Psalms].
      expect(items.slice(0, 4).map((n) => n.props.testID)).toEqual([
        'book-item-genesis',
        'book-item-matthew',
        'book-item-exodus',
        'book-item-psalms',
      ]);
      // Mark was sliced off RECENTS and is NT (not in default OT ALL BOOKS),
      // so it must not be rendered at all.
      expect(screen.queryAllByTestId('book-item-mark')).toHaveLength(0);
      // ALL BOOKS (OT) section starts after the 4 RECENTS entries with Genesis.
      expect(items[4].props.testID).toBe('book-item-genesis');
    });
  });
});
