/**
 * NoteViewModal Component
 *
 * Read-only modal for viewing full note content with a close button.
 *
 * Features:
 * - Full note content display (no truncation)
 * - Close button in header
 * - Swipe-to-dismiss gesture
 * - Animated slide-in/out transitions
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
 *   onMenuPress={handleMenuPress}
 * />
 * ```
 */

import { Ionicons } from '@expo/vector-icons';
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
  /** Optional edit callback (currently unused in UI) */
  onEdit?: (note: Note) => void | Promise<void>;
  /** Optional delete callback (currently unused in UI) */
  onDelete?: (note: Note) => void | Promise<void>;
}

/**
 * NoteViewModal Component
 *
 * Displays read-only note content with swipe-to-dismiss and menu button.
 */
export function NoteViewModal({
  visible,
  note,
  bookName,
  chapterNumber,
  onClose,
}: NoteViewModalProps) {
  const { colors, mode } = useTheme();
  const styles = useMemo(() => createStyles(colors, mode), [colors, mode]);

  // Animation state for swipe-to-dismiss
  const screenHeight = Dimensions.get('window').height;
  const slideAnim = useRef(new Animated.Value(screenHeight)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const [internalVisible, setInternalVisible] = useState(false);

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
      }, 300);
    },
    [backdropOpacity, slideAnim, screenHeight]
  );

  useEffect(() => {
    if (visible && !internalVisible) {
      animateOpen();
    } else if (!visible && internalVisible) {
      animateClose();
    }
  }, [visible, internalVisible, animateOpen, animateClose]);

  const handleDismiss = useCallback(() => {
    animateClose(() => {
      onClose();
    });
  }, [animateClose, onClose]);

  // Pan responder for swipe-to-dismiss – matches tooltip/menus behavior
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

  return (
    <Modal visible={true} animationType="none" transparent={true} onRequestClose={handleDismiss}>
      <View style={styles.modalContainer}>
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleDismiss} />
        </Animated.View>

        <Animated.View
          style={[styles.modalContent, { transform: [{ translateY: slideAnim }] }]}
          {...panResponder.panHandlers}
        >
          <SafeAreaView style={{ flex: 1 }}>
            {/* Handle for visual swipe indicator */}
            <View style={styles.handleContainer}>
              <View style={styles.handle} />
            </View>

            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.headerTitle}>
                {bookName} {chapterNumber}
              </Text>
              <Pressable
                onPress={handleDismiss}
                style={styles.menuButton}
                testID="view-close-button"
                hitSlop={12}
              >
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </Pressable>
            </View>

            {/* Content */}
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              scrollEventThrottle={16}
              onScrollBeginDrag={() => {
                // Disable pan responder when user is scrolling content
              }}
            >
              <Text style={styles.noteContent}>{note.content}</Text>
            </ScrollView>
          </SafeAreaView>
        </Animated.View>
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
    menuButton: {
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
  });
};
