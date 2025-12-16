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
import { useTheme } from '@/contexts/ThemeContext';
import { useBibleByLine, useBibleDetailed, useBibleSummary } from '@/src/api';
import type { ContentTabType } from '@/types/bible';

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
  testID = 'bible-explanations-panel',
}: BibleExplanationsPanelProps) {
  const { mode, colors } = useTheme();
  const specs = useMemo(() => getSplitViewSpecs(mode), [mode]);
  const { styles, markdownStyles } = useMemo(() => createStyles(specs, colors), [specs, colors]);
  const insets = useSafeAreaInsets();

  // Animation for sliding tab indicator
  const getTabIndex = useCallback((tab: ContentTabType) => TABS.findIndex((t) => t.id === tab), []);
  const slideAnim = useRef(new Animated.Value(getTabIndex(activeTab))).current;
  const [tabWidth, setTabWidth] = useState(0);

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
  const { data: summaryData, isLoading: summaryLoading } = useBibleSummary(bookId, chapterNumber, {
    query: { enabled: activeTab === 'summary' },
  });

  const { data: byLineData, isLoading: byLineLoading } = useBibleByLine(bookId, chapterNumber, {
    query: { enabled: activeTab === 'byline' },
  });

  const { data: detailedData, isLoading: detailedLoading } = useBibleDetailed(
    bookId,
    chapterNumber,
    { query: { enabled: activeTab === 'detailed' } }
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

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]} testID={testID}>
      {/* Header Bar */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {bookName} {chapterNumber} Insights
        </Text>
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
  colors: ReturnType<typeof getColors>
) {
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      height: specs.headerHeight,
      backgroundColor: specs.headerBackground,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
    },
    headerTitle: {
      fontSize: fontSizes.body,
      fontWeight: fontWeights.medium,
      color: specs.headerTextColor,
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
