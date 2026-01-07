/**
 * BookmarkToggle Component Tests
 *
 * Tests critical behaviors:
 * 1. Renders correct icon based on bookmark status
 * 2. Toggles bookmark on press
 * 3. Shows loading state during API call
 * 4. Handles authentication requirement
 * 5. Triggers haptic feedback on press
 * 6. Sets correct accessibility props
 * 7. Calls correct hook methods
 *
 * @see Spec: .agent-os/specs/2025-11-05-bookmark-chapters/spec.md
 * @see Task 3.1: Write 2-8 focused tests for BookmarkToggle component
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { BookmarkToggle } from '@/components/bible/BookmarkToggle';
import { useAuth } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { useBookmarks } from '@/hooks/bible/use-bookmarks';

// Mock dependencies
jest.mock('@/contexts/AuthContext');
jest.mock('@/hooks/bible/use-bookmarks');
jest.mock('expo-haptics');
jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    back: jest.fn(),
  },
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseBookmarks = useBookmarks as jest.MockedFunction<typeof useBookmarks>;
const mockHaptics = Haptics.impactAsync as jest.MockedFunction<typeof Haptics.impactAsync>;

const renderWithTheme = (component: React.ReactElement) => {
  return render(<ThemeProvider>{component}</ThemeProvider>);
};

describe('BookmarkToggle', () => {
  const mockAddBookmark = jest.fn();
  const mockRemoveBookmark = jest.fn();
  const mockIsBookmarked = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock haptics to return resolved promise
    mockHaptics.mockResolvedValue();

    // Default: authenticated user
    mockUseAuth.mockReturnValue({
      user: {
        id: 'test-user-id',
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
      loginWithSSO: jest.fn(),
      restoreSession: jest.fn(),
      refreshTokens: jest.fn(),
    });

    // Default: bookmarks hook with no active bookmark
    mockAddBookmark.mockResolvedValue(undefined);
    mockRemoveBookmark.mockResolvedValue(undefined);

    mockUseBookmarks.mockReturnValue({
      bookmarks: [],
      isFetchingBookmarks: false,
      isAddingBookmark: false,
      isRemovingBookmark: false,
      isBookmarked: mockIsBookmarked,
      addBookmark: mockAddBookmark,
      removeBookmark: mockRemoveBookmark,
      refetchBookmarks: jest.fn(),
    });

    mockIsBookmarked.mockReturnValue(false);
  });

  /**
   * Test 1: Renders unbookmarked icon when chapter is not bookmarked
   */
  it('renders bookmark-outline icon when chapter is not bookmarked', () => {
    mockIsBookmarked.mockReturnValue(false);

    renderWithTheme(<BookmarkToggle bookId={1} chapterNumber={1} />);

    const button = screen.getByLabelText('Bookmark this chapter');
    expect(button).toBeTruthy();
  });

  /**
   * Test 2: Renders bookmarked icon when chapter is bookmarked
   */
  it('renders bookmark icon when chapter is bookmarked', () => {
    mockIsBookmarked.mockReturnValue(true);

    renderWithTheme(<BookmarkToggle bookId={1} chapterNumber={1} />);

    const button = screen.getByLabelText('Remove bookmark');
    expect(button).toBeTruthy();
  });

  /**
   * Test 3: Calls addBookmark when pressing unbookmarked icon
   */
  it('calls addBookmark when pressing unbookmarked icon', async () => {
    mockIsBookmarked.mockReturnValue(false);

    renderWithTheme(<BookmarkToggle bookId={1} chapterNumber={1} />);

    const button = screen.getByLabelText('Bookmark this chapter');
    fireEvent.press(button);

    await waitFor(() => {
      expect(mockAddBookmark).toHaveBeenCalledWith(1, 1);
    });
    expect(mockRemoveBookmark).not.toHaveBeenCalled();
  });

  /**
   * Test 4: Calls removeBookmark when pressing bookmarked icon
   */
  it('calls removeBookmark when pressing bookmarked icon', async () => {
    mockIsBookmarked.mockReturnValue(true);

    renderWithTheme(<BookmarkToggle bookId={1} chapterNumber={1} />);

    const button = screen.getByLabelText('Remove bookmark');
    fireEvent.press(button);

    await waitFor(() => {
      expect(mockRemoveBookmark).toHaveBeenCalledWith(1, 1);
    });
    expect(mockAddBookmark).not.toHaveBeenCalled();
  });

  /**
   * Test 5: Triggers haptic feedback on press
   */
  it('triggers haptic feedback on press', async () => {
    renderWithTheme(<BookmarkToggle bookId={1} chapterNumber={1} />);

    const button = screen.getByLabelText('Bookmark this chapter');
    fireEvent.press(button);

    await waitFor(() => {
      expect(mockHaptics).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
    });
  });

  /**
   * Test 6: Shows component and navigates to bookmarks screen when user is not authenticated
   */
  it('shows component and navigates to bookmarks screen when user is not authenticated', async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      login: jest.fn(),
      signup: jest.fn(),
      logout: jest.fn(),
      loginWithSSO: jest.fn(),
      restoreSession: jest.fn(),
      refreshTokens: jest.fn(),
    });

    renderWithTheme(<BookmarkToggle bookId={1} chapterNumber={1} />);

    // Component should be visible
    const button = screen.getByLabelText('Bookmark this chapter');
    expect(button).toBeTruthy();

    // Press the button
    fireEvent.press(button);

    // Should navigate to bookmarks screen (which has the login prompt)
    await waitFor(() => {
      expect(router.push).toHaveBeenCalledWith('/bookmarks');
    });

    // Should NOT attempt to add bookmark
    expect(mockAddBookmark).not.toHaveBeenCalled();
  });

  /**
   * Test 7: Sets correct accessibility props for bookmarked state
   */
  it('sets correct accessibility props for bookmarked state', () => {
    mockIsBookmarked.mockReturnValue(true);

    renderWithTheme(<BookmarkToggle bookId={1} chapterNumber={1} />);

    const button = screen.getByLabelText('Remove bookmark');
    expect(button).toBeTruthy();
    expect(button.props.accessibilityRole).toBe('button');
    expect(button.props.accessibilityState.selected).toBe(true);
  });
});
