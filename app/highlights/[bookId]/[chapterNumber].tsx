import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HighlightOptionsModal } from '@/components/bible/HighlightOptionsModal';
import { fontSizes, type getColors, spacing } from '@/constants/bible-design-tokens';
import { getHighlightColor } from '@/constants/highlight-colors';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/contexts/ToastContext';
import { type Highlight, useHighlights } from '@/hooks/bible/use-highlights';

/**
 * Extended Highlight type for grouped highlights
 */
interface GroupedHighlight extends Highlight {
  ids: number[];
}

/**
 * Format reference title (e.g., "Genesis 1:1" or "Genesis 1:1-5")
 */
function formatReference(
  bookName: string,
  chapter: number,
  startVerse: number,
  endVerse: number
): string {
  if (startVerse === endVerse) {
    return `${bookName} ${chapter}:${startVerse}`;
  }
  return `${bookName} ${chapter}:${startVerse}-${endVerse}`;
}

/**
 * Group consecutive highlights of the same color
 */
function groupHighlights(highlights: Highlight[]): GroupedHighlight[] {
  if (!highlights.length) return [];

  // Sort by start_verse then end_verse
  const sorted = [...highlights].sort((a, b) => {
    if (a.start_verse !== b.start_verse) return a.start_verse - b.start_verse;
    return a.end_verse - b.end_verse;
  });

  const grouped: GroupedHighlight[] = [];
  let current: GroupedHighlight | null = null;

  for (const h of sorted) {
    if (!current) {
      current = { ...h, ids: [h.highlight_id] };
      continue;
    }

    // Check if contiguous (end_verse + 1 >= start_verse) or overlapping, AND same color
    const isContiguous = current.end_verse + 1 >= h.start_verse;
    const sameColor = current.color === h.color;

    if (isContiguous && sameColor) {
      // Merge highlights
      current.end_verse = Math.max(current.end_verse, h.end_verse);
      current.ids.push(h.highlight_id);

      // Merge text if available
      // Ensure selected_text is always a string for concatenation and includes check
      const currentSelectedText: string = String(current.selected_text || '');
      const newSelectedText: string = String(h.selected_text || '');

      if (newSelectedText) {
        // Only append if newSelectedText actually has content
        if (currentSelectedText) {
          // Avoid duplicating if currentSelectedText already contains newSelectedText
          if (!currentSelectedText.includes(newSelectedText)) {
            current.selected_text = `${currentSelectedText} ${newSelectedText}`;
          }
        } else {
          // If current text is empty/null/undefined, just assign new text
          current.selected_text = newSelectedText;
        }
      }
    } else {
      // Push current and start new group
      grouped.push(current);
      current = { ...h, ids: [h.highlight_id] };
    }
  }

  if (current) {
    grouped.push(current);
  }

  return grouped;
}

export default function ChapterHighlightsScreen() {
  const { bookId, chapterNumber, bookName } = useLocalSearchParams<{
    bookId: string;
    chapterNumber: string;
    bookName: string;
  }>();

  const { colors, mode } = useTheme();
  const styles = createStyles(colors);
  const insets = useSafeAreaInsets();
  const parsedBookId = parseInt(bookId || '0', 10);
  const parsedChapterNumber = parseInt(chapterNumber || '0', 10);

  // selectedHighlight can be a GroupedHighlight
  const [selectedHighlight, setSelectedHighlight] = useState<GroupedHighlight | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);

  const { showToast } = useToast();

  const { chapterHighlights, isFetchingHighlights, deleteHighlight } = useHighlights({
    bookId: parsedBookId,
    chapterNumber: parsedChapterNumber,
  });

  // Memoize grouped highlights
  const groupedHighlights = useMemo(() => {
    return groupHighlights(chapterHighlights);
  }, [chapterHighlights]);

  const handleBackPress = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  const handleHighlightPress = async (highlight: GroupedHighlight) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: '/bible/[bookId]/[chapterNumber]',
      params: {
        bookId: parsedBookId,
        chapterNumber: parsedChapterNumber,
        verse: highlight.start_verse,
        endVerse: highlight.end_verse,
      },
    });
  };

  const handleMenuPress = async (highlight: GroupedHighlight) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedHighlight(highlight);
    setIsModalVisible(true);
  };

  const handleActionComplete = (action: string) => {
    if (action === 'copy') {
      showToast('Copied to clipboard');
    }
  };

  // Handle deletion of grouped highlights
  const handleDeleteGroup = async (highlightId: number) => {
    // Find the group containing this ID
    const group = groupedHighlights.find(
      (g) => g.highlight_id === highlightId || g.ids.includes(highlightId)
    );

    if (group) {
      // Delete all highlights in the group concurrently
      await Promise.all(group.ids.map((id) => deleteHighlight(id)));
    } else {
      // Fallback to single delete
      await deleteHighlight(highlightId);
    }
  };

  // Track if we've loaded data at least once
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (!isFetchingHighlights && chapterHighlights.length > 0) {
      hasLoadedRef.current = true;
    }
  }, [isFetchingHighlights, chapterHighlights.length]);

  // Navigate back if all highlights are deleted
  useEffect(() => {
    if (hasLoadedRef.current && !isFetchingHighlights && chapterHighlights.length === 0) {
      // All highlights deleted, navigate back to main highlights page
      router.back();
    }
  }, [chapterHighlights.length, isFetchingHighlights]);

  if (isFetchingHighlights && chapterHighlights.length === 0) {
    return (
      <View style={styles.container}>
        <View
          style={[
            styles.header,
            { paddingTop: insets.top + spacing.md, paddingBottom: spacing.md },
          ]}
        >
          <Pressable
            onPress={handleBackPress}
            style={styles.backButton}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </Pressable>

          <Text style={styles.headerTitle}>Loading...</Text>

          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.gold} testID="activity-indicator" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container} collapsable={false}>
      <View
        style={[styles.header, { paddingTop: insets.top + spacing.md, paddingBottom: spacing.md }]}
      >
        <Pressable
          onPress={handleBackPress}
          style={styles.backButton}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </Pressable>

        <Text style={styles.headerTitle}>
          {bookName} {chapterNumber}
        </Text>

        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + spacing.lg },
        ]}
      >
        {groupedHighlights.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No highlights found</Text>
          </View>
        ) : (
          <View style={styles.highlightsList}>
            {groupedHighlights.map((highlight) => (
              <Pressable
                key={highlight.highlight_id}
                style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
                onPress={() => handleHighlightPress(highlight)}
              >
                <View style={styles.cardContent}>
                  <View style={styles.cardHeaderRow}>
                    <View
                      style={[
                        styles.colorDot,
                        { backgroundColor: getHighlightColor(highlight.color, mode) },
                      ]}
                    />
                    <Text style={styles.cardTitle}>
                      {formatReference(
                        bookName || '',
                        parsedChapterNumber,
                        highlight.start_verse,
                        highlight.end_verse
                      )}
                    </Text>
                  </View>

                  <View style={styles.cardBody}>
                    <Text style={styles.cardText} numberOfLines={2} ellipsizeMode="tail">
                      {String(highlight.selected_text || 'No content')}
                    </Text>
                  </View>
                </View>

                <Pressable
                  onPress={() => handleMenuPress(highlight)}
                  hitSlop={12}
                  style={({ pressed }) => [styles.menuButton, pressed && { opacity: 0.7 }]}
                >
                  <Ionicons name="ellipsis-horizontal" size={24} color={colors.textSecondary} />
                </Pressable>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      <HighlightOptionsModal
        visible={isModalVisible}
        onClose={() => setIsModalVisible(false)}
        highlight={selectedHighlight}
        bookName={bookName || ''}
        chapterNumber={parsedChapterNumber}
        deleteHighlight={handleDeleteGroup}
        onActionComplete={handleActionComplete}
      />
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof getColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.backgroundSecondary,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      // No background or border
    },
    backButton: {
      padding: spacing.xs,
      width: 40,
      alignItems: 'flex-start',
    },
    headerTitle: {
      flex: 1,
      fontSize: 18,
      fontWeight: '300', // Light weight
      color: colors.textPrimary,
      textAlign: 'center',
    },
    headerSpacer: {
      width: 40,
    },
    centerContent: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingVertical: spacing.sm,
      paddingHorizontal: 0,
    },
    highlightsList: {
      gap: 8, // 8px gap
      paddingHorizontal: 16,
    },
    card: {
      backgroundColor: colors.backgroundElevated,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.borderSecondary,
      padding: 16,
      flexDirection: 'row', // Horizontal layout to center icon vertically
      alignItems: 'center',
    },
    cardPressed: {
      opacity: 0.9,
    },
    cardContent: {
      flex: 1,
    },
    cardHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    colorDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginRight: 8,
    },
    cardTitle: {
      fontSize: 14,
      fontWeight: '400',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    cardBody: {
      minHeight: 48, // Minimum height for the text area
      justifyContent: 'center',
    },
    cardText: {
      fontSize: 14,
      fontWeight: '300', // Light
      color: colors.textPrimary,
      lineHeight: 20,
    },
    menuButton: {
      padding: 4,
      marginLeft: 16, // 16px gap from content
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
