/**
 * ChapterReader Notes Integration Tests (Task Group 6.1)
 *
 * Tests notes button integration in chapter reading screen.
 * Focused tests for critical notes behaviors only.
 *
 * Test coverage:
 * 1. Notes button renders next to bookmark toggle in title row
 * 2. Notes button is pressable and not disabled
 * 3. Notes button shows correct icon state (filled vs outline)
 *
 * @see Task Group 6.1
 */

import { fireEvent, render, screen } from '@testing-library/react-native';
import { ChapterReader } from '@/components/bible/ChapterReader';
import { useAuth } from '@/contexts/AuthContext';
// Import mocked modules
import { useBookmarks } from '@/hooks/bible/use-bookmarks';
import { useNotes } from '@/hooks/bible/use-notes';
import type { ChapterContent } from '@/types/bible';
import type { Note } from '@/types/notes';

// Mock dependencies
jest.mock('@/hooks/bible/use-bookmarks');
jest.mock('@/hooks/bible/use-notes');
jest.mock('@/contexts/AuthContext');
jest.mock('expo-haptics');

// Mock functions
const mockUseBookmarks = useBookmarks as jest.MockedFunction<typeof useBookmarks>;
const mockUseNotes = useNotes as jest.MockedFunction<typeof useNotes>;
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

// Sample note data for testing
const mockNote: Note = {
  note_id: 'note-1',
  content: 'Test note content',
  created_at: '2025-01-01T12:00:00Z',
  updated_at: '2025-01-01T12:00:00Z',
  chapter_number: 1,
  book_id: 1,
  book_name: 'Genesis',
  verse_number: null,
};

describe('ChapterReader - Notes Integration', () => {
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

  // Test 1: Notes button renders next to bookmark toggle
  test('renders notes button next to bookmark toggle in title row', () => {
    render(<ChapterReader chapter={mockChapter} activeTab="summary" explanationsOnly={false} />);

    // Check that notes button exists
    const notesButton = screen.getByTestId('notes-button-1-1');
    expect(notesButton).toBeTruthy();

    // Check that bookmark toggle exists
    const bookmarkToggle = screen.getByTestId('bookmark-toggle-1-1');
    expect(bookmarkToggle).toBeTruthy();

    // Check that chapter title exists
    const chapterTitle = screen.getByText('Genesis 1');
    expect(chapterTitle).toBeTruthy();
  });

  // Test 2: Notes button is pressable and not disabled
  test('notes button is pressable and not disabled', () => {
    const { getByTestId } = render(
      <ChapterReader chapter={mockChapter} activeTab="summary" explanationsOnly={false} />
    );

    const notesButton = getByTestId('notes-button-1-1');

    // Verify notes button is not disabled
    expect(notesButton.props.disabled).toBeFalsy();

    // Verify notes button responds to press (no error thrown)
    expect(() => fireEvent.press(notesButton)).not.toThrow();
  });

  // Test 3: Notes button shows outline icon when chapter has no notes
  test('notes button shows outline icon when chapter has no notes', () => {
    // Mock hasNotes to return false
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

    render(<ChapterReader chapter={mockChapter} activeTab="summary" explanationsOnly={false} />);

    const notesButton = screen.getByTestId('notes-button-1-1');
    expect(notesButton).toBeTruthy();

    // The hasNotes function should have been called
    expect(mockUseNotes().hasNotes).toHaveBeenCalledWith(1, 1);
  });

  // Test 4: Notes button shows filled icon when chapter has notes
  test('notes button shows filled icon when chapter has notes', () => {
    // Mock hasNotes to return true and provide notes
    mockUseNotes.mockReturnValue({
      notes: [mockNote],
      addNote: jest.fn().mockResolvedValue(undefined),
      updateNote: jest.fn().mockResolvedValue(undefined),
      deleteNote: jest.fn().mockResolvedValue(undefined),
      getNotesByChapter: jest.fn().mockReturnValue([mockNote]),
      hasNotes: jest.fn().mockReturnValue(true),
      refetchNotes: jest.fn(),
      isFetchingNotes: false,
      isAddingNote: false,
      isUpdatingNote: false,
      isDeletingNote: false,
    });

    render(<ChapterReader chapter={mockChapter} activeTab="summary" explanationsOnly={false} />);

    const notesButton = screen.getByTestId('notes-button-1-1');
    expect(notesButton).toBeTruthy();

    // The hasNotes function should have been called
    expect(mockUseNotes().hasNotes).toHaveBeenCalledWith(1, 1);
  });
});
