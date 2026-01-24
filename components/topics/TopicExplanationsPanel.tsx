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
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { RenderRules } from 'react-native-markdown-display';
import Markdown from 'react-native-markdown-display';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { useBibleVersion } from '@/hooks/use-bible-version';
import { useTopicById } from '@/src/api';
import type { ContentTabType } from '@/types/bible';
import { ShareButton } from '../bible/ShareButton';

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
  const { styles, markdownStyles } = createStyles(specs, colors);
  const insets = useSafeAreaInsets();

  const scrollViewRef = useRef<ScrollView>(null);

  // Animation for sliding tab indicator
  const getTabIndex = (tab: ContentTabType) => TAB_OPTIONS.findIndex((t) => t.id === tab);
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
    // biome-ignore lint/correctness/useExhaustiveDependencies: React Compiler handles memoization of getTabIndex
  }, [activeTab, slideAnim, getTabIndex]);

  // Get Bible version from settings
  const { bibleVersion } = useBibleVersion();

  // Fetch topic data with explanations
  const { data: rawTopicData } = useTopicById(topicId, bibleVersion);
  // biome-ignore lint/suspicious/noExplicitAny: Hybrid online/offline data structure
  const topicData = rawTopicData as any;

  // Handle tab press with haptic feedback
  const handleTabPress = (tab: ContentTabType) => {
    if (tab !== activeTab) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onTabChange(tab);
      // Scroll to top when switching tabs
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    }
  };

  // Get explanation content for active tab
  const getExplanationContent = () => {
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
  };

  const explanationContent = getExplanationContent();
  const hasContent = explanationContent && typeof explanationContent === 'string';

  // Custom share handler for topics
  const handleShare = async () => {
    if (!topicData) return;

    const { generateTopicShareUrl } = await import('@/utils/sharing/generate-topic-share-url');
    const { Share } = await import('react-native');
    const { AnalyticsEvent, analytics } = await import('@/lib/analytics');

    try {
      // Type assertion needed because topicData.topic is typed as unknown in generated types
      const topic = topicData.topic as {
        category: string;
        name: string;
        slug?: string;
        topic_id: string;
      };

      const shareUrl = generateTopicShareUrl(topic.category, topic.name, activeTab);
      const message = `Check out ${topicName} on VerseMate: ${shareUrl}`;

      const result = await Share.share({
        message,
        url: shareUrl,
      });

      if (result.action === Share.sharedAction) {
        // TopicSharedProperties only includes category and topicSlug
        analytics.track(AnalyticsEvent.TOPIC_SHARED, {
          category: topic.category,
          topicSlug: topic.slug || topicName.toLowerCase().replace(/\s+/g, '-'),
        });
      }
    } catch (error) {
      console.error('Failed to share topic:', error);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]} testID={testID}>
      {/* Header Bar */}
      <View style={styles.header} testID={`${testID}-header`}>
        <Text style={styles.headerTitle}>{topicName} Insights</Text>

        {/* Action buttons */}
        <View style={styles.headerActions}>
          <ShareButton
            onShare={handleShare}
            size={20}
            color={specs.headerTextColor}
            testID={`${testID}-share-button`}
          />
          {/* TODO: Topic bookmark button - requires topic bookmark support in hook */}
          {/* <InsightBookmarkButton
            topicId={topicId}
            insightType={activeTab}
            size={20}
            color={specs.headerTextColor}
            testID={`${testID}-bookmark-button`}
          /> */}
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

          {TAB_OPTIONS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <Pressable
                key={tab.id}
                style={styles.tab}
                onPress={() => handleTabPress(tab.id)}
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
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
        testID={`${testID}-scroll`}
      >
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
    explanationContainer: {
      flex: 1,
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
    heading3: {
      fontSize: fontSizes.heading3,
      fontWeight: fontWeights.semibold,
      lineHeight: fontSizes.heading3 * lineHeights.heading,
      color: colors.textPrimary,
      marginTop: spacing.lg,
      marginBottom: spacing.sm,
    },
    paragraph: {
      fontSize: fontSizes.bodyLarge,
      lineHeight: fontSizes.bodyLarge * lineHeights.body,
      color: colors.textPrimary,
      marginBottom: spacing.md,
    },
    list_item: {
      fontSize: fontSizes.bodyLarge,
      lineHeight: fontSizes.bodyLarge * lineHeights.body,
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

export default TopicExplanationsPanel;
