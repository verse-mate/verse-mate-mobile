/**
 * CharacterCounter Component
 *
 * Displays character count for note content with conditional visibility and error styling.
 *
 * Features:
 * - Hidden when content length is below threshold (default: 4500 chars)
 * - Visible when approaching or at character limit
 * - Error color (red) when at or over limit
 * - Format: "{current} / {max} characters"
 *
 * Visual Design:
 * - Font size: caption (12px)
 * - Color: gray500 (normal) / error (at/over limit)
 * - Position: Positioned by parent container
 *
 * @see Spec: agent-os/specs/2025-11-05-notes-functionality/spec.md (lines 55-60)
 * @see Task Group 4: Core UI Components - CharacterCounter
 *
 * @example
 * ```tsx
 * <CharacterCounter
 *   currentLength={4800}
 *   maxLength={5000}
 *   threshold={4500}
 * />
 * ```
 */

import { StyleSheet, Text } from 'react-native';
import { fontSizes, fontWeights, type getColors } from '@/constants/bible-design-tokens';
import { useTheme } from '@/contexts/ThemeContext';

/**
 * Props for CharacterCounter component
 */
export interface CharacterCounterProps {
  /** Current content length */
  currentLength: number;
  /** Maximum allowed length */
  maxLength: number;
  /** Threshold to show counter (hidden below this) */
  threshold: number;
}

/**
 * CharacterCounter Component
 *
 * Conditionally displays character count with error styling when at/over limit.
 *
 * Behavior:
 * - Returns null (hidden) when currentLength < threshold
 * - Shows count with normal color when below limit
 * - Shows count with error color when at or over limit
 */
export function CharacterCounter({ currentLength, maxLength, threshold }: CharacterCounterProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  // Hide counter if below threshold
  if (currentLength < threshold) {
    return null;
  }

  // Determine if over limit
  const isOverLimit = currentLength >= maxLength;

  // Format: "4500 / 5000 characters"
  const text = `${currentLength} / ${maxLength} characters`;

  return <Text style={[styles.counter, isOverLimit && styles.counterError]}>{text}</Text>;
}

const createStyles = (colors: ReturnType<typeof getColors>) =>
  StyleSheet.create({
    counter: {
      fontSize: fontSizes.caption,
      fontWeight: fontWeights.regular,
      color: colors.textTertiary,
      textAlign: 'right',
    },
    counterError: {
      color: colors.error,
    },
  });
