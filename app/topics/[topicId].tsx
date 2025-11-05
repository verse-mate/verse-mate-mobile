/**
 * Topic Detail Screen
 *
 * Displays topic content with Bible references and AI-generated explanations.
 * Features similar structure to Bible chapter screen but adapted for topics.
 *
 * Route: /topics/[topicId]
 * Example: /topics/550e8400-e29b-41d4-a716-446655440000
 */

import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BibleNavigationModal } from '@/components/bible/BibleNavigationModal';
import { ChapterContentTabs } from '@/components/bible/ChapterContentTabs';
import { FloatingActionButtons } from '@/components/bible/FloatingActionButtons';
import { HamburgerMenu } from '@/components/bible/HamburgerMenu';
import { OfflineIndicator } from '@/components/bible/OfflineIndicator';
import { SkeletonLoader } from '@/components/bible/SkeletonLoader';
import {
  colors,
  fontSizes,
  fontWeights,
  headerSpecs,
  lineHeights,
  spacing,
} from '@/constants/bible-design-tokens';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveTab, useActiveView, useLastReadPosition } from '@/hooks/bible';
import {
  useTopicById,
  useTopicExplanation,
  useTopicReferences,
  useTopicsSearch,
} from '@/src/api/generated';
import type { ContentTabType } from '@/types/bible';
import type { TopicCategory, TopicListItem } from '@/types/topics';

/**
 * View mode type for Topic reading interface
 */
type ViewMode = 'bible' | 'explanations';

/**
 * Topic Detail Screen Component
 *
 * Handles:
 * - Loading topic details, references, and explanations from API
 * - Displaying topic content with markdown rendering
 * - Tab switching between explanation types (summary, byline, detailed)
 * - Navigation back to topics list
 */
export default function TopicDetailScreen() {
  // Extract topicId from route params
  const params = useLocalSearchParams<{ topicId: string; category?: string }>();
  const topicId = params.topicId;
  const category = (params.category as TopicCategory) || 'EVENT';

  // Get user's preferred language from auth context
  const { user } = useAuth();
  const preferredLanguage = (user?.preferred_language as string) || 'en-US';

  // Get active tab from persistence (reuse Bible tab hook)
  const { activeTab, setActiveTab } = useActiveTab();

  // Get active view from persistence (Bible references vs Explanations view)
  const { activeView, setActiveView } = useActiveView();

  // Save reading position to AsyncStorage for app launch continuity
  const { savePosition } = useLastReadPosition();

  // Navigation modal state
  const [isNavigationModalOpen, setIsNavigationModalOpen] = useState(false);

  // Hamburger menu state
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Fetch topic data
  const { data: topicData, isLoading: isTopicLoading, error: topicError } = useTopicById(topicId);
  const { data: references } = useTopicReferences(topicId);
  const { data: explanation, isLoading: isExplanationLoading } = useTopicExplanation(
    topicId,
    activeTab,
    preferredLanguage
  );

  // Fetch all topics in the category for navigation
  const { data: categoryTopics = [] } = useTopicsSearch(category);

  // Calculate navigation state
  const sortedTopics = (categoryTopics as TopicListItem[]).sort(
    (a, b) => (a.sort_order || 0) - (b.sort_order || 0)
  );
  const currentIndex = sortedTopics.findIndex((t) => t.topic_id === topicId);
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < sortedTopics.length - 1;
  const previousTopic = hasPrevious ? sortedTopics[currentIndex - 1] : null;
  const nextTopic = hasNext ? sortedTopics[currentIndex + 1] : null;

  // Safe area insets for iOS notch/home indicator
  const insets = useSafeAreaInsets();

  // Save reading position to AsyncStorage for app launch continuity
  // Save whenever topicId, category, tab, or view changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: savePosition is a stable function
  useEffect(() => {
    savePosition({
      type: 'topic',
      topicId,
      topicCategory: category,
      activeTab,
      activeView,
    });
  }, [topicId, category, activeTab, activeView]);

  // Handle back navigation
  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  }, []);

  // Handle chapter selection from modal (redirect to Bible)
  const handleSelectChapter = useCallback((bookId: number, chapter: number) => {
    router.push(`/bible/${bookId}/${chapter}`);
  }, []);

  // Handle topic selection from modal (navigate to different topic)
  const handleSelectTopic = useCallback((newTopicId: string, newCategory: TopicCategory) => {
    router.push({
      pathname: '/topics/[topicId]',
      params: { topicId: newTopicId, category: newCategory },
    });
  }, []);

  // Handle tab change
  const handleTabChange = useCallback(
    (tab: ContentTabType) => {
      setActiveTab(tab);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [setActiveTab]
  );

  // Handle view mode change (Bible references vs Explanations)
  const handleViewChange = useCallback(
    (view: ViewMode) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setActiveView(view);
    },
    [setActiveView]
  );

  // Handle previous topic navigation
  const handlePrevious = useCallback(() => {
    if (previousTopic) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      router.push({
        pathname: '/topics/[topicId]',
        params: { topicId: previousTopic.topic_id, category },
      });
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [previousTopic, category]);

  // Handle next topic navigation
  const handleNext = useCallback(() => {
    if (nextTopic) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      router.push({
        pathname: '/topics/[topicId]',
        params: { topicId: nextTopic.topic_id, category },
      });
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [nextTopic, category]);

  // Loading state
  if (isTopicLoading) {
    return (
      <View style={styles.container}>
        <TopicHeader
          topicName="Loading..."
          activeView={activeView}
          onNavigationPress={() => {}}
          onViewChange={handleViewChange}
          onMenuPress={() => {}}
        />
        <SkeletonLoader />
      </View>
    );
  }

  // Error state
  if (topicError || !topicData) {
    return (
      <View style={styles.container}>
        <TopicHeader
          topicName="Error"
          activeView={activeView}
          onNavigationPress={() => {}}
          onViewChange={handleViewChange}
          onMenuPress={() => {}}
        />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Failed to load topic</Text>
          <Pressable onPress={handleBack} style={styles.errorButton}>
            <Text style={styles.errorButtonText}>Go Back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // Type guard for topic
  const topic =
    topicData.topic && typeof topicData.topic === 'object' && 'name' in topicData.topic
      ? (topicData.topic as {
          name: string;
          description?: string;
          topic_id: string;
          category: string;
        })
      : null;

  // Safely extract description as string
  const topicDescription: string | null =
    topic && typeof topic.description === 'string' && topic.description.trim()
      ? topic.description
      : null;

  if (!topic) {
    return (
      <View style={styles.container}>
        <TopicHeader
          topicName="Error"
          activeView={activeView}
          onNavigationPress={() => {}}
          onViewChange={handleViewChange}
          onMenuPress={() => {}}
        />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Topic data not available</Text>
          <Pressable onPress={handleBack} style={styles.errorButton}>
            <Text style={styles.errorButtonText}>Go Back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <TopicHeader
        topicName={topic.name}
        activeView={activeView}
        onNavigationPress={() => setIsNavigationModalOpen(true)}
        onViewChange={handleViewChange}
        onMenuPress={() => setIsMenuOpen(true)}
      />

      {/* Content Tabs - Only visible in Explanations view */}
      {activeView === 'explanations' && (
        <ChapterContentTabs activeTab={activeTab} onTabChange={handleTabChange} />
      )}

      {/* Scrollable Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + spacing.xxl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Topic Title */}
        <Text style={styles.topicTitle} accessibilityRole="header">
          {topic.name}
        </Text>

        {/* Topic Description */}
        {topicDescription ? <Text style={styles.topicDescription}>{topicDescription}</Text> : null}

        {/* Bible References View */}
        {activeView === 'bible' &&
          (references &&
          typeof references === 'object' &&
          'content' in references &&
          typeof references.content === 'string' ? (
            <View style={styles.referencesContainer}>
              <Markdown style={markdownStyles}>
                {references.content
                  .replace(/\n\n/g, '___PARAGRAPH___')
                  .replace(/\n/g, ' ')
                  .replace(/___PARAGRAPH___/g, '\n\n')}
              </Markdown>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No Bible references available for this topic.</Text>
            </View>
          ))}

        {/* Explanations View */}
        {activeView === 'explanations' &&
          (isExplanationLoading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Loading {activeTab} explanation...</Text>
            </View>
          ) : explanation &&
            typeof explanation === 'object' &&
            'explanation' in explanation &&
            typeof explanation.explanation === 'string' ? (
            <View style={styles.explanationContainer}>
              <Markdown style={markdownStyles}>{explanation.explanation}</Markdown>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                No {activeTab} explanation available for this topic yet.
              </Text>
            </View>
          ))}
      </ScrollView>

      {/* Floating Action Buttons for Topic Navigation */}
      <FloatingActionButtons
        onPrevious={handlePrevious}
        onNext={handleNext}
        showPrevious={hasPrevious}
        showNext={hasNext}
      />

      {/* Navigation Modal */}
      {isNavigationModalOpen && (
        <BibleNavigationModal
          visible={isNavigationModalOpen}
          currentBookId={1} // Default to Genesis
          currentChapter={1}
          onClose={() => setIsNavigationModalOpen(false)}
          onSelectChapter={handleSelectChapter}
          onSelectTopic={handleSelectTopic}
        />
      )}

      {/* Hamburger Menu */}
      <HamburgerMenu visible={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
    </View>
  );
}

/**
 * Topic Header Component
 *
 * Fixed header with topic title and action icons
 * - Topic text (clickable to open topic selector)
 * - Bible view icon (shows Bible references mode)
 * - Explanations view icon (shows AI explanations mode)
 * - Offline indicator (shows when offline)
 * - Hamburger menu icon (opens menu)
 *
 * Identical to ChapterHeader but for topics
 */
interface TopicHeaderProps {
  topicName: string;
  activeView: ViewMode;
  onNavigationPress: () => void;
  onViewChange: (view: ViewMode) => void;
  onMenuPress: () => void;
}

function TopicHeader({
  topicName,
  activeView,
  onNavigationPress,
  onViewChange,
  onMenuPress,
}: TopicHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.header, { paddingTop: insets.top }]} testID="topic-header">
      {/* Topic Title Button (clickable to open navigation) */}
      <Pressable
        onPress={onNavigationPress}
        style={styles.topicButton}
        accessibilityLabel={`Select topic, currently ${topicName}`}
        accessibilityRole="button"
        accessibilityHint="Opens topic navigation menu"
        testID="topic-selector-button"
      >
        <View style={styles.topicButtonContent}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {topicName}
          </Text>
          <Ionicons name="chevron-down" size={16} color={colors.white} />
        </View>
      </Pressable>

      {/* Action Icons */}
      <View style={styles.headerActions}>
        {/* Bible View Icon */}
        <Pressable
          onPress={() => onViewChange('bible')}
          style={styles.iconButton}
          accessibilityLabel="Bible references view"
          accessibilityRole="button"
          accessibilityState={{ selected: activeView === 'bible' }}
          testID="bible-view-icon"
        >
          <Ionicons
            name="book-outline"
            size={headerSpecs.iconSize}
            color={activeView === 'bible' ? colors.gold : colors.white}
          />
        </Pressable>

        {/* Explanations View Icon */}
        <Pressable
          onPress={() => onViewChange('explanations')}
          style={styles.iconButton}
          accessibilityLabel="Explanations view"
          accessibilityRole="button"
          accessibilityState={{ selected: activeView === 'explanations' }}
          testID="explanations-view-icon"
        >
          <Ionicons
            name="reader-outline"
            size={headerSpecs.iconSize}
            color={activeView === 'explanations' ? colors.gold : colors.white}
          />
        </Pressable>

        {/* Offline Indicator */}
        <OfflineIndicator />

        {/* Hamburger Menu Icon */}
        <Pressable
          onPress={onMenuPress}
          style={styles.iconButton}
          accessibilityLabel="Open menu"
          accessibilityRole="button"
        >
          <Ionicons name="menu" size={headerSpecs.iconSize} color={colors.white} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray50, // Match content background to prevent flash during route updates
  },
  header: {
    minHeight: headerSpecs.height,
    backgroundColor: headerSpecs.backgroundColor,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: headerSpecs.padding,
    paddingBottom: spacing.sm,
  },
  topicButton: {
    padding: spacing.xs,
  },
  topicButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  headerTitle: {
    fontSize: headerSpecs.titleFontSize,
    fontWeight: headerSpecs.titleFontWeight,
    color: headerSpecs.titleColor,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  iconButton: {
    padding: spacing.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.xl,
  },
  topicTitle: {
    fontSize: fontSizes.displayMedium,
    fontWeight: fontWeights.bold,
    lineHeight: fontSizes.displayMedium * lineHeights.display,
    color: colors.gray900,
    marginBottom: spacing.lg,
  },
  topicDescription: {
    fontSize: fontSizes.body,
    lineHeight: fontSizes.body * lineHeights.body,
    color: colors.gray500,
    marginBottom: spacing.xxl,
  },
  referencesContainer: {
    marginBottom: spacing.xxxl,
  },
  sectionTitle: {
    fontSize: fontSizes.heading2,
    fontWeight: fontWeights.semibold,
    lineHeight: fontSizes.heading2 * lineHeights.heading,
    color: colors.gray900,
    marginBottom: spacing.md,
  },
  explanationContainer: {
    marginTop: spacing.xxl,
    paddingTop: spacing.xxl,
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
  },
  loadingContainer: {
    padding: spacing.xxl,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: fontSizes.body,
    color: colors.gray500,
  },
  emptyContainer: {
    padding: spacing.xxl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: fontSizes.body,
    color: colors.gray500,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
  },
  errorText: {
    fontSize: fontSizes.heading2,
    color: colors.gray500,
    marginBottom: spacing.xl,
  },
  errorButton: {
    backgroundColor: colors.gold,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 8,
  },
  errorButtonText: {
    fontSize: fontSizes.body,
    fontWeight: fontWeights.medium,
    color: colors.white,
  },
});

/**
 * Markdown Styles
 *
 * Reused from ChapterReader for consistency
 */
const markdownStyles = StyleSheet.create({
  body: {
    fontSize: fontSizes.body,
    lineHeight: fontSizes.body * lineHeights.body,
    color: colors.gray900,
  },
  heading1: {
    fontSize: fontSizes.heading1,
    fontWeight: fontWeights.bold,
    lineHeight: fontSizes.heading1 * lineHeights.heading,
    color: colors.gray900,
    marginTop: spacing.xxl,
    marginBottom: spacing.md,
  },
  heading2: {
    fontSize: fontSizes.heading2,
    fontWeight: fontWeights.semibold,
    lineHeight: fontSizes.heading2 * lineHeights.heading,
    color: colors.gray900,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  heading3: {
    fontSize: fontSizes.heading3,
    fontWeight: fontWeights.semibold,
    lineHeight: fontSizes.heading3 * lineHeights.heading,
    color: colors.gray900,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  paragraph: {
    fontSize: fontSizes.body,
    lineHeight: fontSizes.body * lineHeights.body,
    color: colors.gray900,
    marginBottom: spacing.md,
  },
  list_item: {
    fontSize: fontSizes.body,
    lineHeight: fontSizes.body * lineHeights.body,
    color: colors.gray900,
    marginBottom: spacing.xs,
  },
  bullet_list: {
    marginBottom: spacing.md,
  },
  ordered_list: {
    marginBottom: spacing.md,
  },
  strong: {
    fontSize: fontSizes.caption,
    fontWeight: fontWeights.bold,
    color: colors.gray500,
    marginRight: spacing.xs,
  },
  em: {
    fontStyle: 'italic',
  },
  blockquote: {
    backgroundColor: colors.gray50,
    borderLeftWidth: 4,
    borderLeftColor: colors.gold,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginVertical: spacing.md,
  },
});
