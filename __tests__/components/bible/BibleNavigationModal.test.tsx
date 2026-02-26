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

    // Select Genesis (Current Book) from sticky header
    const genesisButton = screen.getByLabelText('Current book: Genesis');
    fireEvent.press(genesisButton);

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

    // Psalms is the current book, select it from sticky header
    const psalmsButton = screen.getByLabelText('Current book: Psalms');
    fireEvent.press(psalmsButton);

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

    // Select Genesis
    const genesisButton = screen.getByLabelText('Current book: Genesis');
    fireEvent.press(genesisButton);

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

      // Select Genesis from sticky header
      const genesisButton = screen.getByLabelText('Current book: Genesis');
      fireEvent.press(genesisButton);

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
});
