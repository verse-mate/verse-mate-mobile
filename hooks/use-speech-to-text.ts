import * as Haptics from 'expo-haptics';
import type {
  ExpoSpeechRecognitionErrorEvent,
  ExpoSpeechRecognitionResultEvent,
} from 'expo-speech-recognition';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  abortRecognition,
  getNativeModule,
  hasNativeModule,
  isRecognitionAvailable,
  requestPermissions,
  startRecognition,
  stopRecognition,
} from '@/lib/speech-recognition';

interface UseSpeechToTextOptions {
  onTranscript: (text: string) => void;
  onError?: (message: string) => void;
}

interface UseSpeechToTextResult {
  isListening: boolean;
  isAvailable: boolean;
  startListening: () => Promise<void>;
  stopListening: () => void;
}

export function useSpeechToText({
  onTranscript,
  onError,
}: UseSpeechToTextOptions): UseSpeechToTextResult {
  const [isListening, setIsListening] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);
  const isListeningRef = useRef(false);
  const onTranscriptRef = useRef(onTranscript);
  const onErrorRef = useRef(onError);

  onTranscriptRef.current = onTranscript;
  onErrorRef.current = onError;

  useEffect(() => {
    setIsAvailable(isRecognitionAvailable());
  }, []);

  // Subscribe to native speech events via the module's event emitter
  useEffect(() => {
    const mod = getNativeModule();
    if (!mod) return;

    const resultSub = mod.addListener('result', (event: ExpoSpeechRecognitionResultEvent) => {
      if (event.isFinal && event.results.length > 0) {
        const transcript = event.results[0].transcript.trim();
        if (transcript) {
          onTranscriptRef.current(transcript);
        }
      }
    });

    const errorSub = mod.addListener('error', (event: ExpoSpeechRecognitionErrorEvent) => {
      setIsListening(false);
      isListeningRef.current = false;
      if (event.error !== 'aborted' && event.error !== 'no-speech') {
        onErrorRef.current?.(event.message || 'Speech recognition failed');
      }
    });

    const endSub = mod.addListener('end', () => {
      setIsListening(false);
      isListeningRef.current = false;
    });

    return () => {
      resultSub.remove();
      errorSub.remove();
      endSub.remove();
    };
  }, []);

  const startListening = useCallback(async () => {
    if (!hasNativeModule()) {
      onErrorRef.current?.('Voice input requires a development build');
      return;
    }

    const granted = await requestPermissions();
    if (!granted) {
      onErrorRef.current?.('Microphone permission is required for voice input');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsListening(true);
    isListeningRef.current = true;

    startRecognition({
      lang: 'en-US',
      interimResults: false,
      addsPunctuation: true,
    });
  }, []);

  const stopListening = useCallback(() => {
    if (isListeningRef.current) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      stopRecognition();
    }
  }, []);

  useEffect(() => {
    return () => {
      if (isListeningRef.current) {
        abortRecognition();
      }
    };
  }, []);

  return {
    isListening,
    isAvailable,
    startListening,
    stopListening,
  };
}
