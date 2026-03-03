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
  hasError: boolean;
  startListening: () => Promise<void>;
  stopListening: () => void;
}

export function useSpeechToText({
  onTranscript,
  onError,
}: UseSpeechToTextOptions): UseSpeechToTextResult {
  const [isListening, setIsListening] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);
  const [hasError, setHasError] = useState(false);
  const isListeningRef = useRef(false);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const onTranscriptRef = useRef(onTranscript);
  const onErrorRef = useRef(onError);

  onTranscriptRef.current = onTranscript;
  onErrorRef.current = onError;

  const flashError = useCallback(() => {
    setHasError(true);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => setHasError(false), 400);
  }, []);

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

    startRecognition({
      lang: deviceLang,
      interimResults: false,
      // iOS-only: adds punctuation automatically; ignored on Android
      addsPunctuation: true,
    });
  }, [flashError]);

  const stopListening = useCallback(() => {
    if (isListeningRef.current) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      stopRecognition();
    }
  }, []);

  useEffect(() => {
    return () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      if (isListeningRef.current) {
        abortRecognition();
      }
    };
  }, []);

  return {
    isListening,
    isAvailable,
    hasError,
    startListening,
    stopListening,
  };
}
