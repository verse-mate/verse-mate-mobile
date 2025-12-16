/**
 * Bible Version Hook
 *
 * Manages Bible version selection and persistence using AsyncStorage.
 * Provides similar API to web's useBibleVersion hook.
 *
 * @see Task 4.3 - Analytics tracking for preferred_bible_version
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { getPostHogInstance } from '@/lib/analytics/posthog-provider';

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

      // Track analytics: Update user property for preferred_bible_version
      // Use PostHog's capture with $set to update person properties for anonymous users
      // This ensures the property is set even if user is not logged in
      const posthog = getPostHogInstance();
      if (posthog) {
        // Use capture with $set to update person properties
        // This works for both anonymous and identified users
        posthog.capture('$set', {
          $set: { preferred_bible_version: version },
        });
      }
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
