/**
 * Safe wrapper for expo-speech-recognition.
 * Uses requireOptionalNativeModule to gracefully handle Expo Go
 * where the native module is unavailable (returns null instead of throwing).
 */

import { requireOptionalNativeModule } from 'expo';
import type { ExpoSpeechRecognitionOptions } from 'expo-speech-recognition';

type SpeechModuleType = typeof import('expo-speech-recognition').ExpoSpeechRecognitionModule;

const SpeechModule = requireOptionalNativeModule<SpeechModuleType>('ExpoSpeechRecognition');

export function isRecognitionAvailable(): boolean {
  try {
    return SpeechModule?.isRecognitionAvailable() ?? false;
  } catch {
    return false;
  }
}

export async function requestPermissions(): Promise<boolean> {
  if (!SpeechModule) return false;
  const { granted } = await SpeechModule.requestPermissionsAsync();
  return granted;
}

export function startRecognition(options: ExpoSpeechRecognitionOptions): void {
  SpeechModule?.start(options);
}

export function stopRecognition(): void {
  SpeechModule?.stop();
}

export function abortRecognition(): void {
  SpeechModule?.abort();
}

export function getNativeModule() {
  return SpeechModule;
}

export const hasNativeModule = (): boolean => SpeechModule !== null;
