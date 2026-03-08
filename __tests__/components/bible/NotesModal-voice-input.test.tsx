import { fireEvent, render } from '@testing-library/react-native';
import type React from 'react';
import { NotesModal } from '@/components/bible/NotesModal';

// Mock useSpeechToText hook
const mockStartListening = jest.fn();
const mockStopListening = jest.fn();

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
const mockAddNote = jest.fn();
const mockDeleteNote = jest.fn();
jest.mock('@/hooks/bible/use-notes', () => ({
  useNotes: jest.fn().mockReturnValue({
    addNote: mockAddNote,
    isAddingNote: false,
    deleteNote: mockDeleteNote,
  }),
}));

// Mock ToastContext
const mockShowToast = jest.fn();
jest.mock('@/contexts/ToastContext', () => ({
  useToast: jest.fn().mockReturnValue({
    showToast: mockShowToast,
  }),
}));

// Mock SafeAreaView
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

describe('NotesModal - Voice Input Integration', () => {
  const defaultProps = {
    visible: true,
    bookId: 1,
    chapterNumber: 1,
    bookName: 'Genesis',
    onClose: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset useSpeechToText mock to default state
    const { useSpeechToText } = jest.requireMock('@/hooks/use-speech-to-text');
    useSpeechToText.mockReturnValue({
      isListening: false,
      isAvailable: true,
      errorCount: 0,
      startListening: mockStartListening,
      stopListening: mockStopListening,
    });
  });

  it('renders mic button when speech is available', () => {
    const { getByTestId } = render(<NotesModal {...defaultProps} />);

    const micButton = getByTestId('mic-button');
    expect(micButton).toBeTruthy();
  });

  it('hides mic button when speech is unavailable', () => {
    const { useSpeechToText } = jest.requireMock('@/hooks/use-speech-to-text');
    useSpeechToText.mockReturnValue({
      isListening: false,
      isAvailable: false,
      errorCount: 0,
      startListening: mockStartListening,
      stopListening: mockStopListening,
    });

    const { queryByTestId } = render(<NotesModal {...defaultProps} />);

    const micButton = queryByTestId('mic-button');
    expect(micButton).toBeNull();
  });

  it('calls startListening when mic button is pressed while not listening', () => {
    const { getByTestId } = render(<NotesModal {...defaultProps} />);

    const micButton = getByTestId('mic-button');
    fireEvent.press(micButton);

    expect(mockStartListening).toHaveBeenCalledTimes(1);
    expect(mockStopListening).not.toHaveBeenCalled();
  });

  it('calls stopListening when mic button is pressed while listening', () => {
    const { useSpeechToText } = jest.requireMock('@/hooks/use-speech-to-text');
    useSpeechToText.mockReturnValue({
      isListening: true,
      isAvailable: true,
      errorCount: 0,
      startListening: mockStartListening,
      stopListening: mockStopListening,
    });

    const { getByTestId } = render(<NotesModal {...defaultProps} />);

    const micButton = getByTestId('mic-button');
    fireEvent.press(micButton);

    expect(mockStopListening).toHaveBeenCalledTimes(1);
    expect(mockStartListening).not.toHaveBeenCalled();
  });

  it('displays interim transcript text when available', () => {
    const { useSpeechToText } = jest.requireMock('@/hooks/use-speech-to-text');
    useSpeechToText.mockReturnValue({
      isListening: true,
      isAvailable: true,
      errorCount: 0,
      interimTranscript: 'hello world',
      startListening: mockStartListening,
      stopListening: mockStopListening,
    });

    const { getByText } = render(<NotesModal {...defaultProps} />);

    expect(getByText('\u201Chello world\u201D')).toBeTruthy();
  });

  it('does not display interim transcript when empty', () => {
    const { queryByText } = render(<NotesModal {...defaultProps} />);

    expect(queryByText(/\u201C/)).toBeNull();
  });

  it('does not render mic button when modal is not visible', () => {
    const { queryByTestId } = render(<NotesModal {...defaultProps} visible={false} />);

    const micButton = queryByTestId('mic-button');
    expect(micButton).toBeNull();
  });

  it('mic button reflects listening state correctly', () => {
    const { useSpeechToText } = jest.requireMock('@/hooks/use-speech-to-text');

    // Initial render - not listening
    const { getByTestId, rerender } = render(<NotesModal {...defaultProps} />);
    let micButton = getByTestId('mic-button');
    expect(micButton).toBeTruthy();

    // Update to listening state
    useSpeechToText.mockReturnValue({
      isListening: true,
      isAvailable: true,
      errorCount: 0,
      startListening: mockStartListening,
      stopListening: mockStopListening,
    });

    rerender(<NotesModal {...defaultProps} />);
    micButton = getByTestId('mic-button');
    expect(micButton).toBeTruthy();
  });
});
