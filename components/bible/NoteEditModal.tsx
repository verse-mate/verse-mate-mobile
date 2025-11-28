/**
 * NoteEditModal Component
 *
 * Modal for editing existing note content with draft auto-save.
 *
 * Features:
 * - Pre-filled textarea with existing content
 * - Character counter (conditional at 4500+ chars)
 * - Save and Cancel buttons
 * - Draft auto-save integration
 * - Draft restoration indicator
 * - Clear draft after successful save
 *
 * @see Spec: agent-os/specs/2025-11-05-notes-functionality/spec.md (lines 45-53)
 * @see Task Group 5: Modal Components - NoteEditModal
 *
 * @example
 * ```tsx
 * <NoteEditModal
 *   visible={isVisible}
 *   note={noteObject}
 *   bookName="Genesis"
 *   chapterNumber={1}
 *   onClose={handleClose}
 *   onSave={handleSave}
 * />
 * ```
 */

import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CharacterCounter } from '@/components/bible/CharacterCounter';
import {
  fontSizes,
  fontWeights,
  type getColors,
  getModalSpecs,
  spacing,
  type ThemeMode,
} from '@/constants/bible-design-tokens';
import { NOTES_CONFIG } from '@/constants/notes';
import { useTheme } from '@/contexts/ThemeContext';
import { useNoteDraft } from '@/hooks/bible/use-note-draft';
import { useNotes } from '@/hooks/bible/use-notes';
import type { Note } from '@/types/notes';

/**
 * Props for NoteEditModal component
 */
export interface NoteEditModalProps {
  /** Whether modal is visible */
  visible: boolean;
  /** Note to edit */
  note: Note;
  /** Book name for header */
  bookName: string;
  /** Chapter number for header */
  chapterNumber: number;
  /** Callback when modal is closed */
  onClose: () => void;
  /** Callback when note is saved successfully */
  onSave: () => void;
}

/**
 * NoteEditModal Component
 *
 * Displays modal for editing note with draft auto-save.
 */
export function NoteEditModal({
  visible,
  note,
  bookName,
  chapterNumber,
  onClose,
  onSave,
}: NoteEditModalProps) {
  const { colors, mode } = useTheme();
  const styles = useMemo(() => createStyles(colors, mode), [colors, mode]);
  const { updateNote, isUpdatingNote } = useNotes();
  const { draftContent, isDraftRestored, saveDraft, clearDraft } = useNoteDraft(
    note.book_id * 1000 + note.chapter_number, // Generate chapterId
    note.note_id
  );

  // Use draft content if restored, otherwise use note content
  const [content, setContent] = useState(draftContent || note.content);
  const textInputRef = useRef<TextInput>(null);

  // Update content if draft is restored
  useEffect(() => {
    if (draftContent) {
      setContent(draftContent);
    }
  }, [draftContent]);

  // Auto-focus textarea when modal opens
  useEffect(() => {
    if (visible) {
      setTimeout(() => {
        textInputRef.current?.focus();
      }, 300);
    }
  }, [visible]);

  // Save draft on content change
  useEffect(() => {
    if (content !== note.content) {
      saveDraft(content);
    }
  }, [content, note.content, saveDraft]);

  /**
   * Handle save button press
   */
  const handleSave = async () => {
    if (!content.trim() || content === note.content) {
      return;
    }

    // Dismiss keyboard after validation
    Keyboard.dismiss();

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      await updateNote(note.note_id, content.trim());
      await clearDraft();
      onSave();
    } catch (error) {
      console.error('Failed to update note:', error);
    }
  };

  /**
   * Check if Save button should be disabled
   */
  const isSaveDisabled =
    !content.trim() ||
    content === note.content ||
    content.length > NOTES_CONFIG.MAX_CONTENT_LENGTH ||
    isUpdatingNote;

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalContainer}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />

        <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
          <SafeAreaView style={{ flex: 1 }}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.headerTitle}>
                {bookName} {chapterNumber}
              </Text>
              <Pressable onPress={onClose} style={styles.closeButton} testID="edit-close-button">
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </Pressable>
            </View>

            {/* Draft restored indicator */}
            {isDraftRestored && (
              <View style={styles.draftIndicator}>
                <Text style={styles.draftIndicatorText}>Draft restored</Text>
              </View>
            )}

            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="always"
            >
              <TextInput
                ref={textInputRef}
                style={styles.textarea}
                multiline
                value={content}
                onChangeText={setContent}
                maxLength={NOTES_CONFIG.MAX_CONTENT_LENGTH}
              />

              <CharacterCounter
                currentLength={content.length}
                maxLength={NOTES_CONFIG.MAX_CONTENT_LENGTH}
                threshold={NOTES_CONFIG.COUNTER_DISPLAY_THRESHOLD}
              />
            </ScrollView>

            {/* Actions */}
            <View style={styles.actions}>
              <Pressable onPress={onClose} style={[styles.actionButton, styles.cancelButton]}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>

              <TouchableOpacity
                onPress={handleSave}
                disabled={isSaveDisabled}
                style={[
                  styles.actionButton,
                  styles.saveButton,
                  isSaveDisabled && styles.saveButtonDisabled,
                ]}
                activeOpacity={0.7}
              >
                <Text
                  style={[styles.actionButtonText, isSaveDisabled && styles.saveButtonTextDisabled]}
                >
                  {isUpdatingNote ? 'Saving...' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </Pressable>
      </KeyboardAvoidingView>
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
    draftIndicator: {
      backgroundColor: colors.info,
      padding: spacing.sm,
      alignItems: 'center',
    },
    draftIndicatorText: {
      fontSize: fontSizes.bodySmall,
      color: colors.white,
      fontWeight: fontWeights.medium,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: spacing.lg,
    },
    textarea: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: spacing.md,
      fontSize: fontSizes.body,
      color: colors.textPrimary,
      minHeight: 200,
      textAlignVertical: 'top',
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
    cancelButton: {
      backgroundColor: colors.backgroundElevated,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cancelButtonText: {
      fontSize: fontSizes.body,
      fontWeight: fontWeights.semibold,
      color: colors.textPrimary,
    },
    saveButton: {
      backgroundColor: colors.gold,
    },
    saveButtonDisabled: {
      backgroundColor: colors.textDisabled,
    },
    actionButtonText: {
      fontSize: fontSizes.body,
      fontWeight: fontWeights.semibold,
      color: colors.background, // Contrast
    },
    saveButtonTextDisabled: {
      color: colors.textTertiary,
    },
  });
};
