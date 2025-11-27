/**
 * AutoHighlightTooltip Component
 *
 * Displays information about an AI-generated auto-highlight.
 * Shows theme name, relevance score, and option to save as user highlight.
 *
 * Shown as a bottom sheet modal when user taps on an auto-highlighted verse.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { fontSizes, fontWeights, type getColors, spacing } from '@/constants/bible-design-tokens';
import type { HighlightColor } from '@/constants/highlight-colors';
import { useTheme } from '@/contexts/ThemeContext';
import { useBibleByLine } from '@/src/api/generated/hooks';
import type { AutoHighlight } from '@/types/auto-highlights';
import { parseByLineExplanation } from '@/utils/bible/parseByLineExplanation';

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
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const markdownStyles = useMemo(() => createMarkdownStyles(colors), [colors]);

  // Internal visibility state to keep Modal mounted during exit animation
  const [internalVisible, setInternalVisible] = useState(visible);

  // State for showing verse insight (expanded view)
  const [expanded, setExpanded] = useState(false);

  // Get screen height to start modal completely off-screen
  const screenHeight = Dimensions.get('window').height;

  // Animated values
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(screenHeight)).current;
  const expansionAnim = useRef(new Animated.Value(0)).current; // 0: collapsed, 1: expanded

  // Fetch by-line explanation for the chapter
  const { data: byLineData, isLoading: isByLineLoading } = useBibleByLine(
    autoHighlight?.book_id || 0,
    autoHighlight?.chapter_number || 0,
    undefined,
    { enabled: !!autoHighlight && visible }
  );

  // Parse the insight for the specific verses
  const insightText = useMemo(() => {
    if (!byLineData?.content || !autoHighlight) return null;

    return parseByLineExplanation(
      byLineData.content,
      '',
      autoHighlight.chapter_number,
      autoHighlight.start_verse,
      autoHighlight.end_verse
    );
  }, [byLineData, autoHighlight]);

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
      // This ensures the modal unmounts deterministically, fixing the double-click bug
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

  // Don't render anything if we have no data (unless animating out, handled by internalVisible/Modal)
  if (!autoHighlight && !internalVisible) return null;
  if (!autoHighlight) return null;

  const handleSave = () => {
    if (!isLoggedIn) {
      Alert.alert('Sign In Required', 'Please sign in to save highlights to your collection.', [
        { text: 'OK' },
      ]);
      return;
    }
    onSaveAsUserHighlight(autoHighlight.theme_color, {
      start: autoHighlight.start_verse,
      end: autoHighlight.end_verse, // Use end_verse for multi-verse highlights
    });
    handleDismiss();
  };

  // Interpolate values for expansion animation
  const insightMaxHeight = expansionAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 400], // Expand to a reasonable max height
  });

  const insightOpacity = expansionAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0, 1],
  });

  return (
    <Modal
      visible={internalVisible}
      transparent
      animationType="none"
      onRequestClose={handleDismiss}
    >
      {/* Main Container - positions content at bottom */}
      <View style={styles.overlay}>
        {/* Animated Backdrop - Absolute positioned behind content */}
        <Animated.View
          style={[styles.backdrop, { opacity: backdropOpacity }]}
          {...panResponder.panHandlers}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={handleDismiss} />
        </Animated.View>

        {/* Animated Modal Content */}
        <Animated.View style={[styles.container, { transform: [{ translateY: slideAnim }] }]}>
          {/* Header with pan responder for swipe */}
          <View style={styles.header} {...panResponder.panHandlers}>
            <View style={styles.handle} />
          </View>

          {/* Content */}
          <View style={styles.contentContainer}>
            <View style={styles.scrollContainer}>
              <View {...panResponder.panHandlers}>
                {/* Title */}
                <Text style={styles.title}>{autoHighlight.theme_name}</Text>

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
                        No specific insight available for this verse.
                      </Text>
                    </View>
                  )}
                </Animated.View>
              </View>
            </View>

            {/* Actions Footer */}
            <View style={styles.actionsContainer} {...panResponder.panHandlers}>
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
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: ReturnType<typeof getColors>) =>
  StyleSheet.create({
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
    },
    contentContainer: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      flexShrink: 1, // Ensure container shrinks if max height is reached
    },
    scrollContainer: {
      flexShrink: 1, // Allow ScrollView to shrink to accommodate footer
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
    actionsContainer: {
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.xl, // Bottom padding for safe area/aesthetics
      borderTopWidth: 1,
      borderTopColor: colors.divider, // Optional separator
      backgroundColor: colors.backgroundElevated, // Ensure opaque background
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
    loginPrompt: {
      padding: spacing.lg,
      backgroundColor: colors.background,
      borderRadius: 8,
      alignItems: 'center',
    },
    loginPromptText: {
      fontSize: fontSizes.body,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    insightContainer: {
      marginBottom: spacing.lg,
      borderTopWidth: 1,
      borderTopColor: colors.divider,
      paddingTop: spacing.md,
      flexShrink: 1, // Allow container to shrink
      minHeight: 0, // Necessary for flex shrink to work in some cases
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
      flexShrink: 1, // Allow wrapper to shrink
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
 * Adapts standard markdown styling for the tooltip context (smaller fonts)
 */
const createMarkdownStyles = (colors: ReturnType<typeof getColors>) =>
  StyleSheet.create({
    body: {
      fontSize: fontSizes.body, // 16px
      lineHeight: fontSizes.body * 1.5,
      color: colors.textPrimary,
    },
    heading1: {
      fontSize: fontSizes.heading3, // Smaller than main view
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
