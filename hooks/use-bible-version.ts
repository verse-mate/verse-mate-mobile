/**
 * Bible Version Hook
 *
 * Manages Bible version selection and persistence using AsyncStorage.
 * Provides similar API to web's useBibleVersion hook.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

const BIBLE_VERSION_KEY = 'bible-version';
const DEFAULT_VERSION = 'NASB1995';

export function useBibleVersion() {
  const [bibleVersion, setBibleVersionState] = useState<string>(DEFAULT_VERSION);
  const [isLoading, setIsLoading] = useState(true);

  // Load bible version from storage on mount
  useEffect(() => {
    const loadBibleVersion = async () => {
      try {
        const stored = await AsyncStorage.getItem(BIBLE_VERSION_KEY);
        if (stored) {
          setBibleVersionState(stored);
        }
      } catch (error) {
        console.error('Failed to load Bible version:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadBibleVersion();
  }, []);

  // Function to update bible version and persist to storage
  const setBibleVersion = async (version: string) => {
    try {
      await AsyncStorage.setItem(BIBLE_VERSION_KEY, version);
      setBibleVersionState(version);
    } catch (error) {
      console.error('Failed to save Bible version:', error);
      throw error;
    }
  };

  return {
    bibleVersion,
    setBibleVersion,
    isLoading,
  };
}
