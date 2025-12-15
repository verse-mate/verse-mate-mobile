/**
 * Tests for NoteCard Component
 *
 * Focused tests for note card display and interaction.
 * Tests cover critical behaviors: content truncation, menu handler, press handler.
 *
 * @see Task Group 4.5: Write 2-8 focused tests for NoteCard component
 */

import { fireEvent, render, screen } from '@testing-library/react-native';
import { NoteCard } from '@/components/bible/NoteCard';
import type { Note } from '@/types/notes';

describe('NoteCard', () => {
  const mockNote: Note = {
    note_id: 'note-123',
    content: 'This is a test note with some content that should be displayed in the card.',
    created_at: '2025-01-01T12:00:00Z',
    updated_at: '2025-01-01T12:00:00Z',
    chapter_number: 1,
    book_id: 1,
    book_name: 'Genesis',
    verse_number: null,
  };

  const mockOnPress = jest.fn();
  const mockOnEdit = jest.fn();
  const mockOnMenuPress = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render note content', () => {
    render(
      <NoteCard
        note={mockNote}
        onPress={mockOnPress}
        onEdit={mockOnEdit}
        onMenuPress={mockOnMenuPress}
      />
    );

    expect(screen.getByText(/This is a test note/)).toBeTruthy();
  });

  it('should truncate long content to 100 characters by default', () => {
    const longNote: Note = {
      ...mockNote,
      content: 'A'.repeat(150), // 150 characters
    };

    const { getByText } = render(
      <NoteCard
        note={longNote}
        onPress={mockOnPress}
        onEdit={mockOnEdit}
        onMenuPress={mockOnMenuPress}
      />
    );

    // Should show first 100 characters plus ellipsis
    const displayedText = getByText(/A{100}\.\.\./, { exact: false });
    expect(displayedText).toBeTruthy();
  });

  it('should allow custom truncate length', () => {
    const longNote: Note = {
      ...mockNote,
      content: 'B'.repeat(80),
    };

    const { getByText } = render(
      <NoteCard
        note={longNote}
        onPress={mockOnPress}
        onEdit={mockOnEdit}
        onMenuPress={mockOnMenuPress}
        truncateLength={50}
      />
    );

    // Should truncate at 50 characters
    const displayedText = getByText(/B{50}\.\.\./, { exact: false });
    expect(displayedText).toBeTruthy();
  });

  it('should call onEdit when short note is pressed', () => {
    // Note length is ~75 chars, default truncate is 100. So it is short.
    render(
      <NoteCard
        note={mockNote}
        onPress={mockOnPress}
        onEdit={mockOnEdit}
        onMenuPress={mockOnMenuPress}
      />
    );

    const card = screen.getByTestId('note-card-note-123');
    fireEvent.press(card);

    expect(mockOnEdit).toHaveBeenCalledWith(mockNote);
    expect(mockOnPress).not.toHaveBeenCalled();
  });

  it('should call onPress (expand) when long note is pressed (collapsed)', () => {
    const longNote: Note = {
      ...mockNote,
      content: 'A'.repeat(150),
    };

    render(
      <NoteCard
        note={longNote}
        onPress={mockOnPress}
        onEdit={mockOnEdit}
        onMenuPress={mockOnMenuPress}
        isExpanded={false}
      />
    );

    const card = screen.getByTestId('note-card-note-123');
    fireEvent.press(card);

    expect(mockOnPress).toHaveBeenCalledWith(longNote);
    expect(mockOnEdit).not.toHaveBeenCalled();
  });

  it('should call onEdit when long note is pressed (expanded)', () => {
    const longNote: Note = {
      ...mockNote,
      content: 'A'.repeat(150),
    };

    render(
      <NoteCard
        note={longNote}
        onPress={mockOnPress}
        onEdit={mockOnEdit}
        onMenuPress={mockOnMenuPress}
        isExpanded={true}
      />
    );

    const card = screen.getByTestId('note-card-note-123');
    fireEvent.press(card);

    expect(mockOnEdit).toHaveBeenCalledWith(longNote);
    expect(mockOnPress).not.toHaveBeenCalled();
  });

  it('should call onMenuPress when menu button is pressed', () => {
    render(
      <NoteCard
        note={mockNote}
        onPress={mockOnPress}
        onEdit={mockOnEdit}
        onMenuPress={mockOnMenuPress}
      />
    );

    const menuButton = screen.getByTestId('note-menu-note-123');
    fireEvent.press(menuButton);

    expect(mockOnMenuPress).toHaveBeenCalledWith(mockNote);
  });

  it('should not truncate short content', () => {
    const shortNote: Note = {
      ...mockNote,
      content: 'Short note',
    };

    const { getByText, queryByText } = render(
      <NoteCard
        note={shortNote}
        onPress={mockOnPress}
        onEdit={mockOnEdit}
        onMenuPress={mockOnMenuPress}
      />
    );

    // Should show full content without ellipsis
    expect(getByText('Short note')).toBeTruthy();
    expect(queryByText(/\.\.\./)).toBeNull();
  });
});
