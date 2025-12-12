import { useCallback, useState } from 'react';
import * as Dictionary from '@/modules/dictionary';

interface UseNativeDictionaryResult {
  showDefinition: (word: string) => Promise<boolean>;
  hasDefinition: (word: string) => Promise<boolean>;
  isAvailable: boolean;
  isLoading: boolean;
  lastWord: string | null;
}

/**
 * Hook for accessing native OS dictionary functionality.
 * On iOS, uses UIReferenceLibraryViewController.
 * On Android, uses ACTION_DEFINE intent.
 *
 * @example
 * ```tsx
 * const { showDefinition, hasDefinition, isAvailable } = useNativeDictionary();
 *
 * const handleWordPress = async (word: string) => {
 *   if (isAvailable) {
 *     const shown = await showDefinition(word);
 *     if (!shown) {
 *       // Fallback to Strong's lexicon
 *     }
 *   }
 * };
 * ```
 */
export function useNativeDictionary(): UseNativeDictionaryResult {
  const [isLoading, setIsLoading] = useState(false);
  const [lastWord, setLastWord] = useState<string | null>(null);

  const isAvailable = Dictionary.isNativeDictionaryAvailable();

  const showDefinition = useCallback(
    async (word: string): Promise<boolean> => {
      if (!isAvailable) {
        return false;
      }

      setIsLoading(true);
      setLastWord(word);

      try {
        return await Dictionary.showDefinition(word);
      } finally {
        setIsLoading(false);
      }
    },
    [isAvailable]
  );

  const hasDefinition = useCallback(
    async (word: string): Promise<boolean> => {
      if (!isAvailable) {
        return false;
      }

      try {
        return await Dictionary.hasDefinition(word);
      } catch {
        return false;
      }
    },
    [isAvailable]
  );

  return {
    showDefinition,
    hasDefinition,
    isAvailable,
    isLoading,
    lastWord,
  };
}
