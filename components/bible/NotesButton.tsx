/**
 * NotesButton Component
 *
 * Renders a pressable notes icon that opens the notes modal for a Bible chapter.
 * Features:
 * - Icon changes based on notes existence (document-text vs document-text-outline)
 * - Haptic feedback on press
 * - Accessibility support with proper labels
 *
 * Visual Design:
 * - Icon: Ionicons document-text (filled) / document-text-outline (unfilled)
 * - Size: 24px (from bible-design-tokens headerSpecs.iconSize)
 * - Color: black/dark (matches existing icon styling)
 * - Position: Right of bookmark icon in chapter header
 *
 * @see Spec: agent-os/specs/2025-11-05-notes-functionality/spec.md (lines 12-18)
 * @see Task Group 4: Core UI Components - NotesButton
 *
 * @example
 * ```tsx
 * <NotesButton bookId={1} chapterNumber={1} onPress={handleOpenModal} />
 * <NotesButton bookId={43} chapterNumber={3} size={20} color="#666" />
 * ```
 */

import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet } from 'react-native';
import { colors, headerSpecs } from '@/constants/bible-design-tokens';
import { useNotes } from '@/hooks/bible/use-notes';

/**
 * Props for NotesButton component
 */
export interface NotesButtonProps {
  /** Book ID (1-66) */
  bookId: number;
  /** Chapter number (1-based) */
  chapterNumber: number;
  /** Callback when button is pressed */
  onPress: () => void;
  /** Icon size in pixels (default: 24px from headerSpecs.iconSize) */
  size?: number;
  /** Icon color (default: colors.black) */
  color?: string;
}

/**
 * NotesButton Component
 *
 * Displays a pressable notes icon that opens notes modal.
 * Icon automatically updates based on notes existence:
 * - document-text-outline (unfilled): Chapter has no notes
 * - document-text (filled): Chapter has notes
 *
 * Behavior:
 * - Triggers haptic feedback on press
 * - Calls onPress handler to open notes modal
 *
 * Accessibility:
 * - accessibilityRole="button"
 * - accessibilityLabel for screen readers
 */
export function NotesButton({
  bookId,
  chapterNumber,
  onPress,
  size = headerSpecs.iconSize,
  color = colors.black,
}: NotesButtonProps) {
  const { hasNotes } = useNotes();

  // Check if chapter has notes
  const chapterHasNotes = hasNotes(bookId, chapterNumber);

  // Determine icon name based on notes existence
  const iconName = chapterHasNotes ? 'document-text' : 'document-text-outline';

  /**
   * Handle button press
   *
   * Flow:
   * 1. Trigger haptic feedback immediately (non-blocking)
   * 2. Call onPress handler to open modal
   */
  const handlePress = () => {
    // Trigger haptic feedback (non-blocking)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Call parent handler
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      style={styles.iconButton}
      accessibilityLabel="Notes for this chapter"
      accessibilityRole="button"
      testID={`notes-button-${bookId}-${chapterNumber}`}
    >
      <Ionicons name={iconName} size={size} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  iconButton: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
