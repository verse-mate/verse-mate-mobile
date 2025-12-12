import { requireNativeModule, Platform } from 'expo-modules-core';

interface DictionaryModuleInterface {
  hasDefinition(word: string): Promise<boolean>;
  showDefinition(word: string): Promise<boolean>;
}

// Will be null on platforms that don't have a native dictionary (web, Expo Go)
let DictionaryModule: DictionaryModuleInterface | null = null;

if (Platform.OS !== 'web') {
  try {
    DictionaryModule = requireNativeModule('Dictionary');
  } catch (error) {
    // Native module not available (e.g., running in Expo Go)
    // This is expected and the module will gracefully degrade
    console.log('Dictionary native module not available - running in Expo Go or development build without native modules');
  }
}

/**
 * Check if the native dictionary has a definition for a word.
 * Returns false on unsupported platforms (web) or if no definition exists.
 */
export async function hasDefinition(word: string): Promise<boolean> {
  if (!DictionaryModule) {
    return false;
  }
  try {
    return await DictionaryModule.hasDefinition(word);
  } catch {
    return false;
  }
}

/**
 * Show the native dictionary popup for a word.
 * Returns true if the dictionary was shown, false otherwise.
 * On iOS, uses UIReferenceLibraryViewController.
 * On Android, uses ACTION_DEFINE intent.
 */
export async function showDefinition(word: string): Promise<boolean> {
  if (!DictionaryModule) {
    return false;
  }
  try {
    return await DictionaryModule.showDefinition(word);
  } catch {
    return false;
  }
}

/**
 * Check if native dictionary is available on this platform.
 */
export function isNativeDictionaryAvailable(): boolean {
  return DictionaryModule !== null;
}
