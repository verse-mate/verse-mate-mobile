/**
 * Speech-to-Text Hook — Web Implementation
 *
 * Uses the Web Speech API (SpeechRecognition) available in Chrome, Edge, and Safari.
 * Falls back to isAvailable: false on unsupported browsers.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

interface UseSpeechToTextOptions {
  onTranscript: (text: string) => void;
  onError?: (message: string) => void;
}

interface UseSpeechToTextResult {
  isListening: boolean;
  isAvailable: boolean;
  errorCount: number;
  interimTranscript: string;
  startListening: () => Promise<void>;
  stopListening: () => void;
}

type SpeechRecognitionType = typeof window extends { SpeechRecognition: infer T } ? T : unknown;

function getSpeechRecognition(): SpeechRecognitionType | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as Record<string, unknown>;
  return (
    (win.SpeechRecognition as SpeechRecognitionType) ||
    (win.webkitSpeechRecognition as SpeechRecognitionType) ||
    null
  );
}

export function useSpeechToText({
  onTranscript,
  onError,
}: UseSpeechToTextOptions): UseSpeechToTextResult {
  const [isListening, setIsListening] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);
  const [errorCount, setErrorCount] = useState(0);
  const [interimTranscript, setInterimTranscript] = useState('');
  const recognitionRef = useRef<InstanceType<any> | null>(null);

  useEffect(() => {
    setIsAvailable(!!getSpeechRecognition());
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
    setInterimTranscript('');
  }, []);

  const startListening = useCallback(async () => {
    const SpeechRecognitionClass = getSpeechRecognition();
    if (!SpeechRecognitionClass) {
      onError?.('Speech recognition is not supported in this browser.');
      return;
    }

    const recognition = new (SpeechRecognitionClass as any)();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = navigator.language || 'en-US';

    recognition.onresult = (event: any) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }
      setInterimTranscript(interim);
      if (final) {
        onTranscript(final);
        setInterimTranscript('');
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'aborted' || event.error === 'no-speech') return;
      setErrorCount((c) => c + 1);
      onError?.(event.error || 'Speech recognition error');
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterimTranscript('');
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [onTranscript, onError]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
    };
  }, []);

  return {
    isListening,
    isAvailable,
    errorCount,
    interimTranscript,
    startListening,
    stopListening,
  };
}
