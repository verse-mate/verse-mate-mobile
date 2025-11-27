/**
 * Tests for NoteEditModal Component
 *
 * Focused tests for note editing modal.
 * Tests cover critical behaviors: pre-filled content, save, cancel, character limit.
 *
 * @see Task Group 5.5: Write 2-8 focused tests for NoteEditModal component
 */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type React from 'react';
import { NoteEditModal } from '@/components/bible/NoteEditModal';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { useNoteDraft } from '@/hooks/bible/use-note-draft';
import { useNotes } from '@/hooks/bible/use-notes';
import type { Note } from '@/types/notes';

// Mock hooks
jest.mock('@/hooks/bible/use-notes');
jest.mock('@/hooks/bible/use-note-draft');

// Mock haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: {
    Light: 'light',
  },
}));

const renderWithTheme = (component: React.ReactElement) => {
  return render(<ThemeProvider>{component}</ThemeProvider>);
};

describe('NoteEditModal', () => {
  const mockNote: Note = {
    note_id: 'note-123',
    content: 'Original note content',
    created_at: '2025-01-01T12:00:00Z',
    updated_at: '2025-01-01T12:00:00Z',
    chapter_number: 1,
    book_id: 1,
    book_name: 'Genesis',
    verse_number: null,
  };

  const mockOnClose = jest.fn();
  const mockOnSave = jest.fn();
  const mockUpdateNote = jest.fn().mockResolvedValue(undefined);
  const mockClearDraft = jest.fn().mockResolvedValue(undefined);
  const mockSaveDraft = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useNotes as jest.Mock).mockReturnValue({
      updateNote: mockUpdateNote,
      isUpdatingNote: false,
    });
    (useNoteDraft as jest.Mock).mockReturnValue({
      draftContent: null,
      hasDraft: false,
      isDraftRestored: false,
      saveDraft: mockSaveDraft,
      clearDraft: mockClearDraft,
    });
  });

  it('should pre-fill textarea with existing note content', () => {
    renderWithTheme(
      <NoteEditModal
        visible={true}
        note={mockNote}
        bookName="Genesis"
        chapterNumber={1}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    );

    const textarea = screen.getByDisplayValue('Original note content');
    expect(textarea).toBeTruthy();
  });

  it('should call updateNote when Save button is pressed', async () => {
    renderWithTheme(
      <NoteEditModal
        visible={true}
        note={mockNote}
        bookName="Genesis"
        chapterNumber={1}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    );

    const textarea = screen.getByDisplayValue('Original note content');
    const saveButton = screen.getByText('Save');

    // Modify content
    fireEvent.changeText(textarea, 'Updated note content');

    // Press save button
    await act(async () => {
      fireEvent.press(saveButton);
    });

    await waitFor(() => {
      expect(mockUpdateNote).toHaveBeenCalledWith('note-123', 'Updated note content');
    });
  });

  it('should call onClose when Cancel button is pressed', () => {
    renderWithTheme(
      <NoteEditModal
        visible={true}
        note={mockNote}
        bookName="Genesis"
        chapterNumber={1}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    );

    const cancelButton = screen.getByText('Cancel');
    fireEvent.press(cancelButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('should display character counter when approaching limit', () => {
    renderWithTheme(
      <NoteEditModal
        visible={true}
        note={mockNote}
        bookName="Genesis"
        chapterNumber={1}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    );

    const textarea = screen.getByDisplayValue('Original note content');

    // Type content that exceeds threshold (4500 chars)
    fireEvent.changeText(textarea, 'A'.repeat(4600));

    // Counter should be visible
    expect(screen.getByText('4600 / 5000 characters')).toBeTruthy();
  });

  it('should call clearDraft after successful save', async () => {
    renderWithTheme(
      <NoteEditModal
        visible={true}
        note={mockNote}
        bookName="Genesis"
        chapterNumber={1}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    );

    const textarea = screen.getByDisplayValue('Original note content');
    const saveButton = screen.getByText('Save');

    // Modify content
    fireEvent.changeText(textarea, 'Updated content');

    // Press save
    await act(async () => {
      fireEvent.press(saveButton);
    });

    await waitFor(() => {
      expect(mockClearDraft).toHaveBeenCalled();
    });
  });
});
