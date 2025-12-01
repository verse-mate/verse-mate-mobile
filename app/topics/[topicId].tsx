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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GestureResponderEvent, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { RenderRules } from 'react-native-markdown-display';
import Markdown from 'react-native-markdown-display';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BibleNavigationModal } from '@/components/bible/BibleNavigationModal';
import { BottomLogo } from '@/components/bible/BottomLogo';
import { ChapterContentTabs } from '@/components/bible/ChapterContentTabs';
import { FloatingActionButtons } from '@/components/bible/FloatingActionButtons';
import { HamburgerMenu } from '@/components/bible/HamburgerMenu';
import { OfflineIndicator } from '@/components/bible/OfflineIndicator';
import { SkeletonLoader } from '@/components/bible/SkeletonLoader';
import { TopicText } from '@/components/topics/TopicText';
import {
  fontSizes,
  fontWeights,
  type getColors,
  getHeaderSpecs,
  lineHeights,
  spacing,
} from '@/constants/bible-design-tokens';
import { useTheme } from '@/contexts/ThemeContext';
import { useActiveTab, useActiveView, useLastReadPosition } from '@/hooks/bible';
import { BOTTOM_THRESHOLD, useFABVisibility } from '@/hooks/bible/use-fab-visibility';
import { useTopicById, useTopicReferences, useTopicsSearch } from '@/src/api/generated';
import type { ContentTabType } from '@/types/bible';
import type { TopicCategory, TopicListItem } from '@/types/topics';

/**
 * View mode type for Topic reading interface
 */
type ViewMode = 'bible' | 'explanations';

/**
 * Convert a number to Unicode superscript characters
 * Maps each digit to its Unicode superscript equivalent
 * Works for any combination of digits (e.g., 1 -> 1, 42 -> 42, 150 -> 150)
 */
function toSuperscript(num: number): string {
  const superscriptMap: Record<string, string> = {
    '0': '⁰',
    '1': '¹',
    '2': '²',
    '3': '³',
    '4': '⁴',
    '5': '⁵',
    '6': '⁶',
    '7': '⁷',
    '8': '⁸',
    '9': '⁹',
  };

  return num
    .toString()
    .split('')
    .map((digit) => superscriptMap[digit] || digit)
    .join('');
}

/**
 * Preprocess Bible references text to format verse numbers as Unicode superscripts
 *
 * The backend returns verses with numbers on separate lines:
 * ```
 * 1
 * In the beginning God created...
 * 2
 * The earth was formless...
 * ```
 *
 * This function converts them to: `1In the beginning God created...`
 * using Unicode superscript characters for natural elevation.
 */
function formatVerseNumbers(text: string): string {
  if (!text) return text;

  // Match pattern: standalone number on its own line, followed by verse text
  // This regex looks for a number at the start of a line, followed by a newline,
  // then text that doesn't start with a number
  const versePattern = /^(\d+)\n([^\n])/gm;

  return text.replace(versePattern, (_match, verseNum, firstChar) => {
    // Convert verse number to Unicode superscript and stick it to the text
    return `**${toSuperscript(Number.parseInt(verseNum, 10))}**${firstChar}`;
  });
}

/**
 * Custom markdown renderers for special formatting
 */
const markdownRules: RenderRules = {};

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
  const { colors } = useTheme();
  const { styles, markdownStyles } = useMemo(() => createStyles(colors), [colors]);

  // Extract topicId from route params
  const params = useLocalSearchParams<{ topicId: string; category?: string }>();
  const topicId = params.topicId;
  const category = (params.category as TopicCategory) || 'EVENT';

  // Note: User's preferred language is handled by backend based on user session
  // The backend checks currentUserId and uses preferred_language from user table

  // TODO: Implement Bible version selection in Settings page
  // Web app stores this in URL params, mobile should use AsyncStorage
  // For now, hardcoded to NASB1995 (backend default) to enable verse placeholder replacement
  // See web implementation: packages/frontend-base/src/hooks/useBibleVersion.ts
  const bibleVersion = 'NASB1995';

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

  // FAB visibility state and handlers
  const {
    visible: fabVisible,
    handleScroll: handleFABScroll,
    handleTap,
  } = useFABVisibility({
    initialVisible: true,
  });

  // Track last scroll position and timestamp for velocity calculation
  const lastScrollY = useRef(0);
  const lastScrollTime = useRef(Date.now());

  // Track touch start time and position to differentiate tap from scroll
  const touchStartTime = useRef(0);
  const touchStartY = useRef(0);

  // Fetch topic data with verse replacement
  // The /topics/:id endpoint returns all explanation types with verses replaced
  const {
    data: topicData,
    isLoading: isTopicLoading,
    error: topicError,
  } = useTopicById(topicId, bibleVersion);
  const { data: references } = useTopicReferences(topicId);

  // Extract the specific explanation type from the full topic response
  const explanation = topicData?.explanation?.[activeTab];
  const isExplanationLoading = isTopicLoading;

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

  // Handle touch start - record time and position
  const handleTouchStart = useCallback((event: GestureResponderEvent) => {
    touchStartTime.current = Date.now();
    touchStartY.current = event.nativeEvent.pageY;
  }, []);

  // Handle touch end - detect if it was a tap (not a scroll)
  const handleTouchEnd = useCallback(
    (event: GestureResponderEvent) => {
      const touchDuration = Date.now() - touchStartTime.current;
      const touchMovement = Math.abs(event.nativeEvent.pageY - touchStartY.current);

      // Only trigger tap if it was quick and didn't move much
      if (touchDuration < 200 && touchMovement < 10) {
        handleTap();
      }
    },
    [handleTap]
  );

  // Handle scroll events - calculate velocity and detect bottom
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      const currentScrollY = contentOffset.y;
      const currentTime = Date.now();

      // Calculate scroll velocity (pixels per second)
      const timeDelta = currentTime - lastScrollTime.current;
      const scrollDelta = currentScrollY - lastScrollY.current; // Signed value to track direction
      const velocity = timeDelta > 0 ? (scrollDelta / timeDelta) * 1000 : 0;

      // Check if at bottom
      const scrollHeight = contentSize.height - layoutMeasurement.height;
      const isAtBottom = scrollHeight - currentScrollY <= BOTTOM_THRESHOLD;

      // Update refs
      lastScrollY.current = currentScrollY;
      lastScrollTime.current = currentTime;

      // Call FAB visibility handler
      handleFABScroll(velocity, isAtBottom);
    },
    [handleFABScroll]
  );

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
          { paddingBottom: 60 }, // Match ChapterPage: FAB height + bottom offset + progress bar + extra spacing
        ]}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Bible References View */}
        {activeView === 'bible' &&
          (references &&
          typeof references === 'object' &&
          'content' in references &&
          typeof references.content === 'string' ? (
            // Use TopicText if content has structured format (## subtitles)
            // Otherwise fall back to existing Markdown renderer
            references.content.includes('## ') ? (
              <TopicText topicName={topic.name} markdownContent={references.content} />
            ) : (
              <>
                {/* Topic Title (only shown for non-structured content) */}
                <Text style={styles.topicTitle} accessibilityRole="header">
                  {topic.name}
                </Text>

                {/* Topic Description */}
                {topicDescription ? (
                  <Text style={styles.topicDescription}>{topicDescription}</Text>
                ) : null}

                <View style={styles.referencesContainer}>
                  <Markdown style={markdownStyles} rules={markdownRules}>
                    {
                      // First format verse numbers, THEN process newlines
                      formatVerseNumbers(references.content)
                        .replace(/\n\n/g, '___PARAGRAPH___')
                        .replace(/\n/g, ' ')
                        .replace(/___PARAGRAPH___/g, '\n\n')
                    }
                  </Markdown>
                </View>
              </>
            )
          ) : (
            <>
              {/* Topic Title (shown in empty state) */}
              <Text style={styles.topicTitle} accessibilityRole="header">
                {topic.name}
              </Text>

              {/* Topic Description */}
              {topicDescription ? (
                <Text style={styles.topicDescription}>{topicDescription}</Text>
              ) : null}

              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No Bible references available for this topic.</Text>
              </View>
            </>
          ))}

        {/* Explanations View */}
        {activeView === 'explanations' && (
          <>
            {/* Topic Title */}
            <Text style={styles.topicTitle} accessibilityRole="header">
              {topic.name}
            </Text>

            {/* Topic Description */}
            {topicDescription ? (
              <Text style={styles.topicDescription}>{topicDescription}</Text>
            ) : null}

            {isExplanationLoading ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Loading {activeTab} explanation...</Text>
              </View>
            ) : explanation && typeof explanation === 'string' ? (
              <View style={styles.explanationContainer}>
                <Markdown style={markdownStyles} rules={markdownRules}>
                  {explanation.replace(/#{1,6}\s*Summary\s*\n/gi, '\n')}
                </Markdown>
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  No {activeTab} explanation available for this topic yet.
                </Text>
              </View>
            )}
          </>
        )}
        <BottomLogo />
      </ScrollView>

      {/* Floating Action Buttons for Topic Navigation */}
      <FloatingActionButtons
        onPrevious={handlePrevious}
        onNext={handleNext}
        showPrevious={hasPrevious}
        showNext={hasNext}
        visible={fabVisible}
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
  // Get theme directly inside TopicHeader (no props drilling)
  const { colors, mode } = useTheme();
  const headerSpecs = getHeaderSpecs(mode);
  const styles = useMemo(() => createHeaderStyles(headerSpecs), [headerSpecs]);
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.header, { paddingTop: insets.top + spacing.md }]} testID="topic-header">
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
          <Ionicons name="chevron-down" size={16} color={headerSpecs.titleColor} />
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
            color={activeView === 'bible' ? colors.gold : headerSpecs.iconColor}
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
            color={activeView === 'explanations' ? colors.gold : headerSpecs.iconColor}
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
          testID="hamburger-menu-button"
        >
          <Ionicons name="menu" size={headerSpecs.iconSize} color={headerSpecs.iconColor} />
        </Pressable>
      </View>
    </View>
  );
}

/**
 * Creates styles for TopicHeader component
 */
const createHeaderStyles = (headerSpecs: ReturnType<typeof getHeaderSpecs>) =>
  StyleSheet.create({
    header: {
      minHeight: headerSpecs.height,
      backgroundColor: headerSpecs.backgroundColor,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: headerSpecs.padding,
      paddingBottom: spacing.md,
    },
    topicButton: {
      flexShrink: 1,
      marginRight: spacing.sm,
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
      maxWidth: '90%',
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
  });

/**
 * Creates all styles for TopicDetailScreen component
 * Returns both component styles and markdown styles in a single factory
 */
const createStyles = (colors: ReturnType<typeof getColors>) => {
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background, // Match content background to prevent flash during route updates
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
      color: colors.textPrimary,
      marginBottom: spacing.lg,
    },
    topicDescription: {
      fontSize: fontSizes.body,
      lineHeight: fontSizes.body * lineHeights.body,
      color: colors.textSecondary,
      marginBottom: spacing.xxl,
    },
    referencesContainer: {
      marginBottom: spacing.xxxl,
    },
    sectionTitle: {
      fontSize: fontSizes.heading2,
      fontWeight: fontWeights.semibold,
      lineHeight: fontSizes.heading2 * lineHeights.heading,
      color: colors.textPrimary,
      marginBottom: spacing.md,
    },
    explanationContainer: {
      marginTop: spacing.xxl,
      paddingTop: spacing.xxl,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    loadingContainer: {
      padding: spacing.xxl,
      alignItems: 'center',
    },
    loadingText: {
      fontSize: fontSizes.body,
      color: colors.textSecondary,
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
    errorContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xxl,
    },
    errorText: {
      fontSize: fontSizes.heading2,
      color: colors.textSecondary,
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
      color: colors.background,
    },
  });

  /**
   * Markdown Styles
   *
   * Reused from ChapterReader for consistency
   */
  const verseNumberSuperscriptStyle = {
    fontSize: fontSizes.bodyLarge, // Same as body text - Unicode chars are already small
    fontWeight: fontWeights.bold,
    color: colors.textTertiary,
    marginRight: spacing.xs / 2,
    // Unicode superscript characters are naturally smaller and sit higher
  };

  const markdownStyles = StyleSheet.create({
    body: {
      fontSize: fontSizes.bodyLarge,
      lineHeight: fontSizes.bodyLarge * 2.0,
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
      marginTop: 64,
      marginBottom: spacing.sm,
    },
    heading3: {
      fontSize: fontSizes.heading3,
      fontWeight: fontWeights.semibold,
      lineHeight: fontSizes.heading3 * lineHeights.heading,
      color: colors.textPrimary,

      marginTop: 64,
      marginBottom: spacing.sm,
    },
    paragraph: {
      fontSize: fontSizes.bodyLarge,
      lineHeight: fontSizes.bodyLarge * 2.0,
      color: colors.textPrimary,
      marginBottom: spacing.md,
    },
    list_item: {
      fontSize: fontSizes.bodyLarge,
      lineHeight: fontSizes.bodyLarge * 2.0,
      color: colors.textPrimary,
      marginBottom: spacing.xs,
    },
    bullet_list: {
      marginBottom: spacing.md,
    },
    ordered_list: {
      marginBottom: spacing.md,
    },
    strong: {
      // Used for verse numbers
      ...verseNumberSuperscriptStyle,
    },
    em: {
      fontStyle: 'italic',
    },
    blockquote: {
      backgroundColor: colors.backgroundElevated,
      borderLeftWidth: 4,
      borderLeftColor: colors.gold,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      marginVertical: spacing.md,
    },
    verseNumberSuperscript: verseNumberSuperscriptStyle,
  });

  return { styles, markdownStyles };
};
