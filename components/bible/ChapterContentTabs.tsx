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
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  type getColors,
  getTabSpecs,
  spacing,
  type ThemeMode,
} from '@/constants/bible-design-tokens';
import { useTheme } from '@/contexts/ThemeContext';
import type { ContentTabType } from '@/types/bible';

interface ChapterContentTabsProps {
  /** Currently active tab */
  activeTab: ContentTabType;
  /** Callback when tab is changed */
  onTabChange: (tab: ContentTabType) => void;
  /** Whether tabs should be disabled (optional) */
  disabled?: boolean;
}

/**
 * Tab configuration
 */
const TABS = [
  { id: 'summary' as ContentTabType, label: 'Summary' },
  { id: 'byline' as ContentTabType, label: 'By Line' },
  { id: 'detailed' as ContentTabType, label: 'Detailed' },
] as const;

/**
 * Get tab index for animation positioning
 */
const getTabIndex = (tab: ContentTabType) => {
  return TABS.findIndex((t) => t.id === tab);
};

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
}: ChapterContentTabsProps) {
  const { colors, mode } = useTheme();
  const styles = useMemo(() => createStyles(colors, mode), [colors, mode]);

  // Animation value for sliding indicator
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
  }, [activeTab, slideAnim]);

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

  // Measure container width to calculate tab positions
  const handleLayout = (event: { nativeEvent: { layout: { width: number } } }) => {
    const { width } = event.nativeEvent.layout;
    // Each tab width = (containerWidth - padding - gaps) / 3
    // containerWidth - 8 (padding) - 8 (2 gaps of 4px) = containerWidth - 16
    const singleTabWidth = (width - 16) / 3;
    setTabWidth(singleTabWidth);
  };

  // Calculate translateX for sliding indicator
  const indicatorTranslateX = slideAnim.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [0, tabWidth + 4, (tabWidth + 4) * 2], // Add gap (4px) between tabs
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

        {TABS.map((tab) => {
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
      paddingHorizontal: spacing.lg,
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
