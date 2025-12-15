/**
 * NoteCard Component
 *
 * Displays a note preview card with truncated content and action menu.
 *
 * Features:
 * - Truncated content preview (default: 100 chars)
 * - Menu action button (3 dots)
 * - Pressable to view full note
 * - Visual feedback on press
 *
 * Visual Design:
 * - Background: gray50
 * - Border radius: 8px
 * - Padding: md (12px)
 * - Margin bottom: sm (8px)
 * - Icon: ellipsis-horizontal
 *
 * @see Spec: agent-os/specs/2025-11-05-notes-functionality/spec.md (lines 34-35)
 * @see Task Group 4: Core UI Components - NoteCard
 *
 * @example
 * ```tsx
 * <NoteCard
 *   note={noteObject}
 *   onPress={handleViewNote}
 *   onMenuPress={handleMenuPress}
 * />
 * ```
 */

import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fontSizes, fontWeights, type getColors, spacing } from '@/constants/bible-design-tokens';
import { NOTES_CONFIG } from '@/constants/notes';
import { useTheme } from '@/contexts/ThemeContext';
import type { Note } from '@/types/notes';

/**
 * Props for NoteCard component
 */
export interface NoteCardProps {
  /** Note object to display */
  note: Note;
  /** Callback when card needs to expand/collapse */
  onPress: (note: Note) => void;
  /** Callback when card is clicked to edit (short note or expanded long note) */
  onEdit: (note: Note) => void;
  /** Callback when menu button is pressed */
  onMenuPress: (note: Note) => void;
  /** Content truncation length (default: 100 from NOTES_CONFIG) */
  truncateLength?: number;
  /** Whether the card is expanded to show full content */
  isExpanded?: boolean;
}

/**
 * NoteCard Component
 *
 * Displays note preview with action buttons.
 *
 * Behavior:
 * - Truncates content if exceeds truncateLength
 * - Click behavior:
 *   - If short (< truncateLength): Opens edit modal
 *   - If long (> truncateLength):
 *     - Collapsed: Expands card
 *     - Expanded: Opens edit modal
 */
export function NoteCard({
  note,
  onPress,
  onEdit,
  onMenuPress,
  truncateLength = NOTES_CONFIG.PREVIEW_TRUNCATE_LENGTH,
  isExpanded = false,
}: NoteCardProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const isTruncated = note.content.length > truncateLength;

  // Truncate content if needed (only when not expanded)
  const displayContent =
    !isExpanded && isTruncated ? `${note.content.substring(0, truncateLength)}...` : note.content;

  const handlePress = () => {
    if (!isTruncated) {
      // Short note: always edit
      onEdit(note);
    } else if (isExpanded) {
      // Long note & Already expanded: edit
      onEdit(note);
    } else {
      // Long note & Collapsed: expand
      onPress(note);
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      testID={`note-card-${note.note_id}`}
    >
      <View style={styles.content}>
        <Text style={styles.text} numberOfLines={isExpanded ? undefined : 3}>
          {displayContent}
        </Text>
      </View>

      <View style={styles.actions}>
        {isExpanded ? (
          <View style={styles.expandedActions}>
            <Pressable
              onPress={(e) => {
                e?.stopPropagation?.();
                onMenuPress(note);
              }}
              style={styles.actionButton}
              testID={`note-menu-${note.note_id}`}
              hitSlop={12}
            >
              <Ionicons name="ellipsis-horizontal" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={(e) => {
              e?.stopPropagation?.();
              onMenuPress(note);
            }}
            style={styles.actionButton}
            testID={`note-menu-${note.note_id}`}
            hitSlop={12}
          >
            <Ionicons name="ellipsis-horizontal" size={20} color={colors.textSecondary} />
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

const createStyles = (colors: ReturnType<typeof getColors>) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      backgroundColor: colors.backgroundElevated,
      borderRadius: 8,
      padding: spacing.md,
      marginBottom: spacing.sm,
      alignItems: 'flex-start',
      // Add border for visibility in light mode (as requested)
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardPressed: {
      backgroundColor: `${colors.divider}20`,
    },
    content: {
      flex: 1,
      marginRight: spacing.md,
    },
    text: {
      fontSize: fontSizes.body,
      fontWeight: fontWeights.regular,
      color: colors.textPrimary,
      lineHeight: fontSizes.body * 1.5,
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      alignSelf: 'flex-end',
      gap: spacing.sm,
    },
    expandedActions: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    actionButton: {
      padding: spacing.xs,
      marginTop: spacing.xs,
    },
  });
