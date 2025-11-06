/**
 * BookmarkToggle Component
 *
 * Renders a pressable bookmark icon that toggles bookmark status for a Bible chapter.
 * Features:
 * - Icon changes based on bookmark status (bookmark vs bookmark-outline)
 * - Optimistic UI updates with automatic rollback on failure
 * - Haptic feedback on press
 * - Accessibility support with proper labels and states
 * - Navigation to bookmarks screen for unauthenticated users (screen shows login prompt)
 * - Loading state handling
 *
 * Visual Design:
 * - Icon: Ionicons bookmark (filled) / bookmark-outline (unfilled)
 * - Size: 24px (from bible-design-tokens headerSpecs.iconSize)
 * - Color: black/dark (matches existing icon styling)
 * - Position: Right of chapter title, left of copy/share icons
 *
 * @see Spec: .agent-os/specs/2025-11-05-bookmark-chapters/spec.md (lines 12-20)
 * @see Task Group 3: Bookmark Toggle Component
 * @see Visual Reference: planning/visuals/bookmark-off.png, bookmark-on.png
 *
 * @example
 * ```tsx
 * <BookmarkToggle bookId={1} chapterNumber={1} />
 * <BookmarkToggle bookId={43} chapterNumber={3} size={20} color="#666" />
 * ```
 */

import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { colors, headerSpecs } from '@/constants/bible-design-tokens';
import { useAuth } from '@/contexts/AuthContext';
import { useBookmarks } from '@/hooks/bible/use-bookmarks';

/**
 * Props for BookmarkToggle component
 */
export interface BookmarkToggleProps {
  /** Book ID (1-66) */
  bookId: number;
  /** Chapter number (1-based) */
  chapterNumber: number;
  /** Icon size in pixels (default: 24px from headerSpecs.iconSize) */
  size?: number;
  /** Icon color (default: colors.black) */
  color?: string;
}

/**
 * BookmarkToggle Component
 *
 * Displays a pressable bookmark icon that toggles bookmark status.
 * Icon automatically updates based on bookmark state:
 * - bookmark-outline (unfilled): Chapter is not bookmarked
 * - bookmark (filled): Chapter is bookmarked
 *
 * Behavior:
 * - Triggers haptic feedback on every press
 * - Navigates to bookmarks screen for unauthenticated users (screen shows login prompt)
 * - Calls addBookmark() if currently unbookmarked (authenticated users)
 * - Calls removeBookmark() if currently bookmarked (authenticated users)
 * - Optimistic UI update (icon changes immediately)
 * - Automatic rollback if API call fails
 *
 * Accessibility:
 * - accessibilityRole="button"
 * - Dynamic accessibilityLabel based on state
 * - accessibilityState.selected indicates bookmarked state
 */
export function BookmarkToggle({
  bookId,
  chapterNumber,
  size = headerSpecs.iconSize,
  color = colors.black,
}: BookmarkToggleProps) {
  const { isAuthenticated } = useAuth();
  const { isBookmarked, addBookmark, removeBookmark, isAddingBookmark, isRemovingBookmark } =
    useBookmarks();

  // Check if chapter is bookmarked
  const bookmarked = isBookmarked(bookId, chapterNumber);

  // Determine icon name based on bookmark status
  const iconName = bookmarked ? 'bookmark' : 'bookmark-outline';

  // Determine accessibility label based on bookmark status
  const accessibilityLabel = bookmarked ? 'Remove bookmark' : 'Bookmark this chapter';

  // Check if operation is in progress
  const isLoading = isAddingBookmark || isRemovingBookmark;

  /**
   * Handle bookmark toggle press
   *
   * Flow:
   * 1. Trigger haptic feedback immediately
   * 2. If not authenticated, navigate to bookmarks screen (shows login prompt)
   * 3. If authenticated, toggle bookmark with optimistic update
   * 4. If API fails, hook automatically rolls back state
   */
  const handlePress = async () => {
    // Trigger haptic feedback before any action (instant feedback)
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // If not authenticated, navigate to bookmarks screen
    // The bookmarks screen will show the login prompt
    if (!isAuthenticated) {
      router.push('/bookmarks');
      return;
    }

    // Toggle bookmark (optimistic update handled by hook)
    if (bookmarked) {
      await removeBookmark(bookId, chapterNumber);
    } else {
      await addBookmark(bookId, chapterNumber);
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={isLoading}
      style={styles.iconButton}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ selected: bookmarked }}
      testID={`bookmark-toggle-${bookId}-${chapterNumber}`}
    >
      <Ionicons name={iconName} size={size} color={color} />
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
