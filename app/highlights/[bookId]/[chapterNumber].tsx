import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HighlightOptionsModal } from '@/components/bible/HighlightOptionsModal';
import { Toast } from '@/components/ui/Toast';
import { fontSizes, fontWeights, type getColors, spacing } from '@/constants/bible-design-tokens';
import { useTheme } from '@/contexts/ThemeContext';
import { type Highlight, useHighlights } from '@/hooks/bible/use-highlights';

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

export default function ChapterHighlightsScreen() {
  const { bookId, chapterNumber, bookName } = useLocalSearchParams<{
    bookId: string;
    chapterNumber: string;
    bookName: string;
  }>();

  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const parsedBookId = parseInt(bookId || '0', 10);
  const parsedChapterNumber = parseInt(chapterNumber || '0', 10);

  const [selectedHighlight, setSelectedHighlight] = useState<Highlight | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);

  // Toast State
  const [isToastVisible, setIsToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const { chapterHighlights, isFetchingHighlights, deleteHighlight } = useHighlights({
    bookId: parsedBookId,
    chapterNumber: parsedChapterNumber,
  });

  const handleBackPress = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  const handleHighlightPress = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/bible/${parsedBookId}/${parsedChapterNumber}`);
  };

  const handleMenuPress = async (highlight: Highlight) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedHighlight(highlight);
    setIsModalVisible(true);
  };

  const handleActionComplete = (action: string) => {
    if (action === 'copy') {
      setToastMessage('Copied to clipboard');
      setIsToastVisible(true);
    }
  };

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
        {chapterHighlights.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No highlights found</Text>
          </View>
        ) : (
          <View style={styles.highlightsList}>
            {chapterHighlights.map((highlight) => (
              <Pressable
                key={highlight.highlight_id}
                style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
                onPress={handleHighlightPress}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>
                    {formatReference(
                      bookName || '',
                      parsedChapterNumber,
                      highlight.start_verse,
                      highlight.end_verse
                    )}
                  </Text>
                </View>

                <Text style={styles.cardText} numberOfLines={5} ellipsizeMode="tail">
                  {String(highlight.selected_text || 'No content')}
                </Text>

                <View style={styles.cardFooter}>
                  <Pressable
                    onPress={() => handleMenuPress(highlight)}
                    hitSlop={12}
                    style={({ pressed }) => [styles.menuButton, pressed && { opacity: 0.7 }]}
                  >
                    <Ionicons name="ellipsis-horizontal" size={20} color={colors.textSecondary} />
                  </Pressable>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      <HighlightOptionsModal
        visible={isModalVisible}
        onClose={() => setIsModalVisible(false)}
        highlight={selectedHighlight}
        deleteHighlight={deleteHighlight}
        onActionComplete={handleActionComplete}
      />

      <Toast
        visible={isToastVisible}
        message={toastMessage}
        onHide={() => setIsToastVisible(false)}
      />
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof getColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.background,
    },
    backButton: {
      padding: spacing.xs,
      marginRight: spacing.sm,
    },
    headerTitle: {
      flex: 1,
      fontSize: fontSizes.heading3,
      fontWeight: fontWeights.bold,
      color: colors.textPrimary,
      textAlign: 'center',
    },
    headerSpacer: {
      width: 32,
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
      padding: spacing.lg,
    },
    highlightsList: {
      gap: spacing.md,
    },
    card: {
      backgroundColor: colors.backgroundElevated,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    cardPressed: {
      opacity: 0.95,
      transform: [{ scale: 0.995 }],
    },
    cardHeader: {
      marginBottom: spacing.sm,
    },
    cardTitle: {
      fontSize: fontSizes.caption,
      fontWeight: fontWeights.bold,
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    cardText: {
      fontSize: fontSizes.body,
      color: colors.textPrimary,
      lineHeight: 24,
      marginBottom: spacing.sm,
    },
    cardFooter: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginTop: spacing.xs,
    },
    menuButton: {
      padding: spacing.xs,
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
