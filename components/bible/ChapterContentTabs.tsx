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
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, tabSpecs } from '@/constants/bible-design-tokens';
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

  return (
    <View style={styles.container} testID="chapter-content-tabs">
      <View style={styles.tabsRow}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;

          return (
            <Pressable
              key={tab.id}
              onPress={() => handleTabPress(tab.id)}
              style={({ pressed }) => [
                styles.tab,
                isActive ? styles.tabActive : styles.tabInactive,
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

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.white,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  tabsRow: {
    flexDirection: 'row',
    gap: tabSpecs.gap,
    justifyContent: 'flex-start',
  },
  tab: {
    borderRadius: tabSpecs.borderRadius,
    paddingVertical: tabSpecs.paddingVertical,
    paddingHorizontal: tabSpecs.paddingHorizontal,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 80, // Ensure consistent sizing
  },
  tabActive: {
    backgroundColor: tabSpecs.active.backgroundColor,
  },
  tabInactive: {
    backgroundColor: tabSpecs.inactive.backgroundColor,
  },
  tabPressed: {
    opacity: 0.8, // Visual feedback on press
  },
  tabDisabled: {
    opacity: 0.5,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.25,
  },
  tabTextActive: {
    color: tabSpecs.active.textColor,
  },
  tabTextInactive: {
    color: tabSpecs.inactive.textColor,
  },
});
