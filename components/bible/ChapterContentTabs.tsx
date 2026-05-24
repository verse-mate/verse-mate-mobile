/**
 * ChapterContentTabs Component
 *
 * Pill-style tab switcher for Bible reading modes (Summary, By Line, Study, Visuals).
 * Active tab is highlighted with gold background, inactive tabs have gray background.
 * Includes haptic feedback and integrates with useActiveTab hook for persistence.
 *
 * Features:
 * - Pill-style buttons: "Summary", "By Line", "Study", "Visuals" (last is gated)
 * - Active tab: gold background, dark text
 * - Inactive tabs: gray background, white text
 * - Sliding indicator animates on the UI thread via Reanimated, driven by a
 *   shared sharedValue (`activeTabProgress`) the parent updates synchronously
 *   on tap — so the indicator + text colors flip the same frame as the press,
 *   not when React reconciliation catches up.
 *
 * @see Spec lines 254-267, 405-425 (Tab specifications)
 */

import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  interpolateColor,
  type SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/contexts/ThemeContext';
import { type getColors, getTabSpecs, spacing, type ThemeMode } from '@/theme/tokens';
import type { ContentTabType } from '@/types/bible';

interface ChapterContentTabsProps {
  /** Currently active tab */
  activeTab: ContentTabType;
  /** Callback when tab is changed */
  onTabChange: (tab: ContentTabType) => void;
  /**
   * Shared visual key for the active tab. When provided, the indicator
   * translateX and text colors animate on the UI thread the same frame
   * the parent updates this sharedValue (typically synchronously inside
   * the tap handler before `onTabChange`). Falls back to a local
   * sharedValue mirroring `activeTab` when omitted.
   */
  activeTabProgress?: SharedValue<ContentTabType>;
  /** Whether tabs should be disabled (optional) */
  disabled?: boolean;
  /**
   * Topics screen opt-in: include the legacy "Detailed" tab. Bible
   * chapters dropped this tab (parity with the web removal in
   * verse-mate-web 44bce20) but topic explanations still ship a
   * detailed body, so the topic route keeps it visible.
   */
  showDetailed?: boolean;
  /**
   * Bible-chapter opt-in: include the "Study" tab (inductive study
   * via @versemate/studies). Topics have no study content, so this
   * defaults to false.
   */
  showStudy?: boolean;
  /**
   * Bible-chapter opt-in: include the "Visuals" tab. Caller gates
   * this on the current book being in BOOKS_WITH_VISUALS (see
   * `bookHasVisuals` in VisualsPanel).
   */
  showVisuals?: boolean;
}

type Tab = { id: ContentTabType; label: string };

/** Tabs every caller renders. Specific extras (Detailed / Study /
 *  Visuals) are appended per-caller via the boolean props. Order
 *  matters: append in the order they should appear left-to-right. */
const BASE_TABS: readonly Tab[] = [
  { id: 'summary', label: 'Summary' },
  { id: 'byline', label: 'By Line' },
] as const;

const DETAILED_TAB: Tab = { id: 'detailed', label: 'Detailed' };
const STUDY_TAB: Tab = { id: 'study', label: 'Study' };
const VISUALS_TAB: Tab = { id: 'visuals', label: 'Visuals' };

/**
 * ChapterContentTabs Component
 *
 * Renders pill-style tab buttons for switching reading modes.
 * Fixed below header (or sticky during scroll).
 */
export function ChapterContentTabs({
  activeTab,
  onTabChange,
  activeTabProgress,
  disabled = false,
  showDetailed = false,
  showStudy = false,
  showVisuals = false,
}: ChapterContentTabsProps) {
  const { colors, mode } = useTheme();
  const specs = getTabSpecs(mode);
  const styles = createStyles(colors, mode);

  // Memoise the tab list so getTabIndex's deps are stable. When any
  // of the show* flags flip, tab count and tab width both recompute
  // below. Order is fixed: Summary → By Line → Detailed → Study → Visuals.
  const tabs: readonly Tab[] = useMemo(
    () => [
      ...BASE_TABS,
      ...(showDetailed ? [DETAILED_TAB] : []),
      ...(showStudy ? [STUDY_TAB] : []),
      ...(showVisuals ? [VISUALS_TAB] : []),
    ],
    [showDetailed, showStudy, showVisuals]
  );
  const getTabIndex = useCallback(
    (tab: ContentTabType) => tabs.findIndex((t) => t.id === tab),
    [tabs]
  );

  // Local fallback sharedValue for callers that don't pass one in
  // (storybook, isolated tests). Mirrors activeTab via a useEffect.
  const localActiveTabProgress = useSharedValue<ContentTabType>(activeTab);
  useEffect(() => {
    if (activeTabProgress) return;
    localActiveTabProgress.value = activeTab;
  }, [activeTab, localActiveTabProgress, activeTabProgress]);
  const effectiveTabProgress = activeTabProgress ?? localActiveTabProgress;

  // Numeric index of the active tab. animatedIndex is the sharedValue
  // the indicator + text color worklets actually read; it's driven by a
  // useAnimatedReaction that fires withTiming whenever the parent's
  // activeTabProgress changes. This pattern is more reliable than
  // `useDerivedValue(() => withTiming(...))` — the derived form
  // occasionally lost frames or snapped instead of sliding because the
  // animation state isn't preserved between derived-value re-runs.
  const initialIndex = useMemo(() => {
    const idx = tabs.findIndex((t) => t.id === activeTab);
    return idx < 0 ? 0 : idx;
  }, [tabs, activeTab]);
  const animatedIndex = useSharedValue(initialIndex);
  useAnimatedReaction(
    () => effectiveTabProgress.value,
    (current) => {
      'worklet';
      const idx = tabs.findIndex((t) => t.id === current);
      if (idx < 0) return;
      animatedIndex.value = withTiming(idx, {
        duration: 250,
        easing: Easing.out(Easing.cubic),
      });
    },
    [tabs]
  );

  const [tabWidth, setTabWidth] = useState(0);

  /**
   * Handle tab press
   * - Trigger haptic feedback
   * - Call onTabChange callback (parent updates activeTabProgress
   *   synchronously inside this callback so the indicator + colors
   *   start animating the same frame as the tap)
   */
  const handleTabPress = (tab: ContentTabType) => {
    if (disabled || tab === activeTab) {
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onTabChange(tab);
  };

  // Measure container width to calculate tab positions. Math is
  // derived from tabs.length so adding the Visuals tab doesn't break
  // layout: container has 4px padding on each side and a 4px gap
  // between tabs, so usable width = W - 8 - (N-1)*4 and per-tab
  // width = usable / N.
  const handleLayout = (event: { nativeEvent: { layout: { width: number } } }) => {
    const { width } = event.nativeEvent.layout;
    const n = tabs.length;
    const usableWidth = width - 8 - (n - 1) * 4;
    setTabWidth(usableWidth / n);
  };

  // Indicator translateX animation runs on the UI thread driven by
  // animatedIndex (smoothed targetIndex). Translates to index * (tabWidth + 4).
  const indicatorAnimatedStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      transform: [{ translateX: animatedIndex.value * (tabWidth + 4) }],
    };
  }, [tabWidth]);

  // Per-tab text color animation — cross-fade between active and inactive
  // colors based on how close animatedIndex is to this tab's index.
  // Distance 0 = active (fully active color); distance >= 1 = inactive.
  const activeColor = specs.active.textColor;
  const inactiveColor = specs.inactive.textColor;

  return (
    <View style={styles.container} testID="chapter-content-tabs">
      <View style={styles.tabsRow} onLayout={handleLayout}>
        {/* Sliding active indicator */}
        <Animated.View
          style={[styles.slidingIndicator, { width: tabWidth }, indicatorAnimatedStyle]}
        />

        {tabs.map((tab, index) => (
          <TabButton
            key={tab.id}
            tab={tab}
            index={index}
            animatedIndex={animatedIndex}
            activeColor={activeColor}
            inactiveColor={inactiveColor}
            onPress={handleTabPress}
            disabled={disabled}
            activeTab={activeTab}
            styles={styles}
          />
        ))}
      </View>
    </View>
  );
}

/**
 * Single tab button. Pulled out so its useAnimatedStyle hook is called
 * exactly once per tab (hook rules require stable hook ordering — we
 * can't loop useAnimatedStyle inside the parent component).
 */
function TabButton({
  tab,
  index,
  animatedIndex,
  activeColor,
  inactiveColor,
  onPress,
  disabled,
  activeTab,
  styles,
}: {
  tab: Tab;
  index: number;
  animatedIndex: SharedValue<number>;
  activeColor: string;
  inactiveColor: string;
  onPress: (id: ContentTabType) => void;
  disabled: boolean;
  activeTab: ContentTabType;
  styles: ReturnType<typeof createStyles>;
}) {
  const textAnimatedStyle = useAnimatedStyle(() => {
    'worklet';
    const distance = Math.min(1, Math.abs(animatedIndex.value - index));
    return {
      color: interpolateColor(distance, [0, 1], [activeColor, inactiveColor]),
    };
  }, [index, activeColor, inactiveColor]);

  return (
    <Pressable
      onPress={() => onPress(tab.id)}
      style={({ pressed }) => [
        styles.tab,
        pressed && styles.tabPressed,
        disabled && styles.tabDisabled,
      ]}
      accessibilityRole="tab"
      accessibilityState={{ selected: activeTab === tab.id, disabled }}
      accessibilityLabel={`${tab.label} tab`}
      accessibilityHint={`Switch to ${tab.label} reading mode`}
      testID={`tab-${tab.id}`}
      disabled={disabled}
    >
      <Animated.Text style={[styles.tabText, textAnimatedStyle]}>{tab.label}</Animated.Text>
    </Pressable>
  );
}

const createStyles = (colors: ReturnType<typeof getColors>, mode: ThemeMode) => {
  const specs = getTabSpecs(mode);

  return StyleSheet.create({
    container: {
      backgroundColor: colors.background,
      paddingTop: spacing.sm,
      paddingBottom: spacing.md,
      paddingHorizontal: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.gold,
    },
    tabsRow: {
      backgroundColor: colors.backgroundElevated,
      borderRadius: 100,
      padding: 4,
      flexDirection: 'row',
      gap: 4,
      justifyContent: 'space-between',
      position: 'relative',
      minHeight: 36,
    },
    slidingIndicator: {
      position: 'absolute',
      height: 28,
      backgroundColor: specs.active.backgroundColor,
      borderRadius: 100,
      top: 4,
      left: 4,
    },
    tab: {
      flex: 1,
      borderRadius: 100,
      paddingVertical: 2,
      paddingHorizontal: spacing.sm,
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: 28,
      backgroundColor: 'transparent',
      zIndex: 1,
    },
    tabActive: {
      backgroundColor: 'transparent',
    },
    tabInactive: {
      backgroundColor: 'transparent',
    },
    tabPressed: {
      // No opacity change - keep buttons visible during press
    },
    tabDisabled: {
      opacity: 0.5,
    },
    tabText: {
      fontSize: 14,
      fontWeight: '400',
      letterSpacing: 0,
    },
    tabTextActive: {
      color: specs.active.textColor,
    },
    tabTextInactive: {
      color: specs.inactive.textColor,
    },
  });
};
