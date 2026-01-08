/**
 * Tests for Notes List Screen (Task Group 6.3)
 *
 * Focused tests for notes list screen display and interactions.
 * Tests cover critical behaviors: authentication guard, empty state, collapsible groups.
 *
 * @see Task Group 6.3
 */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import type React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import NotesScreen from '@/app/notes/index';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { useNotes } from '@/hooks/bible/use-notes';
import type { Note } from '@/types/notes';

// Mock dependencies
jest.mock('@/hooks/bible/use-notes');
jest.mock('@/contexts/AuthContext');
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: {
    Light: 'light',
  },
}));
jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    back: jest.fn(),
  },
  useLocalSearchParams: jest.fn(),
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: jest.fn(({ children }) => children),
  SafeAreaView: jest.fn(({ children }) => children),
  useSafeAreaInsets: jest.fn(() => ({ top: 0, right: 0, bottom: 0, left: 0 })),
}));

// Mock functions
const mockUseNotes = useNotes as jest.MockedFunction<typeof useNotes>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

// Sample notes data for testing
const mockNotes: Note[] = [
  {
    note_id: 'note-1',
    content: 'First note content for Genesis 1',
    created_at: '2025-01-01T12:00:00Z',
    updated_at: '2025-01-01T12:00:00Z',
    chapter_number: 1,
    book_id: 1,
    book_name: 'Genesis',
    verse_number: null,
  },
  {
    note_id: 'note-2',
    content: 'Second note content for Genesis 1',
    created_at: '2025-01-01T13:00:00Z',
    updated_at: '2025-01-01T13:00:00Z',
    chapter_number: 1,
    book_id: 1,
    book_name: 'Genesis',
    verse_number: null,
  },
  {
    note_id: 'note-3',
    content: 'Note for Joshua 2',
    created_at: '2025-01-02T10:00:00Z',
    updated_at: '2025-01-02T10:00:00Z',
    chapter_number: 2,
    book_id: 6,
    book_name: 'Joshua',
    verse_number: null,
  },
];

const renderWithProviders = (component: React.ReactElement) => {
  return render(<SafeAreaProvider>{component}</SafeAreaProvider>);
};

describe('Notes List Screen', () => {
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
        imageSrc: undefined,
        hasPassword: true,
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

    // Default mock: no notes
    mockUseNotes.mockReturnValue({
      notes: [],
      addNote: jest.fn().mockResolvedValue(undefined),
      updateNote: jest.fn().mockResolvedValue(undefined),
      deleteNote: jest.fn().mockResolvedValue(undefined),
      getNotesByChapter: jest.fn().mockReturnValue([]),
      hasNotes: jest.fn().mockReturnValue(false),
      refetchNotes: jest.fn(),
      isFetchingNotes: false,
      isAddingNote: false,
      isUpdatingNote: false,
      isDeletingNote: false,
    });
  });

  test('shows login prompt when user is not authenticated', async () => {
    // Mock unauthenticated user for this specific test
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

    renderWithProviders(<NotesScreen />);

    expect(await screen.findByText('Please login to view your notes')).toBeTruthy();
    expect(await screen.findByTestId('notes-login-button')).toBeTruthy();
  });

  test('shows empty state when user has no notes', async () => {
    // Default mocks already set for empty state
    renderWithProviders(<NotesScreen />);

    expect(await screen.findByText('No notes yet')).toBeTruthy();
    expect(
      await screen.findByText('Start taking notes while reading chapters to see them here.')
    ).toBeTruthy();
  });

  // Test 3: Display chapter groups when user has notes
  test('displays chapter groups when user has notes', async () => {
    // Mock notes data for this specific test
    mockUseNotes.mockReturnValue({
      notes: mockNotes,
      addNote: jest.fn().mockResolvedValue(undefined),
      updateNote: jest.fn().mockResolvedValue(undefined),
      deleteNote: jest.fn().mockResolvedValue(undefined),
      getNotesByChapter: jest.fn(() => mockNotes), // Return mockNotes
      hasNotes: jest.fn(() => true), // Indicate notes are present
      refetchNotes: jest.fn(),
      isFetchingNotes: false,
      isAddingNote: false,
      isUpdatingNote: false,
      isDeletingNote: false,
    });

    renderWithProviders(<NotesScreen />);

    // Check for chapter group headers
    expect(await screen.findByText('Genesis 1')).toBeTruthy();
    expect(await screen.findByText('2')).toBeTruthy();
    expect(await screen.findByText('Joshua 2')).toBeTruthy();
    expect(await screen.findByText('1')).toBeTruthy();
  });

  // Test 4: Navigates to chapter notes detail screen on tap
  test('navigates to chapter notes detail screen on tap', async () => {
    // Mock notes data for this specific test
    mockUseNotes.mockReturnValue({
      notes: mockNotes,
      addNote: jest.fn(),
      updateNote: jest.fn(),
      deleteNote: jest.fn(),
      getNotesByChapter: jest.fn(() => mockNotes), // Return mockNotes
      hasNotes: jest.fn(() => true),
      refetchNotes: jest.fn(),
      isFetchingNotes: false,
      isAddingNote: false,
      isUpdatingNote: false,
      isDeletingNote: false,
    });

    renderWithProviders(<NotesScreen />);

    const chapterGroup = await screen.findByTestId('chapter-group-1-1'); // Wait for the element
    fireEvent.press(chapterGroup);

    // Wait for the async navigation to complete
    await waitFor(() => {
      expect(router.push).toHaveBeenCalledWith({
        pathname: '/notes/[bookId]/[chapterNumber]',
        params: { bookId: 1, chapterNumber: 1, bookName: 'Genesis' },
      });
    });
  });

  // Test 5: Show loading indicator while fetching
  test('shows loading indicator while fetching notes', async () => {
    // Mock fetching state for this specific test
    mockUseNotes.mockReturnValue({
      notes: [],
      addNote: jest.fn().mockResolvedValue(undefined),
      updateNote: jest.fn().mockResolvedValue(undefined),
      deleteNote: jest.fn().mockResolvedValue(undefined),
      getNotesByChapter: jest.fn().mockReturnValue([]),
      hasNotes: jest.fn().mockReturnValue(false),
      refetchNotes: jest.fn(),
      isFetchingNotes: true, // Set to true for loading state
      isAddingNote: false,
      isUpdatingNote: false,
      isDeletingNote: false,
    });

    renderWithProviders(<NotesScreen />);

    expect(await screen.findByTestId('notes-loading')).toBeTruthy(); // Wait for the loading indicator
  });
});
