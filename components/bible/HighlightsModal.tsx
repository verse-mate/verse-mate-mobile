/**
 * HighlightsModal Component
 *
 * Modal for viewing highlights for a specific Bible chapter.
 * Replaces the accordion-style expansion in the main highlights list.
 */

import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  fontSizes,
  fontWeights,
  type getColors,
  getModalSpecs,
  spacing,
  type ThemeMode,
} from '@/constants/bible-design-tokens';
import { useTheme } from '@/contexts/ThemeContext';
import type { Highlight } from '@/hooks/bible/use-highlights';

/**
 * Props for HighlightsModal component
 */
export interface HighlightsModalProps {
  /** Whether modal is visible */
  visible: boolean;
  /** Book ID */
  bookId: number;
  /** Chapter number */
  chapterNumber: number;
  /** Book name for display */
  bookName: string;
  /** List of highlights for this chapter */
  highlights: Highlight[];
  /** Callback when modal is closed */
  onClose: () => void;
  /** Callback when highlight is pressed (navigation) */
  onHighlightPress: (bookId: number, chapterNumber: number) => void;
}

/**
 * Convert a number to Unicode superscript characters
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

/**
 * Format highlight text with verse numbers
 */
function formatHighlightWithVerseNumbers(highlight: Highlight): string {
  const { start_verse, end_verse, selected_text } = highlight;

  // If no selected_text, just show verse range
  if (!selected_text) {
    if (start_verse === end_verse) {
      return `Verse ${start_verse}`;
    }
    return `Verses ${start_verse}-${end_verse}`;
  }

  // Single verse - add superscript number at start
  if (start_verse === end_verse) {
    return `${toSuperscript(start_verse)}\u2009${selected_text}`;
  }

  // Multiple verses
  return `${toSuperscript(start_verse)}-${toSuperscript(end_verse)}\u2009${selected_text}`;
}

/**
 * HighlightsModal Component
 */
export function HighlightsModal({
  visible,
  bookId,
  chapterNumber,
  bookName,
  highlights,
  onClose,
  onHighlightPress,
}: HighlightsModalProps) {
  const { colors, mode } = useTheme();
  const styles = createStyles(colors, mode);

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View style={styles.modalContent}>
          <SafeAreaView style={{ flex: 1 }}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.headerTitle}>
                {bookName} {chapterNumber}
              </Text>
              <Pressable onPress={onClose} style={styles.closeButton} testID="close-button">
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </Pressable>
            </View>

            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
              {highlights.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>No highlights found</Text>
                </View>
              ) : (
                <View style={styles.highlightsList}>
                  {highlights.map((highlight) => (
                    <Pressable
                      key={highlight.highlight_id}
                      style={({ pressed }) => [
                        styles.highlightItem,
                        pressed && styles.highlightItemPressed,
                      ]}
                      onPress={() => {
                        onHighlightPress(bookId, chapterNumber);
                        onClose();
                      }}
                      testID={`highlight-item-${highlight.highlight_id}`}
                    >
                      <Text style={styles.highlightText} numberOfLines={3} ellipsizeMode="tail">
                        {formatHighlightWithVerseNumbers(highlight)}
                      </Text>
                      <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                    </Pressable>
                  ))}
                </View>
              )}
            </ScrollView>
          </SafeAreaView>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: ReturnType<typeof getColors>, mode: ThemeMode) => {
  const modalSpecs = getModalSpecs(mode);

  return StyleSheet.create({
    modalContainer: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: modalSpecs.backdropColor,
    },
    modalContent: {
      height: modalSpecs.height,
      backgroundColor: modalSpecs.backgroundColor,
      borderTopLeftRadius: modalSpecs.borderTopLeftRadius,
      borderTopRightRadius: modalSpecs.borderTopRightRadius,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: {
      fontSize: fontSizes.heading2,
      fontWeight: fontWeights.semibold,
      color: colors.textPrimary,
      flex: 1,
    },
    closeButton: {
      padding: spacing.xs,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: spacing.lg,
      paddingBottom: spacing.xxxl,
    },
    highlightsList: {
      marginTop: spacing.sm,
    },
    highlightItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
      minHeight: 60,
      backgroundColor: colors.background,
      borderRadius: 8,
      marginBottom: spacing.sm,
    },
    highlightItemPressed: {
      backgroundColor: colors.backgroundElevated,
    },
    highlightText: {
      flex: 1,
      fontSize: fontSizes.body,
      color: colors.textPrimary,
      lineHeight: 24,
      marginRight: spacing.md,
    },
    emptyState: {
      alignItems: 'center',
      paddingVertical: spacing.xxl,
    },
    emptyStateText: {
      fontSize: fontSizes.body,
      color: colors.textSecondary,
    },
  });
};
