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
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BibleNavigationModal } from '@/components/bible/BibleNavigationModal';
import { ChapterContentTabs } from '@/components/bible/ChapterContentTabs';
import { FloatingActionButtons } from '@/components/bible/FloatingActionButtons';
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
import { useActiveTab } from '@/hooks/bible';
import {
  useTopicById,
  useTopicExplanation,
  useTopicReferences,
  useTopicsSearch,
} from '@/src/api/generated';
import type { ContentTabType } from '@/types/bible';
import type { TopicCategory, TopicListItem } from '@/types/topics';

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

  // Navigation modal state
  const [isNavigationModalOpen, setIsNavigationModalOpen] = useState(false);

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
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={handleBack} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color={colors.gold} />
          </Pressable>
          <Text style={styles.headerTitle}>Loading...</Text>
        </View>
        <SkeletonLoader />
      </View>
    );
  }

  // Error state
  if (topicError || !topicData) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={handleBack} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color={colors.gold} />
          </Pressable>
          <Text style={styles.headerTitle}>Error</Text>
        </View>
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
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={handleBack} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color={colors.gold} />
          </Pressable>
          <Text style={styles.headerTitle}>Error</Text>
        </View>
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
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={handleBack}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={24} color={colors.gold} />
        </Pressable>

        <Text style={styles.headerTitle} numberOfLines={1}>
          {topic.name}
        </Text>

        <Pressable
          onPress={() => setIsNavigationModalOpen(true)}
          style={styles.navButton}
          accessibilityRole="button"
          accessibilityLabel="Open navigation"
        >
          <Ionicons name="book-outline" size={24} color={colors.gold} />
        </Pressable>
      </View>

      {/* Content Tabs */}
      <ChapterContentTabs activeTab={activeTab} onTabChange={handleTabChange} />

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

        {/* Bible References */}
        {references &&
        typeof references === 'object' &&
        'content' in references &&
        typeof references.content === 'string' ? (
          <View style={styles.referencesContainer}>
            <Text style={styles.sectionTitle}>Bible References</Text>
            <Markdown style={markdownStyles}>{references.content}</Markdown>
          </View>
        ) : null}

        {/* Explanation Content */}
        {isExplanationLoading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading {activeTab} explanation...</Text>
          </View>
        ) : explanation &&
          typeof explanation === 'object' &&
          'explanation' in explanation &&
          typeof explanation.explanation === 'string' ? (
          <View style={styles.explanationContainer}>
            <Text style={styles.sectionTitle}>
              {activeTab === 'summary'
                ? 'Summary'
                : activeTab === 'byline'
                  ? 'By Line'
                  : 'Detailed'}{' '}
              Explanation
            </Text>
            <Markdown style={markdownStyles}>{explanation.explanation}</Markdown>
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              No {activeTab} explanation available for this topic yet.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Floating Action Buttons for Topic Navigation */}
      <FloatingActionButtons
        onPrevious={handlePrevious}
        onNext={handleNext}
        showPrevious={hasPrevious}
        showNext={hasNext}
      />

      {/* Navigation Modal */}
      <BibleNavigationModal
        visible={isNavigationModalOpen}
        currentBookId={1} // Default to Genesis
        currentChapter={1}
        onClose={() => setIsNavigationModalOpen(false)}
        onSelectChapter={handleSelectChapter}
        onSelectTopic={handleSelectTopic}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  header: {
    height: headerSpecs.height,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
    backgroundColor: colors.white,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: fontSizes.heading3,
    fontWeight: fontWeights.semibold,
    color: colors.gray900,
    textAlign: 'center',
    marginHorizontal: spacing.md,
  },
  navButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
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
    fontWeight: fontWeights.bold,
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
