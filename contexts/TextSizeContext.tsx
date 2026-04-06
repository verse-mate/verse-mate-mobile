/**
 * Text Size Context
 *
 * Manages text size preference with AsyncStorage persistence.
 * Provides a scale factor applied to reading content font sizes.
 *
 * Pattern based on ThemeContext for AsyncStorage persistence and PostHog tracking.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';

import { getPostHogInstance } from '@/lib/analytics/posthog-provider';

// ============================================================================
// Types
// ============================================================================

/**
 * Text size preset options
 */
export type TextSizePreset = 'small' | 'medium' | 'large' | 'extraLarge';

/**
 * Text size context value provided to all consumers
 */
export interface TextSizeContextValue {
  /** Current text size preset */
  preset: TextSizePreset;
  /** Scale factor for the current preset */
  scaleFactor: number;
  /** Update text size preset and persist to AsyncStorage */
  setPreset: (preset: TextSizePreset) => Promise<void>;
  /** Calculate a scaled font size from a base value */
  scaledFontSize: (base: number) => number;
  /** Whether text size is still loading from AsyncStorage */
  isLoading: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const TEXT_SIZE_PREFERENCE_KEY = 'text-size-preference';
const DEFAULT_PRESET: TextSizePreset = 'medium';

export const SCALE_FACTORS: Record<TextSizePreset, number> = {
  small: 0.85,
  medium: 1.0,
  large: 1.15,
  extraLarge: 1.3,
};

export const PRESET_LABELS: Record<TextSizePreset, string> = {
  small: 'Small',
  medium: 'Medium',
  large: 'Large',
  extraLarge: 'Extra Large',
};

export const PRESET_ORDER: TextSizePreset[] = ['small', 'medium', 'large', 'extraLarge'];

// ============================================================================
// Context
// ============================================================================

const TextSizeContext = createContext<TextSizeContextValue | undefined>(undefined);

// ============================================================================
// Provider Component
// ============================================================================

interface TextSizeProviderProps {
  children: ReactNode;
}

export function TextSizeProvider({ children }: TextSizeProviderProps) {
  const [preset, setPresetState] = useState<TextSizePreset>(DEFAULT_PRESET);
  const [isLoading, setIsLoading] = useState(true);

  // Load text size preference from AsyncStorage on mount
  useEffect(() => {
    const loadPreference = async () => {
      try {
        const stored = await AsyncStorage.getItem(TEXT_SIZE_PREFERENCE_KEY);
        if (stored && PRESET_ORDER.includes(stored as TextSizePreset)) {
          setPresetState(stored as TextSizePreset);
        }
      } catch (error) {
        console.error('Failed to load text size preference:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadPreference();
  }, []);

  // Function to update text size preference and persist to AsyncStorage
  const setPreset = async (newPreset: TextSizePreset) => {
    try {
      // Optimistically update state first for immediate UI feedback
      setPresetState(newPreset);

      // Persist to AsyncStorage
      await AsyncStorage.setItem(TEXT_SIZE_PREFERENCE_KEY, newPreset);

      // Track analytics
      const posthog = getPostHogInstance();
      if (posthog) {
        posthog.capture('$set', {
          $set: { text_size_preference: newPreset },
        });
      }
    } catch (error) {
      console.error('Failed to save text size preference:', error);

      if (error instanceof Error && error.message.includes('QuotaExceededError')) {
        console.warn('Storage quota exceeded. Text size preference not persisted.');
      }
    }
  };

  const scaleFactor = SCALE_FACTORS[preset];

  const scaledFontSize = (base: number): number => {
    return Math.round(base * SCALE_FACTORS[preset]);
  };

  const value: TextSizeContextValue = {
    preset,
    scaleFactor,
    setPreset,
    scaledFontSize,
    isLoading,
  };

  return <TextSizeContext.Provider value={value}>{children}</TextSizeContext.Provider>;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook to access text size context
 *
 * @throws Error if used outside TextSizeProvider
 */
export function useTextSize(): TextSizeContextValue {
  const context = useContext(TextSizeContext);

  if (context === undefined) {
    throw new Error('useTextSize must be used within a TextSizeProvider');
  }

  return context;
}
