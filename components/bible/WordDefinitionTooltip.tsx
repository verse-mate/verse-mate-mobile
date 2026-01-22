/**
 * WordDefinitionTooltip Component
 *
 * Bottom sheet modal for displaying word definitions on long press.
 * Styled similarly to VerseMateTooltip but shows dictionary content.
 *
 * Features:
 * - Shows word definition from Strong's Concordance
 * - Strong's number badge (if applicable)
 * - Original word (Lemma) display
 * - Definition in scrollable container
 * - Derivation and KJV translation (if available)
 * - Copy and Share buttons for the definition
 * - "Open in System Dictionary" button
 * - Swipe-down to dismiss
 */

import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useRef, useState } from 'react';
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
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fontSizes, fontWeights, type getColors, spacing } from '@/constants/bible-design-tokens';
import { useTheme } from '@/contexts/ThemeContext';
import { useBibleVersion } from '@/hooks/use-bible-version';
import { useDeviceInfo } from '@/hooks/use-device-info';
import { useNativeDictionary } from '@/hooks/use-native-dictionary';
import { isValidStrongsNumber, lookup } from '@/services/lexicon-service';
import { getStrongsNumber, hasStrongsNumber } from '@/services/word-mapping-service';
import type { StrongsEntry } from '@/types/dictionary';

interface WordDefinitionTooltipProps {
  /** Whether modal is visible */
  visible: boolean;
  /** Word to look up */
  word: string;
  /** Book name for copy/share reference */
  bookName: string;
  /** Chapter number for copy/share reference */
  chapterNumber: number;
  /** Verse number for copy/share reference */
  verseNumber: number;
  /** Callback to close modal */
  onClose: () => void;
  /** Callback when word is copied (for showing toast) */
  onCopy?: () => void;
  /** Whether to use a system Modal (true) or a View overlay (false) */
  useModal?: boolean;
}

interface DefinitionState {
  loading: boolean;
  strongsEntry: StrongsEntry | null;
  strongsNum: string | null;
  hasNative: boolean;
  error: string | null;
}

/**
 * WordDefinitionTooltip Component
 *
 * Bottom sheet modal for word definitions with dictionary content.
 */
export function WordDefinitionTooltip({
  visible,
  word,
  bookName,
  chapterNumber,
  verseNumber,
  onClose,
  onCopy,
  useModal = true,
}: WordDefinitionTooltipProps) {
  const { colors } = useTheme();
  const { bibleVersion } = useBibleVersion();
  const insets = useSafeAreaInsets();
  const { isTablet, useSplitView, splitRatio, splitViewMode } = useDeviceInfo();
  const { width: windowWidth } = useWindowDimensions();
  const { showDefinition, hasDefinition, isAvailable: nativeAvailable } = useNativeDictionary();

  // Calculate dynamic width for tooltip positioning
  const tooltipWidth =
    useSplitView && splitViewMode !== 'left-full'
      ? windowWidth * (1 - splitRatio)
      : isTablet
        ? windowWidth * 0.5
        : undefined;

  const styles = useMemo(
    () => createStyles(colors, insets.bottom, tooltipWidth),
    [colors, insets.bottom, tooltipWidth]
  );

  // Internal visibility state to keep Modal mounted during exit animation
  const [internalVisible, setInternalVisible] = useState(visible);

  // Definition state
  const [state, setState] = useState<DefinitionState>({
    loading: true,
    strongsEntry: null,
    strongsNum: null,
    hasNative: false,
    error: null,
  });

  // Get screen height to start modal completely off-screen
  const screenHeight = Dimensions.get('window').height;

  // Animated values
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(screenHeight)).current;

  // Ref to store close timeout for cleanup
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  /**
   * Fetch definition data when word changes
   */
  useEffect(() => {
    if (!visible || !word) return;

    const fetchDefinitions = async () => {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        // Determine Strong's number to look up
        let strongsNum: string | null = null;

        // Check word mapping
        if (hasStrongsNumber(word)) {
          strongsNum = getStrongsNumber(word);
        }

        // If word looks like a Strong's number itself (e.g., "G26", "H430")
        if (!strongsNum && isValidStrongsNumber(word)) {
          strongsNum = word.toUpperCase();
        }

        // Look up Strong's entry if we have a number
        let strongsEntry: StrongsEntry | null = null;
        if (strongsNum) {
          const result = await lookup(strongsNum);
          if (result.found && result.entry) {
            strongsEntry = result.entry;
          }
        }

        // Check native dictionary availability
        let hasNative = false;
        if (nativeAvailable) {
          hasNative = await hasDefinition(word);
        }

        setState({
          loading: false,
          strongsEntry,
          strongsNum,
          hasNative,
          error: !strongsEntry && !hasNative ? 'No definition available' : null,
        });
      } catch {
        setState({
          loading: false,
          strongsEntry: null,
          strongsNum: null,
          hasNative: false,
          error: 'Failed to load definition',
        });
      }
    };

    fetchDefinitions();
  }, [visible, word, nativeAvailable, hasDefinition]);

  // Helper to animate open
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

  // Helper to animate close
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

    // Force cleanup after 150ms (store ref for cleanup on unmount)
    closeTimeoutRef.current = setTimeout(() => {
      setInternalVisible(false);
      if (callback) callback();
    }, 150);
  };

  // Watch for prop changes to trigger animations
  useEffect(() => {
    if (visible) {
      animateOpen();
    } else if (internalVisible) {
      animateClose();
    }
    // biome-ignore lint/correctness/useExhaustiveDependencies: React Compiler handles memoization of animateOpen/animateClose
  }, [visible, animateOpen, animateClose, internalVisible]);

  // Handle explicit dismiss (user action)
  const handleDismiss = () => {
    animateClose(() => {
      onClose();
    });
  };

  // Auto-close tooltip when switching to insight-only screen
  useEffect(() => {
    if (visible && splitViewMode === 'right-full') {
      handleDismiss();
    }
    // biome-ignore lint/correctness/useExhaustiveDependencies: React Compiler handles memoization of handleDismiss
  }, [visible, splitViewMode, handleDismiss]);

  /**
   * Clean up word for display (capitalize first letter)
   */
  const displayWord = word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();

  /**
   * Get verse reference
   */
  const verseReference = `${bookName} ${chapterNumber}:${verseNumber}`;

  /**
   * Build content for copy/share
   */
  const getShareContent = () => {
    let content = `"${displayWord}"`;

    if (state.strongsNum && state.strongsEntry?.lemma) {
      content += ` (${state.strongsNum} - ${state.strongsEntry.lemma})`;
    }

    if (state.strongsEntry?.definition) {
      content += `\nDefinition: ${state.strongsEntry.definition}`;
    }

    content += `\n\n- ${verseReference} (${bibleVersion})`;

    return content;
  };

  // Handle copy
  const handleCopy = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const payload = getShareContent();
    await Clipboard.setStringAsync(payload);

    animateClose(() => {
      onCopy?.();
    });
  };

  // Handle share
  const handleShare = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const message = getShareContent();

    await Share.share({
      message,
      title: `${displayWord} - Word Definition`,
    });
  };

  // Handle open native dictionary
  const handleOpenNative = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await showDefinition(word);
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
        if (gestureState.dy > 0) {
          slideAnim.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 70) {
          dismissRef.current();
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

  // Don't render if no word
  if (!word) return null;

  const content = (
    <View style={styles.overlay} pointerEvents="box-none">
      {/* Animated Backdrop */}
      <Animated.View
        style={[
          styles.backdrop,
          { opacity: backdropOpacity },
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
        testID="word-definition-tooltip"
      >
        {/* Header with pan responder for swipe */}
        <View style={styles.header} {...panResponder.panHandlers}>
          <View style={styles.handle} />
          <Text style={styles.headerTitle}>Word Definition</Text>
        </View>

        {/* Content */}
        <View style={styles.contentContainer}>
          <View style={styles.scrollContainer}>
            {/* Loading State */}
            {state.loading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.gold} />
                <Text style={styles.loadingText}>Looking up definition...</Text>
              </View>
            )}

            {/* Error State */}
            {!state.loading && state.error && !state.strongsEntry && !state.hasNative && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle-outline" size={48} color={colors.textSecondary} />
                <Text style={styles.errorText}>{state.error}</Text>
              </View>
            )}

            {/* Definition Content */}
            {!state.loading && (state.strongsEntry || state.hasNative) && (
              <View {...panResponder.panHandlers}>
                {/* Word Title */}
                <Text style={styles.wordTitle}>{displayWord}</Text>

                {/* Strong's Definition */}
                {state.strongsEntry && (
                  <>
                    {/* Strong's Number Badge */}
                    {state.strongsNum && (
                      <View style={styles.strongsBadge}>
                        <Text style={styles.strongsBadgeText}>{state.strongsNum}</Text>
                      </View>
                    )}

                    {/* Original Word (Lemma) */}
                    <Text style={styles.lemmaText}>{state.strongsEntry.lemma}</Text>

                    {/* Definition */}
                    <ScrollView
                      style={styles.definitionScroll}
                      contentContainerStyle={styles.definitionScrollContent}
                      showsVerticalScrollIndicator={false}
                    >
                      <View style={styles.definitionBox}>
                        <Text style={styles.definitionText}>{state.strongsEntry.definition}</Text>
                      </View>

                      {/* Derivation */}
                      {state.strongsEntry.derivation && (
                        <View style={styles.derivationContainer}>
                          <Text style={styles.derivationLabel}>Derivation:</Text>
                          <Text style={styles.derivationText}>{state.strongsEntry.derivation}</Text>
                        </View>
                      )}

                      {/* KJV Translation */}
                      {state.strongsEntry.kjvTranslation && (
                        <View style={styles.kjvContainer}>
                          <Text style={styles.kjvLabel}>KJV:</Text>
                          <Text style={styles.kjvText}>{state.strongsEntry.kjvTranslation}</Text>
                        </View>
                      )}
                    </ScrollView>
                  </>
                )}

                {/* Verse Reference */}
                <Text style={styles.verseReference}>{verseReference}</Text>
              </View>
            )}
          </View>

          {/* Actions Footer */}
          <View style={styles.actionsContainer}>
            {/* Action Buttons Row */}
            <View style={styles.actionButtonsRow}>
              <Pressable
                style={styles.actionButton}
                onPress={handleCopy}
                testID="word-definition-copy-button"
                accessibilityRole="button"
                accessibilityLabel="Copy definition"
              >
                <Ionicons name="copy-outline" size={20} color={colors.textPrimary} />
                <Text style={styles.actionButtonText}>Copy</Text>
              </Pressable>

              <Pressable
                style={styles.actionButton}
                onPress={handleShare}
                testID="word-definition-share-button"
                accessibilityRole="button"
                accessibilityLabel="Share definition"
              >
                <Ionicons name="share-outline" size={20} color={colors.textPrimary} />
                <Text style={styles.actionButtonText}>Share</Text>
              </Pressable>
            </View>

            {/* Open in System Dictionary Button */}
            {state.hasNative && (
              <Pressable
                style={[
                  styles.secondaryButton,
                  { flexDirection: 'row', gap: spacing.xs, justifyContent: 'center' },
                ]}
                onPress={handleOpenNative}
                testID="word-definition-native-button"
                accessibilityRole="button"
                accessibilityLabel={`Open in ${Platform.OS === 'ios' ? 'iOS' : 'System'} Dictionary`}
              >
                <Ionicons name="book-outline" size={20} color={colors.textPrimary} />
                <Text style={styles.secondaryButtonText}>
                  Open in {Platform.OS === 'ios' ? 'iOS' : 'System'} Dictionary
                </Text>
              </Pressable>
            )}

            {/* Cancel Button */}
            <Pressable
              style={styles.secondaryButton}
              onPress={handleDismiss}
              testID="word-definition-cancel-button"
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
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

  // Non-modal rendering (Overlay)
  if (!internalVisible) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {content}
    </View>
  );
}

/**
 * Creates all styles for WordDefinitionTooltip component
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
      paddingBottom: bottomInset > 0 ? bottomInset : spacing.md,
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
    headerTitle: {
      fontSize: fontSizes.heading3,
      fontWeight: fontWeights.medium,
      color: colors.gold,
      letterSpacing: 0.5,
      marginTop: spacing.sm,
    },
    wordTitle: {
      fontSize: fontSizes.heading1,
      fontWeight: fontWeights.bold,
      color: colors.textPrimary,
      marginBottom: spacing.md,
    },
    strongsBadge: {
      alignSelf: 'flex-start',
      backgroundColor: colors.gold,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: 16,
      marginBottom: spacing.md,
    },
    strongsBadgeText: {
      fontSize: fontSizes.caption,
      fontWeight: fontWeights.semibold,
      color: colors.white,
    },
    lemmaText: {
      fontSize: fontSizes.heading2,
      fontWeight: fontWeights.medium,
      color: colors.textPrimary,
      marginBottom: spacing.md,
    },
    definitionScroll: {
      maxHeight: 200,
      marginBottom: spacing.md,
    },
    definitionScrollContent: {
      paddingBottom: spacing.md,
    },
    definitionBox: {
      backgroundColor: colors.background,
      padding: spacing.lg,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: spacing.md,
    },
    definitionText: {
      fontSize: fontSizes.body,
      color: colors.textPrimary,
      lineHeight: fontSizes.body * 1.5,
    },
    derivationContainer: {
      marginBottom: spacing.sm,
    },
    derivationLabel: {
      fontSize: fontSizes.caption,
      fontWeight: fontWeights.semibold,
      color: colors.textSecondary,
      marginBottom: spacing.xs,
    },
    derivationText: {
      fontSize: fontSizes.bodySmall,
      color: colors.textSecondary,
      fontStyle: 'italic',
    },
    kjvContainer: {
      marginTop: spacing.sm,
    },
    kjvLabel: {
      fontSize: fontSizes.caption,
      fontWeight: fontWeights.semibold,
      color: colors.textSecondary,
      marginBottom: spacing.xs,
    },
    kjvText: {
      fontSize: fontSizes.bodySmall,
      color: colors.textSecondary,
    },
    verseReference: {
      fontSize: fontSizes.bodySmall,
      color: colors.textSecondary,
      fontStyle: 'italic',
      marginTop: spacing.md,
      marginBottom: spacing.md,
    },
    loadingContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.xxl,
      gap: spacing.md,
    },
    loadingText: {
      fontSize: fontSizes.body,
      color: colors.textSecondary,
    },
    errorContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.xxl,
      gap: spacing.md,
    },
    errorText: {
      fontSize: fontSizes.body,
      color: colors.textSecondary,
      textAlign: 'center',
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
