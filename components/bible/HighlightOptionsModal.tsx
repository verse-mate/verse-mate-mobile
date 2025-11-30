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
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { type EdgeInsets, useSafeAreaInsets } from 'react-native-safe-area-context';
import { fontSizes, fontWeights, type getColors, spacing } from '@/constants/bible-design-tokens';
import { useTheme } from '@/contexts/ThemeContext';
import type { Highlight } from '@/hooks/bible/use-highlights';

interface HighlightOptionsModalProps {
  visible: boolean;
  onClose: () => void;
  highlight: Highlight | null;
  deleteHighlight: (highlightId: number) => Promise<void>;
  onActionComplete?: (action: string) => void;
}

const createThemedStyles = (colors: ReturnType<typeof getColors>, insets: EdgeInsets) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      // This controls the main positioning of content within the modal
      // It will either justify-end for the menu, or center for dialogs
      justifyContent: 'flex-end',
      alignItems: 'center', // For centering dialogs horizontally
    },
    // Backdrop styles
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    backdropPressable: {
      ...StyleSheet.absoluteFillObject,
    },

    // Sheet Container (for Options Menu)
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
      width: '100%', // Ensure it spans full width
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
      borderColor: 'transparent', // Default transparent, set by logic
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: spacing.md,
    },
    optionLabel: {
      fontSize: fontSizes.body,
      fontWeight: fontWeights.medium,
      color: colors.textPrimary,
    },

    // Dialog Overlay (for Delete/Success/Error dialogs - centered)
    dialogCenterOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.5)', // Will be controlled by animated opacity
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

export function HighlightOptionsModal({
  visible,
  onClose,
  highlight,
  deleteHighlight,
  onActionComplete,
}: HighlightOptionsModalProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createThemedStyles(colors, insets), [colors, insets]);

  // Internal state for modal visibility to control animations
  const [internalVisible, setInternalVisible] = useState(false);

  // Dialog specific states
  const [isConfirmDeleteVisible, setIsConfirmDeleteVisible] = useState(false);
  const [isSuccessVisible, setIsSuccessVisible] = useState(false);
  const [isErrorVisible, setIsErrorVisible] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  // Animated values
  const screenHeight = Dimensions.get('window').height;
  const slideAnim = useRef(new Animated.Value(screenHeight)).current; // Start off-screen
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  // Helper to animate open
  const animateOpen = useCallback(() => {
    setInternalVisible(true); // Mount content for animation
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

  // Helper to animate close
  const animateClose = useCallback(
    (callback?: () => void) => {
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: screenHeight, // Slide off-screen
          useNativeDriver: true,
          damping: 20,
          stiffness: 90,
          overshootClamping: true,
          restDisplacementThreshold: 40,
          restSpeedThreshold: 40,
        }),
      ]).start();

      // Force cleanup after animation to prevent blocking UI if spring "tail" persists
      setTimeout(() => {
        setInternalVisible(false); // Unmount content
        // Reset all internal states when closing, so it's fresh on next open
        setIsConfirmDeleteVisible(false);
        setIsSuccessVisible(false);
        setIsErrorVisible(false);
        setStatusMessage('');
        if (callback) callback();
      }, 300); // Match fadeOut duration
    },
    [backdropOpacity, slideAnim, screenHeight]
  );

  // Sync visible prop with internal state and trigger animations
  useEffect(() => {
    if (visible && !internalVisible) {
      // Reset all internal states when opening to ensure fresh state
      setIsConfirmDeleteVisible(false);
      setIsSuccessVisible(false);
      setIsErrorVisible(false);
      setStatusMessage('');
      animateOpen();
    } else if (!visible && internalVisible) {
      animateClose(onClose);
    }
  }, [visible, internalVisible, animateOpen, animateClose, onClose]);

  // Pan Responder for swipe-to-dismiss on the bottom sheet
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 5,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          // Only allow downward drag
          slideAnim.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100) {
          // If dragged down enough, dismiss
          animateClose(onClose);
        } else {
          // Snap back to open position
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

  const handleAction = async (action: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (!highlight) {
      setStatusMessage('No highlight selected for action.');
      setIsErrorVisible(true);
      return;
    }

    switch (action) {
      case 'copy':
        if (highlight.selected_text) {
          await Clipboard.setStringAsync(String(highlight.selected_text));
          onActionComplete?.('copy');
          handleDismiss(); // Dismiss entire modal after copy
        } else {
          setStatusMessage('No text to copy for this highlight.');
          setIsErrorVisible(true);
        }
        break;
      case 'delete':
        setIsConfirmDeleteVisible(true); // Show confirmation dialog (this is central, not part of sheet)
        break;
      case 'share':
        setStatusMessage('"Share" feature is coming soon!');
        setIsErrorVisible(true);
        break;
      case 'edit':
        setStatusMessage('"Edit Highlight" feature is coming soon!');
        setIsErrorVisible(true);
        break;
      default:
        setStatusMessage(`Action "${action}" is not recognized.`);
        setIsErrorVisible(true);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!highlight) {
      setStatusMessage('Error: No highlight to delete.');
      setIsErrorVisible(true);
      return;
    }

    try {
      await deleteHighlight(highlight.highlight_id);
      // After successful delete, close the entire modal
      handleDismiss();
    } catch (error) {
      // If error, switch from Confirm to Error dialog
      setIsConfirmDeleteVisible(false);
      setStatusMessage('Failed to delete highlight.');
      setIsErrorVisible(true);
      console.error('Error deleting highlight:', error);
    }
  };

  const handleStatusModalClose = () => {
    // Close the entire modal after status dialog is acknowledged
    handleDismiss();
  };

  const isDialogActive = isConfirmDeleteVisible || isSuccessVisible || isErrorVisible;

  // Only render if internalVisible is true (after enter animation, before exit animation)
  if (!internalVisible) return null;

  return (
    <Modal
      visible={true} // Modal is always visible internally when internalVisible is true
      transparent
      animationType="none"
      onRequestClose={handleDismiss} // Use internal dismiss handler
      statusBarTranslucent
      presentationStyle="overFullScreen"
    >
      {/* Main Overlay Container */}
      <View
        style={[styles.overlay, isDialogActive && { justifyContent: 'center' }]}
        pointerEvents="box-none"
      >
        {/* Backdrop (animated opacity) */}
        <Animated.View
          style={[styles.backdrop, { opacity: backdropOpacity }]}
          pointerEvents={isDialogActive ? 'auto' : 'none'} // Backdrop should only handle presses if dialog is active
        >
          {/* Pressable on backdrop to dismiss - only active when menu is shown */}
          {!isDialogActive && (
            <Pressable style={styles.backdropPressable} onPress={handleDismiss} />
          )}
        </Animated.View>

        {/* Bottom Sheet for Options Menu (swipeable) */}
        {!isDialogActive && (
          <Animated.View
            style={[styles.sheetContainer, { transform: [{ translateY: slideAnim }] }]}
          >
            {/* Handle for bottom sheet */}
            <View style={styles.handleContainer} {...panResponder.panHandlers}>
              <View style={styles.handle} />
            </View>

            <ScrollView style={styles.optionsScrollView}>
              <Text style={styles.title}>Highlight Options</Text>

              <View style={styles.optionsContainer}>
                <OptionItem
                  icon="copy-outline"
                  label="Copy Text"
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
                  label="Edit Highlight"
                  onPress={() => handleAction('edit')}
                  colors={colors}
                />
                <View style={styles.separator} />
                <OptionItem
                  icon="trash-outline"
                  label="Delete Highlight"
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

        {/* Centered Dialogs (Delete Confirmation, Success, Error) */}
        {isDialogActive && (
          <Animated.View
            style={[styles.dialogCenterOverlay, { opacity: backdropOpacity }]} // Fade with backdrop
            pointerEvents="auto" // Ensure dialog is interactive
          >
            <Pressable style={styles.dialog} onPress={(e) => e?.stopPropagation?.()}>
              {isConfirmDeleteVisible && (
                <>
                  <View style={styles.dialogIconContainer}>
                    <Ionicons name="trash-outline" size={48} color={colors.error} />
                  </View>
                  <Text style={styles.dialogTitle}>Delete Highlight</Text>
                  <Text style={styles.dialogMessage}>
                    Are you sure you want to delete this highlight?
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
