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
import { BibleNavigationModal } from '@/components/bible/BibleNavigationModal';
import { useRecentBooks } from '@/hooks/bible/use-recent-books';
import { useBibleTestaments, useTopicsSearch } from '@/src/api/generated';

// Mock dependencies
jest.mock('@/src/api/generated');
jest.mock('@/hooks/bible/use-recent-books');
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
  },
}));

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
    render(
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
    expect(screen.getByText('Genesis')).toBeTruthy();
    expect(screen.getByText('Exodus')).toBeTruthy();
  });

  it('should display chapter grid when book is selected', async () => {
    render(
      <BibleNavigationModal
        visible={true}
        currentBookId={1}
        currentChapter={1}
        onClose={mockOnClose}
        onSelectChapter={mockOnSelectChapter}
      />
    );

    // Initially shows book list
    expect(screen.getByText('Genesis')).toBeTruthy();

    // Select Genesis book
    const genesisButton = screen.getByLabelText('Genesis, 50 chapters');
    fireEvent.press(genesisButton);

    // Chapter grid should display for Genesis (50 chapters)
    await waitFor(() => {
      expect(screen.getByLabelText('Chapter 1')).toBeTruthy();
      expect(screen.getByLabelText('Chapter 5')).toBeTruthy();
      expect(screen.getByLabelText('Chapter 50')).toBeTruthy();
    });
  });

  it('should call onSelectChapter when chapter button is pressed', async () => {
    render(
      <BibleNavigationModal
        visible={true}
        currentBookId={1}
        currentChapter={1}
        onClose={mockOnClose}
        onSelectChapter={mockOnSelectChapter}
      />
    );

    // Select Genesis book to show chapter grid
    const genesisButton = screen.getByLabelText('Genesis, 50 chapters');
    fireEvent.press(genesisButton);

    // Wait for chapter grid to render
    await waitFor(() => {
      expect(screen.getByLabelText('Chapter 5')).toBeTruthy();
    });

    // Press chapter 5
    const chapter5Button = screen.getByLabelText('Chapter 5');
    fireEvent.press(chapter5Button);

    // Should call callbacks
    expect(mockOnSelectChapter).toHaveBeenCalledWith(1, 5);
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should render filter input', () => {
    render(
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
    render(
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
});
