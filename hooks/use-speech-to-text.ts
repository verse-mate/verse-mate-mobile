import * as Haptics from 'expo-haptics';
import * as Localization from 'expo-localization';
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
  errorCount: number;
  interimTranscript: string;
  startListening: () => Promise<void>;
  stopListening: () => void;
}

export function useSpeechToText({
  onTranscript,
  onError,
}: UseSpeechToTextOptions): UseSpeechToTextResult {
  const [isListening, setIsListening] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);
  const [errorCount, setErrorCount] = useState(0);
  const [interimTranscript, setInterimTranscript] = useState('');
  const isListeningRef = useRef(false);
  const onTranscriptRef = useRef(onTranscript);
  const onErrorRef = useRef(onError);

  onTranscriptRef.current = onTranscript;
  onErrorRef.current = onError;

  const flashError = useCallback(() => {
    setErrorCount((c) => c + 1);
  }, []);

  useEffect(() => {
    setIsAvailable(isRecognitionAvailable());
  }, []);

  // Subscribe to native speech events via the module's event emitter
  useEffect(() => {
    const mod = getNativeModule();
    if (!mod) return;

    const resultSub = mod.addListener('result', (event: ExpoSpeechRecognitionResultEvent) => {
      if (event.results.length > 0) {
        const transcript = event.results[0].transcript.trim();
        if (event.isFinal) {
          setInterimTranscript('');
          if (transcript) {
            onTranscriptRef.current(transcript);
          }
        } else {
          setInterimTranscript(transcript);
        }
      }
    });

    const errorSub = mod.addListener('error', (event: ExpoSpeechRecognitionErrorEvent) => {
      setIsListening(false);
      isListeningRef.current = false;
      setInterimTranscript('');
      if (event.error === 'no-speech') {
        flashError();
        onErrorRef.current?.('No speech detected');
      } else if (event.error !== 'aborted') {
        flashError();
        onErrorRef.current?.(event.message || 'Speech recognition failed');
      }
    });

    const endSub = mod.addListener('end', () => {
      setIsListening(false);
      isListeningRef.current = false;
      setInterimTranscript('');
    });

    return () => {
      resultSub.remove();
      errorSub.remove();
      endSub.remove();
    };
  }, [flashError]);

  const startListening = useCallback(async () => {
    if (isListeningRef.current) return;

    if (!hasNativeModule()) {
      flashError();
      onErrorRef.current?.('Voice input requires a development build');
      return;
    }

    const granted = await requestPermissions();
    if (!granted) {
      flashError();
      onErrorRef.current?.('Microphone permission is required for voice input');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsListening(true);
    isListeningRef.current = true;

    const deviceLang = Localization.getLocales()[0]?.languageTag ?? 'en-US';

    try {
      startRecognition({
        lang: deviceLang,
        interimResults: true,
        // iOS-only: adds punctuation automatically; ignored on Android
        addsPunctuation: true,
      });
    } catch {
      setIsListening(false);
      isListeningRef.current = false;
      flashError();
      onErrorRef.current?.('Speech recognition failed to start');
    }
  }, [flashError]);

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
    errorCount,
    interimTranscript,
    startListening,
    stopListening,
  };
}
