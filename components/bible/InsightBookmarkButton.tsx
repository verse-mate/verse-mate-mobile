/**
 * InsightBookmarkButton Component
 *
 * Renders a pressable bookmark icon for bookmarking specific insight tabs.
 * Features:
 * - Toggles bookmark state for insight types (summary, byline, detailed)
 * - Haptic feedback on press
 * - Visual state (filled vs outline icon)
 * - Accessibility support
 *
 * Visual Design:
 * - Icon: Ionicons bookmark/bookmark-outline
 * - Size: 24px (from bible-design-tokens headerSpecs.iconSize)
 * - Color: Gold (#D4AF37) when bookmarked, theme textPrimary when not
 * - Position: Right of share button in explanations panel header
 *
 * @example
 * ```tsx
 * <InsightBookmarkButton bookId={1} chapterNumber={1} insightType="summary" />
 * <InsightBookmarkButton bookId={43} chapterNumber={3} insightType="detailed" size={20} />
 * ```
 */

import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet } from 'react-native';
import { getHeaderSpecs } from '@/constants/bible-design-tokens';
import { useTheme } from '@/contexts/ThemeContext';
import { useBookmarks } from '@/hooks/bible/use-bookmarks';
import type { ContentTabType } from '@/types/bible';

/**
 * Props for InsightBookmarkButton component
 */
export interface InsightBookmarkButtonProps {
  /** Book ID (1-66) */
  bookId: number;
  /** Chapter number (1-based) */
  chapterNumber: number;
  /** Insight type to bookmark (summary, byline, detailed) */
  insightType: ContentTabType;
  /** Icon size in pixels (default: 24px from headerSpecs.iconSize) */
  size?: number;
  /** Icon color when not bookmarked (default: theme textPrimary) */
  color?: string;
  /** Test ID for testing */
  testID?: string;
}

/**
 * InsightBookmarkButton Component
 *
 * Displays a pressable bookmark icon that toggles bookmark state for insights.
 *
 * Behavior:
 * - Shows filled bookmark icon when bookmarked (gold color)
 * - Shows outline bookmark icon when not bookmarked
 * - Triggers haptic feedback on press
 * - Toggles bookmark state via useBookmarks hook
 *
 * Accessibility:
 * - accessibilityRole="button"
 * - accessibilityLabel for screen readers
 * - accessibilityState for bookmark status
 */
export function InsightBookmarkButton({
  bookId,
  chapterNumber,
  insightType,
  size,
  color,
  testID,
}: InsightBookmarkButtonProps) {
  const { mode, colors } = useTheme();
  const specs = getHeaderSpecs(mode);
  const { isInsightBookmarked, addInsightBookmark, removeInsightBookmark } = useBookmarks();

  // Use provided props or default to theme values
  const iconSize = size ?? specs.iconSize;
  const iconColor = color ?? colors.textPrimary;
  const bookmarkedColor = '#D4AF37'; // Gold color for bookmarked state

  // Check if insight is bookmarked
  const bookmarked = isInsightBookmarked(bookId, chapterNumber, insightType);

  /**
   * Handle bookmark button press
   *
   * Flow:
   * 1. Trigger haptic feedback immediately
   * 2. Toggle bookmark state via hook
   * 3. Handle errors gracefully
   */
  const handlePress = async () => {
    try {
      // Trigger haptic feedback
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Toggle bookmark state
      if (bookmarked) {
        await removeInsightBookmark(bookId, chapterNumber, insightType);
      } else {
        await addInsightBookmark(bookId, chapterNumber, insightType);
      }
    } catch (error) {
      console.error('Failed to toggle insight bookmark:', error);

      // Trigger error haptic feedback
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      style={styles.iconButton}
      accessibilityLabel={`Bookmark ${insightType} insight`}
      accessibilityRole="button"
      accessibilityState={{ selected: bookmarked }}
      testID={testID || `insight-bookmark-button-${insightType}`}
    >
      <Ionicons
        name={bookmarked ? 'bookmark' : 'bookmark-outline'}
        size={iconSize}
        color={bookmarked ? bookmarkedColor : iconColor}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  iconButton: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
