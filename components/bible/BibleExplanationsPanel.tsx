/**
 * BibleExplanationsPanel Component
 *
 * Right panel for split view that displays AI-generated explanations
 * for Bible chapters. Includes tab selector and scrollable content.
 *
 * Features:
 * - Dark header bar with menu icon
 * - Tab selector for Summary/By Line/Detailed modes
 * - Scrollable explanation content area
 *
 * @see Spec: agent-os/specs/landscape-tablet-optimization/plan.md
 */

import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GestureResponderEvent, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomLogo } from '@/components/bible/BottomLogo';
import { SkeletonLoader } from '@/components/bible/SkeletonLoader';
import {
  fontSizes,
  fontWeights,
  type getColors,
  getSplitViewSpecs,
  lineHeights,
  spacing,
} from '@/constants/bible-design-tokens';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { BOTTOM_THRESHOLD } from '@/hooks/bible/use-fab-visibility';
import { useBibleByLine, useBibleDetailed, useBibleSummary } from '@/src/api';
import type { ContentTabType } from '@/types/bible';
import { InsightBookmarkButton } from './InsightBookmarkButton';
import { ShareButton } from './ShareButton';

/**
 * Tab configuration for explanation types
 */
const TABS: { id: ContentTabType; label: string }[] = [
  { id: 'summary', label: 'Summary' },
  { id: 'byline', label: 'By Line' },
  { id: 'detailed', label: 'Detailed' },
];

/**
 * Props for BibleExplanationsPanel
 */
export interface BibleExplanationsPanelProps {
  /** Book ID for fetching explanations */
  bookId: number;

  /** Chapter number for fetching explanations */
  chapterNumber: number;

  /** Book name for display */
  bookName: string;

  /** Currently active tab */
  activeTab: ContentTabType;

  /** Callback when tab changes */
  onTabChange: (tab: ContentTabType) => void;

  /** Callback when menu button is pressed */
  onMenuPress?: () => void;

  /** Callback for scroll events (for FAB visibility control) */
  onScroll?: (velocity: number, isAtBottom: boolean) => void;

  /** Callback for tap events (for FAB visibility control) */
  onTap?: () => void;

  /** Test ID for testing */
  testID?: string;
}

/**
 * BibleExplanationsPanel Component
 *
 * Displays AI-generated explanations in the right panel of split view.
 */
export function BibleExplanationsPanel({
  bookId,
  chapterNumber,
  bookName,
  activeTab,
  onTabChange,
  onMenuPress,
  onScroll,
  onTap,
  testID = 'bible-explanations-panel',
}: BibleExplanationsPanelProps) {
  const { mode, colors } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const specs = useMemo(() => getSplitViewSpecs(mode), [mode]);
  const { styles, markdownStyles } = useMemo(
    () => createStyles(specs, colors, insets),
    [specs, colors, insets]
  );

  // Get current language from user preferences (default to 'en-US')
  // This ensures the query key changes when language changes
  const language = typeof user?.preferred_language === 'string' ? user.preferred_language : 'en-US';

  // Animation for sliding tab indicator
  const getTabIndex = useCallback((tab: ContentTabType) => TABS.findIndex((t) => t.id === tab), []);
  const slideAnim = useRef(new Animated.Value(getTabIndex(activeTab))).current;
  const [tabWidth, setTabWidth] = useState(0);

  // Track last scroll position and timestamp for velocity calculation
  const lastScrollY = useRef(0);
  const lastScrollTime = useRef(Date.now());

  // Track touch start time and position to differentiate tap from scroll
  const touchStartTime = useRef(0);
  const touchStartY = useRef(0);

  // Animate indicator when active tab changes
  useEffect(() => {
    const targetIndex = getTabIndex(activeTab);
    Animated.spring(slideAnim, {
      toValue: targetIndex,
      useNativeDriver: true,
      friction: 8,
      tension: 50,
    }).start();
  }, [activeTab, slideAnim, getTabIndex]);

  // Fetch explanations based on active tab
  const { data: summaryData, isLoading: summaryLoading } = useBibleSummary(
    bookId,
    chapterNumber,
    undefined,
    {
      enabled: activeTab === 'summary',
      language,
    }
  );

  const { data: byLineData, isLoading: byLineLoading } = useBibleByLine(
    bookId,
    chapterNumber,
    undefined,
    {
      enabled: activeTab === 'byline',
      language,
    }
  );

  const { data: detailedData, isLoading: detailedLoading } = useBibleDetailed(
    bookId,
    chapterNumber,
    undefined,
    {
      enabled: activeTab === 'detailed',
      language,
    }
  );

  // Get current tab data
  const currentData = useMemo(() => {
    switch (activeTab) {
      case 'summary':
        return summaryData;
      case 'byline':
        return byLineData;
      case 'detailed':
        return detailedData;
      default:
        return null;
    }
  }, [activeTab, summaryData, byLineData, detailedData]);

  const isLoading =
    (activeTab === 'summary' && summaryLoading) ||
    (activeTab === 'byline' && byLineLoading) ||
    (activeTab === 'detailed' && detailedLoading);

  // Handle tab change with haptic feedback
  const handleTabChange = useCallback(
    (tab: ContentTabType) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onTabChange(tab);
    },
    [onTabChange]
  );

  // Get content string from data
  const content = useMemo(() => {
    if (!currentData) return null;
    if (typeof currentData === 'object' && 'content' in currentData) {
      return currentData.content as string;
    }
    return null;
  }, [currentData]);

  /**
   * Handle touch start - record time and position
   * Used to differentiate tap from scroll gestures
   */
  const handleTouchStart = useCallback((event: GestureResponderEvent) => {
    touchStartTime.current = Date.now();
    touchStartY.current = event.nativeEvent.pageY;
  }, []);

  /**
   * Handle touch end - detect if it was a tap (not a scroll)
   * A tap is defined as:
   * - Touch duration < 200ms
   * - Movement < 10 pixels
   * Matches logic from ChapterPage.tsx for consistent behavior
   */
  const handleTouchEnd = useCallback(
    (event: GestureResponderEvent) => {
      if (!onTap) return;

      const touchDuration = Date.now() - touchStartTime.current;
      const touchMovement = Math.abs(event.nativeEvent.pageY - touchStartY.current);

      // Only trigger tap if it was quick and didn't move much
      if (touchDuration < 200 && touchMovement < 10) {
        onTap();
      }
    },
    [onTap]
  );

  /**
   * Handle scroll events - calculate velocity and check if at bottom
   * Matches logic from ChapterPage.tsx for consistent FAB behavior
   */
  const handleInternalScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!onScroll) return;

      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      const currentScrollY = contentOffset.y;
      const currentTime = Date.now();

      // Calculate scroll velocity (pixels per second)
      const timeDelta = currentTime - lastScrollTime.current;
      const scrollDelta = currentScrollY - lastScrollY.current;
      const velocity = timeDelta > 0 ? (scrollDelta / timeDelta) * 1000 : 0;

      // Check if at bottom
      const scrollHeight = contentSize.height - layoutMeasurement.height;
      const isAtBottom = scrollHeight - currentScrollY <= BOTTOM_THRESHOLD;

      // Update refs
      lastScrollY.current = currentScrollY;
      lastScrollTime.current = currentTime;

      // Call parent callback
      onScroll(velocity, isAtBottom);
    },
    [onScroll]
  );

  return (
    <View
      style={styles.container}
      testID={testID}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Header Bar */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>
            {bookName} {chapterNumber} Insights
          </Text>

          {/* Action buttons */}
          <View style={styles.headerActions}>
            <ShareButton
              bookId={bookId}
              chapterNumber={chapterNumber}
              bookName={bookName}
              insightType={activeTab}
              size={20}
              color={specs.headerTextColor}
              testID={`${testID}-share-button`}
            />
            <InsightBookmarkButton
              bookId={bookId}
              chapterNumber={chapterNumber}
              insightType={activeTab}
              size={20}
              color={specs.headerTextColor}
              testID={`${testID}-bookmark-button`}
            />
          </View>

          {onMenuPress && (
            <Pressable
              style={styles.menuButton}
              onPress={onMenuPress}
              accessibilityLabel="Open menu"
              accessibilityRole="button"
              testID={`${testID}-menu-button`}
            >
              <Ionicons name="menu" size={24} color={specs.headerTextColor} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Tab Selector */}

      <View style={styles.tabContainer}>
        <View
          style={styles.tabsRow}
          onLayout={(event) => {
            const { width } = event.nativeEvent.layout;
            const singleTabWidth = (width - 16) / 3;
            setTabWidth(singleTabWidth);
          }}
        >
          {/* Sliding active indicator */}
          <Animated.View
            style={[
              styles.slidingIndicator,
              {
                width: tabWidth,
                transform: [
                  {
                    translateX: slideAnim.interpolate({
                      inputRange: [0, 1, 2],
                      outputRange: [0, tabWidth + 4, (tabWidth + 4) * 2],
                    }),
                  },
                ],
              },
            ]}
          />

          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <Pressable
                key={tab.id}
                style={styles.tab}
                onPress={() => handleTabChange(tab.id)}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
                testID={`${testID}-tab-${tab.id}`}
              >
                <Text
                  style={[styles.tabText, isActive ? styles.tabTextActive : styles.tabTextInactive]}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Content Area */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
        onScroll={handleInternalScroll}
        scrollEventThrottle={16}
        testID={`${testID}-scroll`}
      >
        {isLoading ? (
          <SkeletonLoader />
        ) : content ? (
          <>
            <Markdown style={markdownStyles}>{content}</Markdown>
            <BottomLogo />
          </>
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No explanations available for this chapter.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

/**
 * Create styles for BibleExplanationsPanel
 */
function createStyles(
  specs: ReturnType<typeof getSplitViewSpecs>,
  colors: ReturnType<typeof getColors>,
  insets: ReturnType<typeof useSafeAreaInsets>
) {
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      minHeight: specs.headerHeight + insets.top,
      paddingTop: insets.top,
      paddingBottom: spacing.sm,
      backgroundColor: specs.headerBackground,
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
    },
    headerContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: specs.headerHeight,
      width: '100%',
    },
    headerTitle: {
      fontSize: fontSizes.body,
      fontWeight: fontWeights.medium,
      color: specs.headerTextColor,
      flex: 1,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginRight: spacing.sm,
    },
    menuButton: {
      padding: spacing.xs,
    },
    tabContainer: {
      backgroundColor: colors.background,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.lg,
    },
    tabsRow: {
      backgroundColor: colors.backgroundElevated,
      borderRadius: 100,
      padding: 4,
      flexDirection: 'row',
      gap: 4,
      position: 'relative',
      minHeight: 36,
      alignSelf: 'flex-start',
    },
    slidingIndicator: {
      position: 'absolute',
      height: 28,
      backgroundColor: specs.activeTabBackground,
      borderRadius: 100,
      top: 4,
      left: 4,
    },
    tab: {
      width: 100,
      borderRadius: 100,
      paddingVertical: 2,
      paddingHorizontal: spacing.sm,
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: 28,
      backgroundColor: 'transparent',
      zIndex: 1,
    },
    tabText: {
      fontSize: 14,
      fontWeight: '400',
    },
    tabTextActive: {
      color: specs.activeTabTextColor,
    },
    tabTextInactive: {
      color: specs.inactiveTabTextColor,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: spacing.xxl,
      paddingVertical: spacing.xxl,
      paddingBottom: 60,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.xxl,
    },
    emptyText: {
      fontSize: fontSizes.body,
      color: colors.textSecondary,
      textAlign: 'center',
    },
  });

  const markdownStyles = StyleSheet.create({
    body: {
      fontSize: fontSizes.bodyLarge,
      lineHeight: fontSizes.bodyLarge * lineHeights.body,
      color: colors.textPrimary,
    },
    heading1: {
      fontSize: fontSizes.heading1,
      fontWeight: fontWeights.bold,
      lineHeight: fontSizes.heading1 * lineHeights.heading,
      color: colors.textPrimary,
      marginTop: spacing.xxl,
      marginBottom: spacing.md,
    },
    heading2: {
      fontSize: fontSizes.heading2,
      fontWeight: fontWeights.semibold,
      lineHeight: fontSizes.heading2 * lineHeights.heading,
      color: colors.textPrimary,
      marginTop: spacing.xl,
      marginBottom: spacing.sm,
    },
    paragraph: {
      fontSize: fontSizes.bodyLarge,
      lineHeight: fontSizes.bodyLarge * lineHeights.body,
      color: colors.textPrimary,
      marginBottom: spacing.md,
    },
    blockquote: {
      backgroundColor: colors.backgroundElevated,
      borderLeftWidth: 4,
      borderLeftColor: colors.gold,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.lg,
    },
    blockquote_text: {
      fontSize: fontSizes.bodyLarge,
      lineHeight: fontSizes.bodyLarge * lineHeights.body,
      color: colors.textPrimary,
    },
  });

  return { styles, markdownStyles };
}

export default BibleExplanationsPanel;
