/**
 * SwipeBoundaryPage Component
 *
 * A prominent visual indicator shown when users reach the boundary
 * of swipeable content (first/last item in a list).
 *
 * This component is designed to be used within pager views (like TopicPagerView
 * or ChapterPagerView) to provide clear feedback when users attempt to swipe
 * past the available content.
 *
 * The page snaps back automatically - users cannot stay on this page.
 *
 * @example
 * ```tsx
 * <SwipeBoundaryPage
 *   direction="start"
 *   contentType="topic"
 * />
 * ```
 */

import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { fontSizes, fontWeights, spacing } from '@/constants/bible-design-tokens';
import { useTheme } from '@/contexts/ThemeContext';

/**
 * Content types supported by the boundary indicator
 */
export type BoundaryContentType = 'topic' | 'chapter' | 'explanation';

/**
 * Direction of the boundary
 */
export type BoundaryDirection = 'start' | 'end';

export interface SwipeBoundaryPageProps {
  /** Which boundary this represents */
  direction: BoundaryDirection;
  /** Type of content being navigated */
  contentType: BoundaryContentType;
  /** Optional custom message override */
  message?: string;
  /** Optional test ID for testing */
  testID?: string;
}

/**
 * Get the appropriate icon name based on direction
 */
function getIconName(direction: BoundaryDirection): keyof typeof Ionicons.glyphMap {
  return direction === 'start' ? 'chevron-forward-circle' : 'chevron-back-circle';
}

/**
 * Get the default message based on content type and direction
 */
function getDefaultMessage(contentType: BoundaryContentType, direction: BoundaryDirection): string {
  const messages: Record<BoundaryContentType, Record<BoundaryDirection, string>> = {
    topic: {
      start: 'This is the first topic\nin this category',
      end: "You've reached the last topic\nin this category",
    },
    chapter: {
      start: 'This is the first chapter\nof the Bible',
      end: "You've reached the last chapter\nof the Bible",
    },
    explanation: {
      start: 'This is the first explanation',
      end: "You've reached the last explanation",
    },
  };

  return messages[contentType][direction];
}

/**
 * SwipeBoundaryPage Component
 *
 * Displays a prominent visual indicator when users reach the edge
 * of swipeable content. Features:
 * - Directional icon pointing back toward content
 * - Clear message about reaching the boundary
 * - Theme-aware styling (light/dark mode)
 * - Vertically and horizontally centered
 */
export function SwipeBoundaryPage({
  direction,
  contentType,
  message,
  testID,
}: SwipeBoundaryPageProps) {
  const { colors } = useTheme();

  const displayMessage = message ?? getDefaultMessage(contentType, direction);
  const iconName = getIconName(direction);

  return (
    <View
      style={[styles.container, { backgroundColor: colors.background }]}
      testID={testID ?? `swipe-boundary-${direction}`}
    >
      <View style={[styles.card, { backgroundColor: colors.backgroundElevated }]}>
        <Ionicons name={iconName} size={48} color={colors.gold} style={styles.icon} />
        <Text style={[styles.message, { color: colors.textPrimary }]}>{displayMessage}</Text>
        <Text style={[styles.hint, { color: colors.textTertiary }]}>Swipe to go back</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
  },
  card: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.xxl,
    borderRadius: 16,
    maxWidth: 300,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  icon: {
    marginBottom: spacing.lg,
  },
  message: {
    fontSize: fontSizes.bodyLarge,
    fontWeight: fontWeights.medium,
    textAlign: 'center',
    lineHeight: fontSizes.bodyLarge * 1.4,
    marginBottom: spacing.md,
  },
  hint: {
    fontSize: fontSizes.bodySmall,
    fontWeight: fontWeights.regular,
    textAlign: 'center',
  },
});
