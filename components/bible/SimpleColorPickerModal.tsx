/**
 * SimpleColorPickerModal Component
 *
 * A simple bottom sheet modal for selecting a highlight color.
 * Used when saving a verse as a highlight from the verse insight tooltip.
 *
 * Features:
 * - Bottom sheet with slide-up animation
 * - Color picker grid (9 colors)
 * - Save and Cancel buttons
 * - Swipe-to-dismiss gesture
 * - Identical animations/UX to AutoHighlightTooltip
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fontSizes, fontWeights, type getColors, spacing } from '@/constants/bible-design-tokens';
import { DEFAULT_HIGHLIGHT_COLOR, type HighlightColor } from '@/constants/highlight-colors';
import { useTheme } from '@/contexts/ThemeContext';
import { useDeviceInfo } from '@/hooks/use-device-info';
import { HighlightColorPicker } from './HighlightColorPicker';

interface SimpleColorPickerModalProps {
  /** Whether modal is visible */
  visible: boolean;
  /** Callback to close modal */
  onClose: () => void;
  /** Callback when user saves with selected color */
  onSave: (color: HighlightColor) => void;
  /** Whether to use a system Modal (true) or a View overlay (false) */
  useModal?: boolean;
}

/**
 * SimpleColorPickerModal Component
 *
 * Bottom sheet modal for selecting a highlight color.
 */
export function SimpleColorPickerModal({
  visible,
  onClose,
  onSave,
  useModal = true,
}: SimpleColorPickerModalProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { isTablet, useSplitView, splitRatio, splitViewMode } = useDeviceInfo();
  const { width: windowWidth } = useWindowDimensions();

  // Calculate dynamic width for tooltip positioning
  // In split view: align over the insights panel (right panel)
  // In tablet landscape full screen: position on right side with fixed 50% width
  const tooltipWidth =
    useSplitView && splitViewMode !== 'left-full'
      ? windowWidth * (1 - splitRatio)
      : isTablet
        ? windowWidth * 0.5
        : undefined;

  const styles = createStyles(colors, insets.bottom, tooltipWidth);

  // Internal visibility state to keep Modal mounted during exit animation
  const [internalVisible, setInternalVisible] = useState(visible);

  // Selected color state
  const [selectedColor, setSelectedColor] = useState<HighlightColor>(DEFAULT_HIGHLIGHT_COLOR);

  // Get screen height to start modal completely off-screen
  const screenHeight = Dimensions.get('window').height;

  // Animated values
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(screenHeight)).current;

  // Helper to animate open
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
          toValue: screenHeight,
          useNativeDriver: true,
          damping: 20,
          stiffness: 90,
          overshootClamping: true,
          restDisplacementThreshold: 40,
          restSpeedThreshold: 40,
        }),
      ]).start();

      // Force cleanup after 150ms to prevent "spring tail" blocking the UI
      setTimeout(() => {
        setInternalVisible(false);
        setSelectedColor(DEFAULT_HIGHLIGHT_COLOR); // Reset color
        if (callback) callback();
      }, 150);
    },
    [backdropOpacity, slideAnim, screenHeight]
  );

  // Watch for prop changes to trigger animations
  useEffect(() => {
    if (visible) {
      animateOpen();
    } else if (internalVisible) {
      animateClose();
    }
  }, [visible, animateOpen, animateClose, internalVisible]);

  // Handle explicit dismiss (user action)
  const handleDismiss = () => {
    animateClose(() => {
      onClose();
    });
  };

  // Handle save
  const handleSave = () => {
    animateClose(() => {
      onSave(selectedColor);
    });
  };

  // Keep refs for PanResponder closure
  const dismissRef = useRef(handleDismiss);
  useEffect(() => {
    dismissRef.current = handleDismiss;
  });

  // Pan responder for swipe-to-dismiss
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 5;
      },
      onPanResponderMove: (_, gestureState) => {
        // Only allow downward drag
        if (gestureState.dy > 0) {
          slideAnim.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        // Swipe Down -> Dismiss
        if (gestureState.dy > 70) {
          dismissRef.current();
        }
        // Snap back if dragged down but not enough
        else if (gestureState.dy > 0) {
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

  const content = (
    /* Main Container - positions content at bottom */
    <View key={`picker-${useModal}`} style={styles.overlay} pointerEvents="box-none">
      {/* Animated Backdrop */}
      <Animated.View
        style={[
          styles.backdrop,
          { opacity: backdropOpacity },
          // Constrain backdrop to right panel only in split view mode (left panel should stay visible)
          // In full screen tablet mode, backdrop covers whole screen
          !useModal && useSplitView && splitViewMode !== 'left-full' && tooltipWidth
            ? {
                left: windowWidth - tooltipWidth,
                width: tooltipWidth,
              }
            : undefined,
        ]}
        pointerEvents="auto"
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={handleDismiss} />
      </Animated.View>

      {/* Animated Modal Content */}
      <Animated.View
        style={[styles.container, { transform: [{ translateY: slideAnim }] }]}
        pointerEvents="auto"
      >
        {/* Header with pan responder for swipe */}
        <View style={styles.header} {...panResponder.panHandlers}>
          <View style={styles.handle} />
        </View>

        {/* Content */}
        <View style={styles.contentContainer}>
          {/* Title */}
          <Text style={styles.title}>Select Highlight Color</Text>

          {/* Color Picker */}
          <View style={styles.colorPickerContainer}>
            <HighlightColorPicker
              selectedColor={selectedColor}
              onColorSelect={setSelectedColor}
              variant="light"
            />
          </View>

          {/* Actions */}
          <View style={styles.actionsContainer}>
            <Pressable style={styles.primaryButton} onPress={handleSave}>
              <Text style={styles.primaryButtonText}>Save Highlight</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={handleDismiss}>
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Animated.View>
    </View>
  );

  if (useModal) {
    return (
      <Modal
        visible={internalVisible}
        transparent
        animationType="none"
        onRequestClose={handleDismiss}
      >
        {content}
      </Modal>
    );
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {content}
    </View>
  );
}

/**
 * Creates styles for SimpleColorPickerModal component
 */
const createStyles = (
  colors: ReturnType<typeof getColors>,
  bottomInset: number,
  tooltipWidth?: number
) => {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
      alignItems: tooltipWidth ? 'flex-end' : 'stretch',
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.backdrop,
    },
    container: {
      backgroundColor: colors.backgroundElevated,
      borderTopLeftRadius: 16,
      borderTopRightRadius: tooltipWidth ? 0 : 16,
      maxHeight: '80%',
      width: tooltipWidth ?? '100%',
      paddingBottom: bottomInset, // Extend into safe area
    },
    contentContainer: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.xl,
    },
    header: {
      alignItems: 'center',
      paddingTop: spacing.sm,
      paddingBottom: spacing.md,
    },
    handle: {
      width: 40,
      height: 4,
      backgroundColor: colors.border,
      borderRadius: 2,
    },
    title: {
      fontSize: fontSizes.heading2,
      fontWeight: fontWeights.semibold,
      color: colors.textPrimary,
      marginBottom: spacing.lg,
      textAlign: 'center',
    },
    colorPickerContainer: {
      marginBottom: spacing.lg,
      alignItems: 'center',
    },
    actionsContainer: {
      gap: spacing.sm,
    },
    primaryButton: {
      backgroundColor: colors.gold,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: 8,
      alignItems: 'center',
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
