/**
 * AutoHighlightTooltip Component
 *
 * Displays information about an AI-generated auto-highlight.
 * Shows theme name, relevance score, and option to save as user highlight.
 *
 * Shown as a bottom sheet modal when user taps on an auto-highlighted verse.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors, fontSizes, fontWeights, spacing } from '@/constants/bible-design-tokens';
import type { HighlightColor } from '@/constants/highlight-colors';
import type { AutoHighlight } from '@/types/auto-highlights';

interface AutoHighlightTooltipProps {
  /** Auto-highlight to display info for */
  autoHighlight: AutoHighlight | null;
  /** Whether modal is visible */
  visible: boolean;
  /** Callback to close modal */
  onClose: () => void;
  /** Callback to save auto-highlight as user highlight */
  onSaveAsUserHighlight: (
    color: HighlightColor,
    verseRange: { start: number; end: number }
  ) => void;
  /** Whether user is logged in */
  isLoggedIn: boolean;
}

/**
 * AutoHighlightTooltip Component
 *
 * Bottom sheet modal showing auto-highlight details and actions.
 */
export function AutoHighlightTooltip({
  autoHighlight,
  visible,
  onClose,
  onSaveAsUserHighlight,
  isLoggedIn,
}: AutoHighlightTooltipProps) {
  // Internal visibility state to keep Modal mounted during exit animation
  const [internalVisible, setInternalVisible] = useState(visible);

  // Get screen height to start modal completely off-screen
  const screenHeight = Dimensions.get('window').height;

  // Animated values for backdrop fade and content slide
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

      // Force cleanup after 300ms to prevent "spring tail" blocking the UI
      // This ensures the modal unmounts deterministically, fixing the double-click bug
      setTimeout(() => {
        setInternalVisible(false);
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
      // If externally closed (prop becomes false), animate out
      // We only animate out if it's currently internally visible
      animateClose();
    }
  }, [visible, animateOpen, animateClose, internalVisible]);

  // Handle explicit dismiss (user action)
  const handleDismiss = () => {
    animateClose(() => {
      onClose();
    });
  };

  // Keep a ref to handleDismiss for PanResponder to avoid stale closures
  const dismissRef = useRef(handleDismiss);
  useEffect(() => {
    dismissRef.current = handleDismiss;
  });

  // Pan responder for swipe-to-dismiss
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only respond to vertical swipes
        return Math.abs(gestureState.dy) > 5;
      },
      onPanResponderMove: (_, gestureState) => {
        // Only allow downward drag
        if (gestureState.dy > 0) {
          slideAnim.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        // If dragged down more than 70px, animate out from current position
        if (gestureState.dy > 70) {
          // Animate from current position to off-screen
          dismissRef.current();
        } else {
          // Otherwise, snap back to position
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

  // Don't render anything if we have no data (unless animating out, handled by internalVisible/Modal)
  if (!autoHighlight && !internalVisible) return null;
  // We might have internalVisible=true but autoHighlight=null if it was cleared quickly,
  // but usually they sync. If autoHighlight is null but we are visible, it might crash accessing fields.
  // Safe guard:
  if (!autoHighlight) return null;

  const handleSave = () => {
    if (!isLoggedIn) {
      Alert.alert('Sign In Required', 'Please sign in to save highlights to your collection.', [
        { text: 'OK' },
      ]);
      return;
    }

    // Save auto-highlight as user highlight with the same color and verse range
    onSaveAsUserHighlight(autoHighlight.theme_color, {
      start: autoHighlight.start_verse,
      end: autoHighlight.end_verse,
    });

    handleDismiss();
  };

  return (
    <Modal
      visible={internalVisible}
      transparent
      animationType="none"
      onRequestClose={handleDismiss}
    >
      {/* Animated Backdrop with fade */}
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <Pressable style={styles.backdropPressable} onPress={handleDismiss}>
          {/* Animated Modal content with slide */}
          <Animated.View style={[styles.container, { transform: [{ translateY: slideAnim }] }]}>
            {/* Header with pan responder for swipe */}
            <View style={styles.header} {...panResponder.panHandlers}>
              <View style={styles.handle} />
            </View>

            {/* Content - prevent backdrop press */}
            <Pressable onPress={(e) => e.stopPropagation()}>
              {/* Title */}
              <Text style={styles.title}>{autoHighlight.theme_name}</Text>

              {/* Info rows */}
              <View style={styles.infoContainer}>
                <View style={styles.infoRow}>
                  <Text style={styles.label}>Relevance:</Text>
                  <Text style={styles.value}>{autoHighlight.relevance_score} / 5</Text>
                </View>

                <View style={styles.infoRow}>
                  <Text style={styles.label}>Type:</Text>
                  <Text style={styles.value}>AI-generated highlight</Text>
                </View>

                <View style={styles.infoRow}>
                  <Text style={styles.label}>Verse Range:</Text>
                  <Text style={styles.value}>
                    {autoHighlight.start_verse === autoHighlight.end_verse
                      ? `Verse ${autoHighlight.start_verse}`
                      : `Verses ${autoHighlight.start_verse}-${autoHighlight.end_verse}`}
                  </Text>
                </View>
              </View>

              {/* Actions */}
              <View style={styles.actionsContainer}>
                {isLoggedIn ? (
                  <>
                    <Pressable style={styles.primaryButton} onPress={handleSave}>
                      <Text style={styles.primaryButtonText}>Save as My Highlight</Text>
                    </Pressable>
                    <Pressable style={styles.secondaryButton} onPress={handleDismiss}>
                      <Text style={styles.secondaryButtonText}>Cancel</Text>
                    </Pressable>
                  </>
                ) : (
                  <View style={styles.loginPrompt}>
                    <Text style={styles.loginPromptText}>
                      Sign in to save this highlight to your collection
                    </Text>
                  </View>
                )}
              </View>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  backdropPressable: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  header: {
    alignItems: 'center',
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.gray300,
    borderRadius: 2,
  },
  title: {
    fontSize: fontSizes.heading2,
    fontWeight: fontWeights.semibold,
    color: colors.gray900,
    marginBottom: spacing.lg,
  },
  infoContainer: {
    marginBottom: spacing.xl,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  label: {
    fontSize: fontSizes.body,
    color: colors.gray500,
    fontWeight: fontWeights.regular,
  },
  value: {
    fontSize: fontSizes.body,
    color: colors.gray900,
    fontWeight: fontWeights.medium,
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
    color: colors.white,
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
    borderColor: colors.gray300,
  },
  secondaryButtonText: {
    color: colors.gray900,
    fontSize: fontSizes.body,
    fontWeight: fontWeights.medium,
  },
  loginPrompt: {
    padding: spacing.lg,
    backgroundColor: colors.gray100,
    borderRadius: 8,
    alignItems: 'center',
  },
  loginPromptText: {
    fontSize: fontSizes.body,
    color: colors.gray700,
    textAlign: 'center',
  },
});
