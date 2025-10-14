/**
 * Tests for Bible Chapter Screen
 *
 * Focused tests for the main chapter reading interface.
 * Tests core functionality: rendering, loading states, reading position persistence.
 */

import { render, screen, waitFor, within } from '@testing-library/react-native';
import { useLocalSearchParams, router } from 'expo-router';
import ChapterScreen from '@/app/bible/[bookId]/[chapterNumber]';
import { useBibleChapter, useSaveLastRead } from '@/src/api/bible';
import { useActiveTab } from '@/hooks/bible';

// Mock dependencies
jest.mock('expo-router', () => ({
  useLocalSearchParams: jest.fn(),
  router: {
    push: jest.fn(),
    replace: jest.fn(),
  },
}));

jest.mock('@/src/api/bible', () => ({
  useBibleChapter: jest.fn(),
  useSaveLastRead: jest.fn(),
}));

jest.mock('@/hooks/bible', () => ({
  useActiveTab: jest.fn(),
}));

// Mock chapter data
const mockChapterData = {
  bookId: 1,
  bookName: 'Genesis',
  chapterNumber: 1,
  title: 'Genesis 1',
  testament: 'OT' as const,
  sections: [
    {
      subtitle: 'The Creation',
      startVerse: 1,
      endVerse: 31,
      verses: [
        { verseNumber: 1, text: 'In the beginning God created the heavens and the earth.' },
        { verseNumber: 2, text: 'The earth was formless and void.' },
      ],
    },
  ],
};

describe('ChapterScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementations
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      bookId: '1',
      chapterNumber: '1',
    });

    (useActiveTab as jest.Mock).mockReturnValue({
      activeTab: 'summary',
      setActiveTab: jest.fn(),
      isLoading: false,
      error: null,
    });

    (useSaveLastRead as jest.Mock).mockReturnValue({
      mutate: jest.fn(),
    });
  });

  /**
   * Test 1: Screen renders with valid bookId/chapter params
   */
  it('renders chapter screen with valid params', async () => {
    (useBibleChapter as jest.Mock).mockReturnValue({
      data: mockChapterData,
      isLoading: false,
      error: null,
    });

    const { getByTestId } = render(<ChapterScreen />);

    await waitFor(() => {
      expect(getByTestId('chapter-header')).toBeTruthy();
      expect(screen.getByText('The Creation')).toBeTruthy();
    });
  });

  /**
   * Test 2: Skeleton loader shows while loading
   */
  it('shows skeleton loader while loading chapter', () => {
    (useBibleChapter as jest.Mock).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });

    const { getByTestId } = render(<ChapterScreen />);

    expect(getByTestId('skeleton-loader')).toBeTruthy();
  });

  /**
   * Test 3: Chapter content displays after load
   */
  it('displays chapter content after loading completes', async () => {
    (useBibleChapter as jest.Mock).mockReturnValue({
      data: mockChapterData,
      isLoading: false,
      error: null,
    });

    const { getByTestId } = render(<ChapterScreen />);

    await waitFor(() => {
      // Scroll view should be visible
      expect(getByTestId('chapter-scroll-view')).toBeTruthy();
      // Section subtitle should be visible
      expect(screen.getByText('The Creation')).toBeTruthy();
    });
  });

  /**
   * Test 4: Save reading position called on mount
   */
  it('calls save reading position on mount', () => {
    const mockMutate = jest.fn();
    (useSaveLastRead as jest.Mock).mockReturnValue({
      mutate: mockMutate,
    });

    (useBibleChapter as jest.Mock).mockReturnValue({
      data: mockChapterData,
      isLoading: false,
      error: null,
    });

    render(<ChapterScreen />);

    // Verify save position was called with correct data
    expect(mockMutate).toHaveBeenCalledWith({
      user_id: 'guest',
      book_id: 1,
      chapter_number: 1,
    });
  });

  /**
   * Test 5: Invalid bookId redirects to Genesis 1
   */
  it('redirects to Genesis 1 when bookId is invalid', () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      bookId: '999', // Invalid book ID (only 66 books)
      chapterNumber: '1',
    });

    (useBibleChapter as jest.Mock).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Book not found'),
    });

    render(<ChapterScreen />);

    // Should redirect to Genesis 1
    expect(router.replace).toHaveBeenCalled();
  });

  /**
   * Test 6: Header displays book and chapter title
   */
  it('displays header with book and chapter title', async () => {
    (useBibleChapter as jest.Mock).mockReturnValue({
      data: mockChapterData,
      isLoading: false,
      error: null,
    });

    const { getByTestId } = render(<ChapterScreen />);

    await waitFor(() => {
      const header = getByTestId('chapter-header');
      expect(header).toBeTruthy();
      // Use within to query only inside the header
      const headerText = within(header).getByText(/Genesis/);
      expect(headerText).toBeTruthy();
    });
  });
});
