/**
 * VerseMateTooltip Component
 *
 * Unified tooltip for all verse interactions - replaces ManualHighlightTooltip and VerseInsightTooltip.
 * Displays verse insight with context-aware actions.
 *
 * Features:
 * - Shows verse reference as title
 * - Displays verse insight (expandable with button + swipe gestures)
 * - Single verse: starts expanded
 * - Multi-verse: starts collapsed
 * - Context-aware actions:
 *   - Plain verse → "Save as My Highlight" (opens color picker)
 *   - Highlighted verse → Shows color info + "Remove Highlight" (red)
 * - Swipe up to expand, swipe down to dismiss
 */

import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  Share,
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
import { useBibleVersion } from '@/hooks/use-bible-version';
import { useBibleByLine } from '@/src/api/generated/hooks';
import type { HighlightGroup } from '@/utils/bible/groupConsecutiveHighlights';
import { parseByLineExplanation } from '@/utils/bible/parseByLineExplanation';
import { generateChapterShareUrl } from '@/utils/sharing/generate-chapter-share-url';

interface VerseMateTooltipProps {
  /** Verse number (for plain verses) or null */
  verseNumber: number | null;
  /** Highlight group (for highlighted verses) or null */
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
  /** Callback when user wants to save as highlight (plain verse only) */
  onSaveAsHighlight?: () => void;
  /** Callback to remove highlight group (highlighted verse only) */
  onRemoveHighlight?: (group: HighlightGroup) => void;
  /** Callback when user wants to change highlight color */
  onChangeColor?: (group: HighlightGroup) => void;
  /** Callback when user wants to add a note */
  onAddNote?: () => void;
  /** Callback when verse is copied (for showing toast and closing) */
  onCopy?: () => void;
  /** Verse text for copy/share actions */
  verseText?: string;
  /** Whether user is logged in (for save action) */
  isLoggedIn: boolean;
}

/**
 * VerseMateTooltip Component
 *
 * Unified bottom sheet modal for all verse interactions.
 */
export function VerseMateTooltip({
  verseNumber,
  highlightGroup,
  bookId,
  chapterNumber,
  bookName,
  visible,
  onClose,
  onSaveAsHighlight,
  onRemoveHighlight,
  onChangeColor,
  onAddNote,
  onCopy,
  verseText,
  isLoggedIn,
}: VerseMateTooltipProps) {
  const { colors, mode } = useTheme();
  const { bibleVersion } = useBibleVersion();
  const insets = useSafeAreaInsets();
  const { styles, markdownStyles } = useMemo(
    () => createStyles(colors, insets.bottom),
    [colors, insets.bottom]
  );

  // ... (rest of the component state and hooks)

  // Determine if this is a highlighted verse or plain verse
  const isHighlighted = !!highlightGroup;
  const targetVerseNumber = highlightGroup?.startVerse ?? verseNumber;
  const startVerse = highlightGroup?.startVerse ?? verseNumber ?? 0;
  const endVerse = highlightGroup?.endVerse ?? verseNumber ?? 0;
  const isMultiVerse = startVerse !== endVerse;

  // Internal visibility state to keep Modal mounted during exit animation
  const [internalVisible, setInternalVisible] = useState(visible);

  // State for showing verse insight - start expanded for single verses
  const [expanded, setExpanded] = useState(!isMultiVerse);

  // State for delete confirmation modal
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);

  // Get screen height to start modal completely off-screen
  const screenHeight = Dimensions.get('window').height;

  // Animated values
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(screenHeight)).current;
  const expansionAnim = useRef(new Animated.Value(!isMultiVerse ? 1 : 0)).current; // Start expanded for single verse

  // Fetch by-line explanation for the chapter
  const { data: byLineData, isLoading: isByLineLoading } = useBibleByLine(
    bookId,
    chapterNumber,
    undefined,
    { enabled: !!targetVerseNumber && visible }
  );

  // Parse the insight for the specific verses
  const insightText = useMemo(() => {
    if (!byLineData?.content || !targetVerseNumber) return null;

    return parseByLineExplanation(byLineData.content, '', chapterNumber, startVerse, endVerse);
  }, [byLineData, chapterNumber, startVerse, endVerse, targetVerseNumber]);

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
        setExpanded(!isMultiVerse); // Reset to default state
        expansionAnim.setValue(!isMultiVerse ? 1 : 0);
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
      // Reset expansion state and animation value immediately based on verse count
      const shouldBeExpanded = !isMultiVerse;
      setExpanded(shouldBeExpanded);
      expansionAnim.setValue(shouldBeExpanded ? 1 : 0); // Set immediately without animation
      animateOpen();
    } else if (internalVisible) {
      animateClose();
    }
  }, [visible, animateOpen, animateClose, internalVisible, isMultiVerse, expansionAnim]);

  // Handle explicit dismiss (user action)
  const handleDismiss = () => {
    animateClose(() => {
      onClose();
    });
  };

  // Handle save as highlight (plain verse only)
  const handleSave = () => {
    animateClose(() => {
      onSaveAsHighlight?.();
    });
  };

  // Handle remove button press - show confirmation (highlighted verse only)
  const handleRemove = () => {
    setShowDeleteConfirmation(true);
  };

  // Handle confirmed deletion
  const handleConfirmDelete = () => {
    setShowDeleteConfirmation(false);
    if (!highlightGroup) return;

    animateClose(() => {
      onRemoveHighlight?.(highlightGroup);
    });
  };

  // Build verse reference title
  const verseReference =
    startVerse === endVerse
      ? `${bookName} ${chapterNumber}:${startVerse}`
      : `${bookName} ${chapterNumber}:${startVerse}-${endVerse}`;

  // Helper to get share content
  const getShareContent = () => {
    let content = `"${verseText}"\n\n- ${verseReference} ${bibleVersion}`;

    if (insightText) {
      // Strip markdown syntax for better readability in plain text
      const plainInsight = insightText
        .replace(/\*\*(.*?)\*\*/g, '$1') // Bold
        .replace(/\*(.*?)\*/g, '$1') // Italic
        .replace(/^###\s/gm, '') // H3 headers
        .replace(/^##\s/gm, '') // H2 headers
        .trim();

      content += `\n\nAnalysis:\n${plainInsight}`;
    }

    try {
      const url = generateChapterShareUrl(bookId, chapterNumber);
      content += `\n\n${url}`;
    } catch (_e) {
      // Ignore if URL gen fails (e.g. env var missing)
    }

    return content;
  };

  // Handle copy verse
  const handleCopy = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!verseText) return;

    const payload = getShareContent();
    await Clipboard.setStringAsync(payload);

    // Close modal and trigger callback (for showing toast)
    animateClose(() => {
      onCopy?.();
    });
  };

  // Handle share verse
  const handleShare = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!verseText) return;

    const message = getShareContent();

    // For iOS, providing url separately might trigger rich link preview better in some apps
    // But message often takes precedence.
    let url: string | undefined;
    try {
      url = generateChapterShareUrl(bookId, chapterNumber);
    } catch {}

    await Share.share({
      message,
      url, // iOS only
      title: `${verseReference} ${bibleVersion}`, // Android dialog title
    });
    // Don't dismiss - user might want to do more actions
  };

  // Handle change color (highlighted verses only)
  const handleChangeColor = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!highlightGroup) return;

    animateClose(() => {
      onChangeColor?.(highlightGroup);
    });
  };

  // Handle add note
  const handleAddNote = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    animateClose(() => {
      onAddNote?.();
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
  if (!targetVerseNumber && !internalVisible) return null;
  if (!targetVerseNumber) return null;

  // Interpolate values for expansion animation
  const insightMaxHeight = expansionAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 400],
  });

  const insightOpacity = expansionAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0, 1],
  });

  // Get color for display (highlighted verses only)
  const highlightColorHex = highlightGroup
    ? getHighlightColor(highlightGroup.color, mode)
    : undefined;

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
            <Text style={styles.verseMateHeader}>Verse Insight</Text>
          </View>

          {/* Content */}
          <View style={styles.contentContainer}>
            <View style={styles.scrollContainer}>
              <View {...panResponder.panHandlers}>
                {/* Title with optional color indicator */}
                <View style={styles.titleRow}>
                  <Text style={styles.title}>{verseReference}</Text>
                  {isHighlighted && highlightGroup && onChangeColor && (
                    <Pressable style={styles.colorBadge} onPress={handleChangeColor}>
                      <View
                        style={[styles.colorIndicator, { backgroundColor: highlightColorHex }]}
                      />
                      <Text style={styles.colorText}>
                        {highlightGroup.color.charAt(0).toUpperCase() +
                          highlightGroup.color.slice(1)}
                      </Text>
                    </Pressable>
                  )}
                </View>

                {/* Verse Text (Single verse only) */}
                {verseText && !isMultiVerse && (
                  <Text style={styles.verseText}>{`"${verseText}"`}</Text>
                )}
              </View>

              {/* Insight Section (Always Expandable) */}
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
                        No specific insight available for{' '}
                        {isMultiVerse ? 'these verses' : 'this verse'}.
                      </Text>
                    </View>
                  )}
                </Animated.View>
              </View>
            </View>

            {/* Actions Footer - Context-aware */}
            <View style={styles.actionsContainer}>
              {/* Action Buttons Row - Always visible */}
              <View style={styles.actionButtonsRow}>
                <Pressable style={styles.actionButton} onPress={handleCopy}>
                  <Ionicons name="copy-outline" size={20} color={colors.textPrimary} />
                  <Text style={styles.actionButtonText}>Copy</Text>
                </Pressable>

                <Pressable style={styles.actionButton} onPress={handleShare}>
                  <Ionicons name="share-outline" size={20} color={colors.textPrimary} />
                  <Text style={styles.actionButtonText}>Share</Text>
                </Pressable>

                {isHighlighted && onChangeColor && (
                  <Pressable style={styles.actionButton} onPress={handleChangeColor}>
                    <Ionicons name="color-palette-outline" size={20} color={colors.textPrimary} />
                    <Text style={styles.actionButtonText}>Color</Text>
                  </Pressable>
                )}

                {onAddNote && (
                  <Pressable style={styles.actionButton} onPress={handleAddNote}>
                    <Ionicons name="create-outline" size={20} color={colors.textPrimary} />
                    <Text style={styles.actionButtonText}>Note</Text>
                  </Pressable>
                )}
              </View>

              {/* Primary Action - Context-aware */}
              {isHighlighted ? (
                // Highlighted verse - show remove button
                <Pressable style={styles.removeButton} onPress={handleRemove}>
                  <Ionicons name="trash-outline" size={20} color={colors.white} />
                  <Text style={styles.removeButtonText}>Remove Highlight</Text>
                </Pressable>
              ) : isLoggedIn ? (
                // Plain verse - show save button
                <Pressable style={styles.primaryButton} onPress={handleSave}>
                  <Ionicons name="bookmark-outline" size={20} color={colors.background} />
                  <Text style={styles.primaryButtonText}>Save as My Highlight</Text>
                </Pressable>
              ) : (
                // Plain verse - not logged in
                <View style={styles.loginPrompt}>
                  <Text style={styles.loginPromptText}>
                    Sign in to save this verse to your collection
                  </Text>
                </View>
              )}

              {/* Cancel Button */}
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
          message={`This will delete ${highlightGroup.highlights.length} highlighted ${
            highlightGroup.highlights.length === 1 ? 'verse' : 'verses'
          } (${
            startVerse === endVerse ? `verse ${startVerse}` : `verses ${startVerse}-${endVerse}`
          }). To delete a single verse, long-press on the specific verse.`}
        />
      )}
    </Modal>
  );
}

/**
 * Creates all styles for VerseMateTooltip component
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
      paddingBottom: Platform.OS === 'android' ? spacing.xs : bottomInset, // Minimal on Android, safe area on iOS
    },
    contentContainer: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.xs,
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
    verseMateHeader: {
      fontSize: fontSizes.heading3,
      fontWeight: fontWeights.medium,
      color: colors.gold,
      letterSpacing: 0.5,
      marginTop: spacing.sm,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
      gap: spacing.sm,
    },
    title: {
      fontSize: fontSizes.heading3,
      fontWeight: fontWeights.medium,
      color: colors.textPrimary,
      flex: 1,
    },
    verseText: {
      fontSize: fontSizes.body,
      fontStyle: 'italic',
      color: colors.textSecondary,
      marginTop: spacing.xs,
      marginBottom: spacing.sm,
      lineHeight: fontSizes.body * 1.5,
    },
    colorBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      backgroundColor: colors.background,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: colors.border,
    },
    colorText: {
      fontSize: fontSizes.bodySmall,
      color: colors.textPrimary,
      fontWeight: fontWeights.medium,
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
      paddingTop: spacing.lg,
      paddingBottom: spacing.md,
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
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.xs,
      borderRadius: 8,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 4,
      minHeight: 64,
    },
    actionButtonText: {
      fontSize: fontSizes.bodySmall,
      color: colors.textPrimary,
      fontWeight: fontWeights.medium,
      textAlign: 'center',
    },
    primaryButton: {
      backgroundColor: colors.gold,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: 8,
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'center',
      gap: spacing.xs,
    },
    primaryButtonText: {
      color: colors.background,
      fontSize: fontSizes.body,
      fontWeight: fontWeights.semibold,
    },
    removeButton: {
      backgroundColor: colors.error,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: 8,
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'center',
      gap: spacing.xs,
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
      marginBottom: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.divider,
      paddingTop: spacing.md,
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
