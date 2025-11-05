/**
 * ChapterReader Component
 *
 * Renders Bible chapter content with sections, subtitles, verses, and explanations.
 * Supports three reading modes via activeTab prop: summary, byline, detailed.
 *
 * Features:
 * - Chapter title (displayMedium: 32px, bold)
 * - Icon row with bookmark, copy, and share actions (Task Group 4)
 * - Section subtitles (heading2: 20px, semibold)
 * - Verse range captions (caption: 12px, gray500)
 * - Bible text with superscript verse numbers
 * - Markdown rendering for explanation content
 *
 * @see Spec lines 778-821 (Markdown rendering)
 * @see Task Group 4: Add Bookmark Toggle to Chapter Reading Screen
 */

import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { BookmarkToggle } from '@/components/bible/BookmarkToggle';
import {
  colors,
  fontSizes,
  fontWeights,
  headerSpecs,
  lineHeights,
  spacing,
} from '@/constants/bible-design-tokens';
import type { ChapterContent, ContentTabType, ExplanationContent } from '@/types/bible';

interface ChapterReaderProps {
  /** Chapter content with verses and sections */
  chapter: ChapterContent;
  /** Active reading mode tab */
  activeTab: ContentTabType;
  /** Optional explanation content (summary/byline/detailed) */
  explanation?: ExplanationContent;
  /** Show only explanations, hide Bible verses (for Explanations view) */
  explanationsOnly?: boolean;
}

/**
 * ChapterReader Component
 *
 * Renders the chapter content in the selected reading mode.
 * - When explanationsOnly is false: Shows Bible text
 * - When explanationsOnly is true: Shows only explanation content
 */
export function ChapterReader({
  chapter,
  explanation,
  explanationsOnly = false,
}: ChapterReaderProps) {
  const [isCopying, setIsCopying] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  /**
   * Handle copy chapter text to clipboard
   *
   * Formats chapter text as: "Genesis 1:1 - verse text\nGenesis 1:2 - verse text"
   */
  const handleCopy = async () => {
    try {
      setIsCopying(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      // Format chapter text with verse numbers
      const chapterText = chapter.sections
        .flatMap((section) =>
          section.verses.map(
            (verse) =>
              `${chapter.bookName} ${chapter.chapterNumber}:${verse.verseNumber} ${verse.text}`
          )
        )
        .join('\n\n');

      await Clipboard.setStringAsync(chapterText);
      Alert.alert('Copied', 'Chapter text copied to clipboard');
    } catch (_error) {
      Alert.alert('Error', 'Failed to copy chapter text');
    } finally {
      setIsCopying(false);
    }
  };

  /**
   * Handle share chapter text
   *
   * Uses native sharing API to share chapter content
   */
  const handleShare = async () => {
    try {
      setIsSharing(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      // Format chapter text with verse numbers
      const chapterText = chapter.sections
        .flatMap((section) =>
          section.verses.map(
            (verse) =>
              `${chapter.bookName} ${chapter.chapterNumber}:${verse.verseNumber} ${verse.text}`
          )
        )
        .join('\n\n');

      const title = `${chapter.title}`;
      const message = `${title}\n\n${chapterText}`;

      // Check if sharing is available
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Error', 'Sharing is not available on this device');
        return;
      }

      // Create a temporary text file to share
      // Note: expo-sharing requires a file URI, so we'll copy to clipboard as fallback
      await Clipboard.setStringAsync(message);
      Alert.alert(
        'Ready to Share',
        'Chapter text copied to clipboard. You can now paste it into your preferred sharing app.'
      );
    } catch (_error) {
      Alert.alert('Error', 'Failed to share chapter text');
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Chapter Title */}
      <Text style={styles.chapterTitle} accessibilityRole="header">
        {chapter.title}
      </Text>

      {/* Icon Row: Bookmark, Copy, Share (Task 4.3, 4.4) */}
      <View style={styles.iconRow} testID="chapter-icon-row">
        {/* Bookmark Toggle (leftmost) */}
        <BookmarkToggle
          bookId={chapter.bookId}
          chapterNumber={chapter.chapterNumber}
          size={headerSpecs.iconSize}
          color={colors.gray900}
        />

        {/* Copy Icon (middle) */}
        <Pressable
          onPress={handleCopy}
          disabled={isCopying}
          style={styles.iconButton}
          accessibilityLabel="Copy chapter text"
          accessibilityRole="button"
          testID="copy-chapter-icon"
        >
          <Ionicons name="document-outline" size={headerSpecs.iconSize} color={colors.gray900} />
        </Pressable>

        {/* Share Icon (rightmost) */}
        <Pressable
          onPress={handleShare}
          disabled={isSharing}
          style={styles.iconButton}
          accessibilityLabel="Share chapter"
          accessibilityRole="button"
          testID="share-chapter-icon"
        >
          <Ionicons name="share-outline" size={headerSpecs.iconSize} color={colors.gray900} />
        </Pressable>
      </View>

      {/* Render Bible verses (only in Bible view) */}
      {!explanationsOnly &&
        chapter.sections.map((section) => (
          <View
            key={`section-${section.startVerse}-${section.subtitle || 'no-subtitle'}`}
            style={styles.section}
            testID={`chapter-section-${section.startVerse}`}
          >
            {/* Section Subtitle (if present) */}
            {section.subtitle && (
              <Text style={styles.sectionSubtitle} accessibilityRole="header">
                {section.subtitle}
              </Text>
            )}

            {/* Verse Range Caption */}
            <Text
              style={styles.verseRange}
              accessibilityLabel={`Verses ${section.startVerse}-${section.endVerse}`}
            >
              {section.startVerse}-{section.endVerse}
            </Text>

            {/* Verses */}
            <View style={styles.versesContainer}>
              {section.verses.map((verse) => (
                <View key={verse.verseNumber} style={styles.verseRow}>
                  <Text
                    style={styles.verseNumber}
                    accessibilityLabel={`Verse ${verse.verseNumber}`}
                  >
                    {verse.verseNumber}
                  </Text>
                  <Text style={styles.verseText}>{verse.text}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}

      {/* Explanation Content (Markdown) - shown in Explanations view */}
      {explanation && (
        <View style={styles.explanationContainer}>
          <Markdown style={markdownStyles}>{explanation.content}</Markdown>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  chapterTitle: {
    fontSize: fontSizes.displayMedium,
    fontWeight: fontWeights.bold,
    lineHeight: fontSizes.displayMedium * lineHeights.display,
    color: colors.gray900,
    marginBottom: spacing.md,
  },
  // Icon row for bookmark, copy, share (Task 4.4)
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md, // 12px spacing between icons
    marginBottom: spacing.xxl,
  },
  // Icon button with 44px minimum touch target (Task 4.4)
  iconButton: {
    padding: spacing.sm, // 8px padding = 24px icon + 16px padding = 40px (close to 44px minimum)
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 44,
    minHeight: 44,
  },
  section: {
    marginBottom: spacing.xxxl,
  },
  sectionSubtitle: {
    fontSize: fontSizes.heading2,
    fontWeight: fontWeights.semibold,
    lineHeight: fontSizes.heading2 * lineHeights.heading,
    color: colors.gray900,
    marginBottom: spacing.sm,
  },
  verseRange: {
    fontSize: fontSizes.caption,
    fontWeight: fontWeights.regular,
    lineHeight: fontSizes.caption * lineHeights.ui,
    color: colors.gray500,
    marginBottom: spacing.md,
  },
  versesContainer: {
    flexDirection: 'column',
  },
  verseRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  verseNumber: {
    fontSize: fontSizes.caption,
    fontWeight: fontWeights.bold,
    lineHeight: fontSizes.bodyLarge * lineHeights.body,
    color: colors.gray500,
    marginRight: spacing.xs,
    marginTop: -4, // Superscript positioning
  },
  verseText: {
    flex: 1,
    fontSize: fontSizes.bodyLarge,
    fontWeight: fontWeights.regular,
    lineHeight: fontSizes.bodyLarge * lineHeights.body,
    color: colors.gray900,
  },
  explanationContainer: {
    marginTop: spacing.xxxl,
    paddingTop: spacing.xxl,
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
  },
});

/**
 * Markdown Styles
 *
 * Custom styling for react-native-markdown-display
 * Ensures explanation content follows design system
 *
 * @see Spec lines 778-821 (Markdown rendering)
 */
const markdownStyles = StyleSheet.create({
  body: {
    fontSize: fontSizes.body,
    lineHeight: fontSizes.body * lineHeights.body,
    color: colors.gray900,
  },
  heading1: {
    fontSize: fontSizes.heading1,
    fontWeight: fontWeights.bold,
    lineHeight: fontSizes.heading1 * lineHeights.heading,
    color: colors.gray900,
    marginTop: spacing.xxl,
    marginBottom: spacing.md,
  },
  heading2: {
    fontSize: fontSizes.heading2,
    fontWeight: fontWeights.semibold,
    lineHeight: fontSizes.heading2 * lineHeights.heading,
    color: colors.gray900,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  heading3: {
    fontSize: fontSizes.heading3,
    fontWeight: fontWeights.semibold,
    lineHeight: fontSizes.heading3 * lineHeights.heading,
    color: colors.gray900,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  paragraph: {
    fontSize: fontSizes.body,
    lineHeight: fontSizes.body * lineHeights.body,
    color: colors.gray900,
    marginBottom: spacing.lg,
  },
  strong: {
    fontWeight: fontWeights.bold,
    color: colors.gray900,
  },
  em: {
    fontStyle: 'italic',
    color: colors.gray900,
  },
  list_item: {
    fontSize: fontSizes.body,
    lineHeight: fontSizes.body * lineHeights.body,
    color: colors.gray900,
    marginBottom: spacing.sm,
  },
  bullet_list: {
    marginBottom: spacing.lg,
  },
  ordered_list: {
    marginBottom: spacing.lg,
  },
  code_inline: {
    fontFamily: 'monospace',
    fontSize: fontSizes.bodySmall,
    backgroundColor: colors.gray50,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: 3,
    color: colors.gray900,
  },
  fence: {
    fontFamily: 'monospace',
    fontSize: fontSizes.bodySmall,
    backgroundColor: colors.gray50,
    padding: spacing.md,
    borderRadius: 4,
    marginBottom: spacing.lg,
    color: colors.gray900,
  },
  blockquote: {
    backgroundColor: colors.gray50,
    borderLeftWidth: 4,
    borderLeftColor: colors.gold,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  link: {
    color: colors.gold,
    textDecorationLine: 'underline',
  },
  hr: {
    backgroundColor: colors.gray200,
    height: 1,
    marginVertical: spacing.xl,
  },
});
