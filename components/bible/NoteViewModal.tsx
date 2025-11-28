/**
 * NoteViewModal Component
 *
 * Read-only modal for viewing full note content with edit and delete actions.
 *
 * Features:
 * - Full note content display (no truncation)
 * - Edit and Delete action buttons
 * - Close button returns to previous screen
 * - Modal stacking support (can appear over NotesModal)
 *
 * @see Spec: agent-os/specs/2025-11-05-notes-functionality/spec.md (lines 37-44)
 * @see Task Group 5: Modal Components - NoteViewModal
 *
 * @example
 * ```tsx
 * <NoteViewModal
 *   visible={isVisible}
 *   note={noteObject}
 *   bookName="Genesis"
 *   chapterNumber={1}
 *   onClose={handleClose}
 *   onEdit={handleEdit}
 *   onDelete={handleDelete}
 * />
 * ```
 */

import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  fontSizes,
  fontWeights,
  type getColors,
  getModalSpecs,
  spacing,
  type ThemeMode,
} from '@/constants/bible-design-tokens';
import { useTheme } from '@/contexts/ThemeContext';
import type { Note } from '@/types/notes';

/**
 * Props for NoteViewModal component
 */
export interface NoteViewModalProps {
  /** Whether modal is visible */
  visible: boolean;
  /** Note to display */
  note: Note;
  /** Book name for header */
  bookName: string;
  /** Chapter number for header */
  chapterNumber: number;
  /** Callback when modal is closed */
  onClose: () => void;
  /** Callback when edit button is pressed */
  onEdit: (note: Note) => void;
  /** Callback when delete button is pressed */
  onDelete: (note: Note) => void;
}

/**
 * NoteViewModal Component
 *
 * Displays read-only note content with action buttons.
 */
export function NoteViewModal({
  visible,
  note,
  bookName,
  chapterNumber,
  onClose,
  onEdit,
  onDelete,
}: NoteViewModalProps) {
  const { colors, mode } = useTheme();
  const styles = useMemo(() => createStyles(colors, mode), [colors, mode]);

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <SafeAreaView style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>
              {bookName} {chapterNumber}
            </Text>
            <Pressable onPress={onClose} style={styles.closeButton} testID="view-close-button">
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </Pressable>
          </View>

          {/* Content */}
          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
            <Text style={styles.noteContent}>{note.content}</Text>
          </ScrollView>

          {/* Actions */}
          <View style={styles.actions}>
            <Pressable
              onPress={() => onEdit(note)}
              style={[styles.actionButton, styles.editButton]}
            >
              <Text style={styles.actionButtonText}>Edit</Text>
            </Pressable>

            <Pressable
              onPress={() => onDelete(note)}
              style={[styles.actionButton, styles.deleteButton]}
            >
              <Text style={[styles.actionButtonText, styles.deleteButtonText]}>Delete</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const createStyles = (colors: ReturnType<typeof getColors>, mode: ThemeMode) => {
  const modalSpecs = getModalSpecs(mode);

  return StyleSheet.create({
    modalContainer: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: modalSpecs.backdropColor,
    },
    modalContent: {
      height: modalSpecs.height,
      backgroundColor: modalSpecs.backgroundColor,
      borderTopLeftRadius: modalSpecs.borderTopLeftRadius,
      borderTopRightRadius: modalSpecs.borderTopRightRadius,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: {
      fontSize: fontSizes.heading2,
      fontWeight: fontWeights.semibold,
      color: colors.textPrimary,
      flex: 1,
    },
    closeButton: {
      padding: spacing.xs,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: spacing.lg,
    },
    noteContent: {
      fontSize: fontSizes.body,
      color: colors.textPrimary,
      lineHeight: fontSizes.body * 1.6,
    },
    actions: {
      flexDirection: 'row',
      padding: spacing.lg,
      gap: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    actionButton: {
      flex: 1,
      paddingVertical: spacing.md,
      borderRadius: 8,
      alignItems: 'center',
    },
    editButton: {
      backgroundColor: colors.gold,
    },
    deleteButton: {
      backgroundColor: colors.error,
    },
    actionButtonText: {
      fontSize: fontSizes.body,
      fontWeight: fontWeights.semibold,
      color: colors.background,
    },
    deleteButtonText: {
      color: colors.white,
    },
  });
};
