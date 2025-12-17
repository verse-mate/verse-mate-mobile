/**
 * AutoHighlightTooltip Component
 *
 * Displays information about an AI-generated auto-highlight.
 * Shows theme name, relevance score, and option to save as user highlight.
 *
 * Shown as a bottom sheet modal when user taps on an auto-highlighted verse.
 *
 * @see Task 4.7 - Analytics tracking for AUTO_HIGHLIGHT_TOOLTIP_VIEWED
 */

import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
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
  Share,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Markdown from 'react-native-markdown-display';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fontSizes, fontWeights, type getColors, spacing } from '@/constants/bible-design-tokens';
import type { HighlightColor } from '@/constants/highlight-colors';
import { getHighlightColor } from '@/constants/highlight-colors';
import { useTheme } from '@/contexts/ThemeContext';
import { useDeviceInfo } from '@/hooks/use-device-info';
import { AnalyticsEvent, analytics } from '@/lib/analytics';
import { useBibleByLine } from '@/src/api';
import type { AutoHighlight } from '@/types/auto-highlights';
import {
  extractVerseTextFromByLine,
  parseByLineExplanation,
} from '@/utils/bible/parseByLineExplanation';

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
    verseRange: { start: number; end: number },
    selectedText?: string
  ) => void;
  /** Callback when save is successful */
  onSaveSuccess?: () => void;
  /** Callback when verse is copied */
  onCopy?: () => void;
  /** Callback when note button is pressed */
  onAddNote?: () => void;
  /** Book name for verse reference */
  bookName?: string;
  /** Whether user is logged in */
  isLoggedIn: boolean;
  /** Whether to use a system Modal (true) or a View overlay (false) */
  useModal?: boolean;
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
  onSaveSuccess,
  onCopy,
  onAddNote,
  bookName,
  isLoggedIn,
  useModal = true,
}: AutoHighlightTooltipProps) {
  const { colors, mode } = useTheme();
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

  const { styles, markdownStyles } = useMemo(
    () => createStyles(colors, insets.bottom, isTablet, tooltipWidth),
    [colors, insets.bottom, isTablet, tooltipWidth]
  );

  // Determine if this is a multi-verse highlight
  const isMultiVerse = autoHighlight
    ? autoHighlight.start_verse !== autoHighlight.end_verse
    : false;

  // Internal visibility state to keep Modal mounted during exit animation
  const [internalVisible, setInternalVisible] = useState(visible);

  // State for showing verse insight (expanded view) - start expanded for single verses
  const [expanded, setExpanded] = useState(!isMultiVerse);

  // Ref to track if analytics event has been fired for this tooltip open
  const hasTrackedOpen = useRef(false);

  // Get screen height to start modal completely off-screen
  const screenHeight = Dimensions.get('window').height;

  // Animated values
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(screenHeight)).current;
  const expansionAnim = useRef(new Animated.Value(!isMultiVerse ? 1 : 0)).current; // 0: collapsed, 1: expanded

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
        setExpanded(!isMultiVerse); // Reset expansion state
        expansionAnim.setValue(!isMultiVerse ? 1 : 0);
        hasTrackedOpen.current = false; // Reset tracking flag
        if (callback) callback();
      }, 150);
    },
    [backdropOpacity, slideAnim, screenHeight, expansionAnim, isMultiVerse]
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
      // Reset expansion state based on multi-verse status
      const shouldBeExpanded = !isMultiVerse;
      setExpanded(shouldBeExpanded);
      expansionAnim.setValue(shouldBeExpanded ? 1 : 0);
      animateOpen();

      // Track analytics: AUTO_HIGHLIGHT_TOOLTIP_VIEWED (Task 4.7)
      // Only track once per tooltip open, not on re-renders
      if (!hasTrackedOpen.current && autoHighlight) {
        hasTrackedOpen.current = true;
        analytics.track(AnalyticsEvent.AUTO_HIGHLIGHT_TOOLTIP_VIEWED, {
          bookId: autoHighlight.book_id,
          chapterNumber: autoHighlight.chapter_number,
        });
      }
    } else if (internalVisible) {
      animateClose();
    }
  }, [
    visible,
    animateOpen,
    animateClose,
    internalVisible,
    isMultiVerse,
    expansionAnim,
    autoHighlight,
  ]);

  // Handle explicit dismiss (user action)
  const handleDismiss = useCallback(() => {
    animateClose(() => {
      onClose();
    });
  }, [animateClose, onClose]);

  // Auto-close tooltip when switching to insight-only screen (right-full mode)
  // Tooltips are supported in split view and full Bible screen, but not in insight-only
  useEffect(() => {
    if (visible && splitViewMode === 'right-full') {
      handleDismiss();
    }
  }, [visible, splitViewMode, handleDismiss]);

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

  // Build verse reference
  const verseReference =
    autoHighlight.start_verse === autoHighlight.end_verse
      ? `${bookName || 'Bible'} ${autoHighlight.chapter_number}:${autoHighlight.start_verse}`
      : `${bookName || 'Bible'} ${autoHighlight.chapter_number}:${autoHighlight.start_verse}-${autoHighlight.end_verse}`;

  // Handle copy verse
  const handleCopy = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const verseText = byLineData?.content
      ? extractVerseTextFromByLine(
          byLineData.content,
          autoHighlight.chapter_number,
          autoHighlight.start_verse,
          autoHighlight.end_verse
        )
      : undefined;

    if (!verseText) return;

    let payload = `"${verseText}"\\n\\n- ${verseReference}`;

    if (insightText) {
      // Strip markdown syntax for better readability in plain text
      const plainInsight = insightText
        .replace(/\*\*(.*?)\*\*/g, '$1') // Bold
        .replace(/\*(.*?)\*/g, '$1') // Italic
        .replace(/^###\s/gm, '') // H3 headers
        .replace(/^##\s/gm, '') // H2 headers
        .trim();

      payload += `\n\nAnalysis:\n${plainInsight}`;
    }

    await Clipboard.setStringAsync(payload);

    // Close modal and trigger callback
    animateClose(() => {
      onCopy?.();
    });
  };

  // Handle share verse
  const handleShare = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const verseText = byLineData?.content
      ? extractVerseTextFromByLine(
          byLineData.content,
          autoHighlight.chapter_number,
          autoHighlight.start_verse,
          autoHighlight.end_verse
        )
      : undefined;

    if (!verseText) return;

    let message = `"${verseText}"\n\n- ${verseReference}`;

    if (insightText) {
      // Strip markdown syntax for better readability in plain text share
      const plainInsight = insightText
        .replace(/\*\*(.*?)\*\*/g, '$1') // Bold
        .replace(/\*(.*?)\*/g, '$1') // Italic
        .replace(/^###\s/gm, '') // H3 headers
        .replace(/^##\s/gm, '') // H2 headers
        .trim();

      message += `\n\nAnalysis:\n${plainInsight}`;
    }

    await Share.share({
      message,
    });
  };

  // Handle add note
  const handleAddNote = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    animateClose(() => {
      onAddNote?.();
    });
  };

  const handleSave = () => {
    if (!isLoggedIn) {
      Alert.alert('Sign In Required', 'Please sign in to save highlights to your collection.', [
        { text: 'OK' },
      ]);
      return;
    }

    // Extract verse text for the highlight
    const verseText =
      byLineData?.content && autoHighlight
        ? extractVerseTextFromByLine(
            byLineData.content,
            autoHighlight.chapter_number,
            autoHighlight.start_verse,
            autoHighlight.end_verse
          )
        : undefined;

    onSaveAsUserHighlight(
      autoHighlight.theme_color,
      {
        start: autoHighlight.start_verse,
        end: autoHighlight.end_verse, // Use end_verse for multi-verse highlights
      },
      verseText || undefined
    );
    onSaveSuccess?.();
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

  const content = (
    <View style={styles.overlay} pointerEvents="box-none">
      {/* Animated Backdrop - Absolute positioned behind content */}
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
          <Text style={styles.verseMateHeader}>Verse Insight</Text>
        </View>

        {/* Content */}
        <View style={styles.contentContainer}>
          <View style={styles.scrollContainer}>
            <View {...panResponder.panHandlers}>
              {/* Title with optional color indicator */}
              <View style={styles.titleRow}>
                <Text style={styles.title}>{autoHighlight.theme_name}</Text>
                {autoHighlight && (
                  <View style={styles.colorBadge}>
                    <View
                      style={[
                        styles.colorIndicator,
                        { backgroundColor: getHighlightColor(autoHighlight.theme_color, mode) },
                      ]}
                    />
                    <Text style={styles.colorText}>
                      {autoHighlight.theme_color.charAt(0).toUpperCase() +
                        autoHighlight.theme_color.slice(1)}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.infoContainer}>
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
              {isMultiVerse && (
                <Pressable
                  style={[styles.insightToggle, expanded && { marginBottom: spacing.md }]}
                  onPress={() => setExpanded(!expanded)}
                  hitSlop={10}
                  {...panResponder.panHandlers}
                >
                  <Ionicons
                    name={expanded ? 'chevron-down' : 'chevron-up'}
                    size={16}
                    color={colors.gold}
                    style={{ marginRight: spacing.xs }}
                  />
                  <Text style={styles.insightToggleText}>
                    {expanded ? 'Hide Verse Insight' : 'View Verse Insight'}
                  </Text>
                </Pressable>
              )}

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
                  <>
                    <Text style={styles.analysisTitle}>Analysis</Text>
                    <ScrollView
                      style={styles.insightScroll}
                      contentContainerStyle={styles.insightScrollContent}
                      showsVerticalScrollIndicator={false}
                    >
                      <Markdown style={markdownStyles}>{insightText}</Markdown>
                    </ScrollView>
                  </>
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
          <View style={styles.actionsContainer}>
            {/* Action Buttons Row */}
            <View style={styles.actionButtonsRow}>
              <Pressable style={styles.actionButton} onPress={handleCopy}>
                <Ionicons name="copy-outline" size={20} color={colors.textPrimary} />
                <Text style={styles.actionButtonText}>Copy</Text>
              </Pressable>

              <Pressable style={styles.actionButton} onPress={handleShare}>
                <Ionicons name="share-outline" size={20} color={colors.textPrimary} />
                <Text style={styles.actionButtonText}>Share</Text>
              </Pressable>

              {onAddNote && (
                <Pressable style={styles.actionButton} onPress={handleAddNote}>
                  <Ionicons name="create-outline" size={20} color={colors.textPrimary} />
                  <Text style={styles.actionButtonText}>Note</Text>
                </Pressable>
              )}
            </View>

            {isLoggedIn ? (
              <>
                <Pressable style={styles.primaryButton} onPress={handleSave}>
                  <Ionicons
                    name="bookmark-outline"
                    size={20}
                    color={colors.background}
                    style={{ marginRight: spacing.xs }}
                  />
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

  // Non-modal rendering (Overlay)
  if (!internalVisible) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {content}
    </View>
  );
}

/**
 * Creates all styles for AutoHighlightTooltip component
 * Returns both component styles and markdown styles in a single factory
 */
const createStyles = (
  colors: ReturnType<typeof getColors>,
  bottomInset: number,
  _isTablet: boolean,
  tooltipWidth?: number
) => {
  const styles = StyleSheet.create({
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
      paddingBottom: bottomInset > 0 ? bottomInset : spacing.md,
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
    verseMateHeader: {
      fontSize: fontSizes.heading3,
      fontWeight: fontWeights.medium,
      color: colors.gold,
      letterSpacing: 0.5,
      marginTop: spacing.sm,
    },
    title: {
      fontSize: fontSizes.heading2,
      fontWeight: fontWeights.semibold,
      color: colors.textPrimary,
      marginBottom: spacing.sm,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
      gap: spacing.sm,
    },
    infoContainer: {
      marginBottom: 0,
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
    colorBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: 0,
      paddingVertical: 0,
      backgroundColor: 'transparent',
      borderRadius: 0,
      borderWidth: 0,
      borderColor: 'transparent',
    },
    colorIndicator: {
      width: 16,
      height: 16,
      borderRadius: 3,
      borderWidth: 1,
      borderColor: colors.border,
    },
    colorText: {
      fontSize: fontSizes.bodySmall,
      color: colors.textPrimary,
      fontWeight: fontWeights.medium,
    },
    actionsContainer: {
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: bottomInset > 0 ? bottomInset + spacing.sm : spacing.xl,
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
      gap: spacing.xs,
      paddingVertical: spacing.sm,
      borderRadius: 8,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    actionButtonText: {
      fontSize: fontSizes.caption,
      color: colors.textPrimary,
      fontWeight: fontWeights.medium,
    },
    primaryButton: {
      flexDirection: 'row',
      backgroundColor: colors.gold,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
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
      paddingTop: spacing.lg,
      flexShrink: 1,
      minHeight: 0,
    },
    insightToggle: {
      flexDirection: 'row',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 6,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: 'transparent',
    },
    insightToggleText: {
      fontSize: fontSizes.bodySmall,
      color: colors.gold,
      fontWeight: fontWeights.semibold,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    analysisTitle: {
      fontSize: fontSizes.heading3,
      fontWeight: fontWeights.semibold,
      color: colors.textPrimary,
      marginBottom: spacing.sm,
      marginTop: spacing.xs,
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
  const markdownStyles = StyleSheet.create({
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

  return { styles, markdownStyles };
};
