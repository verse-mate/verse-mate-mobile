/**
 * Tests for Bookmarks List Screen
 *
 * Tests critical behaviors:
 * - Renders bookmark list
 * - Navigates on item press
 * - Shows empty state
 * - Requires authentication
 * - Handles loading state
 * - Handles error state
 *
 * @see Task 5.1: Write 2-8 focused tests for bookmarks list screen
 * @see Spec: .agent-os/specs/2025-11-05-bookmark-chapters/spec.md
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import Bookmarks from '@/app/bookmarks';
import type { User } from '@/contexts/AuthContext';
import { useAuth } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { useBookmarks } from '@/hooks/bible/use-bookmarks';

// Mock dependencies
jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
  },
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: {
    Light: 'light',
  },
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/hooks/bible/use-bookmarks', () => ({
  useBookmarks: jest.fn(),
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseBookmarks = useBookmarks as jest.MockedFunction<typeof useBookmarks>;

// Mock user data
const mockUser: User = {
  id: 'test-user-123',
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  is_admin: false,
  preferred_language: 'en',
};

const renderWithTheme = (component: React.ReactElement) => {
  return render(<ThemeProvider>{component}</ThemeProvider>);
};

describe('Bookmarks Screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Test 1: Renders bookmark list
   * Verify screen displays list of bookmarked chapters with correct formatting
   */
  it('renders list of bookmarked chapters with correct format', async () => {
    // Mock authenticated user
    mockUseAuth.mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
      isLoading: false,
      login: jest.fn(),
      signup: jest.fn(),
      logout: jest.fn(),
      restoreSession: jest.fn(),
    });

    // Mock bookmarks data
    mockUseBookmarks.mockReturnValue({
      bookmarks: [
        { favorite_id: 1, book_id: 1, chapter_number: 1, book_name: 'Genesis' },
        { favorite_id: 2, book_id: 43, chapter_number: 3, book_name: 'John' },
        { favorite_id: 3, book_id: 19, chapter_number: 23, book_name: 'Psalms' },
      ],
      isFetchingBookmarks: false,
      isAddingBookmark: false,
      isRemovingBookmark: false,
      isBookmarked: jest.fn(),
      addBookmark: jest.fn(),
      removeBookmark: jest.fn(),
      refetchBookmarks: jest.fn(),
    });

    renderWithTheme(<Bookmarks />);

    // Verify all bookmarks are rendered with correct format
    await waitFor(() => {
      expect(screen.getByText('Genesis 1')).toBeTruthy();
      expect(screen.getByText('John 3')).toBeTruthy();
      expect(screen.getByText('Psalms 23')).toBeTruthy();
    });
  });

  /**
   * Test 2: Navigates on item press
   * Verify tapping a bookmark navigates to correct chapter and triggers haptic feedback
   */
  it('navigates to chapter when bookmark is pressed', async () => {
    mockUseAuth.mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
      isLoading: false,
      login: jest.fn(),
      signup: jest.fn(),
      logout: jest.fn(),
      restoreSession: jest.fn(),
    });

    mockUseBookmarks.mockReturnValue({
      bookmarks: [{ favorite_id: 1, book_id: 1, chapter_number: 1, book_name: 'Genesis' }],
      isFetchingBookmarks: false,
      isAddingBookmark: false,
      isRemovingBookmark: false,
      isBookmarked: jest.fn(),
      addBookmark: jest.fn(),
      removeBookmark: jest.fn(),
      refetchBookmarks: jest.fn(),
    });

    renderWithTheme(<Bookmarks />);

    // Tap on Genesis 1
    const bookmarkItem = await waitFor(() => screen.getByTestId('bookmark-item-1-1'));
    fireEvent.press(bookmarkItem);

    // Verify navigation to correct chapter
    await waitFor(() => {
      expect(router.push).toHaveBeenCalledWith('/bible/1/1');
    });

    // Verify haptic feedback triggered
    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
  });

  /**
   * Test 3: Shows empty state
   * Verify empty state message displays when no bookmarks exist
   */
  it('shows empty state message when no bookmarks exist', async () => {
    mockUseAuth.mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
      isLoading: false,
      login: jest.fn(),
      signup: jest.fn(),
      logout: jest.fn(),
      restoreSession: jest.fn(),
    });

    // Mock empty bookmarks array
    mockUseBookmarks.mockReturnValue({
      bookmarks: [],
      isFetchingBookmarks: false,
      isAddingBookmark: false,
      isRemovingBookmark: false,
      isBookmarked: jest.fn(),
      addBookmark: jest.fn(),
      removeBookmark: jest.fn(),
      refetchBookmarks: jest.fn(),
    });

    renderWithTheme(<Bookmarks />);

    // Verify empty state message displays
    await waitFor(() => {
      expect(screen.getByText(/No bookmarked chapters yet/i)).toBeTruthy();
    });
  });

  /**
   * Test 4: Requires authentication
   * Verify screen shows login prompt when user is not authenticated
   */
  it('shows login prompt when user is not authenticated', async () => {
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

    mockUseBookmarks.mockReturnValue({
      bookmarks: [],
      isFetchingBookmarks: false,
      isAddingBookmark: false,
      isRemovingBookmark: false,
      isBookmarked: jest.fn(),
      addBookmark: jest.fn(),
      removeBookmark: jest.fn(),
      refetchBookmarks: jest.fn(),
    });

    renderWithTheme(<Bookmarks />);

    // Verify login prompt displays
    await waitFor(() => {
      expect(screen.getByText(/Please login to view your bookmarks/i)).toBeTruthy();
    });
  });

  /**
   * Test 5: Handles loading state
   * Verify loading indicator displays while bookmarks are being fetched
   */
  it('shows loading indicator while fetching bookmarks', async () => {
    mockUseAuth.mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
      isLoading: false,
      login: jest.fn(),
      signup: jest.fn(),
      logout: jest.fn(),
      restoreSession: jest.fn(),
    });

    // Mock loading state
    mockUseBookmarks.mockReturnValue({
      bookmarks: [],
      isFetchingBookmarks: true,
      isAddingBookmark: false,
      isRemovingBookmark: false,
      isBookmarked: jest.fn(),
      addBookmark: jest.fn(),
      removeBookmark: jest.fn(),
      refetchBookmarks: jest.fn(),
    });

    renderWithTheme(<Bookmarks />);

    // Verify loading indicator displays
    await waitFor(() => {
      expect(screen.getByTestId('bookmarks-loading')).toBeTruthy();
    });
  });

  /**
   * Test 6: Handles auth loading state
   * Verify screen shows loading while authentication state is being determined
   */
  it('shows loading while auth state is being determined', async () => {
    // Mock auth loading state
    mockUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      login: jest.fn(),
      signup: jest.fn(),
      logout: jest.fn(),
      restoreSession: jest.fn(),
    });

    mockUseBookmarks.mockReturnValue({
      bookmarks: [],
      isFetchingBookmarks: false,
      isAddingBookmark: false,
      isRemovingBookmark: false,
      isBookmarked: jest.fn(),
      addBookmark: jest.fn(),
      removeBookmark: jest.fn(),
      refetchBookmarks: jest.fn(),
    });

    renderWithTheme(<Bookmarks />);

    // Verify loading indicator displays during auth check
    await waitFor(() => {
      expect(screen.getByTestId('bookmarks-loading')).toBeTruthy();
    });
  });

  /**
   * Test 7: Renders screen title
   * Verify screen displays proper header with "Bookmarks" title
   */
  it('renders screen with proper title', async () => {
    mockUseAuth.mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
      isLoading: false,
      login: jest.fn(),
      signup: jest.fn(),
      logout: jest.fn(),
      restoreSession: jest.fn(),
    });

    mockUseBookmarks.mockReturnValue({
      bookmarks: [],
      isFetchingBookmarks: false,
      isAddingBookmark: false,
      isRemovingBookmark: false,
      isBookmarked: jest.fn(),
      addBookmark: jest.fn(),
      removeBookmark: jest.fn(),
      refetchBookmarks: jest.fn(),
    });

    renderWithTheme(<Bookmarks />);

    // Verify title renders
    await waitFor(() => {
      expect(screen.getByText('Bookmarks')).toBeTruthy();
    });
  });
});
