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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
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
import { NoteEditModal } from '@/components/bible/NoteEditModal';
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
}

/**
 * NotesModal Component
 *
 * Displays modal for managing chapter notes with add form and existing notes list.
 */
export function NotesModal({ visible, bookId, chapterNumber, bookName, onClose }: NotesModalProps) {
  const { colors, mode } = useTheme();
  const styles = useMemo(() => createStyles(colors, mode), [colors, mode]);
  const { addNote, isAddingNote, deleteNote } = useNotes();
  const { showToast } = useToast();
  const [newNoteContent, setNewNoteContent] = useState('');
  const [recentNotes, setRecentNotes] = useState<Note[]>([]);
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [showNoteOptions, setShowNoteOptions] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const textInputRef = useRef<TextInput>(null);

  // Animation state for swipe-to-dismiss
  const slideAnim = useRef(new Animated.Value(0)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const [internalVisible, setInternalVisible] = useState(false);

  // Auto-focus textarea when modal opens
  useEffect(() => {
    if (visible) {
      // Delay to ensure modal animation completes
      setTimeout(() => {
        textInputRef.current?.focus();
      }, 300);
    }
  }, [visible]);

  // Animate open/close
  const animateOpen = useCallback(() => {
    setInternalVisible(true);
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        damping: 20,
        stiffness: 90,
      }),
    ]).start();
  }, [backdropOpacity, slideAnim]);

  const animateClose = useCallback(
    (callback?: () => void) => {
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 600,
          useNativeDriver: true,
          damping: 20,
          stiffness: 90,
        }),
      ]).start();
      setTimeout(() => {
        setInternalVisible(false);
        if (callback) callback();
      }, 300);
    },
    [backdropOpacity, slideAnim]
  );

  useEffect(() => {
    if (visible && !internalVisible) {
      animateOpen();
    } else if (!visible && internalVisible) {
      animateClose();
    }
  }, [visible, internalVisible, animateOpen, animateClose]);

  const handleDismiss = () => {
    animateClose(() => {
      onClose();
    });
  };

  // Pan responder for swipe-to-dismiss
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 5,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          slideAnim.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 70) {
          handleDismiss();
        } else if (gestureState.dy > 0) {
          Animated.spring(slideAnim, {
            toValue: 0,
            useNativeDriver: true,
            damping: 20,
            stiffness: 90,
          }).start();
        }
      },
    })
  ).current;

  if (!internalVisible) return null;

  /**
   * Handle add note button press
   */
  const handleAddNote = async () => {
    if (!newNoteContent.trim()) {
      return;
    }

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const noteContent = newNoteContent.trim();
      const addedNote = await addNote(bookId, chapterNumber, noteContent);

      // Clear textarea after successful addition
      setNewNoteContent('');
      showToast('Note added successfully');

      if (addedNote) {
        const noteWithBookName = {
          ...addedNote,
          book_name: bookName,
        };
        setRecentNotes((prev) => [noteWithBookName, ...prev]);
      }
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

  /**
   * Handle note options menu (three dots)
   */
  const handleNoteMenuPress = async (note: Note) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveNote(note);
    setShowNoteOptions(true);
  };

  /**
   * Handle edit from options modal
   */
  const handleEdit = () => {
    setShowEditModal(true);
  };

  /**
   * Handle action complete (copy, share, etc.)
   */
  const handleActionComplete = (action: string) => {
    if (action === 'copy') {
      showToast('Note copied to clipboard');
    }
  };

  /**
   * Handle note deletion from either modal
   */
  const handleDeleteLastNote = async (noteId: string) => {
    // Optimistic update: clear UI immediately
    setRecentNotes((prev) => prev.filter((n) => n.note_id !== noteId));
    setShowEditModal(false);
    setShowNoteOptions(false);
    showToast('Note deleted successfully');

    try {
      await deleteNote(noteId);
    } catch (error) {
      console.error('Failed to delete note:', error);
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
    <Modal visible={true} animationType="none" transparent={true} onRequestClose={handleDismiss}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalContainer}
      >
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleDismiss} />
        </Animated.View>

        <Animated.View style={[styles.modalContent, { transform: [{ translateY: slideAnim }] }]}>
          <SafeAreaView style={{ flex: 1 }}>
            {/* Header with handle */}
            <View {...panResponder.panHandlers}>
              <View style={styles.handleContainer}>
                <View style={styles.handle} />
              </View>
            </View>
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

              {/* Show most recently added notes */}
              {recentNotes.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Recently Added Notes</Text>
                  <View style={{ gap: 12 }}>
                    {recentNotes.map((note) => (
                      <View key={note.note_id} style={styles.noteCard}>
                        <Text style={styles.noteContent}>{note.content}</Text>
                        <Pressable
                          onPress={() => handleNoteMenuPress(note)}
                          style={styles.noteMenuButton}
                          hitSlop={12}
                        >
                          <Ionicons
                            name="ellipsis-horizontal"
                            size={20}
                            color={colors.textSecondary}
                          />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </ScrollView>
          </SafeAreaView>
        </Animated.View>
      </KeyboardAvoidingView>

      {/* Note Options Modal (same as notes page) */}
      <NoteOptionsModal
        visible={showNoteOptions}
        onClose={() => setShowNoteOptions(false)}
        note={activeNote}
        deleteNote={handleDeleteLastNote}
        onEdit={handleEdit}
        onActionComplete={handleActionComplete}
      />

      {/* Edit Modal */}
      {activeNote && (
        <NoteEditModal
          visible={showEditModal}
          note={activeNote}
          bookName={bookName}
          chapterNumber={chapterNumber}
          onClose={() => {
            setShowEditModal(false);
          }}
          onSave={(newContent: string) => {
            setShowEditModal(false);
            // Update the local state immediately to reflect changes
            setRecentNotes((prev) =>
              prev.map((n) =>
                n.note_id === activeNote.note_id ? { ...n, content: newContent } : n
              )
            );
          }}
          onDelete={handleDeleteLastNote}
        />
      )}
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
    handleContainer: {
      alignItems: 'center',
      paddingVertical: spacing.sm,
    },
    handle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.textTertiary,
      opacity: 0.3,
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
    noteCard: {
      backgroundColor: colors.backgroundElevated,
      borderRadius: 8,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.borderSecondary,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
    },
    noteContent: {
      flex: 1,
      fontSize: fontSizes.body,
      color: colors.textPrimary,
      lineHeight: fontSizes.body * 1.5,
    },
    noteMenuButton: {
      padding: spacing.xs,
    },
  });
};
