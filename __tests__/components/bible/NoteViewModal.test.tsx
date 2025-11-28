/**
 * Tests for NoteViewModal Component
 *
 * Focused tests for note view modal display and actions.
 * Tests cover critical behaviors: content display, edit/delete buttons.
 *
 * @see Task Group 5.3: Write 2-8 focused tests for NoteViewModal component
 */

import { fireEvent, render, screen } from '@testing-library/react-native';
import type React from 'react';
import { NoteViewModal } from '@/components/bible/NoteViewModal';
import { ThemeProvider } from '@/contexts/ThemeContext';
import type { Note } from '@/types/notes';

const renderWithTheme = (component: React.ReactElement) => {
  return render(<ThemeProvider>{component}</ThemeProvider>);
};

describe('NoteViewModal', () => {
  const mockNote: Note = {
    note_id: 'note-123',
    content: 'This is a test note with detailed content that should be fully displayed.',
    created_at: '2025-01-01T12:00:00Z',
    updated_at: '2025-01-01T12:00:00Z',
    chapter_number: 1,
    book_id: 1,
    book_name: 'Genesis',
    verse_number: null,
  };

  const mockOnClose = jest.fn();
  const mockOnEdit = jest.fn();
  const mockOnDelete = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should display full note content without truncation', () => {
    renderWithTheme(
      <NoteViewModal
        visible={true}
        note={mockNote}
        bookName="Genesis"
        chapterNumber={1}
        onClose={mockOnClose}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />
    );

    expect(screen.getByText(mockNote.content)).toBeTruthy();
  });

  it('should display chapter reference in header', () => {
    renderWithTheme(
      <NoteViewModal
        visible={true}
        note={mockNote}
        bookName="Genesis"
        chapterNumber={1}
        onClose={mockOnClose}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />
    );

    expect(screen.getByText('Genesis 1')).toBeTruthy();
  });

  it('should call onEdit when Edit button is pressed', () => {
    renderWithTheme(
      <NoteViewModal
        visible={true}
        note={mockNote}
        bookName="Genesis"
        chapterNumber={1}
        onClose={mockOnClose}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />
    );

    const editButton = screen.getByText('Edit');
    fireEvent.press(editButton);

    expect(mockOnEdit).toHaveBeenCalledWith(mockNote);
  });

  it('should call onDelete when Delete button is pressed', () => {
    renderWithTheme(
      <NoteViewModal
        visible={true}
        note={mockNote}
        bookName="Genesis"
        chapterNumber={1}
        onClose={mockOnClose}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />
    );

    const deleteButton = screen.getByText('Delete');
    fireEvent.press(deleteButton);

    expect(mockOnDelete).toHaveBeenCalledWith(mockNote);
  });

  it('should call onClose when close button is pressed', () => {
    renderWithTheme(
      <NoteViewModal
        visible={true}
        note={mockNote}
        bookName="Genesis"
        chapterNumber={1}
        onClose={mockOnClose}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />
    );

    const closeButton = screen.getByTestId('view-close-button');
    fireEvent.press(closeButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });
});
