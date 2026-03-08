import { act, renderHook } from '@testing-library/react-native';
import { useSpeechToText } from '@/hooks/use-speech-to-text';
import * as speechLib from '@/lib/speech-recognition';

// Mock the native module addListener for event subscriptions
const mockListeners: Record<string, ((...args: unknown[]) => void)[]> = {};
const mockRemove = jest.fn();
const mockNativeModule = {
  addListener: jest.fn((eventName: string, handler: (...args: unknown[]) => void) => {
    if (!mockListeners[eventName]) mockListeners[eventName] = [];
    mockListeners[eventName].push(handler);
    return { remove: mockRemove };
  }),
};

// Mock expo-localization
jest.mock('expo-localization', () => ({
  getLocales: jest.fn().mockReturnValue([{ languageTag: 'en-US' }]),
}));

// Mock the speech-recognition lib
jest.mock('@/lib/speech-recognition', () => ({
  isRecognitionAvailable: jest.fn().mockReturnValue(true),
  requestPermissions: jest.fn().mockResolvedValue(true),
  startRecognition: jest.fn(),
  stopRecognition: jest.fn(),
  abortRecognition: jest.fn(),
  hasNativeModule: jest.fn().mockReturnValue(true),
  getNativeModule: jest.fn().mockReturnValue(mockNativeModule),
}));

function emitEvent(eventName: string, data?: unknown) {
  mockListeners[eventName]?.forEach((handler) => {
    handler(data);
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  for (const key of Object.keys(mockListeners)) {
    delete mockListeners[key];
  }
  (speechLib.isRecognitionAvailable as jest.Mock).mockReturnValue(true);
  (speechLib.requestPermissions as jest.Mock).mockResolvedValue(true);
  (speechLib.startRecognition as jest.Mock).mockImplementation(() => {});
  (speechLib.hasNativeModule as jest.Mock).mockReturnValue(true);
  // Restore mocks wiped by clearAllMocks
  (speechLib.getNativeModule as jest.Mock).mockReturnValue(mockNativeModule);
  mockNativeModule.addListener.mockImplementation(
    (eventName: string, handler: (...args: unknown[]) => void) => {
      if (!mockListeners[eventName]) mockListeners[eventName] = [];
      mockListeners[eventName].push(handler);
      return { remove: mockRemove };
    }
  );
});

describe('useSpeechToText', () => {
  it('should return initial state', () => {
    const onTranscript = jest.fn();
    const { result } = renderHook(() => useSpeechToText({ onTranscript }));

    expect(result.current.isListening).toBe(false);
    expect(result.current.isAvailable).toBe(true);
    expect(result.current.errorCount).toBe(0);
    expect(result.current.interimTranscript).toBe('');
    expect(typeof result.current.startListening).toBe('function');
    expect(typeof result.current.stopListening).toBe('function');
  });

  it('should report unavailable when recognition is not available', () => {
    (speechLib.isRecognitionAvailable as jest.Mock).mockReturnValue(false);

    const onTranscript = jest.fn();
    const { result } = renderHook(() => useSpeechToText({ onTranscript }));

    expect(result.current.isAvailable).toBe(false);
  });

  it('should start listening when permissions are granted', async () => {
    const onTranscript = jest.fn();
    const { result } = renderHook(() => useSpeechToText({ onTranscript }));

    await act(async () => {
      await result.current.startListening();
    });

    expect(speechLib.requestPermissions).toHaveBeenCalled();
    expect(speechLib.startRecognition).toHaveBeenCalledWith({
      lang: 'en-US',
      interimResults: true,
      addsPunctuation: true,
    });
    expect(result.current.isListening).toBe(true);
  });

  it('should not start when permissions are denied', async () => {
    (speechLib.requestPermissions as jest.Mock).mockResolvedValue(false);
    const onTranscript = jest.fn();
    const onError = jest.fn();
    const { result } = renderHook(() => useSpeechToText({ onTranscript, onError }));

    await act(async () => {
      await result.current.startListening();
    });

    expect(speechLib.startRecognition).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith('Microphone permission is required for voice input');
    expect(result.current.errorCount).toBe(1);
    expect(result.current.isListening).toBe(false);
  });

  it('should not start when native module is unavailable', async () => {
    (speechLib.hasNativeModule as jest.Mock).mockReturnValue(false);
    const onTranscript = jest.fn();
    const onError = jest.fn();
    const { result } = renderHook(() => useSpeechToText({ onTranscript, onError }));

    await act(async () => {
      await result.current.startListening();
    });

    expect(speechLib.startRecognition).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith('Voice input requires a development build');
    expect(result.current.errorCount).toBe(1);
  });

  it('should call onTranscript and clear interimTranscript on final result', () => {
    const onTranscript = jest.fn();
    const { result } = renderHook(() => useSpeechToText({ onTranscript }));

    // First emit an interim result
    act(() => {
      emitEvent('result', {
        isFinal: false,
        results: [{ transcript: 'Hello', confidence: 0.5, segments: [] }],
      });
    });
    expect(result.current.interimTranscript).toBe('Hello');

    // Then emit final result — should clear interim and call onTranscript
    act(() => {
      emitEvent('result', {
        isFinal: true,
        results: [{ transcript: 'Hello world', confidence: 0.95, segments: [] }],
      });
    });

    expect(onTranscript).toHaveBeenCalledWith('Hello world');
    expect(result.current.interimTranscript).toBe('');
  });

  it('should update interimTranscript for non-final results without calling onTranscript', () => {
    const onTranscript = jest.fn();
    const { result } = renderHook(() => useSpeechToText({ onTranscript }));

    act(() => {
      emitEvent('result', {
        isFinal: false,
        results: [{ transcript: 'Hello', confidence: 0.5, segments: [] }],
      });
    });

    expect(onTranscript).not.toHaveBeenCalled();
    expect(result.current.interimTranscript).toBe('Hello');
  });

  it('should stop listening on end event', async () => {
    const onTranscript = jest.fn();
    const { result } = renderHook(() => useSpeechToText({ onTranscript }));

    await act(async () => {
      await result.current.startListening();
    });
    expect(result.current.isListening).toBe(true);

    act(() => {
      emitEvent('end');
    });
    expect(result.current.isListening).toBe(false);
  });

  it('should call onError and increment errorCount for non-aborted errors', () => {
    const onTranscript = jest.fn();
    const onError = jest.fn();
    const { result } = renderHook(() => useSpeechToText({ onTranscript, onError }));

    expect(result.current.errorCount).toBe(0);

    act(() => {
      emitEvent('error', { error: 'network', message: 'Network error' });
    });

    expect(onError).toHaveBeenCalledWith('Network error');
    expect(result.current.errorCount).toBe(1);
  });

  it('should not call onError for aborted errors', () => {
    const onTranscript = jest.fn();
    const onError = jest.fn();
    const { result } = renderHook(() => useSpeechToText({ onTranscript, onError }));

    act(() => {
      emitEvent('error', { error: 'aborted', message: 'Aborted' });
    });
    expect(onError).not.toHaveBeenCalled();
    expect(result.current.errorCount).toBe(0);
  });

  it('should show friendly message and increment errorCount for no-speech errors', () => {
    const onTranscript = jest.fn();
    const onError = jest.fn();
    const { result } = renderHook(() => useSpeechToText({ onTranscript, onError }));

    act(() => {
      emitEvent('error', { error: 'no-speech', message: 'No speech detected by engine' });
    });

    expect(onError).toHaveBeenCalledWith('No speech detected');
    expect(result.current.errorCount).toBe(1);
  });

  it('should call stop on stopListening', async () => {
    const onTranscript = jest.fn();
    const { result } = renderHook(() => useSpeechToText({ onTranscript }));

    await act(async () => {
      await result.current.startListening();
    });

    act(() => {
      result.current.stopListening();
    });

    expect(speechLib.stopRecognition).toHaveBeenCalled();
  });

  it('should reset state and call onError when startRecognition throws', async () => {
    (speechLib.startRecognition as jest.Mock).mockImplementation(() => {
      throw new Error('Native module crash');
    });
    const onTranscript = jest.fn();
    const onError = jest.fn();
    const { result } = renderHook(() => useSpeechToText({ onTranscript, onError }));

    await act(async () => {
      await result.current.startListening();
    });

    expect(result.current.isListening).toBe(false);
    expect(result.current.errorCount).toBe(1);
    expect(onError).toHaveBeenCalledWith('Speech recognition failed to start');
  });

  it('should use fallback message when error event has no message', () => {
    const onTranscript = jest.fn();
    const onError = jest.fn();
    renderHook(() => useSpeechToText({ onTranscript, onError }));

    act(() => {
      emitEvent('error', { error: 'network', message: '' });
    });

    expect(onError).toHaveBeenCalledWith('Speech recognition failed');
  });

  it('should not start again if already listening', async () => {
    const onTranscript = jest.fn();
    const { result } = renderHook(() => useSpeechToText({ onTranscript }));

    await act(async () => {
      await result.current.startListening();
    });
    expect(speechLib.startRecognition).toHaveBeenCalledTimes(1);

    // Try to start again while already listening
    await act(async () => {
      await result.current.startListening();
    });
    // Should not call startRecognition a second time
    expect(speechLib.startRecognition).toHaveBeenCalledTimes(1);
  });

  it('should clear interimTranscript on error', () => {
    const onTranscript = jest.fn();
    const { result } = renderHook(() => useSpeechToText({ onTranscript }));

    // Set an interim result first
    act(() => {
      emitEvent('result', {
        isFinal: false,
        results: [{ transcript: 'partial', confidence: 0.3, segments: [] }],
      });
    });
    expect(result.current.interimTranscript).toBe('partial');

    // Error should clear it
    act(() => {
      emitEvent('error', { error: 'network', message: 'Network error' });
    });
    expect(result.current.interimTranscript).toBe('');
  });

  it('should clear interimTranscript on end', async () => {
    const onTranscript = jest.fn();
    const { result } = renderHook(() => useSpeechToText({ onTranscript }));

    await act(async () => {
      await result.current.startListening();
    });

    // Set an interim result
    act(() => {
      emitEvent('result', {
        isFinal: false,
        results: [{ transcript: 'partial', confidence: 0.3, segments: [] }],
      });
    });
    expect(result.current.interimTranscript).toBe('partial');

    // End event should clear it
    act(() => {
      emitEvent('end');
    });
    expect(result.current.interimTranscript).toBe('');
  });

  it('should abort on unmount if listening', async () => {
    const onTranscript = jest.fn();
    const { result, unmount } = renderHook(() => useSpeechToText({ onTranscript }));

    await act(async () => {
      await result.current.startListening();
    });

    unmount();

    expect(speechLib.abortRecognition).toHaveBeenCalled();
  });
});
