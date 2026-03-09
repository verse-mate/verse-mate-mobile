import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { NoteEditModal } from '@/components/bible/NoteEditModal';

const mockStartListening = jest.fn();
const mockStopListening = jest.fn();
const mockUpdateNote = jest.fn();
const mockSaveDraft = jest.fn();
const mockClearDraft = jest.fn();
const mockShowToast = jest.fn();

// Mock useSpeechToText hook
jest.mock('@/hooks/use-speech-to-text', () => ({
  useSpeechToText: jest.fn().mockReturnValue({
    isListening: false,
    isAvailable: true,
    errorCount: 0,
    interimTranscript: '',
    startListening: mockStartListening,
    stopListening: mockStopListening,
  }),
}));

// Mock useNotes hook
jest.mock('@/hooks/bible/use-notes', () => ({
  useNotes: jest.fn().mockReturnValue({
    updateNote: mockUpdateNote,
    isUpdatingNote: false,
  }),
}));

// Mock useNoteDraft hook
jest.mock('@/hooks/bible/use-note-draft', () => ({
  useNoteDraft: jest.fn().mockReturnValue({
    draftContent: null,
    isDraftRestored: false,
    saveDraft: mockSaveDraft,
    clearDraft: mockClearDraft,
  }),
}));

// Mock ToastContext
jest.mock('@/contexts/ToastContext', () => ({
  useToast: jest.fn().mockReturnValue({
    showToast: mockShowToast,
  }),
}));

// Mock safe area insets
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: jest.fn().mockReturnValue({
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  }),
}));

// Mock share URL generator
jest.mock('@/utils/sharing/generate-chapter-share-url', () => ({
  generateChapterShareUrl: jest.fn().mockReturnValue(''),
}));

describe('NoteEditModal - Voice Input Integration', () => {
  const mockNote = {
    note_id: 'test-note-1',
    book_id: 1,
    chapter_number: 1,
    content: 'Test note content',
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
    book_name: 'Genesis',
    verse_number: null,
  };

  const defaultProps = {
    visible: true,
    note: mockNote,
    bookName: 'Genesis',
    chapterNumber: 1,
    onClose: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset useSpeechToText mock to default state
    const { useSpeechToText } = require('@/hooks/use-speech-to-text');
    useSpeechToText.mockReturnValue({
      isListening: false,
      isAvailable: true,
      errorCount: 0,
      startListening: mockStartListening,
      stopListening: mockStopListening,
    });
  });

  it('renders microphone button when speech is available', () => {
    const { getByTestId } = render(<NoteEditModal {...defaultProps} />);

    const micButton = getByTestId('mic-button');
    expect(micButton).toBeTruthy();
  });

  it('hides microphone button when speech is unavailable', () => {
    const { useSpeechToText } = require('@/hooks/use-speech-to-text');
    useSpeechToText.mockReturnValue({
      isListening: false,
      isAvailable: false,
      errorCount: 0,
      startListening: mockStartListening,
      stopListening: mockStopListening,
    });

    const { queryByTestId } = render(<NoteEditModal {...defaultProps} />);

    const micButton = queryByTestId('mic-button');
    expect(micButton).toBeNull();
  });

  it('calls startListening when microphone button is pressed', () => {
    const { getByTestId } = render(<NoteEditModal {...defaultProps} />);

    const micButton = getByTestId('mic-button');
    fireEvent.press(micButton);

    expect(mockStartListening).toHaveBeenCalledTimes(1);
  });

  it('calls stopListening when microphone button is pressed while listening', () => {
    const { useSpeechToText } = require('@/hooks/use-speech-to-text');
    useSpeechToText.mockReturnValue({
      isListening: true,
      isAvailable: true,
      errorCount: 0,
      startListening: mockStartListening,
      stopListening: mockStopListening,
    });

    const { getByTestId } = render(<NoteEditModal {...defaultProps} />);

    const micButton = getByTestId('mic-button');
    fireEvent.press(micButton);

    expect(mockStopListening).toHaveBeenCalledTimes(1);
    expect(mockStartListening).not.toHaveBeenCalled();
  });

  it('displays interim transcript text when available', () => {
    const { useSpeechToText } = require('@/hooks/use-speech-to-text');
    useSpeechToText.mockReturnValue({
      isListening: true,
      isAvailable: true,
      errorCount: 0,
      interimTranscript: 'hello world',
      startListening: mockStartListening,
      stopListening: mockStopListening,
    });

    const { getByText } = render(<NoteEditModal {...defaultProps} />);

    expect(getByText('\u201Chello world\u201D')).toBeTruthy();
  });

  it('does not display interim transcript when empty', () => {
    const { queryByText } = render(<NoteEditModal {...defaultProps} />);

    expect(queryByText(/\u201C/)).toBeNull();
  });
});
