/**
 * Topic Detail Screen
 *
 * Displays topic content with Bible references and AI-generated explanations.
 * Features similar structure to Bible chapter screen but adapted for topics.
 * Includes horizontal swipe navigation with global circular navigation across all categories.
 *
 * Global Circular Navigation:
 * - Topics from ALL categories (EVENT, PROPHECY, PARABLE, THEME) are combined into one sorted array
 * - Swiping backward from the first topic globally shows the last topic globally
 * - Swiping forward from the last topic globally shows the first topic globally
 * - FAB prev/next buttons are always enabled (no boundary restrictions)
 *
 * Route: /topics/[topicId]
 * Example: /topics/550e8400-e29b-41d4-a716-446655440000
 *
 * @see Spec: agent-os/specs/fix-topic-swipe-navigation/spec.md
 * @see components/bible/ChapterPagerView.tsx - Reference implementation for circular navigation
 */

import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { Alert, Animated, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BibleNavigationModal } from '@/components/bible/BibleNavigationModal';
import { ChapterContentTabs } from '@/components/bible/ChapterContentTabs';
import { FloatingActionButtons } from '@/components/bible/FloatingActionButtons';
import { HamburgerMenu } from '@/components/bible/HamburgerMenu';
import { OfflineIndicator } from '@/components/bible/OfflineIndicator';
import { SkeletonLoader } from '@/components/bible/SkeletonLoader';
import { TopicContentPanel } from '@/components/topics/TopicContentPanel';
import { TopicExplanationsPanel } from '@/components/topics/TopicExplanationsPanel';
import { TopicPagerView, type TopicPagerViewRef } from '@/components/topics/TopicPagerView';
import type { VersePress } from '@/components/topics/TopicText';
import { TopicVerseTooltip } from '@/components/topics/TopicVerseTooltip';
import { SplitView } from '@/components/ui/SplitView';
import {
  fontSizes,
  fontWeights,
  type getColors,
  getHeaderSpecs,
  spacing,
} from '@/constants/bible-design-tokens';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/contexts/ToastContext';
import { useActiveTab, useActiveView, useLastReadPosition } from '@/hooks/bible';
import { useFABVisibility } from '@/hooks/bible/use-fab-visibility';
import { useTopicNavigation } from '@/hooks/topics/use-topic-navigation';
import { useAuth } from '@/hooks/use-auth';
import { useDeviceInfo } from '@/hooks/use-device-info';
import { AnalyticsEvent, analytics } from '@/lib/analytics';
import { useAllTopics, useTopicById } from '@/src/api';
import type { ContentTabType } from '@/types/bible';
import type { TopicCategory } from '@/types/topics';
import { generateTopicShareUrl } from '@/utils/sharing/generate-topic-share-url';
import { generateTopicSlug } from '@/utils/topicSlugs';

/**
 * View mode type for Topic reading interface
 */
type ViewMode = 'bible' | 'explanations';

/**
 * Topic Detail Screen Component
 *
 * Handles:
 * - Loading topic details, references, and explanations from API
 * - Horizontal swipe navigation with global circular navigation across all categories
 * - Tab switching between explanation types (summary, byline, detailed)
 * - Navigation to other topics via modal or FAB buttons (always enabled)
 * - Split view layout for landscape/tablet mode
 */
export default function TopicDetailScreen() {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { user } = useAuth();
  const { showToast } = useToast();

  // Derive isLoggedIn from user
  const isLoggedIn = user !== null;

  // Device info for split view detection
  const { useSplitView, splitRatio, setSplitRatio, splitViewMode, setSplitViewMode } =
    useDeviceInfo();

  // Extract topicId from route params
  const params = useLocalSearchParams<{ topicId: string; category?: string; tab?: string }>();
  const topicId = params.topicId;

  // Local state for immediate UI updates
  const [activeTopicId, setActiveTopicId] = useState(topicId);

  // Fetch ALL topics globally for circular navigation across all categories
  const { data: allTopics } = useAllTopics();

  // Get current topic's category from the global topics array (needed for modal)
  // This updates immediately when swiping to a topic in a different category
  const currentTopicCategory = useMemo(() => {
    if (!allTopics || !activeTopicId) return (params.category as TopicCategory) || 'EVENT';
    const currentTopic = allTopics.find((t) => t.topic_id === activeTopicId);
    return (
      (currentTopic?.category as TopicCategory) || (params.category as TopicCategory) || 'EVENT'
    );
  }, [allTopics, activeTopicId, params.category]);

  // Get current topic's name from the global topics array (immediate fallback for header)
  // This updates immediately when swiping, before useTopicById refetches
  const currentTopicName = useMemo(() => {
    if (!allTopics || !activeTopicId) return '';
    const currentTopic = allTopics.find((t) => t.topic_id === activeTopicId);
    return currentTopic?.name || '';
  }, [allTopics, activeTopicId]);

  // Sync local state from params (deep links, back button)
  // biome-ignore lint/correctness/useExhaustiveDependencies: activeTopicId is intentionally omitted
  useEffect(() => {
    if (params.topicId && params.topicId !== activeTopicId) {
      setActiveTopicId(params.topicId);
    }
  }, [params.topicId]);

  // Debounced URL sync
  useEffect(() => {
    const timer = setTimeout(() => {
      if (params.topicId !== activeTopicId) {
        router.setParams({
          topicId: activeTopicId,
          category: currentTopicCategory,
        });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [activeTopicId, currentTopicCategory, params.topicId]);

  // Ref for imperative pager control
  const pagerRef = useRef<TopicPagerViewRef>(null);

  // Get active tab from persistence (reuse Bible tab hook)
  const { activeTab, setActiveTab } = useActiveTab();

  // Get active view from persistence (Bible references vs Explanations view)
  const { activeView, setActiveView } = useActiveView();

  // Handle deep-linked insight tab parameter
  // When user opens a shared topic insight URL, navigate to that specific tab
  const hasSetInitialTab = useRef(false);
  useEffect(() => {
    const deeplinkTab = params.tab;
    if (deeplinkTab && !hasSetInitialTab.current) {
      hasSetInitialTab.current = true;
      // Validate that the tab parameter is a valid ContentTabType
      if (deeplinkTab === 'summary' || deeplinkTab === 'byline' || deeplinkTab === 'detailed') {
        setActiveTab(deeplinkTab);
        // Force explanations view to show the insight tab
        if (activeView !== 'explanations') {
          setActiveView('explanations');
        }
      }
    }
  }, [params.tab, setActiveTab, activeView, setActiveView]);

  // Save reading position to AsyncStorage for app launch continuity
  const { savePosition } = useLastReadPosition();

  // Navigation modal state
  const [isNavigationModalOpen, setIsNavigationModalOpen] = useState(false);

  // Hamburger menu state
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Tooltip state
  const [selectedVerse, setSelectedVerse] = useState<VersePress | null>(null);
  const [tooltipVisible, setTooltipVisible] = useState(false);

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
  } = useTopicById(activeTopicId, bibleVersion);

  // Calculate navigation state using the hook with global topics array
  // With circular navigation, prevTopic and nextTopic are always available when topics exist
  const { nextTopic, prevTopic } = useTopicNavigation(activeTopicId, allTopics);

  // Save reading position to AsyncStorage for app launch continuity
  // Save whenever topicId, category, tab, or view changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: savePosition is a stable function
  useEffect(() => {
    savePosition({
      type: 'topic',
      topicId: activeTopicId,
      topicCategory: currentTopicCategory,
      activeTab,
      activeView,
    });
  }, [activeTopicId, currentTopicCategory, activeTab, activeView]);

  // Handle back navigation
  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  // Handle chapter selection from modal (redirect to Bible)
  const handleSelectChapter = (bookId: number, chapter: number) => {
    setIsNavigationModalOpen(false);
    // Always default to Bible text view when navigating to Bible
    setActiveView('bible');
    router.push(`/bible/${bookId}/${chapter}`);
  };

  // Handle topic selection from modal (navigate to different topic)
  const handleSelectTopic = (newTopicId: string, _newCategory: TopicCategory) => {
    setIsNavigationModalOpen(false);
    // Always default to Bible text view when switching topics via modal
    setActiveView('bible');
    setActiveTopicId(newTopicId);
    // URL will catch up via debounce
  };

  // Handle tab change
  const handleTabChange = (tab: ContentTabType) => {
    setActiveTab(tab);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // Handle view mode change (Bible references vs Explanations)
  const handleViewChange = (view: ViewMode) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveView(view);
  };

  /**
   * Handle page change from TopicPagerView swipe
   * Updates local state immediately to prevent flash
   * Global navigation - no category parameter needed
   */
  const handlePageChange = (newTopicId: string) => {
    setActiveTopicId(newTopicId);
  };

  /**
   * Handle previous topic navigation via FAB button
   * Uses pagerRef.goPrevious for smooth animation in portrait, direct state update for split view
   * With circular navigation, prevTopic is always available - no error case needed
   */
  const handlePrevious = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (useSplitView && prevTopic) {
      // In split view, update local state directly
      setActiveTopicId(prevTopic.topic_id);
    } else {
      // In portrait view, use goPrevious to navigate relative to current position
      // This works correctly even if user has swiped manually
      pagerRef.current?.goPrevious();
    }
  };

  /**
   * Handle next topic navigation via FAB button
   * Uses pagerRef.goNext for smooth animation in portrait, direct state update for split view
   * With circular navigation, nextTopic is always available - no error case needed
   */
  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (useSplitView && nextTopic) {
      // In split view, update local state directly
      setActiveTopicId(nextTopic.topic_id);
    } else {
      // In portrait view, use goNext to navigate relative to current position
      // This works correctly even if user has swiped manually
      pagerRef.current?.goNext();
    }
  };

  // Handle share topic
  const handleShare = async () => {
    // Extract topic from topicData
    const currentTopic =
      topicData?.topic && typeof topicData.topic === 'object' && 'name' in topicData.topic
        ? (topicData.topic as { name: string; topic_id: string; category: string })
        : null;

    if (!currentTopic) return;

    try {
      // Trigger haptic feedback for share action
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const url = generateTopicShareUrl(currentTopicCategory, currentTopic.name);
      const message = `Check out ${currentTopic.name} on VerseMate: ${url}`;

      const result = await Share.share({
        message,
        url,
      });

      if (result.action === Share.sharedAction) {
        // Track analytics: TOPIC_SHARED event on successful share
        const topicSlug = generateTopicSlug(currentTopic.name);
        analytics.track(AnalyticsEvent.TOPIC_SHARED, {
          category: currentTopicCategory,
          topicSlug,
        });
      }
    } catch (error) {
      console.error('Share failed:', error);
      // Show error alert
      Alert.alert('Share Failed', 'Unable to share this topic. Please try again.');
      // Trigger error haptic feedback
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  /**
   * Handle scroll events from TopicPage for FAB visibility
   */
  const handleScroll = (velocity: number, isAtBottom: boolean) => {
    handleFABScroll(velocity, isAtBottom);
  };

  /**
   * Handle verse press from TopicText component
   */
  const handleVersePress = (verseData: VersePress) => {
    setSelectedVerse(verseData);
    setTooltipVisible(true);
  };

  /**
   * Handle tooltip close
   */
  const handleTooltipClose = () => {
    setTooltipVisible(false);
    // Clear selected verse after animation completes
    setTimeout(() => setSelectedVerse(null), 300);
  };

  /**
   * Handle copy action from tooltip - show toast notification
   */
  const handleCopy = () => {
    showToast('Verse copied to clipboard');
  };

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

  // Show skeleton loader ONLY on initial mount
  const isInitialLoad = isTopicLoading && !topicData;
  if (isInitialLoad) {
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
  if ((topicError || !topicData) && !isTopicLoading) {
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

  return (
    <View style={styles.container}>
      {/* Split View Layout for Landscape/Tablet */}
      {useSplitView ? (
        <SplitView
          splitRatio={splitRatio}
          onSplitRatioChange={setSplitRatio}
          viewMode={splitViewMode}
          onViewModeChange={setSplitViewMode}
          edgeTabsVisible={fabVisible}
          leftContent={
            <TopicContentPanel
              topicId={activeTopicId}
              topicName={currentTopicName || topic?.name || ''}
              topicDescription={topic?.description}
              onHeaderPress={() => setIsNavigationModalOpen(true)}
              onShare={handleShare}
              onNavigatePrev={handlePrevious}
              onNavigateNext={handleNext}
              hasPrevTopic={true}
              hasNextTopic={true}
              onScroll={handleScroll}
              onTap={handleTap}
              onVersePress={handleVersePress}
              visible={fabVisible}
            />
          }
          rightContent={
            <TopicExplanationsPanel
              topicId={activeTopicId}
              topicName={currentTopicName || topic?.name || ''}
              activeTab={activeTab}
              onTabChange={handleTabChange}
              onMenuPress={() => setIsMenuOpen(true)}
            />
          }
        />
      ) : (
        /* Standard Portrait/Phone Layout */
        <>
          {/* Header */}
          <TopicHeader
            topicName={currentTopicName || topic?.name || ''}
            activeView={activeView}
            onNavigationPress={() => setIsNavigationModalOpen(true)}
            navigationModalVisible={isNavigationModalOpen}
            onViewChange={handleViewChange}
            onMenuPress={() => setIsMenuOpen(true)}
          />

          {/* Content Tabs - Only visible in Explanations view */}
          {activeView === 'explanations' && (
            <ChapterContentTabs activeTab={activeTab} onTabChange={handleTabChange} />
          )}

          {/* TopicPagerView - 7-page sliding window with global circular navigation */}
          <TopicPagerView
            ref={pagerRef}
            initialTopicId={activeTopicId}
            sortedTopics={allTopics}
            activeTab={activeTab}
            activeView={activeView}
            onPageChange={handlePageChange}
            onScroll={handleScroll}
            onTap={handleTap}
            onShare={handleShare}
            onVersePress={handleVersePress}
          />

          {/* Floating Action Buttons for Topic Navigation - Always enabled with circular navigation */}
          <FloatingActionButtons
            onPrevious={handlePrevious}
            onNext={handleNext}
            showPrevious={true}
            showNext={true}
            visible={fabVisible}
          />

          {/* Hamburger Menu */}
          <HamburgerMenu visible={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
        </>
      )}

      {/* Navigation Modal - Consolidated outside conditional blocks */}
      {isNavigationModalOpen && (
        <BibleNavigationModal
          visible={isNavigationModalOpen}
          currentBookId={1} // Default to Genesis
          currentChapter={1}
          initialTab="TOPICS"
          initialTopicCategory={currentTopicCategory}
          onClose={() => setIsNavigationModalOpen(false)}
          onSelectChapter={handleSelectChapter}
          onSelectTopic={handleSelectTopic}
        />
      )}

      {/* Topic Verse Tooltip - Handled at screen level for proper positioning */}
      {selectedVerse && (
        <TopicVerseTooltip
          verseNumber={selectedVerse.verseNumber}
          bookId={selectedVerse.bookId}
          chapterNumber={selectedVerse.chapterNumber}
          bookName={selectedVerse.bookName}
          verseText={selectedVerse.verseText}
          visible={tooltipVisible}
          onClose={handleTooltipClose}
          onCopy={handleCopy}
          isLoggedIn={isLoggedIn}
          useModal={!useSplitView}
        />
      )}
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
  navigationModalVisible?: boolean;
}

function TopicHeader({
  topicName,
  activeView,
  onNavigationPress,
  onViewChange,
  onMenuPress,
  navigationModalVisible,
}: TopicHeaderProps) {
  // Get theme directly inside TopicHeader (no props drilling)
  const { colors, mode } = useTheme();
  const headerSpecs = getHeaderSpecs(mode);
  const styles = useMemo(() => createHeaderStyles(headerSpecs, colors), [headerSpecs, colors]);
  const insets = useSafeAreaInsets();

  // Animation for sliding toggle indicator
  const toggleSlideAnim = useRef(new Animated.Value(activeView === 'bible' ? 0 : 1)).current;
  const [bibleButtonWidth, setBibleButtonWidth] = useState(0);
  const [insightButtonWidth, setInsightButtonWidth] = useState(0);

  // Animate toggle indicator when activeView changes
  useEffect(() => {
    Animated.spring(toggleSlideAnim, {
      toValue: activeView === 'bible' ? 0 : 1,
      useNativeDriver: false, // Changed to false to allow width animation
      friction: 8,
      tension: 50,
    }).start();
  }, [activeView, toggleSlideAnim]);

  // Measure individual button widths
  const handleBibleLayout = (event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    setBibleButtonWidth(width);
  };

  const handleInsightLayout = (event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    setInsightButtonWidth(width);
  };

  // Memoize interpolations to prevent recreating on every render
  const indicatorTranslateX = useMemo(
    () =>
      toggleSlideAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, Math.max(0, bibleButtonWidth + 4)], // Move to insight position (Bible width + gap)
      }),
    [toggleSlideAnim, bibleButtonWidth]
  );

  const indicatorWidth = useMemo(
    () =>
      toggleSlideAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [Math.max(0, bibleButtonWidth), Math.max(0, insightButtonWidth)],
      }),
    [toggleSlideAnim, bibleButtonWidth, insightButtonWidth]
  );

  /**
   * Safe navigation press handler to prevent double-triggering
   */
  const handleNavigationPress = () => {
    if (!navigationModalVisible) {
      onNavigationPress();
    }
  };

  return (
    <View style={[styles.header, { paddingTop: insets.top + spacing.md }]} testID="topic-header">
      {/* Topic Title Button (clickable to open navigation) */}
      <Pressable
        onPress={handleNavigationPress}
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
        <View style={styles.toggleContainer}>
          {/* Sliding indicator background */}
          <Animated.View
            style={[
              styles.toggleIndicator,
              {
                width: indicatorWidth,
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
            onLayout={handleBibleLayout}
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
            onLayout={handleInsightLayout}
            accessibilityLabel="Insight view"
            accessibilityRole="button"
            accessibilityState={{ selected: activeView === 'explanations' }}
            testID="insight-view-toggle"
          >
            <Text
              style={[styles.toggleText, activeView === 'explanations' && styles.toggleTextActive]}
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
