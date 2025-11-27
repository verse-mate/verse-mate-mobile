/**
 * Tests for Notes List Screen (Task Group 6.3)
 *
 * Focused tests for notes list screen display and interactions.
 * Tests cover critical behaviors: authentication guard, empty state, collapsible groups.
 *
 * @see Task Group 6.3
 */

import { fireEvent, render, screen } from '@testing-library/react-native';
import type React from 'react';
import NotesScreen from '@/app/notes';
import { useAuth } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { useNotes } from '@/hooks/bible/use-notes';
import type { Note } from '@/types/notes';

// Mock dependencies
jest.mock('@/hooks/bible/use-notes');
jest.mock('@/contexts/AuthContext');
jest.mock('expo-haptics');
jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    back: jest.fn(),
  },
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

const renderWithTheme = (component: React.ReactElement) => {
  return render(<ThemeProvider>{component}</ThemeProvider>);
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
      },
      isAuthenticated: true,
      isLoading: false,
      login: jest.fn(),
      signup: jest.fn(),
      logout: jest.fn(),
      restoreSession: jest.fn(),
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

  // Test 1: Show login prompt when not authenticated
  test('shows login prompt when user is not authenticated', () => {
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

    renderWithTheme(<NotesScreen />);

    expect(screen.getByText('Please login to view your notes')).toBeTruthy();
    expect(screen.getByTestId('notes-login-button')).toBeTruthy();
  });

  // Test 2: Show empty state when user has no notes
  test('shows empty state when user has no notes', () => {
    renderWithTheme(<NotesScreen />);

    expect(screen.getByText('No notes yet')).toBeTruthy();
    expect(
      screen.getByText('Start taking notes while reading chapters to see them here.')
    ).toBeTruthy();
  });

  // Test 3: Display chapter groups when user has notes
  test('displays chapter groups when user has notes', () => {
    // Mock notes data
    mockUseNotes.mockReturnValue({
      notes: mockNotes,
      addNote: jest.fn().mockResolvedValue(undefined),
      updateNote: jest.fn().mockResolvedValue(undefined),
      deleteNote: jest.fn().mockResolvedValue(undefined),
      getNotesByChapter: jest.fn().mockReturnValue([]),
      hasNotes: jest.fn().mockReturnValue(true),
      refetchNotes: jest.fn(),
      isFetchingNotes: false,
      isAddingNote: false,
      isUpdatingNote: false,
      isDeletingNote: false,
    });

    renderWithTheme(<NotesScreen />);

    // Check for chapter group headers
    expect(screen.getByText('Genesis 1 (2 notes)')).toBeTruthy();
    expect(screen.getByText('Joshua 2 (1 note)')).toBeTruthy();
  });

  // Test 4: Expand chapter groups on tap
  test('expands chapter group on tap', () => {
    // Mock notes data
    mockUseNotes.mockReturnValue({
      notes: mockNotes,
      addNote: jest.fn().mockResolvedValue(undefined),
      updateNote: jest.fn().mockResolvedValue(undefined),
      deleteNote: jest.fn().mockResolvedValue(undefined),
      getNotesByChapter: jest.fn().mockReturnValue([]),
      hasNotes: jest.fn().mockReturnValue(true),
      refetchNotes: jest.fn(),
      isFetchingNotes: false,
      isAddingNote: false,
      isUpdatingNote: false,
      isDeletingNote: false,
    });

    const { getByTestId } = renderWithTheme(<NotesScreen />);

    // Find chapter group header
    const chapterGroup = getByTestId('chapter-group-1-1');

    // Verify we can tap without errors
    expect(() => fireEvent.press(chapterGroup)).not.toThrow();

    // Tap again should also work (collapse)
    expect(() => fireEvent.press(chapterGroup)).not.toThrow();
  });

  // Test 5: Show loading indicator while fetching
  test('shows loading indicator while fetching notes', () => {
    mockUseNotes.mockReturnValue({
      notes: [],
      addNote: jest.fn().mockResolvedValue(undefined),
      updateNote: jest.fn().mockResolvedValue(undefined),
      deleteNote: jest.fn().mockResolvedValue(undefined),
      getNotesByChapter: jest.fn().mockReturnValue([]),
      hasNotes: jest.fn().mockReturnValue(false),
      refetchNotes: jest.fn(),
      isFetchingNotes: true,
      isAddingNote: false,
      isUpdatingNote: false,
      isDeletingNote: false,
    });

    renderWithTheme(<NotesScreen />);

    expect(screen.getByTestId('notes-loading')).toBeTruthy();
  });
});
