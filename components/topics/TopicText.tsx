/**
 * TopicText Component
 *
 * Renders structured topic content with proper formatting for:
 * - Topic subtitles (h2 headings)
 * - Reference lists under subtitles
 * - Individual verses with superscript numbers and citations
 * - Pressable verses that trigger tooltips
 *
 * Adapted from web version for React Native.
 */

import * as Haptics from 'expo-haptics';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ShareButton } from '@/components/bible/ShareButton';
import {
  fontSizes,
  fontWeights,
  type getColors,
  lineHeights,
  spacing,
} from '@/constants/bible-design-tokens';
import { useTheme } from '@/contexts/ThemeContext';
import type { ParsedTopicContent } from '@/utils/parseTopicMarkdown';
import { parseTopicMarkdown } from '@/utils/parseTopicMarkdown';
import { parseVerseReference } from '@/utils/topics/parseVerseReference';

/**
 * Data passed when a verse is pressed
 */
export interface VersePress {
  bookId: number;
  bookName: string;
  chapterNumber: number;
  verseNumber: number;
  verseText: string;
  verseReference: string;
}

interface TopicTextProps {
  topicName: string;
  markdownContent: string;
  onShare?: () => void;
  onVersePress?: (data: VersePress) => void;
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

export function TopicText({ topicName, markdownContent, onShare, onVersePress }: TopicTextProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  // Parse the markdown content into structured data
  const parsedContent: ParsedTopicContent = useMemo(() => {
    return parseTopicMarkdown(markdownContent);
  }, [markdownContent]);

  // Helper function to handle verse press
  const handleVersePress = (verseText: string, reference: string, verseNumberOverride?: string) => {
    if (!onVersePress) return;

    // Parse the reference to extract components
    const parsed = parseVerseReference(reference);
    if (!parsed) {
      console.warn(`Failed to parse verse reference: ${reference}`);
      return;
    }

    // If we have an explicit verse number from the text content (e.g. clicking on Verse 5 in a 1-5 block),
    // use that instead of what the reference string says (which might be "1-5" -> 1).
    if (verseNumberOverride) {
      const overrideNum = Number.parseInt(verseNumberOverride, 10);
      if (!Number.isNaN(overrideNum)) {
        parsed.verseNumber = overrideNum;
      }
    }

    // Trigger haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Call the callback with parsed data
    onVersePress({
      bookId: parsed.bookId,
      bookName: parsed.bookName,
      chapterNumber: parsed.chapterNumber,
      verseNumber: parsed.verseNumber,
      verseText: verseText.trim(),
      verseReference: reference,
    });
  };

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
      {/* Topic title with share button */}
      <View style={styles.titleContainer}>
        <Text style={styles.title}>{topicName}</Text>
        {onShare && (
          <View style={styles.iconButtons}>
            <ShareButton onShare={onShare} />
          </View>
        )}
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
              {section.verses.map((verse, verseIndex) => {
                // Only make verse pressable if it has a reference (display or clickable) and onVersePress callback
                const isPressable = Boolean(
                  (verse.reference || verse.clickableReference) && onVersePress
                );

                return (
                  <Text key={`${verse.verseNumber}-${verse.reference}-${verseIndex}`}>
                    {/* Verse number as superscript - only show if verse number exists */}
                    {verse.verseNumber && (
                      <Text style={styles.verseNumber}>
                        {toSuperscript(Number.parseInt(verse.verseNumber, 10))}
                      </Text>
                    )}
                    {/* Verse text - use onPress directly on Text to maintain inline flow */}
                    <Text
                      style={[styles.verseText, isPressable && styles.verseTextPressable]}
                      onPress={
                        isPressable
                          ? () =>
                              handleVersePress(
                                verse.text,
                                verse.reference || verse.clickableReference || '',
                                verse.verseNumber
                              )
                          : undefined
                      }
                      suppressHighlighting={!isPressable}
                    >
                      {verse.text}
                      {/* Reference citation (grayed out) - only show if reference exists (DISPLAY ONLY) */}
                      {verse.reference && (
                        <Text style={styles.verseReference}> ({verse.reference})</Text>
                      )}
                    </Text>
                    {/* Add space between verses */}
                    {verseIndex < section.verses.length - 1 && ' '}
                  </Text>
                );
              })}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof getColors>) =>
  StyleSheet.create({
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
      flex: 1,
      fontFamily: 'System',
      fontWeight: fontWeights.bold as '700',
      fontSize: fontSizes.displayMedium,
      lineHeight: fontSizes.displayMedium * lineHeights.display,
      color: colors.textPrimary,
      marginRight: spacing.md,
    },
    iconButtons: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
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
      color: colors.textPrimary,
    },
    subtitleReference: {
      fontFamily: 'System',
      fontSize: fontSizes.body,
      fontWeight: fontWeights.regular as '400',
      lineHeight: fontSizes.body * lineHeights.body,
      textAlign: 'left',
      color: colors.textTertiary,
    },
    versesContainer: {
      width: '100%',
    },
    versesText: {
      fontSize: fontSizes.bodyLarge,
      lineHeight: fontSizes.bodyLarge * 2.0,
      textAlign: 'left',
      color: colors.textPrimary,
    },
    verseNumber: {
      fontSize: fontSizes.bodyLarge,
      fontWeight: fontWeights.bold as '700',
      color: colors.textTertiary,
      marginRight: spacing.xs / 2,
    },
    verseText: {
      fontFamily: 'System',
      fontWeight: fontWeights.regular as '400',
      fontSize: fontSizes.bodyLarge,
      lineHeight: fontSizes.bodyLarge * 2.0,
      color: colors.textPrimary,
    },
    verseTextPressable: {
      // Subtle indicator that verse is interactive (optional, can be removed if too subtle)
    },
    versePressable: {
      // Wrapper for pressable verse - inline display
    },
    versePressablePressed: {
      opacity: 0.6,
    },
    verseReference: {
      fontFamily: 'System',
      fontWeight: fontWeights.regular as '400',
      fontSize: fontSizes.body,
      lineHeight: fontSizes.bodyLarge * 2.0,
      color: colors.textTertiary,
    },
  });
