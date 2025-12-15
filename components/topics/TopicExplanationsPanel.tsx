/**
 * TopicExplanationsPanel Component
 *
 * Right panel for split view that displays AI-generated explanations.
 * Includes header with tab selector (Summary/By Line/Detailed).
 *
 * Features:
 * - Dark header bar with tab selector
 * - Scrollable explanations content
 * - Tab switching between explanation types
 * - Menu button for additional options
 *
 * @see Spec: agent-os/specs/landscape-tablet-optimization/plan.md
 */

import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useCallback, useMemo, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { RenderRules } from 'react-native-markdown-display';
import Markdown from 'react-native-markdown-display';
import { BottomLogo } from '@/components/bible/BottomLogo';
import {
  fontSizes,
  fontWeights,
  type getColors,
  getSplitViewSpecs,
  lineHeights,
  spacing,
} from '@/constants/bible-design-tokens';
import { useTheme } from '@/contexts/ThemeContext';
import { useTopicById } from '@/src/api/generated';
import type { ContentTabType } from '@/types/bible';

const markdownRules: RenderRules = {};

/**
 * Tab option for the header
 */
interface TabOption {
  id: ContentTabType;
  label: string;
}

const TAB_OPTIONS: TabOption[] = [
  { id: 'summary', label: 'Summary' },
  { id: 'byline', label: 'By Line' },
  { id: 'detailed', label: 'Detailed' },
];

/**
 * Props for TopicExplanationsPanel
 */
export interface TopicExplanationsPanelProps {
  /** Topic UUID */
  topicId: string;

  /** Topic name for display */
  topicName: string;

  /** Currently active tab */
  activeTab: ContentTabType;

  /** Callback when tab is changed */
  onTabChange: (tab: ContentTabType) => void;

  /** Callback when menu button is pressed */
  onMenuPress?: () => void;

  /** Test ID for testing */
  testID?: string;
}

/**
 * TopicExplanationsPanel Component
 *
 * Displays AI-generated explanations in the right panel of split view.
 */
export function TopicExplanationsPanel({
  topicId,
  topicName,
  activeTab,
  onTabChange,
  onMenuPress,
  testID = 'topic-explanations-panel',
}: TopicExplanationsPanelProps) {
  const { mode, colors } = useTheme();
  const specs = useMemo(() => getSplitViewSpecs(mode), [mode]);
  const { styles, markdownStyles } = useMemo(() => createStyles(specs, colors), [specs, colors]);

  const scrollViewRef = useRef<ScrollView>(null);

  // Fetch topic data with explanations
  const bibleVersion = 'NASB1995';
  const { data: topicData } = useTopicById(topicId, bibleVersion);

  // Handle tab press
  const handleTabPress = useCallback(
    (tab: ContentTabType) => {
      if (tab !== activeTab) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onTabChange(tab);
        // Scroll to top when switching tabs
        scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      }
    },
    [activeTab, onTabChange]
  );

  // Get explanation content for active tab
  const getExplanationContent = useCallback(() => {
    if (!topicData?.explanation) return null;

    switch (activeTab) {
      case 'summary':
        return topicData.explanation.summary;
      case 'byline':
        return topicData.explanation.byline;
      case 'detailed':
        return topicData.explanation.detailed;
      default:
        return null;
    }
  }, [topicData, activeTab]);

  const explanationContent = getExplanationContent();
  const hasContent = explanationContent && typeof explanationContent === 'string';

  return (
    <View style={styles.container} testID={testID}>
      {/* Header Bar with Tabs */}
      <View style={styles.header} testID={`${testID}-header`}>
        {/* Tab Selector */}
        <View style={styles.tabContainer}>
          {TAB_OPTIONS.map((tab) => (
            <Pressable
              key={tab.id}
              style={[styles.tab, activeTab === tab.id && styles.tabActive]}
              onPress={() => handleTabPress(tab.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === tab.id }}
              testID={`${testID}-tab-${tab.id}`}
            >
              <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Menu Button */}
        <Pressable
          style={styles.menuButton}
          onPress={onMenuPress}
          accessibilityLabel="Menu"
          accessibilityRole="button"
          testID={`${testID}-menu-button`}
        >
          <Ionicons name="menu" size={24} color={specs.headerTextColor} />
        </Pressable>
      </View>

      {/* Content Area */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
        testID={`${testID}-scroll`}
      >
        {/* Title */}
        <Text style={styles.title} accessibilityRole="header">
          {topicName}
        </Text>

        {/* Explanation Content */}
        {hasContent ? (
          <View style={styles.explanationContainer}>
            <Markdown style={markdownStyles} rules={markdownRules}>
              {explanationContent.replace(/#{1,6}\s*Summary\s*\n/gi, '\n')}
            </Markdown>
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              No {activeTab} explanation available for this topic yet.
            </Text>
          </View>
        )}

        <BottomLogo />
      </ScrollView>
    </View>
  );
}

/**
 * Create styles for TopicExplanationsPanel
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
    tabContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    tab: {
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
      borderRadius: 100,
      backgroundColor: specs.inactiveTabBackground,
    },
    tabActive: {
      backgroundColor: specs.activeTabBackground,
    },
    tabText: {
      fontSize: fontSizes.bodySmall,
      fontWeight: fontWeights.medium,
      color: specs.inactiveTabTextColor,
    },
    tabTextActive: {
      color: specs.activeTabTextColor,
    },
    menuButton: {
      padding: spacing.xs,
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
    title: {
      fontSize: fontSizes.displayMedium,
      fontWeight: fontWeights.bold,
      fontStyle: 'italic',
      lineHeight: fontSizes.displayMedium * lineHeights.display,
      color: colors.textPrimary,
      marginBottom: spacing.xxl,
    },
    explanationContainer: {
      flex: 1,
    },
    emptyContainer: {
      padding: spacing.xxl,
      alignItems: 'center',
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
      lineHeight: fontSizes.bodyLarge * 2.0,
      color: colors.textPrimary,
    },
    heading1: {
      fontSize: fontSizes.heading1,
      fontWeight: fontWeights.bold,
      fontStyle: 'italic',
      lineHeight: fontSizes.heading1 * lineHeights.heading,
      color: colors.textPrimary,
      marginTop: spacing.xxl,
      marginBottom: spacing.md,
    },
    heading2: {
      fontSize: fontSizes.heading2,
      fontWeight: fontWeights.semibold,
      fontStyle: 'italic',
      lineHeight: fontSizes.heading2 * lineHeights.heading,
      color: colors.textPrimary,
      marginTop: 64,
      marginBottom: spacing.sm,
    },
    heading3: {
      fontSize: fontSizes.heading3,
      fontWeight: fontWeights.semibold,
      fontStyle: 'italic',
      lineHeight: fontSizes.heading3 * lineHeights.heading,
      color: colors.textPrimary,
      marginTop: 48,
      marginBottom: spacing.sm,
    },
    paragraph: {
      fontSize: fontSizes.bodyLarge,
      lineHeight: fontSizes.bodyLarge * 2.0,
      color: colors.textSecondary,
      marginBottom: spacing.md,
    },
    list_item: {
      fontSize: fontSizes.bodyLarge,
      lineHeight: fontSizes.bodyLarge * 2.0,
      color: colors.textSecondary,
      marginBottom: spacing.xs,
    },
    bullet_list: {
      marginBottom: spacing.md,
    },
    ordered_list: {
      marginBottom: spacing.md,
    },
    strong: {
      fontWeight: fontWeights.bold,
      color: colors.textPrimary,
    },
    em: {
      fontStyle: 'italic',
    },
    hr: {
      backgroundColor: colors.border,
      height: 1,
      marginVertical: spacing.xxl,
    },
  });

  return { styles, markdownStyles };
}

export default TopicExplanationsPanel;
