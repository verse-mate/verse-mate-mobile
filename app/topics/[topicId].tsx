/**
 * Topic Detail Screen
 *
 * Displays topic content with Bible references and AI-generated explanations.
 * Features similar structure to Bible chapter screen but adapted for topics.
 * Includes horizontal swipe navigation between topics within the same category.
 *
 * Route: /topics/[topicId]
 * Example: /topics/550e8400-e29b-41d4-a716-446655440000
 */

import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { Alert, Animated, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BibleNavigationModal } from '@/components/bible/BibleNavigationModal';
import { ChapterContentTabs } from '@/components/bible/ChapterContentTabs';
import { FloatingActionButtons } from '@/components/bible/FloatingActionButtons';
import { HamburgerMenu } from '@/components/bible/HamburgerMenu';
import { OfflineIndicator } from '@/components/bible/OfflineIndicator';
import { SkeletonLoader } from '@/components/bible/SkeletonLoader';
import { TopicPagerView, type TopicPagerViewRef } from '@/components/topics/TopicPagerView';
import {
  fontSizes,
  fontWeights,
  type getColors,
  getHeaderSpecs,
  spacing,
} from '@/constants/bible-design-tokens';
import { useTheme } from '@/contexts/ThemeContext';
import { useActiveTab, useActiveView, useLastReadPosition } from '@/hooks/bible';
import { useFABVisibility } from '@/hooks/bible/use-fab-visibility';
import { useTopicNavigation } from '@/hooks/topics/use-topic-navigation';
import { useTopicById, useTopicsSearch } from '@/src/api/generated';
import type { ContentTabType } from '@/types/bible';
import type { TopicCategory, TopicListItem } from '@/types/topics';
import { generateTopicShareUrl } from '@/utils/sharing/generate-topic-share-url';

/**
 * View mode type for Topic reading interface
 */
type ViewMode = 'bible' | 'explanations';

/**
 * Center index constant from TopicPagerView (5-page window)
 */
const CENTER_INDEX = 2;

/**
 * Topic Detail Screen Component
 *
 * Handles:
 * - Loading topic details, references, and explanations from API
 * - Horizontal swipe navigation between topics in the same category
 * - Tab switching between explanation types (summary, byline, detailed)
 * - Navigation to other topics via modal or FAB buttons
 */
export default function TopicDetailScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Extract topicId from route params
  const params = useLocalSearchParams<{ topicId: string; category?: string }>();
  const topicId = params.topicId;
  const category = (params.category as TopicCategory) || 'EVENT';

  // Ref for imperative pager control
  const pagerRef = useRef<TopicPagerViewRef>(null);

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

  // Fetch topic data for header display
  const bibleVersion = 'NASB1995';
  const {
    data: topicData,
    isLoading: isTopicLoading,
    error: topicError,
  } = useTopicById(topicId, bibleVersion);

  // Fetch all topics in the category for navigation
  const { data: categoryTopics = [] } = useTopicsSearch(category);

  // Sort topics by sort_order
  const sortedTopics = useMemo(() => {
    return (categoryTopics as TopicListItem[]).sort(
      (a, b) => (a.sort_order || 0) - (b.sort_order || 0)
    );
  }, [categoryTopics]);

  // Calculate navigation state using the hook
  const { canGoNext, canGoPrevious, nextTopic, prevTopic } = useTopicNavigation(
    topicId,
    sortedTopics
  );

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

  /**
   * Handle page change from TopicPagerView swipe
   * Uses router.replace for silent URL update (swipe handles animation)
   */
  const handlePageChange = useCallback((newTopicId: string, newCategory: TopicCategory) => {
    router.replace({
      pathname: '/topics/[topicId]',
      params: { topicId: newTopicId, category: newCategory },
    });
  }, []);

  /**
   * Handle previous topic navigation via FAB button
   * Uses pagerRef.setPage for smooth animation, then router.push for stack
   */
  const handlePrevious = useCallback(() => {
    if (prevTopic) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      // Use setPage to trigger pager animation (CENTER_INDEX - 1 = 1)
      pagerRef.current?.setPage(CENTER_INDEX - 1);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [prevTopic]);

  /**
   * Handle next topic navigation via FAB button
   * Uses pagerRef.setPage for smooth animation, then router.push for stack
   */
  const handleNext = useCallback(() => {
    if (nextTopic) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      // Use setPage to trigger pager animation (CENTER_INDEX + 1 = 3)
      pagerRef.current?.setPage(CENTER_INDEX + 1);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [nextTopic]);

  // Handle share topic
  const handleShare = useCallback(async () => {
    // Extract topic from topicData
    const currentTopic =
      topicData?.topic && typeof topicData.topic === 'object' && 'name' in topicData.topic
        ? (topicData.topic as { name: string; topic_id: string; category: string })
        : null;

    if (!currentTopic) return;

    try {
      // Trigger haptic feedback for share action
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const url = generateTopicShareUrl(category, currentTopic.name);
      const message = `Check out ${currentTopic.name} on VerseMate: ${url}`;

      await Share.share({
        message,
        url,
      });
    } catch (error) {
      console.error('Share failed:', error);
      // Show error alert
      Alert.alert('Share Failed', 'Unable to share this topic. Please try again.');
      // Trigger error haptic feedback
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [topicData, category]);

  /**
   * Handle scroll events from TopicPage for FAB visibility
   */
  const handleScroll = useCallback(
    (velocity: number, isAtBottom: boolean) => {
      handleFABScroll(velocity, isAtBottom);
    },
    [handleFABScroll]
  );

  // Type guard for topic
  const topic =
    topicData?.topic && typeof topicData.topic === 'object' && 'name' in topicData.topic
      ? (topicData.topic as {
          name: string;
          description?: string;
          topic_id: string;
          category: string;
        })
      : null;

  // Loading state - show skeleton while fetching topic header info
  if (isTopicLoading && !topic) {
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

      {/* TopicPagerView - 5-page sliding window for swipe navigation */}
      <TopicPagerView
        ref={pagerRef}
        initialTopicId={topicId}
        category={category}
        sortedTopics={sortedTopics}
        activeTab={activeTab}
        activeView={activeView}
        onPageChange={handlePageChange}
        onScroll={handleScroll}
        onTap={handleTap}
        onShare={handleShare}
      />

      {/* Floating Action Buttons for Topic Navigation */}
      <FloatingActionButtons
        onPrevious={handlePrevious}
        onNext={handleNext}
        showPrevious={canGoPrevious}
        showNext={canGoNext}
        visible={fabVisible}
      />

      {/* Navigation Modal */}
      {isNavigationModalOpen && (
        <BibleNavigationModal
          visible={isNavigationModalOpen}
          currentBookId={1} // Default to Genesis
          currentChapter={1}
          initialTab="TOPICS"
          initialTopicCategory={category}
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
  const styles = useMemo(() => createHeaderStyles(headerSpecs, colors), [headerSpecs, colors]);
  const insets = useSafeAreaInsets();

  // Animation for sliding toggle indicator
  const toggleSlideAnim = useRef(new Animated.Value(activeView === 'bible' ? 0 : 1)).current;
  const [buttonWidth, setButtonWidth] = useState(0);

  // Animate toggle indicator when activeView changes
  useEffect(() => {
    Animated.spring(toggleSlideAnim, {
      toValue: activeView === 'bible' ? 0 : 1,
      useNativeDriver: true,
      friction: 8,
      tension: 50,
    }).start();
  }, [activeView, toggleSlideAnim]);

  // Measure button container to calculate proper button widths
  const handleToggleLayout = (event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    // Each button width = (containerWidth - padding - gap) / 2
    // containerWidth - 8 (padding) - 4 (gap) = containerWidth - 12
    const singleButtonWidth = (width - 12) / 2;
    setButtonWidth(singleButtonWidth);
  };

  // Calculate translateX for sliding indicator
  const indicatorTranslateX = toggleSlideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, buttonWidth + 3], // Add gap (4px) + extra left padding (3px) for Insight
  });

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
        {/* Bible/Insight Toggle (pill-style matching Bible page) */}
        <View style={styles.toggleContainer} onLayout={handleToggleLayout}>
          {/* Sliding indicator background */}
          <Animated.View
            style={[
              styles.toggleIndicator,
              {
                width: buttonWidth,
                transform: [
                  {
                    translateX: indicatorTranslateX,
                  },
                ],
              },
            ]}
          />
          <Pressable
            onPress={() => onViewChange('bible')}
            style={styles.toggleButton}
            accessibilityLabel="Bible reading view"
            accessibilityRole="button"
            accessibilityState={{ selected: activeView === 'bible' }}
            testID="bible-view-toggle"
          >
            <Text style={[styles.toggleText, activeView === 'bible' && styles.toggleTextActive]}>
              Bible
            </Text>
          </Pressable>
          <Pressable
            onPress={() => onViewChange('explanations')}
            style={styles.toggleButton}
            accessibilityLabel="Insight view"
            accessibilityRole="button"
            accessibilityState={{ selected: activeView === 'explanations' }}
            testID="insight-view-toggle"
          >
            <Text
              style={[
                styles.toggleText,
                activeView === 'explanations' && styles.toggleTextActive,
                { paddingLeft: 5 },
              ]}
            >
              Insight
            </Text>
          </Pressable>
        </View>

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
const createHeaderStyles = (
  headerSpecs: ReturnType<typeof getHeaderSpecs>,
  themeColors: ReturnType<typeof import('@/constants/bible-design-tokens').getColors>
) =>
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
    toggleContainer: {
      backgroundColor: '#323232',
      borderRadius: 100,
      padding: 4,
      flexDirection: 'row',
      gap: 4,
      position: 'relative',
    },
    toggleIndicator: {
      position: 'absolute',
      height: 28,
      backgroundColor: themeColors.gold,
      borderRadius: 100,
      top: 4,
      left: 4,
    },
    toggleButton: {
      paddingHorizontal: 10,
      paddingVertical: 2,
      borderRadius: 100,
      minHeight: 28,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'transparent',
      zIndex: 1,
    },
    toggleButtonActive: {
      backgroundColor: 'transparent',
    },
    toggleText: {
      fontSize: 14,
      color: headerSpecs.titleColor,
      fontWeight: '400',
    },
    toggleTextActive: {
      color: themeColors.black,
    },
    iconButton: {
      padding: spacing.xs,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });

/**
 * Creates all styles for TopicDetailScreen component
 */
const createStyles = (colors: ReturnType<typeof getColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
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
