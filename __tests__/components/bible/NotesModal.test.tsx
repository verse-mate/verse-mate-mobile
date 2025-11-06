/**
 * Tests for NotesModal Component
 *
 * Focused tests for notes modal display and note management.
 * Tests cover critical behaviors: empty state, existing notes display, add note form.
 *
 * @see Task Group 5.1: Write 2-8 focused tests for NotesModal component
 */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { NotesModal } from '@/components/bible/NotesModal';
import { useNotes } from '@/hooks/bible/use-notes';
import type { Note } from '@/types/notes';

// Mock useNotes hook
jest.mock('@/hooks/bible/use-notes');

// Mock haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: {
    Light: 'light',
  },
}));

describe('NotesModal', () => {
  const mockOnClose = jest.fn();
  const mockOnNotePress = jest.fn();
  const mockOnEditNote = jest.fn();
  const mockOnDeleteNote = jest.fn();
  const mockAddNote = jest.fn().mockResolvedValue(undefined);
  const mockGetNotesByChapter = jest.fn();

  const defaultProps = {
    visible: true,
    bookId: 1,
    chapterNumber: 1,
    bookName: 'Genesis',
    onClose: mockOnClose,
    onNotePress: mockOnNotePress,
    onEditNote: mockOnEditNote,
    onDeleteNote: mockOnDeleteNote,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useNotes as jest.Mock).mockReturnValue({
      addNote: mockAddNote,
      getNotesByChapter: mockGetNotesByChapter.mockReturnValue([]),
      isAddingNote: false,
    });
  });

  it('should display empty state when chapter has no notes', () => {
    render(<NotesModal {...defaultProps} />);

    expect(screen.getByText('Notes for Genesis 1')).toBeTruthy();
    expect(screen.getByText('Existing Notes (0)')).toBeTruthy();
    expect(screen.getByText('No notes yet')).toBeTruthy();
  });

  it('should display existing notes when chapter has notes', () => {
    const mockNotes: Note[] = [
      {
        note_id: 'note-1',
        content: 'First note content',
        created_at: '2025-01-01T12:00:00Z',
        updated_at: '2025-01-01T12:00:00Z',
        chapter_number: 1,
        book_id: 1,
        book_name: 'Genesis',
        verse_number: null,
      },
      {
        note_id: 'note-2',
        content: 'Second note content',
        created_at: '2025-01-01T13:00:00Z',
        updated_at: '2025-01-01T13:00:00Z',
        chapter_number: 1,
        book_id: 1,
        book_name: 'Genesis',
        verse_number: null,
      },
    ];

    mockGetNotesByChapter.mockReturnValue(mockNotes);

    render(<NotesModal {...defaultProps} />);

    expect(screen.getByText('Existing Notes (2)')).toBeTruthy();
    expect(screen.getByText(/First note content/)).toBeTruthy();
    expect(screen.getByText(/Second note content/)).toBeTruthy();
  });

  it('should call addNote when Add Note button is pressed', async () => {
    render(<NotesModal {...defaultProps} />);

    const textarea = screen.getByPlaceholderText('Write your note here...');
    const addButton = screen.getByText('Add Note');

    // Type in textarea
    fireEvent.changeText(textarea, 'New note content');

    // Press add button
    await act(async () => {
      fireEvent.press(addButton);
    });

    await waitFor(() => {
      expect(mockAddNote).toHaveBeenCalledWith(1, 1, 'New note content');
    });
  });

  it('should not call addNote when textarea is empty', async () => {
    render(<NotesModal {...defaultProps} />);

    const addButton = screen.getByText('Add Note');

    // Press button without typing anything
    await act(async () => {
      fireEvent.press(addButton);
    });

    // addNote should not be called
    expect(mockAddNote).not.toHaveBeenCalled();
  });

  it('should display character counter when approaching limit', () => {
    render(<NotesModal {...defaultProps} />);

    const textarea = screen.getByPlaceholderText('Write your note here...');

    // Type content that exceeds threshold (4500 chars)
    fireEvent.changeText(textarea, 'A'.repeat(4600));

    // Counter should be visible
    expect(screen.getByText('4600 / 5000 characters')).toBeTruthy();
  });

  it('should call onClose when close button is pressed', () => {
    render(<NotesModal {...defaultProps} />);

    const closeButton = screen.getByTestId('close-button');
    fireEvent.press(closeButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('should clear textarea after successful note addition', async () => {
    render(<NotesModal {...defaultProps} />);

    const textarea = screen.getByPlaceholderText('Write your note here...');
    const addButton = screen.getByText('Add Note');

    // Type in textarea
    fireEvent.changeText(textarea, 'Test note');

    // Press add button
    await act(async () => {
      fireEvent.press(addButton);
    });

    await waitFor(() => {
      // Textarea should be cleared
      expect(textarea.props.value).toBe('');
    });
  });
});
