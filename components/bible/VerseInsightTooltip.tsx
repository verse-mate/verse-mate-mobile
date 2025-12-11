/**
 * VerseInsightTooltip Component
 *
 * Displays verse insight (by-line explanation) for any Bible verse.
 * Shown when user taps on a plain (non-highlighted) verse.
 *
 * Features:
 * - Bottom sheet modal with slide-up animation
 * - Shows verse reference as title (e.g., "Genesis 1:1")
 * - Displays verse insight (always expanded)
 * - "Save as My Highlight" button -> opens color picker
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
import { fontSizes, fontWeights, type getColors, spacing } from '@/constants/bible-design-tokens';
import { useTheme } from '@/contexts/ThemeContext';
import { useBibleByLine } from '@/src/api/generated/hooks';
import { parseByLineExplanation } from '@/utils/bible/parseByLineExplanation';

interface VerseInsightTooltipProps {
  /** Verse number to display insight for */
  verseNumber: number | null;
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
  /** Callback when user wants to save as highlight (triggers color picker) */
  onSaveAsHighlight: () => void;
  /** Whether user is logged in */
  isLoggedIn: boolean;
}

/**
 * VerseInsightTooltip Component
 *
 * Bottom sheet modal showing verse insight and option to save as highlight.
 */
export function VerseInsightTooltip({
  verseNumber,
  bookId,
  chapterNumber,
  bookName,
  visible,
  onClose,
  onSaveAsHighlight,
  isLoggedIn,
}: VerseInsightTooltipProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { styles, markdownStyles } = useMemo(
    () => createStyles(colors, insets.bottom),
    [colors, insets.bottom]
  );

  // Internal visibility state to keep Modal mounted during exit animation
  const [internalVisible, setInternalVisible] = useState(visible);

  // Get screen height to start modal completely off-screen
  const screenHeight = Dimensions.get('window').height;

  // Animated values
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(screenHeight)).current;

  // Fetch by-line explanation for the chapter
  const { data: byLineData, isLoading: isByLineLoading } = useBibleByLine(
    bookId,
    chapterNumber,
    undefined,
    { enabled: !!verseNumber && visible }
  );

  // Parse the insight for the specific verse
  const insightText = useMemo(() => {
    if (!byLineData?.content || !verseNumber) return null;

    return parseByLineExplanation(byLineData.content, '', chapterNumber, verseNumber, verseNumber);
  }, [byLineData, chapterNumber, verseNumber]);

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

  // Handle save as highlight
  const handleSave = () => {
    animateClose(() => {
      onSaveAsHighlight();
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
        // Only allow downward drag for sliding the whole modal
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

  // Don't render anything if we have no data
  if (!verseNumber && !internalVisible) return null;
  if (!verseNumber) return null;

  // Build verse reference title (e.g., "Genesis 1:1")
  const verseReference = `${bookName} ${chapterNumber}:${verseNumber}`;

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
                {/* Title - Verse Reference */}
                <Text style={styles.title}>{verseReference}</Text>
              </View>

              {/* Insight Section (Always Visible) */}
              <View style={styles.insightContainer}>
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
              </View>
            </View>

            {/* Actions Footer */}
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
                    Sign in to save this verse to your collection
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

/**
 * Creates all styles for VerseInsightTooltip component
 * Returns both component styles and markdown styles in a single factory
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
    actionsContainer: {
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.xl,
      borderTopWidth: 1,
      borderTopColor: colors.divider,
      backgroundColor: colors.backgroundElevated,
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
      flexShrink: 1,
      minHeight: 0,
    },
    insightScroll: {
      backgroundColor: colors.background,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      maxHeight: 400,
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
   * Adapts standard markdown styling for the tooltip context
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
