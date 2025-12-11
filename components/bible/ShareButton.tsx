/**
 * ShareButton Component
 *
 * Renders a pressable share icon that opens the system share sheet for a Bible chapter.
 * Features:
 * - Opens native share sheet with chapter URL
 * - Haptic feedback on press
 * - Error handling for share failures
 * - Accessibility support with proper labels
 *
 * Visual Design:
 * - Icon: Ionicons share-outline
 * - Size: 24px (from bible-design-tokens headerSpecs.iconSize)
 * - Color: black/dark (matches existing icon styling)
 * - Position: Right of notes button in chapter header
 *
 * @see Spec: agent-os/specs/2025-11-06-deep-linking/spec.md (lines 12-19)
 * @see Task Group 3: Share Functionality
 *
 * @example
 * ```tsx
 * <ShareButton bookId={1} chapterNumber={1} bookName="Genesis" />
 * <ShareButton bookId={43} chapterNumber={3} bookName="John" size={20} color="#666" />
 * ```
 */

import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Alert, Pressable, Share, StyleSheet } from 'react-native';
import { getColors, getHeaderSpecs } from '@/constants/bible-design-tokens';
import { useTheme } from '@/contexts/ThemeContext';
import { generateChapterShareUrl } from '@/utils/sharing/generate-chapter-share-url';

/**
 * Props for ShareButton component
 */
export interface ShareButtonProps {
  /** Book ID (1-66) - optional if onShare is provided */
  bookId?: number;
  /** Chapter number (1-based) - optional if onShare is provided */
  chapterNumber?: number;
  /** Book name for share message (e.g., "Genesis", "John") - optional if onShare is provided */
  bookName?: string;
  /** Custom share handler (for topics or custom sharing logic) */
  onShare?: () => void | Promise<void>;
  /** Icon size in pixels (default: 24px from headerSpecs.iconSize) */
  size?: number;
  /** Icon color (default: theme-aware textPrimary) */
  color?: string;
  /** Test ID for testing */
  testID?: string;
}

/**
 * ShareButton Component
 *
 * Displays a pressable share icon that opens system share sheet.
 *
 * Behavior:
 * - Triggers haptic feedback on press
 * - Opens native share sheet with chapter URL
 * - Handles share errors gracefully
 * - Generates shareable URL using generateChapterShareUrl()
 *
 * Share Message Format:
 * "Check out [Book Name] [Chapter Number] on VerseMate: [URL]"
 * Example: "Check out John 3 on VerseMate: https://app.versemate.org/bible/43/3"
 *
 * Accessibility:
 * - accessibilityRole="button"
 * - accessibilityLabel for screen readers
 */
export function ShareButton({
  bookId,
  chapterNumber,
  bookName,
  size,
  color,
  onShare,
  testID,
}: ShareButtonProps) {
  const { mode, colors } = useTheme();
  const specs = getHeaderSpecs(mode);

  // Use provided props or default to theme values
  const iconSize = size ?? specs.iconSize;
  const iconColor = color ?? colors.textPrimary;
  /**
   * Handle share button press
   *
   * Flow:
   * 1. Trigger haptic feedback immediately
   * 2. Generate shareable URL or use custom handler
   * 3. Open system share sheet
   * 4. Handle success/error cases
   */
  const handlePress = async () => {
    // If custom onShare handler is provided, use it
    if (onShare) {
      await onShare();
      return;
    }

    // Default chapter sharing logic
    // TODO: Track analytics - share_chapter_initiated with { bookId, chapterNumber, source: 'chapter_reader' }

    try {
      // Trigger haptic feedback (non-blocking)
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      // Generate shareable URL
      const shareUrl = generateChapterShareUrl(bookId!, chapterNumber!);

      // Format share message
      const message = `Check out ${bookName} ${chapterNumber} on VerseMate: ${shareUrl}`;

      // Open system share sheet
      const result = await Share.share({
        message,
        url: shareUrl, // iOS uses this for better handling
      });

      if (result.action === Share.sharedAction) {
        // TODO: Track analytics - share_chapter_completed with { platform: result.activityType, successful: true }
        console.log('Chapter shared successfully');
      } else if (result.action === Share.dismissedAction) {
        // User dismissed share sheet - no action needed
        console.log('Share dismissed');
      }
    } catch (error) {
      // TODO: Track analytics - share_chapter_failed with { error: error.message }
      console.error('Failed to share chapter:', error);

      // Trigger error haptic feedback
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      // Show user-friendly error message
      Alert.alert('Share Failed', 'Unable to share this chapter. Please try again.');
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      style={styles.iconButton}
      accessibilityLabel={
        bookName && chapterNumber ? `Share ${bookName} ${chapterNumber}` : 'Share'
      }
      accessibilityRole="button"
      testID={testID || 'share-button'}
    >
      <Ionicons name="share-outline" size={iconSize} color={iconColor} />
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
