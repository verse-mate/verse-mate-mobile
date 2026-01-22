/**
 * TopicVerseTooltip Component
 *
 * Simplified tooltip for topic verse interactions.
 * Shows verse insight with basic actions (copy, share).
 *
 * Features:
 * - Shows verse reference as title
 * - Displays verse text and AI insight
 * - Always starts expanded (single verse only)
 * - Actions: Copy, Share
 * - Auth prompt for logged-out users (for future features)
 * - Swipe up to expand, swipe down to dismiss
 *
 * Based on VerseMateTooltip but simplified for topics.
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
import SignInModal from '@/components/bible/SignInModal';
import SignUpModal from '@/components/bible/SignUpModal';
import { fontSizes, fontWeights, type getColors, spacing } from '@/constants/bible-design-tokens';
import { useTheme } from '@/contexts/ThemeContext';
import { useDeviceInfo } from '@/hooks/use-device-info';
import { AnalyticsEvent, analytics } from '@/lib/analytics';
import { useBibleByLine } from '@/src/api';
import { parseByLineExplanation } from '@/utils/bible/parseByLineExplanation';
import { generateChapterShareUrl } from '@/utils/sharing/generate-chapter-share-url';

/**
 * Minimum duration in seconds for tooltip reading to be tracked
 * Filters out accidental taps or brief views
 */
const TOOLTIP_DURATION_THRESHOLD_SECONDS = 3;

interface TopicVerseTooltipProps {
  /** Verse number */
  verseNumber: number;
  /** Book ID */
  bookId: number;
  /** Chapter number */
  chapterNumber: number;
  /** Book name for title */
  bookName: string;
  /** Verse text for display */
  verseText: string;
  /** Whether modal is visible */
  visible: boolean;
  /** Callback to close modal */
  onClose: () => void;
  /** Callback when verse is copied (for showing toast) */
  onCopy?: () => void;
  /** Whether user is logged in (for future features) */
  isLoggedIn: boolean;
  /** Whether to use a system Modal (true) or a View overlay (false) */
  useModal?: boolean;
}

/**
 * TopicVerseTooltip Component
 *
 * Simplified bottom sheet modal for topic verse interactions.
 */
export function TopicVerseTooltip({
  verseNumber,
  bookId,
  chapterNumber,
  bookName,
  verseText,
  visible,
  onClose,
  onCopy,
  isLoggedIn,
  useModal = true,
}: TopicVerseTooltipProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { isTablet, isLandscape, useSplitView, splitRatio, splitViewMode } = useDeviceInfo();
  const { width: windowWidth } = useWindowDimensions();

  // Calculate dynamic width for tooltip positioning (same as VerseMateTooltip)
  const tooltipWidth =
    useSplitView && splitViewMode !== 'left-full'
      ? windowWidth * (1 - splitRatio)
      : isTablet
        ? isLandscape
          ? windowWidth * 0.5
          : windowWidth * 0.75
        : undefined;

  const { styles, markdownStyles } = useMemo(
    () => createStyles(colors, insets.bottom, isTablet, isLandscape, useSplitView, tooltipWidth),
    [colors, insets.bottom, isTablet, isLandscape, useSplitView, tooltipWidth]
  );

  // Internal visibility state to keep Modal mounted during exit animation
  const [internalVisible, setInternalVisible] = useState(visible);

  // Always start expanded for single verse
  const [expanded, setExpanded] = useState(true);

  // State for auth modals - 'signup' is default since most users don't have accounts
  const [authModalType, setAuthModalType] = useState<'signin' | 'signup' | null>(null);

  // Form State for Auth Modals (hoisted to preserve data across orientation/layout changes)
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');

  const [signUpFirstName, setSignUpFirstName] = useState('');
  const [signUpLastName, setSignUpLastName] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [signUpConfirmPassword, setSignUpConfirmPassword] = useState('');

  // Ref to track if analytics event has been fired for this tooltip open
  const hasTrackedOpen = useRef(false);

  // Ref to track when tooltip was opened (for duration tracking)
  const openTimestampRef = useRef<number | null>(null);

  // Get screen height to start modal completely off-screen
  const screenHeight = Dimensions.get('window').height;

  // Animated values
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(screenHeight)).current;
  const expansionAnim = useRef(new Animated.Value(1)).current; // Always start expanded

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
  const animateOpen = () => {
    setInternalVisible(true);
    // Record the open timestamp for duration tracking
    openTimestampRef.current = Date.now();

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
    // Calculate and track duration (Time-Based Analytics)
    if (openTimestampRef.current && verseNumber) {
      const durationMs = Date.now() - openTimestampRef.current;
      const durationSeconds = Math.floor(durationMs / 1000);

      // Only track if tooltip was open for >= 3 seconds (filter accidental taps)
      if (durationSeconds >= TOOLTIP_DURATION_THRESHOLD_SECONDS) {
        analytics.track(AnalyticsEvent.TOOLTIP_READING_DURATION, {
          duration_seconds: durationSeconds,
          bookId,
          chapterNumber,
          verseNumber,
        });
      }
    }

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
      setExpanded(true); // Reset to default state
      expansionAnim.setValue(1);
      hasTrackedOpen.current = false; // Reset tracking flag
      openTimestampRef.current = null; // Reset open timestamp
      if (callback) callback();
    }, 150);
  };

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
      // Always start expanded for single verse
      setExpanded(true);
      expansionAnim.setValue(1); // Set immediately without animation
      animateOpen();

      // Track analytics: TOPIC_VERSE_TOOLTIP_OPENED
      if (!hasTrackedOpen.current && verseNumber) {
        hasTrackedOpen.current = true;
        analytics.track(AnalyticsEvent.VERSEMATE_TOOLTIP_OPENED, {
          bookId,
          chapterNumber,
          verseNumber,
        });
      }
    } else if (internalVisible) {
      animateClose();
    }
  }, [
    visible,
    // biome-ignore lint/correctness/useExhaustiveDependencies: React Compiler handles memoization
    animateOpen,
    // biome-ignore lint/correctness/useExhaustiveDependencies: React Compiler handles memoization
    animateClose,
    internalVisible,
    expansionAnim,
    bookId,
    chapterNumber,
    verseNumber,
  ]);

  // Handle explicit dismiss (user action)
  const handleDismiss = () => {
    animateClose(() => {
      onClose();
    });
  };

  // Auto-close tooltip when switching to insight-only screen (right-full mode)
  useEffect(() => {
    if (visible && splitViewMode === 'right-full') {
      handleDismiss();
    }
    // biome-ignore lint/correctness/useExhaustiveDependencies: React Compiler handles memoization of handleDismiss
  }, [visible, splitViewMode, handleDismiss]);

  // Build verse reference title
  const verseReference = `${bookName} ${chapterNumber}:${verseNumber}`;

  // Helper to get share content
  const getShareContent = () => {
    let content = `"${verseText}"\n\n- ${verseReference}`;

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

    // Show toast without closing modal
    onCopy?.();
  };

  // Handle share verse
  const handleShare = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!verseText) return;

    const message = getShareContent();

    let url: string | undefined;
    try {
      url = generateChapterShareUrl(bookId, chapterNumber);
    } catch {}

    await Share.share({
      message,
      url, // iOS only
      title: verseReference, // Android dialog title
    });
    // Don't dismiss - user might want to do more actions
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

  // Interpolate values for expansion animation
  const insightMaxHeight = expansionAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 400],
  });

  const insightOpacity = expansionAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0, 1],
  });

  const content = (
    /* Main Container - positions content at bottom */
    <View key={`tooltip-${useModal}`} style={styles.overlay} pointerEvents="box-none">
      {/* Animated Backdrop */}
      <Animated.View
        style={[
          styles.backdrop,
          { opacity: backdropOpacity },
          // Constrain backdrop to right panel only in split view mode (left panel should stay visible)
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
              {/* Title */}
              <Text style={styles.title}>{verseReference}</Text>

              {/* Verse Text */}
              {verseText && <Text style={styles.verseText}>{`"${verseText}"`}</Text>}
            </View>

            {/* Insight Section (Always Expandable) */}
            <View style={styles.insightContainer}>
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
            </View>

            {/* Auth Prompt for logged-out users (for future features) */}
            {!isLoggedIn && (
              <Pressable style={styles.loginPrompt} onPress={() => setAuthModalType('signin')}>
                <Ionicons name="log-in-outline" size={20} color={colors.gold} />
                <Text style={styles.loginPromptText}>
                  Sign in to save this verse to your collection
                </Text>
              </Pressable>
            )}

            {/* Close Button */}
            <Pressable style={styles.closeButton} onPress={handleDismiss}>
              <Text style={styles.closeButtonText}>Close</Text>
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
        {!authModalType && content}
        {/* Auth Modals */}
        <SignUpModal
          key="signup-modal"
          visible={authModalType === 'signup'}
          onClose={() => setAuthModalType(null)}
          onSwitchToSignIn={() => setAuthModalType('signin')}
          onAuthSuccess={onClose}
          useModal={useModal}
          firstName={signUpFirstName}
          setFirstName={setSignUpFirstName}
          lastName={signUpLastName}
          setLastName={setSignUpLastName}
          email={signUpEmail}
          setEmail={setSignUpEmail}
          password={signUpPassword}
          setPassword={setSignUpPassword}
          confirmPassword={signUpConfirmPassword}
          setConfirmPassword={setSignUpConfirmPassword}
        />
        <SignInModal
          key="signin-modal"
          visible={authModalType === 'signin'}
          onClose={() => setAuthModalType(null)}
          onSwitchToSignUp={() => setAuthModalType('signup')}
          onAuthSuccess={onClose}
          useModal={useModal}
          email={signInEmail}
          setEmail={setSignInEmail}
          password={signInPassword}
          setPassword={setSignInPassword}
        />
      </Modal>
    );
  }

  // Non-modal rendering (Overlay)
  if (!internalVisible) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {!authModalType && content}
      {/* Auth Modals */}
      <SignUpModal
        key="signup-modal"
        visible={authModalType === 'signup'}
        onClose={() => setAuthModalType(null)}
        onSwitchToSignIn={() => setAuthModalType('signin')}
        onAuthSuccess={onClose}
        useModal={useModal}
        firstName={signUpFirstName}
        setFirstName={setSignUpFirstName}
        lastName={signUpLastName}
        setLastName={setSignUpLastName}
        email={signUpEmail}
        setEmail={setSignUpEmail}
        password={signUpPassword}
        setPassword={setSignUpPassword}
        confirmPassword={signUpConfirmPassword}
        setConfirmPassword={setSignUpConfirmPassword}
      />
      <SignInModal
        key="signin-modal"
        visible={authModalType === 'signin'}
        onClose={() => setAuthModalType(null)}
        onSwitchToSignUp={() => setAuthModalType('signup')}
        onAuthSuccess={onClose}
        useModal={useModal}
        email={signInEmail}
        setEmail={setSignInEmail}
        password={signInPassword}
        setPassword={setSignInPassword}
      />
    </View>
  );
}

/**
 * Creates all styles for TopicVerseTooltip component
 */
const createStyles = (
  colors: ReturnType<typeof getColors>,
  bottomInset: number,
  _isTablet: boolean,
  _isLandscape: boolean,
  useSplitView: boolean,
  tooltipWidth?: number
) => {
  const styles = StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
      // Center align for tablet portrait, right align for split view, stretch for mobile
      alignItems: tooltipWidth ? (useSplitView ? 'flex-end' : 'center') : 'stretch',
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.backdrop,
    },
    container: {
      backgroundColor: colors.backgroundElevated,
      borderTopLeftRadius: 16,
      borderTopRightRadius: tooltipWidth ? 0 : 16,
      maxHeight: '95%',
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
    verseMateHeader: {
      fontSize: fontSizes.heading3,
      fontWeight: fontWeights.medium,
      color: colors.gold,
      letterSpacing: 0.5,
      marginTop: spacing.sm,
    },
    title: {
      fontSize: fontSizes.heading3,
      fontWeight: fontWeights.medium,
      color: colors.textPrimary,
      marginBottom: spacing.md,
    },
    verseText: {
      fontSize: fontSizes.body,
      fontStyle: 'italic',
      color: colors.textSecondary,
      marginTop: spacing.xs,
      marginBottom: spacing.sm,
      lineHeight: fontSizes.body * 1.5,
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
    closeButton: {
      backgroundColor: colors.gold,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: 8,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.gold,
    },
    closeButtonText: {
      color: colors.background,
      fontSize: fontSizes.body,
      fontWeight: fontWeights.medium,
    },
    loginPrompt: {
      padding: spacing.lg,
      backgroundColor: colors.background,
      borderRadius: 8,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.gold,
      flexDirection: 'row',
      justifyContent: 'center',
      gap: spacing.sm,
    },
    loginPromptText: {
      fontSize: fontSizes.body,
      color: colors.gold,
      textAlign: 'center',
      fontWeight: fontWeights.medium,
    },
    insightContainer: {
      marginBottom: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.divider,
      paddingTop: spacing.md,
      flexShrink: 1,
      minHeight: 0,
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
