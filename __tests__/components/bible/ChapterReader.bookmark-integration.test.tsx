/**
 * ChapterReader Bookmark Integration Tests (Task Group 4.1)
 *
 * Tests bookmark toggle integration in chapter reading screen.
 * Limit: 2-8 focused tests for critical behaviors only.
 *
 * Test coverage:
 * 1. Bookmark toggle renders in correct position (with copy and share icons)
 * 2. Bookmark toggle is pressable and not disabled
 * 3. Icon row maintains proper spacing
 * 4. Copy icon is pressable and functional
 * 5. Share icon is pressable and functional
 * 6. Icon row is hidden when user is not authenticated (bookmark only)
 * 7. All icons maintain consistent size
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
jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(() => Promise.resolve()),
}));
jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(() => Promise.resolve(true)),
  shareAsync: jest.fn(() => Promise.resolve({ action: 'sharedAction' })),
}));

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

  // Test 1: Bookmark toggle renders in correct position
  test('renders bookmark toggle in icon row with copy and share icons', () => {
    render(<ChapterReader chapter={mockChapter} activeTab="summary" explanationsOnly={false} />);

    // Check that bookmark toggle exists
    const bookmarkToggle = screen.getByTestId('bookmark-toggle-1-1');
    expect(bookmarkToggle).toBeTruthy();

    // Check that copy icon exists
    const copyIcon = screen.getByTestId('copy-chapter-icon');
    expect(copyIcon).toBeTruthy();

    // Check that share icon exists
    const shareIcon = screen.getByTestId('share-chapter-icon');
    expect(shareIcon).toBeTruthy();

    // Check that icon row exists
    const iconRow = screen.getByTestId('chapter-icon-row');
    expect(iconRow).toBeTruthy();
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

  // Test 3: Icon row maintains proper spacing (12px between icons)
  test('icon row has proper spacing between icons', () => {
    const { getByTestId } = render(
      <ChapterReader chapter={mockChapter} activeTab="summary" explanationsOnly={false} />
    );

    const iconRow = getByTestId('chapter-icon-row');

    // Check that icon row has flex row direction and gap spacing
    expect(iconRow.props.style).toMatchObject(
      expect.objectContaining({
        flexDirection: 'row',
        gap: 12, // spacing.md from bible-design-tokens
      })
    );
  });

  // Test 4: Copy icon is pressable
  test('copy icon is pressable and has correct accessibility props', () => {
    const { getByTestId } = render(
      <ChapterReader chapter={mockChapter} activeTab="summary" explanationsOnly={false} />
    );

    const copyIcon = getByTestId('copy-chapter-icon');

    // Check accessibility props
    expect(copyIcon.props.accessibilityRole).toBe('button');
    expect(copyIcon.props.accessibilityLabel).toBe('Copy chapter text');

    // Verify copy icon is pressable (no error thrown)
    expect(() => fireEvent.press(copyIcon)).not.toThrow();
  });

  // Test 5: Share icon is pressable
  test('share icon is pressable and has correct accessibility props', () => {
    const { getByTestId } = render(
      <ChapterReader chapter={mockChapter} activeTab="summary" explanationsOnly={false} />
    );

    const shareIcon = getByTestId('share-chapter-icon');

    // Check accessibility props
    expect(shareIcon.props.accessibilityRole).toBe('button');
    expect(shareIcon.props.accessibilityLabel).toBe('Share chapter');

    // Verify share icon is pressable (no error thrown)
    expect(() => fireEvent.press(shareIcon)).not.toThrow();
  });

  // Test 6: Bookmark toggle hidden when user is not authenticated
  test('bookmark toggle is hidden when user is not authenticated', () => {
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

    // Bookmark toggle should not exist
    const bookmarkToggle = queryByTestId('bookmark-toggle-1-1');
    expect(bookmarkToggle).toBeNull();

    // Copy and share icons should still exist
    expect(queryByTestId('copy-chapter-icon')).toBeTruthy();
    expect(queryByTestId('share-chapter-icon')).toBeTruthy();
  });

  // Test 7: All icons maintain consistent size (24px)
  test('all icons have consistent size of 24px', () => {
    const { getByTestId } = render(
      <ChapterReader chapter={mockChapter} activeTab="summary" explanationsOnly={false} />
    );

    // Import Ionicons to check icon sizes
    const { Ionicons } = require('@expo/vector-icons');

    // Get all Ionicons within the icon row
    const iconRow = getByTestId('chapter-icon-row');
    const iconComponents = iconRow.findAllByType(Ionicons);

    // All icons should have size 24
    iconComponents.forEach((icon: any) => {
      expect(icon.props.size).toBe(24);
    });
  });
});
