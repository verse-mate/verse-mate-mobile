import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useRef, useState } from 'react';
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
import type { SvgProps } from 'react-native-svg';
import { IconCopy, IconShare, IconTrash } from '@/components/ui/icons';
import { fontSizes, fontWeights, type getColors, spacing } from '@/constants/bible-design-tokens';
import { useTheme } from '@/contexts/ThemeContext';
import type { Highlight } from '@/hooks/bible/use-highlights';

interface HighlightOptionsModalProps {
  visible: boolean;
  onClose: () => void;
  highlight: Highlight | null;
  bookName: string;
  chapterNumber: number;
  deleteHighlight: (highlightId: number) => Promise<void>;
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
      backgroundColor: colors.backgroundElevated,
      borderTopLeftRadius: 30,
      borderTopRightRadius: 30,
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
      width: 72,
      height: 4,
      borderRadius: 2,
      backgroundColor: '#3A3A3A',
      opacity: 1,
    },
    title: {
      fontSize: 18,
      fontWeight: '300',
      color: colors.textPrimary,
      textAlign: 'center',
      marginBottom: spacing.lg,
      marginTop: spacing.sm,
    },
    optionsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: spacing.sm,
      marginBottom: spacing.lg,
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
      paddingVertical: 14,
      alignItems: 'center',
      backgroundColor: 'transparent',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cancelButtonText: {
      fontSize: 16,
      fontWeight: '400',
      color: colors.textPrimary,
    },
    optionItem: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      paddingHorizontal: 4,
      borderRadius: 12,
      backgroundColor: colors.backgroundElevated,
      borderWidth: 1,
      borderColor: colors.border,
      height: 74,
    },
    iconContainer: {
      marginBottom: 8,
    },
    optionLabel: {
      fontSize: 12,
      fontWeight: '400',
      color: colors.textPrimary,
      textAlign: 'center',
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
  bookName,
  chapterNumber,
  deleteHighlight,
  onActionComplete,
}: HighlightOptionsModalProps) {
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

  const animateOpen = () => {
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
  };

  const animateClose = (callback?: () => void) => {
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
  };

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
    // biome-ignore lint/correctness/useExhaustiveDependencies: React Compiler handles memoization of animateOpen/animateClose
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
          handleDismiss();
        } else {
          setStatusMessage('No text to copy for this highlight.');
          setIsErrorVisible(true);
        }
        break;
      case 'delete':
        setIsConfirmDeleteVisible(true);
        break;
      case 'share':
        if (highlight.selected_text) {
          try {
            const verseRange =
              highlight.start_verse === highlight.end_verse
                ? `${highlight.start_verse}`
                : `${highlight.start_verse}-${highlight.end_verse}`;
            const message = `"${highlight.selected_text}"\n\n${bookName} ${chapterNumber}:${verseRange}`;

            await Share.share({
              message,
            });
            handleDismiss();
          } catch (error) {
            console.error('Error sharing highlight:', error);
            setStatusMessage('Failed to share highlight.');
            setIsErrorVisible(true);
          }
        } else {
          setStatusMessage('No content to share.');
          setIsErrorVisible(true);
        }
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
      handleDismiss();
    } catch (error) {
      setIsConfirmDeleteVisible(false);
      setStatusMessage('Failed to delete highlight.');
      setIsErrorVisible(true);
      console.error('Error deleting highlight:', error);
    }
  };

  const handleStatusModalClose = () => {
    handleDismiss();
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
              <Text style={styles.title}>Highlight Options</Text>
            </View>

            <ScrollView
              style={styles.optionsScrollView}
              bounces={false}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.optionsContainer}>
                <OptionItem
                  Icon={IconCopy}
                  label="Copy"
                  onPress={() => handleAction('copy')}
                  colors={colors}
                />
                <OptionItem
                  Icon={IconShare}
                  label="Share"
                  onPress={() => handleAction('share')}
                  colors={colors}
                />
                <OptionItem
                  Icon={IconTrash}
                  label="Delete"
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
                  <Text style={styles.dialogTitle}>Delete Highlight</Text>
                  <Text style={styles.dialogMessage}>
                    Are you sure you want to delete this highlight?
                  </Text>
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
  Icon: React.FC<SvgProps>;
  label: string;
  onPress: () => void;
  isDestructive?: boolean;
  colors: ReturnType<typeof getColors>;
}

function OptionItem({ Icon, label, onPress, isDestructive, colors }: OptionItemProps) {
  const destructiveColor = '#B03A42';
  const styles = useMemo(
    () =>
      StyleSheet.create({
        optionItem: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 12,
          paddingHorizontal: 4,
          borderRadius: 12,
          backgroundColor: isDestructive ? 'rgba(176, 58, 66, 0.1)' : colors.backgroundElevated,
          borderWidth: 1,
          borderColor: isDestructive ? 'rgba(176, 58, 66, 0.4)' : colors.border,
          height: 74,
        },
        iconContainer: {
          marginBottom: 8,
        },
        optionLabel: {
          fontSize: 12,
          fontWeight: '400',
          color: isDestructive ? destructiveColor : colors.textPrimary,
          textAlign: 'center',
        },
      }),
    [colors, isDestructive]
  );

  return (
    <Pressable
      style={({ pressed }) => [
        styles.optionItem,
        pressed && {
          backgroundColor: isDestructive ? 'rgba(176, 58, 66, 0.2)' : colors.backgroundSecondary,
        },
      ]}
      onPress={onPress}
    >
      <View style={styles.iconContainer}>
        <Icon
          width={24}
          height={24}
          color={isDestructive ? destructiveColor : colors.textPrimary}
        />
      </View>
      <Text style={styles.optionLabel}>{label}</Text>
    </Pressable>
  );
}
