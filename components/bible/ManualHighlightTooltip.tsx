/**
 * ManualHighlightTooltip Component
 *
 * Displays information about a grouped manual highlight (consecutive verses with same color).
 * Shown when user taps on a highlighted verse that's part of a consecutive group.
 *
 * Features:
 * - Shows verse range reference as title
 * - Displays type, verse range, and color
 * - Expandable "View Verse Insight" section
 * - Remove button to delete all highlights in group
 * - Identical animations/UX to AutoHighlightTooltip
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import Markdown from 'react-native-markdown-display';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DeleteConfirmationModal } from '@/components/bible/DeleteConfirmationModal';
import { fontSizes, fontWeights, type getColors, spacing } from '@/constants/bible-design-tokens';
import { getHighlightColor } from '@/constants/highlight-colors';
import { useTheme } from '@/contexts/ThemeContext';
import { useBibleByLine } from '@/src/api/generated/hooks';
import type { HighlightGroup } from '@/utils/bible/groupConsecutiveHighlights';
import { parseByLineExplanation } from '@/utils/bible/parseByLineExplanation';

interface ManualHighlightTooltipProps {
  /** Highlight group to display info for */
  highlightGroup: HighlightGroup | null;
  /** Book ID */
  bookId: number;
  /** Chapter number */
  chapterNumber: number;
  /** Book name for title */
  bookName: string;
  /** Whether modal is visible */
  visible: boolean;
  /** Callback to close modal */
  onClose: () => void;
  /** Callback to remove highlight group */
  onRemove: (group: HighlightGroup) => void;
}

/**
 * ManualHighlightTooltip Component
 *
 * Bottom sheet modal showing grouped manual highlight details and actions.
 */
export function ManualHighlightTooltip({
  highlightGroup,
  bookId,
  chapterNumber,
  bookName,
  visible,
  onClose,
  onRemove,
}: ManualHighlightTooltipProps) {
  const { colors, mode } = useTheme();
  const insets = useSafeAreaInsets();
  const { styles, markdownStyles } = useMemo(
    () => createStyles(colors, insets.bottom),
    [colors, insets.bottom]
  );

  // Internal visibility state to keep Modal mounted during exit animation
  const [internalVisible, setInternalVisible] = useState(visible);

  // State for showing verse insight (expanded view)
  const [expanded, setExpanded] = useState(false);

  // State for delete confirmation modal
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);

  // Get screen height to start modal completely off-screen
  const screenHeight = Dimensions.get('window').height;

  // Animated values
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(screenHeight)).current;
  const expansionAnim = useRef(new Animated.Value(0)).current; // 0: collapsed, 1: expanded

  // Fetch by-line explanation for the chapter
  const { data: byLineData, isLoading: isByLineLoading } = useBibleByLine(
    bookId,
    chapterNumber,
    undefined,
    { enabled: !!highlightGroup && visible }
  );

  // Parse the insight for the specific verses
  const insightText = useMemo(() => {
    if (!byLineData?.content || !highlightGroup) return null;

    return parseByLineExplanation(
      byLineData.content,
      '',
      chapterNumber,
      highlightGroup.startVerse,
      highlightGroup.endVerse
    );
  }, [byLineData, chapterNumber, highlightGroup]);

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
        setExpanded(false); // Reset expansion state
        expansionAnim.setValue(0);
        if (callback) callback();
      }, 150);
    },
    [backdropOpacity, slideAnim, screenHeight, expansionAnim]
  );

  // Handle expansion animation
  useEffect(() => {
    Animated.spring(expansionAnim, {
      toValue: expanded ? 1 : 0,
      useNativeDriver: false, // Height animation requires false
      damping: 20,
      stiffness: 90,
    }).start();
  }, [expanded, expansionAnim]);

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

  // Handle remove button press - show confirmation
  const handleRemove = () => {
    setShowDeleteConfirmation(true);
  };

  // Handle confirmed deletion
  const handleConfirmDelete = () => {
    setShowDeleteConfirmation(false);
    if (!highlightGroup) return;

    animateClose(() => {
      onRemove(highlightGroup);
    });
  };

  // Keep refs for PanResponder closure
  const dismissRef = useRef(handleDismiss);
  const expandRef = useRef((val: boolean) => setExpanded(val));
  const isExpandedRef = useRef(expanded);

  useEffect(() => {
    dismissRef.current = handleDismiss;
    expandRef.current = setExpanded;
    isExpandedRef.current = expanded;
  });

  // Pan responder for swipe-to-dismiss AND expand
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 5;
      },
      onPanResponderMove: (_, gestureState) => {
        // Only allow downward drag for sliding the whole modal
        if (gestureState.dy > 0) {
          slideAnim.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        // Swipe Up -> Expand (if not already)
        if (gestureState.dy < -50 && !isExpandedRef.current) {
          expandRef.current(true);
        }
        // Swipe Down -> Dismiss
        else if (gestureState.dy > 70) {
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

  // Don't render anything if we have no data
  if (!highlightGroup && !internalVisible) return null;
  if (!highlightGroup) return null;

  // Build verse reference title
  const verseReference =
    highlightGroup.startVerse === highlightGroup.endVerse
      ? `${bookName} ${chapterNumber}:${highlightGroup.startVerse}`
      : `${bookName} ${chapterNumber}:${highlightGroup.startVerse}-${highlightGroup.endVerse}`;

  // Interpolate values for expansion animation
  const insightMaxHeight = expansionAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 400],
  });

  const insightOpacity = expansionAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0, 1],
  });

  // Get color for display
  const highlightColorHex = getHighlightColor(highlightGroup.color, mode);

  return (
    <Modal
      visible={internalVisible}
      transparent
      animationType="none"
      onRequestClose={handleDismiss}
    >
      {/* Main Container - positions content at bottom */}
      <View style={styles.overlay}>
        {/* Animated Backdrop */}
        <Animated.View
          style={[styles.backdrop, { opacity: backdropOpacity }]}
          pointerEvents="box-none"
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
            <View style={styles.scrollContainer}>
              <View {...panResponder.panHandlers}>
                {/* Title */}
                <Text style={styles.title}>{verseReference}</Text>

                <View style={styles.infoContainer}>
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>Type:</Text>
                    <Text style={styles.value}>Manual Highlight</Text>
                  </View>

                  <View style={styles.infoRow}>
                    <Text style={styles.label}>Verse Range:</Text>
                    <Text style={styles.value}>
                      {highlightGroup.startVerse === highlightGroup.endVerse
                        ? `Verse ${highlightGroup.startVerse}`
                        : `Verses ${highlightGroup.startVerse}-${highlightGroup.endVerse}`}
                    </Text>
                  </View>

                  <View style={styles.infoRow}>
                    <Text style={styles.label}>Color:</Text>
                    <View style={styles.colorRow}>
                      <View
                        style={[styles.colorIndicator, { backgroundColor: highlightColorHex }]}
                      />
                      <Text style={styles.value}>
                        {highlightGroup.color.charAt(0).toUpperCase() +
                          highlightGroup.color.slice(1)}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Insight Section (Expandable) */}
              <View style={styles.insightContainer}>
                <Pressable
                  style={styles.insightToggle}
                  onPress={() => setExpanded(!expanded)}
                  hitSlop={10}
                  {...panResponder.panHandlers}
                >
                  <Text style={styles.insightToggleText}>
                    {expanded ? 'Hide Verse Insight' : 'View Verse Insight'}
                  </Text>
                </Pressable>

                <Animated.View
                  style={[
                    styles.insightContentWrapper,
                    { maxHeight: insightMaxHeight, opacity: insightOpacity },
                  ]}
                >
                  {isByLineLoading ? (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator size="small" color={colors.gold} />
                    </View>
                  ) : insightText ? (
                    <ScrollView
                      style={styles.insightScroll}
                      contentContainerStyle={styles.insightScrollContent}
                      showsVerticalScrollIndicator={false}
                    >
                      <Markdown style={markdownStyles}>{insightText}</Markdown>
                    </ScrollView>
                  ) : (
                    <View style={styles.emptyInsightContainer}>
                      <Text style={styles.insightEmptyText}>
                        No specific insight available for these verses.
                      </Text>
                    </View>
                  )}
                </Animated.View>
              </View>
            </View>

            {/* Actions Footer */}
            <View style={styles.actionsContainer}>
              <Pressable style={styles.removeButton} onPress={handleRemove}>
                <Text style={styles.removeButtonText}>Remove Highlight</Text>
              </Pressable>
              <Pressable style={styles.secondaryButton} onPress={handleDismiss}>
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>
      </View>

      {/* Delete Confirmation Modal */}
      {highlightGroup && (
        <DeleteConfirmationModal
          visible={showDeleteConfirmation}
          onCancel={() => setShowDeleteConfirmation(false)}
          onConfirm={handleConfirmDelete}
          title="Remove Highlight Group"
          message={`This will delete ${highlightGroup.highlights.length} highlighted ${highlightGroup.highlights.length === 1 ? 'verse' : 'verses'} (${
            highlightGroup.startVerse === highlightGroup.endVerse
              ? `verse ${highlightGroup.startVerse}`
              : `verses ${highlightGroup.startVerse}-${highlightGroup.endVerse}`
          }). To delete a single verse, long-press on the specific verse.`}
        />
      )}
    </Modal>
  );
}

/**
 * Creates all styles for ManualHighlightTooltip component
 */
const createStyles = (colors: ReturnType<typeof getColors>, bottomInset: number) => {
  const styles = StyleSheet.create({
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
      maxHeight: '80%',
      paddingBottom: bottomInset, // Extend into safe area
    },
    contentContainer: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      flexShrink: 1,
    },
    scrollContainer: {
      flexShrink: 1,
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
    },
    infoContainer: {
      marginBottom: spacing.lg,
    },
    infoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
      alignItems: 'center',
    },
    label: {
      fontSize: fontSizes.body,
      color: colors.textSecondary,
      fontWeight: fontWeights.regular,
    },
    value: {
      fontSize: fontSizes.body,
      color: colors.textPrimary,
      fontWeight: fontWeights.medium,
    },
    colorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    colorIndicator: {
      width: 20,
      height: 20,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: colors.border,
    },
    actionsContainer: {
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.xl,
      borderTopWidth: 1,
      borderTopColor: colors.divider,
      backgroundColor: colors.backgroundElevated,
    },
    removeButton: {
      backgroundColor: colors.error,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: 8,
      alignItems: 'center',
    },
    removeButtonText: {
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
      borderColor: colors.border,
    },
    secondaryButtonText: {
      color: colors.textPrimary,
      fontSize: fontSizes.body,
      fontWeight: fontWeights.medium,
    },
    insightContainer: {
      marginBottom: spacing.lg,
      borderTopWidth: 1,
      borderTopColor: colors.divider,
      paddingTop: spacing.md,
      flexShrink: 1,
      minHeight: 0,
    },
    insightToggle: {
      paddingVertical: spacing.sm,
      alignItems: 'center',
      marginBottom: spacing.xs,
    },
    insightToggleText: {
      fontSize: fontSizes.bodySmall,
      color: colors.gold,
      fontWeight: fontWeights.semibold,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    insightContentWrapper: {
      overflow: 'hidden',
      flexShrink: 1,
    },
    insightScroll: {
      backgroundColor: colors.background,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    insightScrollContent: {
      padding: spacing.md,
      paddingBottom: spacing.md,
    },
    loadingContainer: {
      padding: spacing.lg,
      alignItems: 'center',
    },
    emptyInsightContainer: {
      padding: spacing.lg,
      alignItems: 'center',
      backgroundColor: colors.background,
      borderRadius: 8,
    },
    insightEmptyText: {
      fontSize: fontSizes.body,
      color: colors.textSecondary,
      fontStyle: 'italic',
      textAlign: 'center',
    },
  });

  /**
   * Markdown Styles
   */
  const markdownStyles = StyleSheet.create({
    body: {
      fontSize: fontSizes.body,
      lineHeight: fontSizes.body * 1.5,
      color: colors.textPrimary,
    },
    heading1: {
      fontSize: fontSizes.heading3,
      fontWeight: fontWeights.bold,
      color: colors.textPrimary,
      marginBottom: spacing.xs,
      marginTop: spacing.sm,
    },
    heading2: {
      fontSize: fontSizes.heading3,
      fontWeight: fontWeights.semibold,
      color: colors.textPrimary,
      marginBottom: spacing.xs,
      marginTop: spacing.sm,
    },
    paragraph: {
      fontSize: fontSizes.body,
      lineHeight: fontSizes.body * 1.5,
      color: colors.textPrimary,
      marginBottom: spacing.sm,
    },
    strong: {
      fontWeight: fontWeights.bold,
      color: colors.textPrimary,
    },
    em: {
      fontStyle: 'italic',
      color: colors.textPrimary,
    },
    blockquote: {
      backgroundColor: colors.background,
      borderLeftWidth: 4,
      borderLeftColor: colors.gold,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      marginBottom: spacing.sm,
    },
  });

  return { styles, markdownStyles };
};
