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
      interimResults: false,
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
  });

  it('should call onTranscript when a final result is received', () => {
    const onTranscript = jest.fn();
    renderHook(() => useSpeechToText({ onTranscript }));

    act(() => {
      emitEvent('result', {
        isFinal: true,
        results: [{ transcript: 'Hello world', confidence: 0.95, segments: [] }],
      });
    });

    expect(onTranscript).toHaveBeenCalledWith('Hello world');
  });

  it('should not call onTranscript for non-final results', () => {
    const onTranscript = jest.fn();
    renderHook(() => useSpeechToText({ onTranscript }));

    act(() => {
      emitEvent('result', {
        isFinal: false,
        results: [{ transcript: 'Hello', confidence: 0.5, segments: [] }],
      });
    });

    expect(onTranscript).not.toHaveBeenCalled();
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

  it('should call onError for non-aborted errors', () => {
    const onTranscript = jest.fn();
    const onError = jest.fn();
    renderHook(() => useSpeechToText({ onTranscript, onError }));

    act(() => {
      emitEvent('error', { error: 'network', message: 'Network error' });
    });

    expect(onError).toHaveBeenCalledWith('Network error');
  });

  it('should not call onError for aborted or no-speech errors', () => {
    const onTranscript = jest.fn();
    const onError = jest.fn();
    renderHook(() => useSpeechToText({ onTranscript, onError }));

    act(() => {
      emitEvent('error', { error: 'aborted', message: 'Aborted' });
    });
    expect(onError).not.toHaveBeenCalled();

    act(() => {
      emitEvent('error', { error: 'no-speech', message: 'No speech' });
    });
    expect(onError).not.toHaveBeenCalled();
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
