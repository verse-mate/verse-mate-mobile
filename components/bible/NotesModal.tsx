/**
 * NotesModal Component
 *
 * Modal for managing notes for a Bible chapter. Displays existing notes and
 * provides interface to add new notes.
 *
 * Features:
 * - Add New Note section with textarea and submit button
 * - Existing Notes section with list of note cards
 * - Character counter (conditional at 4500+ chars)
 * - Empty state when no notes exist
 * - KeyboardAvoidingView for proper keyboard handling
 * - Auto-focus textarea when chapter has no notes
 *
 * @see Spec: agent-os/specs/2025-11-05-notes-functionality/spec.md (lines 20-28)
 * @see Task Group 5: Modal Components - NotesModal
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
import { NoteCard } from '@/components/bible/NoteCard';
import { NoteOptionsModal } from '@/components/bible/NoteOptionsModal';
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
import { useToast } from '@/contexts/ToastContext';
import { useNotes } from '@/hooks/bible/use-notes';
import type { Note } from '@/types/notes';

/**
 * Props for NotesModal component
 */
export interface NotesModalProps {
  /** Whether modal is visible */
  visible: boolean;
  /** Book ID */
  bookId: number;
  /** Chapter number */
  chapterNumber: number;
  /** Book name for display */
  bookName: string;
  /** Callback when modal is closed */
  onClose: () => void;
  /** Callback when note card is pressed (to view full note) */
  onNotePress: (note: Note) => void;
  /** Callback when edit button is pressed */
  onEditNote: (note: Note) => void;
}

/**
 * NotesModal Component
 *
 * Displays modal for managing chapter notes with add form and existing notes list.
 */
export function NotesModal({
  visible,
  bookId,
  chapterNumber,
  bookName,
  onClose,
  onNotePress,
  onEditNote,
}: NotesModalProps) {
  const { colors, mode } = useTheme();
  const styles = useMemo(() => createStyles(colors, mode), [colors, mode]);
  const { addNote, getNotesByChapter, isAddingNote, deleteNote } = useNotes();
  const { showToast } = useToast();
  const [newNoteContent, setNewNoteContent] = useState('');
  const textInputRef = useRef<TextInput>(null);

  // Options Modal State
  const [optionsModalVisible, setOptionsModalVisible] = useState(false);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);

  // Get notes for this chapter
  const chapterNotes = getNotesByChapter(bookId, chapterNumber);

  // Auto-focus textarea when modal opens and chapter has no notes
  useEffect(() => {
    if (visible && chapterNotes.length === 0) {
      // Delay to ensure modal animation completes
      setTimeout(() => {
        textInputRef.current?.focus();
      }, 300);
    }
  }, [visible, chapterNotes.length]);

  /**
   * Handle add note button press
   */
  const handleAddNote = async () => {
    if (!newNoteContent.trim()) {
      return;
    }

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      await addNote(bookId, chapterNumber, newNoteContent.trim());
      // Clear textarea after successful addition
      setNewNoteContent('');
      showToast('Note added successfully');
    } catch (error) {
      console.error('Failed to add note:', error);
    }
  };

  /**
   * Wrapper to dismiss keyboard then execute add
   */
  const handleAddNoteWithKeyboardDismiss = () => {
    Keyboard.dismiss();
    // Use setImmediate to let keyboard dismissal complete first
    setImmediate(() => {
      handleAddNote();
    });
  };

  const handleMenuPress = async (note: Note) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedNote(note);
    setOptionsModalVisible(true);
  };

  const handleEditFromMenu = () => {
    if (selectedNote) {
      onEditNote(selectedNote);
    }
  };

  const handleActionComplete = (action: string) => {
    if (action === 'copy') {
      showToast('Note copied to clipboard');
    }
  };

  /**
   * Check if Add Note button should be disabled
   */
  const isAddButtonDisabled =
    !newNoteContent.trim() ||
    newNoteContent.length > NOTES_CONFIG.MAX_CONTENT_LENGTH ||
    isAddingNote;

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalContainer}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />

        <Pressable style={styles.modalContent} onPress={(e) => e?.stopPropagation?.()}>
          <SafeAreaView style={{ flex: 1 }}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.headerTitle}>
                Notes for {bookName} {chapterNumber}
              </Text>
              <Pressable onPress={onClose} style={styles.closeButton} testID="close-button">
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="always"
            >
              {/* Add New Note Section */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Add New Note</Text>

                <TextInput
                  ref={textInputRef}
                  style={styles.textarea}
                  placeholder="Write your note here..."
                  placeholderTextColor={colors.textTertiary}
                  multiline
                  numberOfLines={4}
                  value={newNoteContent}
                  onChangeText={setNewNoteContent}
                  maxLength={NOTES_CONFIG.MAX_CONTENT_LENGTH}
                />

                <View style={styles.addNoteFooter}>
                  <CharacterCounter
                    currentLength={newNoteContent.length}
                    maxLength={NOTES_CONFIG.MAX_CONTENT_LENGTH}
                    threshold={NOTES_CONFIG.COUNTER_DISPLAY_THRESHOLD}
                  />

                  <TouchableOpacity
                    onPressIn={() => Keyboard.dismiss()}
                    onPress={handleAddNoteWithKeyboardDismiss}
                    disabled={isAddButtonDisabled}
                    style={[styles.addButton, isAddButtonDisabled && styles.addButtonDisabled]}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.addButtonText,
                        isAddButtonDisabled && styles.addButtonTextDisabled,
                      ]}
                    >
                      {isAddingNote ? 'Adding...' : 'Add Note'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Existing Notes Section */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Existing Notes ({chapterNotes.length})</Text>

                {chapterNotes.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyStateText}>No notes yet</Text>
                    <Text style={styles.emptyStateSubtext}>
                      Add your first note for this chapter above.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.notesList}>
                    {chapterNotes.map((note) => (
                      <NoteCard
                        key={note.note_id}
                        note={note}
                        onPress={onNotePress}
                        onMenuPress={handleMenuPress}
                      />
                    ))}
                  </View>
                )}
              </View>
            </ScrollView>
          </SafeAreaView>
        </Pressable>

        {/* Note Options Modal */}
        <NoteOptionsModal
          visible={optionsModalVisible}
          onClose={() => setOptionsModalVisible(false)}
          note={selectedNote}
          deleteNote={deleteNote} // Use deleteNote from hook directly
          onEdit={handleEditFromMenu}
          onActionComplete={handleActionComplete}
        />
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
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: spacing.lg,
    },
    section: {
      marginBottom: spacing.xxl,
    },
    sectionTitle: {
      fontSize: fontSizes.heading3,
      fontWeight: fontWeights.semibold,
      color: colors.textPrimary,
      marginBottom: spacing.md,
    },
    textarea: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: spacing.md,
      fontSize: fontSizes.body,
      color: colors.textPrimary,
      minHeight: 100,
      textAlignVertical: 'top',
    },
    addNoteFooter: {
      marginTop: spacing.sm,
      alignItems: 'flex-end',
    },
    addButton: {
      backgroundColor: colors.gold,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      borderRadius: 8,
      marginTop: spacing.sm,
      alignItems: 'center',
    },
    addButtonDisabled: {
      backgroundColor: colors.textDisabled,
    },
    addButtonText: {
      fontSize: fontSizes.body,
      fontWeight: fontWeights.semibold,
      color: colors.background, // Contrast
    },
    addButtonTextDisabled: {
      color: colors.textTertiary,
    },
    emptyState: {
      alignItems: 'center',
      paddingVertical: spacing.xxl,
    },
    emptyStateText: {
      fontSize: fontSizes.body,
      fontWeight: fontWeights.medium,
      color: colors.textSecondary,
      marginBottom: spacing.xs,
    },
    emptyStateSubtext: {
      fontSize: fontSizes.bodySmall,
      color: colors.textTertiary,
      textAlign: 'center',
    },
    notesList: {
      marginTop: spacing.sm,
    },
  });
};
