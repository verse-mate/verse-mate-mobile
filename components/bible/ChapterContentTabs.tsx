/**
 * ChapterContentTabs Component
 *
 * Pill-style tab switcher for Bible reading modes (Summary, By Line, Detailed).
 * Active tab is highlighted with gold background, inactive tabs have gray background.
 * Includes haptic feedback and integrates with useActiveTab hook for persistence.
 *
 * Features:
 * - Three pill-style buttons: "Summary", "By Line", "Detailed"
 * - Active tab: gold background (#b09a6d), dark text
 * - Inactive tabs: gray700 background (#4a4a4a), white text
 * - Border radius: 20px, padding: 8px vertical, 20px horizontal
 * - Horizontal layout with 8px gap
 * - Haptic feedback on tap (light)
 *
 * @see Spec lines 254-267, 405-425 (Tab specifications)
 * @see Task Group 5.2 - Implement ChapterContentTabs component
 */

import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { type getColors, getTabSpecs, spacing, type ThemeMode } from '@/theme/tokens';
import type { ContentTabType } from '@/types/bible';

interface ChapterContentTabsProps {
  /** Currently active tab */
  activeTab: ContentTabType;
  /** Callback when tab is changed */
  onTabChange: (tab: ContentTabType) => void;
  /** Whether tabs should be disabled (optional) */
  disabled?: boolean;
  /**
   * When true, append a 5th "Visuals" tab. Caller gates this on the
   * current book being in BOOKS_WITH_VISUALS (see `bookHasVisuals` in
   * VisualsPanel). Default false so books without curated visuals keep
   * the legacy 4-tab layout.
   */
  showVisuals?: boolean;
}

type Tab = { id: ContentTabType; label: string };

/** Base tabs — order MUST match BibleExplanationsPanel.TABS. */
const BASE_TABS: readonly Tab[] = [
  { id: 'summary', label: 'Summary' },
  { id: 'byline', label: 'By Line' },
  { id: 'detailed', label: 'Detailed' },
  { id: 'study', label: 'Study' },
] as const;

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
  disabled = false,
  showVisuals = false,
}: ChapterContentTabsProps) {
  const { colors, mode } = useTheme();
  const styles = createStyles(colors, mode);

  // Compose the tab list once per render. When `showVisuals` flips
  // (between books with/without curated visuals), tab count and tab
  // width both recompute below.
  const tabs = showVisuals ? [...BASE_TABS, VISUALS_TAB] : BASE_TABS;
  const getTabIndex = (tab: ContentTabType) => tabs.findIndex((t) => t.id === tab);

  // Animation value for sliding indicator
  const slideAnim = useRef(new Animated.Value(getTabIndex(activeTab))).current;
  const [tabWidth, setTabWidth] = useState(0);

  // Animate indicator when active tab changes
  useEffect(() => {
    const targetIndex = getTabIndex(activeTab);
    // Negative index (e.g. activeTab='visuals' while showVisuals just
    // toggled off) shouldn't animate — clamp to 0 instead of NaN.
    Animated.spring(slideAnim, {
      toValue: targetIndex < 0 ? 0 : targetIndex,
      useNativeDriver: true,
      friction: 8,
      tension: 50,
    }).start();
  }, [activeTab, slideAnim, getTabIndex]);

  /**
   * Handle tab press
   * - Trigger haptic feedback
   * - Call onTabChange callback
   */
  const handleTabPress = (tab: ContentTabType) => {
    if (disabled || tab === activeTab) {
      return; // Don't trigger if already active or disabled
    }

    // Light haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Notify parent of tab change
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

  // Calculate translateX for sliding indicator. Animated.interpolate
  // requires inputRange.length === outputRange.length and a
  // monotonically increasing inputRange — both built from tabs.length.
  const indicatorInputRange = tabs.map((_, i) => i);
  const indicatorOutputRange = tabs.map((_, i) => i * (tabWidth + 4));
  // interpolate() rejects single-element ranges (e.g. if tabs.length
  // somehow became 1) — pad to two entries so animation never throws.
  if (indicatorInputRange.length < 2) {
    indicatorInputRange.push(1);
    indicatorOutputRange.push(tabWidth + 4);
  }
  const indicatorTranslateX = slideAnim.interpolate({
    inputRange: indicatorInputRange,
    outputRange: indicatorOutputRange,
  });

  return (
    <View style={styles.container} testID="chapter-content-tabs">
      <View style={styles.tabsRow} onLayout={handleLayout}>
        {/* Sliding active indicator */}
        <Animated.View
          style={[
            styles.slidingIndicator,
            {
              width: tabWidth,
              transform: [{ translateX: indicatorTranslateX }],
            },
          ]}
        />

        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;

          return (
            <Pressable
              key={tab.id}
              onPress={() => handleTabPress(tab.id)}
              style={({ pressed }) => [
                styles.tab,
                pressed && styles.tabPressed,
                disabled && styles.tabDisabled,
              ]}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive, disabled }}
              accessibilityLabel={`${tab.label} tab`}
              accessibilityHint={`Switch to ${tab.label} reading mode`}
              testID={`tab-${tab.id}`}
              disabled={disabled}
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
      // Tight horizontal padding so 4 labels (Summary / By Line / Detailed /
      // Study) fit on narrow phone widths without truncation. flex:1 already
      // handles equal sizing; padding here is just for press hit area + edge.
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
