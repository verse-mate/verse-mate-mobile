/**
 * ChapterReader Component
 *
 * Renders Bible chapter content with sections, subtitles, verses, and explanations.
 * Supports three reading modes via activeTab prop: summary, byline, detailed.
 *
 * Features:
 * - Chapter title (displayMedium: 32px, bold) with bookmark button aligned on the right
 * - Section subtitles (heading2: 20px, semibold)
 * - Verse range captions (caption: 12px, gray500)
 * - Bible text with superscript verse numbers
 * - Markdown rendering for explanation content
 *
 * @see Spec lines 778-821 (Markdown rendering)
 * @see Task Group 4: Add Bookmark Toggle to Chapter Reading Screen
 */

import { StyleSheet, Text, View } from 'react-native';
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
  return (
    <View style={styles.container} collapsable={false}>
      {/* Chapter Title Row with Bookmark */}
      <View style={styles.titleRow} collapsable={false}>
        <Text style={styles.chapterTitle} accessibilityRole="header">
          {chapter.title}
        </Text>
        <BookmarkToggle
          bookId={chapter.bookId}
          chapterNumber={chapter.chapterNumber}
          size={headerSpecs.iconSize}
          color={colors.gray900}
        />
      </View>

      {/* Render Bible verses (only in Bible view) */}
      {!explanationsOnly &&
        chapter.sections.map((section) => (
          <View
            key={`section-${section.startVerse}-${section.subtitle || 'no-subtitle'}`}
            style={styles.section}
            testID={`chapter-section-${section.startVerse}`}
            collapsable={false}
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
        <View style={styles.explanationContainer} collapsable={false}>
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
  // Title row with bookmark button on the right
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xxl,
  },
  chapterTitle: {
    flex: 1,
    fontSize: fontSizes.displayMedium,
    fontWeight: fontWeights.bold,
    lineHeight: fontSizes.displayMedium * lineHeights.display,
    color: colors.gray900,
    marginRight: spacing.md, // Space between title and bookmark
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
