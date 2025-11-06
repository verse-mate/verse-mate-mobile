/**
 * ChapterReader Bookmark Integration Tests (Task Group 4.1)
 *
 * Tests bookmark toggle integration in chapter reading screen.
 * Focused tests for critical bookmark behaviors only.
 *
 * Test coverage:
 * 1. Bookmark toggle renders in title row
 * 2. Bookmark toggle is pressable and not disabled
 * 3. Bookmark toggle is visible for unauthenticated users
 *
 * @see Task Group 4.1
 */

import { fireEvent, render, screen } from '@testing-library/react-native';
import { ChapterReader } from '@/components/bible/ChapterReader';
import { useAuth } from '@/contexts/AuthContext';
// Import mocked modules
import { useBookmarks } from '@/hooks/bible/use-bookmarks';
import type { ChapterContent } from '@/types/bible';

// Mock dependencies
jest.mock('@/hooks/bible/use-bookmarks');
jest.mock('@/contexts/AuthContext');
jest.mock('expo-haptics');

// Mock functions
const mockUseBookmarks = useBookmarks as jest.MockedFunction<typeof useBookmarks>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

// Sample chapter data for testing
const mockChapter: ChapterContent = {
  bookId: 1,
  bookName: 'Genesis',
  chapterNumber: 1,
  title: 'Genesis 1',
  testament: 'Old Testament',
  sections: [
    {
      subtitle: 'The Creation',
      startVerse: 1,
      endVerse: 31,
      verses: [
        {
          number: 1,
          verseNumber: 1,
          text: 'In the beginning God created the heavens and the earth.',
        },
        {
          number: 2,
          verseNumber: 2,
          text: 'The earth was formless and void, and darkness was over the surface of the deep, and the Spirit of God was moving over the surface of the waters.',
        },
      ],
    },
  ],
};

describe('ChapterReader - Bookmark Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock: authenticated user
    mockUseAuth.mockReturnValue({
      user: {
        id: 'test-user-123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        is_admin: false,
        preferred_language: 'en',
      },
      isAuthenticated: true,
      isLoading: false,
      login: jest.fn(),
      signup: jest.fn(),
      logout: jest.fn(),
      restoreSession: jest.fn(),
    });

    // Default mock: no bookmarks
    mockUseBookmarks.mockReturnValue({
      bookmarks: [],
      isBookmarked: jest.fn().mockReturnValue(false),
      addBookmark: jest.fn().mockResolvedValue(undefined),
      removeBookmark: jest.fn().mockResolvedValue(undefined),
      refetchBookmarks: jest.fn(),
      isFetchingBookmarks: false,
      isAddingBookmark: false,
      isRemovingBookmark: false,
    });
  });

  // Test 1: Bookmark toggle renders in title row
  test('renders bookmark toggle in title row', () => {
    render(<ChapterReader chapter={mockChapter} activeTab="summary" explanationsOnly={false} />);

    // Check that bookmark toggle exists
    const bookmarkToggle = screen.getByTestId('bookmark-toggle-1-1');
    expect(bookmarkToggle).toBeTruthy();

    // Check that chapter title exists
    const chapterTitle = screen.getByText('Genesis 1');
    expect(chapterTitle).toBeTruthy();
  });

  // Test 2: Bookmark toggle is pressable and responds to press
  test('bookmark toggle is pressable and not disabled', () => {
    const { getByTestId } = render(
      <ChapterReader chapter={mockChapter} activeTab="summary" explanationsOnly={false} />
    );

    const bookmarkToggle = getByTestId('bookmark-toggle-1-1');

    // Verify bookmark toggle is not disabled
    expect(bookmarkToggle.props.disabled).toBeFalsy();

    // Verify bookmark toggle responds to press (no error thrown)
    expect(() => fireEvent.press(bookmarkToggle)).not.toThrow();
  });

  // Test 3: Bookmark toggle visible for unauthenticated users
  test('bookmark toggle is visible when user is not authenticated', () => {
    // Mock unauthenticated user
    mockUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      login: jest.fn(),
      signup: jest.fn(),
      logout: jest.fn(),
      restoreSession: jest.fn(),
    });

    const { queryByTestId } = render(
      <ChapterReader chapter={mockChapter} activeTab="summary" explanationsOnly={false} />
    );

    // Bookmark toggle should be visible (navigates to bookmarks screen on press)
    const bookmarkToggle = queryByTestId('bookmark-toggle-1-1');
    expect(bookmarkToggle).toBeTruthy();
  });
});
