import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { type EdgeInsets, useSafeAreaInsets } from 'react-native-safe-area-context';
import { fontSizes, fontWeights, type getColors, spacing } from '@/constants/bible-design-tokens';
import { useTheme } from '@/contexts/ThemeContext';
import type { Note } from '@/types/notes';
import { generateChapterShareUrl } from '@/utils/sharing/generate-chapter-share-url';

interface NoteOptionsModalProps {
  visible: boolean;
  onClose: () => void;
  note: Note | null;
  deleteNote: (noteId: string) => Promise<void>;
  onEdit: () => void;
  onActionComplete?: (action: string) => void;
}

const createThemedStyles = (colors: ReturnType<typeof getColors>, insets: EdgeInsets) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
      alignItems: 'center',
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    backdropPressable: {
      ...StyleSheet.absoluteFillObject,
    },
    sheetContainer: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.lg,
      paddingBottom: insets.bottom > 0 ? insets.bottom + spacing.md : spacing.lg,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.1,
      shadowRadius: 10,
      elevation: 10,
      maxHeight: Dimensions.get('window').height * 0.9,
      width: '100%',
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
    title: {
      fontSize: fontSizes.heading3,
      fontWeight: fontWeights.bold,
      color: colors.textPrimary,
      textAlign: 'center',
      marginBottom: spacing.lg,
      marginTop: spacing.sm,
    },
    optionsContainer: {
      gap: spacing.xs,
    },
    optionsScrollView: {
      flexGrow: 0,
    },
    separator: {
      height: 1,
      backgroundColor: colors.divider,
      marginVertical: spacing.sm,
    },
    cancelButton: {
      marginTop: spacing.lg,
      paddingVertical: spacing.md,
      alignItems: 'center',
      backgroundColor: colors.backgroundElevated,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cancelButtonText: {
      fontSize: fontSizes.body,
      fontWeight: fontWeights.bold,
      color: colors.textPrimary,
    },
    optionItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.sm,
      borderRadius: 12,
    },
    iconContainer: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.backgroundElevated,
      borderWidth: 1,
      borderColor: 'transparent',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: spacing.md,
    },
    optionLabel: {
      fontSize: fontSizes.body,
      fontWeight: fontWeights.medium,
      color: colors.textPrimary,
    },
    dialogCenterOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 20,
    },
    dialog: {
      backgroundColor: colors.background,
      borderRadius: 16,
      padding: spacing.xxl,
      width: '90%',
      maxWidth: 340,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    dialogIconContainer: {
      marginBottom: spacing.lg,
    },
    dialogTitle: {
      fontSize: fontSizes.heading2,
      fontWeight: fontWeights.bold,
      color: colors.textPrimary,
      marginBottom: spacing.sm,
      textAlign: 'center',
    },
    dialogMessage: {
      fontSize: fontSizes.body,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: spacing.xl,
      lineHeight: fontSizes.body * 1.5,
    },
    dialogSubmessage: {
      fontSize: fontSizes.bodySmall,
      color: colors.textTertiary,
      textAlign: 'center',
      marginBottom: spacing.xl,
    },
    dialogActions: {
      flexDirection: 'row',
      gap: spacing.md,
      width: '100%',
    },
    dialogButton: {
      flex: 1,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: 8,
      alignItems: 'center',
    },
    dialogCancelButton: {
      backgroundColor: colors.backgroundElevated,
      borderWidth: 1,
      borderColor: colors.border,
    },
    dialogCancelButtonText: {
      fontSize: fontSizes.body,
      fontWeight: fontWeights.semibold,
      color: colors.textPrimary,
    },
    dialogDestructiveButton: {
      backgroundColor: colors.error,
    },
    dialogDestructiveButtonText: {
      fontSize: fontSizes.body,
      fontWeight: fontWeights.semibold,
      color: '#FFFFFF',
    },
    dialogSuccessButton: {
      backgroundColor: colors.gold,
    },
    dialogSuccessButtonText: {
      fontSize: fontSizes.body,
      fontWeight: fontWeights.semibold,
      color: colors.background,
    },
    dialogErrorButton: {
      backgroundColor: colors.error,
    },
    dialogErrorButtonText: {
      fontSize: fontSizes.body,
      fontWeight: fontWeights.semibold,
      color: '#FFFFFF',
    },
  });

export function NoteOptionsModal({
  visible,
  onClose,
  note,
  deleteNote,
  onEdit,
  onActionComplete,
}: NoteOptionsModalProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createThemedStyles(colors, insets), [colors, insets]);

  const [internalVisible, setInternalVisible] = useState(false);
  const [isConfirmDeleteVisible, setIsConfirmDeleteVisible] = useState(false);
  const [isSuccessVisible, setIsSuccessVisible] = useState(false);
  const [isErrorVisible, setIsErrorVisible] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const screenHeight = Dimensions.get('window').height;
  const slideAnim = useRef(new Animated.Value(screenHeight)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

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
        setIsConfirmDeleteVisible(false);
        setIsSuccessVisible(false);
        setIsErrorVisible(false);
        setStatusMessage('');
        if (callback) callback();
      }, 300);
    },
    [backdropOpacity, slideAnim, screenHeight]
  );

  useEffect(() => {
    if (visible && !internalVisible) {
      setIsConfirmDeleteVisible(false);
      setIsSuccessVisible(false);
      setIsErrorVisible(false);
      setStatusMessage('');
      animateOpen();
    } else if (!visible && internalVisible) {
      animateClose(onClose);
    }
  }, [visible, internalVisible, animateOpen, animateClose, onClose]);

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

  const handleDismiss = () => {
    animateClose(onClose);
  };

  const handleModalClose = () => {
    onClose();
    setTimeout(() => {
      setIsConfirmDeleteVisible(false);
      setIsSuccessVisible(false);
      setIsErrorVisible(false);
      setStatusMessage('');
    }, 500);
  };

  const handleAction = async (action: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (!note) {
      setStatusMessage('No note selected for action.');
      setIsErrorVisible(true);
      return;
    }

    switch (action) {
      case 'copy':
        if (note.content) {
          await Clipboard.setStringAsync(note.content);
          onActionComplete?.('copy');
          handleModalClose();
        } else {
          setStatusMessage('No content to copy for this note.');
          setIsErrorVisible(true);
        }
        break;
      case 'delete':
        setIsConfirmDeleteVisible(true);
        break;
      case 'share':
        try {
          const message = `Note on ${note.book_name} ${note.chapter_number}:\n\n"${note.content}"`;

          let url: string | undefined;
          try {
            url = generateChapterShareUrl(note.book_id, note.chapter_number);
          } catch {}

          await Share.share({
            message,
            url,
            title: `Note: ${note.book_name} ${note.chapter_number}`,
          });
          // Don't close modal after sharing - user might want to do more actions
          onActionComplete?.('share');
        } catch (error) {
          console.error('Failed to share note:', error);
          setStatusMessage('Failed to share note.');
          setIsErrorVisible(true);
        }
        break;
      case 'edit':
        // For edit, we close this modal and trigger parent callback
        handleModalClose();
        // Small delay to allow close animation before opening edit modal
        setTimeout(() => {
          onEdit();
        }, 500);
        break;
      default:
        setStatusMessage(`Action "${action}" is not recognized.`);
        setIsErrorVisible(true);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!note) {
      setStatusMessage('Error: No note to delete.');
      setIsErrorVisible(true);
      return;
    }

    try {
      await deleteNote(note.note_id);
      handleModalClose();
    } catch (error) {
      setIsConfirmDeleteVisible(false);
      setStatusMessage('Failed to delete note.');
      setIsErrorVisible(true);
      console.error('Error deleting note:', error);
    }
  };

  const handleStatusModalClose = () => {
    handleModalClose();
  };

  const isDialogActive = isConfirmDeleteVisible || isSuccessVisible || isErrorVisible;

  if (!internalVisible) return null;

  return (
    <Modal
      visible={true}
      transparent
      animationType="none"
      onRequestClose={handleDismiss}
      statusBarTranslucent
      presentationStyle="overFullScreen"
    >
      <View
        style={[styles.overlay, isDialogActive && { justifyContent: 'center' }]}
        pointerEvents="box-none"
      >
        <Animated.View
          style={[styles.backdrop, { opacity: backdropOpacity }]}
          pointerEvents="box-none"
        >
          {!isDialogActive && (
            <Pressable style={styles.backdropPressable} onPress={handleDismiss} />
          )}
        </Animated.View>

        {!isDialogActive && (
          <Animated.View
            style={[styles.sheetContainer, { transform: [{ translateY: slideAnim }] }]}
          >
            <View {...panResponder.panHandlers}>
              <View style={styles.handleContainer}>
                <View style={styles.handle} />
              </View>
              <Text style={styles.title}>Note Options</Text>
            </View>

            <ScrollView
              style={styles.optionsScrollView}
              bounces={false}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.optionsContainer}>
                <OptionItem
                  icon="copy-outline"
                  label="Copy Note"
                  onPress={() => handleAction('copy')}
                  colors={colors}
                />
                <OptionItem
                  icon="share-social-outline"
                  label="Share"
                  onPress={() => handleAction('share')}
                  colors={colors}
                />
                <OptionItem
                  icon="create-outline"
                  label="Edit Note"
                  onPress={() => handleAction('edit')}
                  colors={colors}
                />
                <View style={styles.separator} />
                <OptionItem
                  icon="trash-outline"
                  label="Delete Note"
                  onPress={() => handleAction('delete')}
                  isDestructive
                  colors={colors}
                />
              </View>

              <Pressable style={styles.cancelButton} onPress={handleDismiss}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
            </ScrollView>
          </Animated.View>
        )}

        {isDialogActive && (
          <Animated.View
            style={[styles.dialogCenterOverlay, { opacity: backdropOpacity }]}
            pointerEvents="auto"
          >
            <Pressable style={styles.dialog} onPress={(e) => e?.stopPropagation?.()}>
              {isConfirmDeleteVisible && (
                <>
                  <View style={styles.dialogIconContainer}>
                    <Ionicons name="trash-outline" size={48} color={colors.error} />
                  </View>
                  <Text style={styles.dialogTitle}>Delete Note</Text>
                  <Text style={styles.dialogMessage}>
                    Are you sure you want to delete this note?
                  </Text>
                  <Text style={styles.dialogSubmessage}>This action cannot be undone.</Text>
                  <View style={styles.dialogActions}>
                    <Pressable
                      onPress={() => setIsConfirmDeleteVisible(false)}
                      style={[styles.dialogButton, styles.dialogCancelButton]}
                    >
                      <Text style={styles.dialogCancelButtonText}>Cancel</Text>
                    </Pressable>
                    <Pressable
                      onPress={handleDeleteConfirm}
                      style={[styles.dialogButton, styles.dialogDestructiveButton]}
                    >
                      <Text style={styles.dialogDestructiveButtonText}>Delete</Text>
                    </Pressable>
                  </View>
                </>
              )}

              {isSuccessVisible && (
                <>
                  <View style={styles.dialogIconContainer}>
                    <Ionicons name="checkmark-circle-outline" size={64} color={colors.success} />
                  </View>
                  <Text style={styles.dialogTitle}>Success</Text>
                  <Text style={styles.dialogMessage}>{statusMessage}</Text>
                  <View style={styles.dialogActions}>
                    <Pressable
                      onPress={handleStatusModalClose}
                      style={[styles.dialogButton, styles.dialogSuccessButton]}
                    >
                      <Text style={styles.dialogSuccessButtonText}>OK</Text>
                    </Pressable>
                  </View>
                </>
              )}

              {isErrorVisible && (
                <>
                  <View style={styles.dialogIconContainer}>
                    <Ionicons name="alert-circle-outline" size={64} color={colors.error} />
                  </View>
                  <Text style={styles.dialogTitle}>Error</Text>
                  <Text style={styles.dialogMessage}>{statusMessage}</Text>
                  <View style={styles.dialogActions}>
                    <Pressable
                      onPress={handleStatusModalClose}
                      style={[styles.dialogButton, styles.dialogErrorButton]}
                    >
                      <Text style={styles.dialogErrorButtonText}>OK</Text>
                    </Pressable>
                  </View>
                </>
              )}
            </Pressable>
          </Animated.View>
        )}
      </View>
    </Modal>
  );
}

interface OptionItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  isDestructive?: boolean;
  colors: ReturnType<typeof getColors>;
}

function OptionItem({ icon, label, onPress, isDestructive, colors }: OptionItemProps) {
  const styles = useMemo(
    () =>
      StyleSheet.create({
        optionItem: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.sm,
          borderRadius: 12,
        },
        iconContainer: {
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: isDestructive ? `${colors.error}30` : colors.backgroundElevated,
          borderWidth: 1,
          borderColor: isDestructive ? colors.error : colors.border,
          justifyContent: 'center',
          alignItems: 'center',
          marginRight: spacing.md,
        },
        optionLabel: {
          fontSize: fontSizes.body,
          fontWeight: fontWeights.medium,
          color: isDestructive ? colors.error : colors.textPrimary,
        },
      }),
    [colors, isDestructive]
  );

  return (
    <Pressable
      style={({ pressed }) => [
        styles.optionItem,
        pressed && { backgroundColor: colors.backgroundElevated },
      ]}
      onPress={onPress}
    >
      <View style={styles.iconContainer}>
        <Ionicons name={icon} size={22} color={isDestructive ? colors.error : colors.textPrimary} />
      </View>
      <Text style={styles.optionLabel}>{label}</Text>
    </Pressable>
  );
}
