/**
 * NoteEditModal Component
 *
 * Unified bottom sheet modal for viewing and editing notes.
 * Replaces the previous full-screen edit modal.
 *
 * Features:
 * - Bottom sheet design with swipe gestures (like VerseMateTooltip)
 * - Editable note content with draft auto-save
 * - Integrated actions: Copy, Share, Delete
 * - Character counter
 *
 * @see Task Group 5: Modal Components - NoteEditModal
 */

import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CharacterCounter } from '@/components/bible/CharacterCounter';
import { DeleteConfirmationModal } from '@/components/bible/DeleteConfirmationModal';
import { fontSizes, fontWeights, type getColors, spacing } from '@/constants/bible-design-tokens';
import { NOTES_CONFIG } from '@/constants/notes';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/contexts/ToastContext';
import { useNoteDraft } from '@/hooks/bible/use-note-draft';
import { useNotes } from '@/hooks/bible/use-notes';
import type { Note } from '@/types/notes';
import { generateChapterShareUrl } from '@/utils/sharing/generate-chapter-share-url';

export interface NoteEditModalProps {
  visible: boolean;
  note: Note;
  bookName: string;
  chapterNumber: number;
  onClose: () => void;
  onSave: () => void;
  onDelete?: (noteId: string) => Promise<void>;
}

export function NoteEditModal({
  visible,
  note,
  bookName,
  chapterNumber,
  onClose,
  onSave,
  onDelete,
}: NoteEditModalProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, insets.bottom), [colors, insets.bottom]);
  const { showToast } = useToast();
  const { updateNote, isUpdatingNote } = useNotes();
  const { draftContent, isDraftRestored, saveDraft, clearDraft } = useNoteDraft(
    note.book_id * 1000 + note.chapter_number,
    note.note_id
  );

  // -- Animation State --
  const [internalVisible, setInternalVisible] = useState(visible);
  const screenHeight = Dimensions.get('window').height;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(screenHeight)).current;

  // -- Editing State --
  const [content, setContent] = useState(draftContent || note.content);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const textInputRef = useRef<TextInput>(null);
  const isSavingRef = useRef(false);
  const hasRestoredDraftRef = useRef(false);
  const prevNoteIdRef = useRef(note.note_id);

  // Initialize content when note changes
  useEffect(() => {
    if (prevNoteIdRef.current !== note.note_id) {
      prevNoteIdRef.current = note.note_id;
      hasRestoredDraftRef.current = false;
      isSavingRef.current = false;
      setContent(note.content);
    }
  }, [note.note_id, note.content]);

  // Apply draft if found (only once per note)
  useEffect(() => {
    if (isSavingRef.current) return;

    if (isDraftRestored && draftContent && !hasRestoredDraftRef.current) {
      setContent(draftContent);
      hasRestoredDraftRef.current = true;
    }
  }, [draftContent, isDraftRestored]);

  // Save draft on content change
  useEffect(() => {
    if (content !== note.content && !isSavingRef.current) {
      saveDraft(content);
    }
  }, [content, note.content, saveDraft]);

  // -- Animation Logic --

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
      Keyboard.dismiss();
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: screenHeight,
          useNativeDriver: true,
          damping: 20,
          stiffness: 90,
          overshootClamping: true,
          restDisplacementThreshold: 40,
          restSpeedThreshold: 40,
        }),
      ]).start();

      setTimeout(() => {
        setInternalVisible(false);
        if (callback) callback();
      }, 200);
    },
    [backdropOpacity, slideAnim, screenHeight]
  );

  useEffect(() => {
    if (visible) {
      animateOpen();
    } else if (internalVisible) {
      animateClose();
    }
  }, [visible, animateOpen, animateClose, internalVisible]);

  // -- Gestures --

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 5;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          slideAnim.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100) {
          animateClose(onClose);
        } else {
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

  // -- Actions --

  const handleDismiss = () => {
    animateClose(onClose);
  };

  const handleSave = async () => {
    if (!content.trim() || isUpdatingNote) return;

    // If content hasn't changed, just close
    if (content === note.content) {
      handleDismiss();
      return;
    }

    isSavingRef.current = true;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      await updateNote(note.note_id, content.trim());
      await clearDraft();
      animateClose(onSave);
      // Note: we don't reset isSavingRef here because the component will unmount
    } catch (error) {
      console.error('Failed to update note:', error);
      showToast('Failed to save note');
      isSavingRef.current = false;
    }
  };

  const handleCopy = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Clipboard.setStringAsync(content);
    showToast('Note copied to clipboard');
  };

  const handleShare = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const message = `Note on ${bookName} ${chapterNumber}:\n\n"${content}"`;

    let url: string | undefined;
    try {
      url = generateChapterShareUrl(note.book_id, note.chapter_number);
    } catch {}

    await Share.share({
      message,
      url,
      title: `Note: ${bookName} ${chapterNumber}`,
    });
  };

  const handleDelete = () => {
    setShowDeleteConfirmation(true);
  };

  const handleConfirmDelete = async () => {
    setShowDeleteConfirmation(false);
    if (onDelete) {
      animateClose(async () => {
        await onDelete(note.note_id);
      });
    }
  };

  const isSaveDisabled =
    !content.trim() || content.length > NOTES_CONFIG.MAX_CONTENT_LENGTH || isUpdatingNote;

  if (!internalVisible) return null;

  return (
    <Modal
      visible={internalVisible}
      transparent
      animationType="none"
      onRequestClose={handleDismiss}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        {/* Backdrop */}
        <Animated.View
          style={[styles.backdrop, { opacity: backdropOpacity }]}
          pointerEvents="box-none"
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={handleDismiss} />
        </Animated.View>

        {/* Sheet */}
        <Animated.View style={[styles.container, { transform: [{ translateY: slideAnim }] }]}>
          {/* Header (Swipe Handle) */}
          <View style={styles.header} {...panResponder.panHandlers}>
            <View style={styles.handle} />
            <Text style={styles.headerTitle}>
              {bookName} {chapterNumber}
            </Text>
          </View>

          {/* Content */}
          <View style={styles.contentContainer}>
            {isDraftRestored && (
              <View style={styles.draftIndicator}>
                <Text style={styles.draftIndicatorText}>Draft restored</Text>
              </View>
            )}

            <ScrollView style={styles.scrollContainer} keyboardShouldPersistTaps="handled">
              <Text style={styles.editNoteTitle}>Edit note:</Text>

              <TextInput
                ref={textInputRef}
                style={styles.textArea}
                multiline
                value={content}
                onChangeText={setContent}
                placeholder="Type your note here..."
                placeholderTextColor={colors.textTertiary}
                scrollEnabled={false} // Allow ScrollView to handle scrolling
              />

              <View style={styles.counterContainer}>
                <CharacterCounter
                  currentLength={content.length}
                  maxLength={NOTES_CONFIG.MAX_CONTENT_LENGTH}
                  threshold={NOTES_CONFIG.COUNTER_DISPLAY_THRESHOLD}
                />
              </View>
            </ScrollView>

            {/* Actions Footer */}
            <View style={styles.actionsContainer}>
              <View style={styles.actionButtonsRow}>
                <Pressable style={styles.actionButton} onPress={handleCopy}>
                  <Ionicons name="copy-outline" size={20} color={colors.textPrimary} />
                  <Text style={styles.actionButtonText}>Copy</Text>
                </Pressable>

                <Pressable style={styles.actionButton} onPress={handleShare}>
                  <Ionicons name="share-outline" size={20} color={colors.textPrimary} />
                  <Text style={styles.actionButtonText}>Share</Text>
                </Pressable>

                {onDelete && (
                  <Pressable style={[styles.actionButton]} onPress={handleDelete}>
                    <Ionicons name="trash-outline" size={20} color={colors.error} />
                    <Text style={[styles.actionButtonText, { color: colors.error }]}>Delete</Text>
                  </Pressable>
                )}
              </View>

              <Pressable
                style={[styles.primaryButton, isSaveDisabled && styles.primaryButtonDisabled]}
                onPress={handleSave}
                disabled={isSaveDisabled}
              >
                <Ionicons name="save-outline" size={20} color={colors.background} />
                <Text style={styles.primaryButtonText}>
                  {isUpdatingNote ? 'Saving...' : 'Save Note'}
                </Text>
              </Pressable>

              <Pressable style={styles.secondaryButton} onPress={handleDismiss}>
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>

      {/* Delete Confirmation */}
      <DeleteConfirmationModal
        visible={showDeleteConfirmation}
        onCancel={() => setShowDeleteConfirmation(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Note"
        message="Are you sure you want to delete this note?"
      />
    </Modal>
  );
}

const createStyles = (colors: ReturnType<typeof getColors>, bottomInset: number) => {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.backdrop,
    },
    container: {
      backgroundColor: colors.backgroundElevated,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      maxHeight: '85%',
      paddingBottom: Platform.OS === 'android' ? spacing.xs : bottomInset,
    },
    header: {
      alignItems: 'center',
      paddingTop: spacing.sm,
      paddingBottom: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    handle: {
      width: 40,
      height: 4,
      backgroundColor: colors.border,
      borderRadius: 2,
      marginBottom: spacing.sm,
    },
    headerTitle: {
      fontSize: fontSizes.heading3,
      fontWeight: fontWeights.medium,
      color: colors.textPrimary,
    },
    contentContainer: {
      flexShrink: 1,
    },
    scrollContainer: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      flexGrow: 0,
    },
    textArea: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      fontSize: fontSizes.body,
      lineHeight: fontSizes.body * 1.5,
      color: colors.textPrimary,
      minHeight: 120,
      textAlignVertical: 'top',
    },
    editNoteTitle: {
      fontSize: fontSizes.bodySmall,
      fontWeight: fontWeights.semibold,
      color: colors.textSecondary,
      marginBottom: spacing.sm,
      marginLeft: spacing.xs,
    },
    draftIndicator: {
      backgroundColor: colors.info,
      padding: spacing.xs,
      alignItems: 'center',
    },
    draftIndicatorText: {
      fontSize: fontSizes.bodySmall,
      color: colors.white,
    },
    counterContainer: {
      alignItems: 'flex-end',
      paddingVertical: spacing.xs,
    },
    actionsContainer: {
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.divider,
      backgroundColor: colors.backgroundElevated,
    },
    actionButtonsRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      gap: spacing.xs,
      marginBottom: spacing.sm,
    },
    actionButton: {
      flex: 1,
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.xs,
      borderRadius: 8,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 4,
    },
    actionButtonText: {
      fontSize: fontSizes.bodySmall,
      color: colors.textPrimary,
      fontWeight: fontWeights.medium,
      textAlign: 'center',
    },
    primaryButton: {
      backgroundColor: colors.gold,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: 8,
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'center',
      gap: spacing.xs,
    },
    primaryButtonDisabled: {
      backgroundColor: colors.textDisabled,
    },
    primaryButtonText: {
      color: colors.background,
      fontSize: fontSizes.body,
      fontWeight: fontWeights.semibold,
    },
    secondaryButton: {
      backgroundColor: 'transparent',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: 8,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    secondaryButtonText: {
      color: colors.textPrimary,
      fontSize: fontSizes.body,
      fontWeight: fontWeights.medium,
    },
  });
};
