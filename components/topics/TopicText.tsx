/**
 * TopicText Component
 *
 * Renders structured topic content with proper formatting for:
 * - Topic subtitles (h2 headings)
 * - Reference lists under subtitles
 * - Individual verses with superscript numbers and citations
 *
 * Adapted from web version for React Native.
 */

import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  colors,
  fontSizes,
  fontWeights,
  lineHeights,
  spacing,
} from '@/constants/bible-design-tokens';
import type { ParsedTopicContent } from '@/utils/parseTopicMarkdown';
import { parseTopicMarkdown } from '@/utils/parseTopicMarkdown';

interface TopicTextProps {
  topicName: string;
  markdownContent: string;
}

/**
 * Convert a number to Unicode superscript characters
 * Reuses the same logic from topic screen for consistency
 */
function toSuperscript(num: number): string {
  const superscriptMap: Record<string, string> = {
    '0': '⁰',
    '1': '¹',
    '2': '²',
    '3': '³',
    '4': '⁴',
    '5': '⁵',
    '6': '⁶',
    '7': '⁷',
    '8': '⁸',
    '9': '⁹',
  };

  return num
    .toString()
    .split('')
    .map((digit) => superscriptMap[digit] || digit)
    .join('');
}

export function TopicText({ topicName, markdownContent }: TopicTextProps) {
  // Parse the markdown content into structured data
  const parsedContent: ParsedTopicContent = useMemo(() => {
    return parseTopicMarkdown(markdownContent);
  }, [markdownContent]);

  // Helper function to render reference list with proper styling
  const renderReferenceList = (referenceList: string) => {
    if (!referenceList) return null;

    // Remove outer parentheses if present
    const cleanList = referenceList.replace(/^\(|\)$/g, '');
    // Split by comma but keep each reference together
    const refs = cleanList.split(',').map((ref) => ref.trim());

    return <Text style={styles.subtitleReference}>({refs.join(', ')})</Text>;
  };

  return (
    <View style={styles.contentBox}>
      {/* Topic title */}
      <View style={styles.titleContainer}>
        <Text style={styles.title}>{topicName}</Text>
      </View>

      {/* Render each subtitle section */}
      {parsedContent.subtitles.map((section, index) => (
        <View key={`${section.subtitle}-${index}`} style={styles.textBox}>
          {/* Subtitle */}
          <View style={styles.subtitleBox}>
            <Text style={styles.subtitle}>{section.subtitle}</Text>
            {/* Reference list under subtitle (grayed out) */}
            {section.referenceList && renderReferenceList(section.referenceList)}
          </View>

          {/* Verses container */}
          <View style={styles.versesContainer}>
            <Text style={styles.versesText}>
              {section.verses.map((verse, verseIndex) => (
                <Text key={`${verse.verseNumber}-${verse.reference}-${verseIndex}`}>
                  {/* Verse number as superscript */}
                  <Text style={styles.verseNumber}>
                    {toSuperscript(Number.parseInt(verse.verseNumber, 10))}
                  </Text>
                  {/* Verse text */}
                  <Text style={styles.verseText}>
                    {verse.text}
                    {/* Reference citation (grayed out) - only show if reference exists */}
                    {verse.reference && (
                      <Text style={styles.verseReference}> ({verse.reference})</Text>
                    )}
                  </Text>
                  {/* Add space between verses */}
                  {verseIndex < section.verses.length - 1 && ' '}
                </Text>
              ))}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  contentBox: {
    flexDirection: 'column',
    gap: spacing.xxxl * 2, // 64px equivalent
    paddingBottom: spacing.xxxl,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  title: {
    fontFamily: 'System',
    fontWeight: fontWeights.bold as '700',
    fontSize: fontSizes.displayMedium,
    lineHeight: fontSizes.displayMedium * lineHeights.display,
    color: colors.gray900,
  },
  textBox: {
    flexDirection: 'column',
    gap: spacing.md,
  },
  subtitleBox: {
    flexDirection: 'column',
    gap: 4,
    width: '100%',
  },
  subtitle: {
    fontFamily: 'System',
    fontSize: fontSizes.heading2,
    fontWeight: fontWeights.bold as '700',
    lineHeight: fontSizes.heading2 * lineHeights.heading,
    textAlign: 'left',
    color: colors.gray900,
  },
  subtitleReference: {
    fontFamily: 'System',
    fontSize: fontSizes.body,
    fontWeight: fontWeights.regular as '400',
    lineHeight: fontSizes.body * lineHeights.body,
    textAlign: 'left',
    color: colors.gray500,
  },
  versesContainer: {
    width: '100%',
  },
  versesText: {
    fontSize: fontSizes.bodyLarge,
    lineHeight: fontSizes.bodyLarge * 2.0,
    textAlign: 'left',
    color: colors.gray900,
  },
  verseNumber: {
    fontSize: fontSizes.bodyLarge,
    fontWeight: fontWeights.bold as '700',
    color: colors.gray500,
    marginRight: spacing.xs / 2,
  },
  verseText: {
    fontFamily: 'System',
    fontWeight: fontWeights.regular as '400',
    fontSize: fontSizes.bodyLarge,
    lineHeight: fontSizes.bodyLarge * 2.0,
    color: colors.gray900,
  },
  verseReference: {
    fontFamily: 'System',
    fontWeight: fontWeights.regular as '400',
    fontSize: fontSizes.body,
    lineHeight: fontSizes.bodyLarge * 2.0,
    color: colors.gray500,
  },
});
