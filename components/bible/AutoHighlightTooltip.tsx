/**
 * AutoHighlightTooltip Component
 *
 * Displays information about an AI-generated auto-highlight.
 * Shows theme name, relevance score, and option to save as user highlight.
 *
 * Shown as a bottom sheet modal when user taps on an auto-highlighted verse.
 */

import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fontSizes, fontWeights, spacing } from '@/constants/bible-design-tokens';
import type { HighlightColor } from '@/constants/highlight-colors';
import type { AutoHighlight } from '@/types/auto-highlights';

interface AutoHighlightTooltipProps {
  /** Auto-highlight to display info for */
  autoHighlight: AutoHighlight | null;
  /** Whether modal is visible */
  visible: boolean;
  /** Callback to close modal */
  onClose: () => void;
  /** Callback to save auto-highlight as user highlight */
  onSaveAsUserHighlight: (
    color: HighlightColor,
    verseRange: { start: number; end: number }
  ) => void;
  /** Whether user is logged in */
  isLoggedIn: boolean;
}

/**
 * AutoHighlightTooltip Component
 *
 * Bottom sheet modal showing auto-highlight details and actions.
 */
export function AutoHighlightTooltip({
  autoHighlight,
  visible,
  onClose,
  onSaveAsUserHighlight,
  isLoggedIn,
}: AutoHighlightTooltipProps) {
  if (!autoHighlight) return null;

  const handleSave = () => {
    if (!isLoggedIn) {
      Alert.alert('Sign In Required', 'Please sign in to save highlights to your collection.', [
        { text: 'OK' },
      ]);
      return;
    }

    // Save auto-highlight as user highlight with the same color and verse range
    onSaveAsUserHighlight(autoHighlight.theme_color, {
      start: autoHighlight.start_verse,
      end: autoHighlight.end_verse,
    });

    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {/* Backdrop */}
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Modal content - prevent close when pressing inside */}
        <Pressable style={styles.container} onPress={(e) => e.stopPropagation()}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.handle} />
          </View>

          {/* Title */}
          <Text style={styles.title}>{autoHighlight.theme_name}</Text>

          {/* Info rows */}
          <View style={styles.infoContainer}>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Relevance:</Text>
              <Text style={styles.value}>{autoHighlight.relevance_score} / 5</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.label}>Type:</Text>
              <Text style={styles.value}>AI-generated highlight</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.label}>Verse Range:</Text>
              <Text style={styles.value}>
                {autoHighlight.start_verse === autoHighlight.end_verse
                  ? `Verse ${autoHighlight.start_verse}`
                  : `Verses ${autoHighlight.start_verse}-${autoHighlight.end_verse}`}
              </Text>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.actionsContainer}>
            {isLoggedIn ? (
              <>
                <Pressable style={styles.primaryButton} onPress={handleSave}>
                  <Text style={styles.primaryButtonText}>Save as My Highlight</Text>
                </Pressable>
                <Pressable style={styles.secondaryButton} onPress={onClose}>
                  <Text style={styles.secondaryButtonText}>Cancel</Text>
                </Pressable>
              </>
            ) : (
              <View style={styles.loginPrompt}>
                <Text style={styles.loginPromptText}>
                  Sign in to save this highlight to your collection
                </Text>
              </View>
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  header: {
    alignItems: 'center',
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.gray300,
    borderRadius: 2,
  },
  title: {
    fontSize: fontSizes.heading2,
    fontWeight: fontWeights.semibold,
    color: colors.gray900,
    marginBottom: spacing.lg,
  },
  infoContainer: {
    marginBottom: spacing.xl,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  label: {
    fontSize: fontSizes.body,
    color: colors.gray500,
    fontWeight: fontWeights.regular,
  },
  value: {
    fontSize: fontSizes.body,
    color: colors.gray900,
    fontWeight: fontWeights.medium,
  },
  actionsContainer: {
    gap: spacing.sm,
  },
  primaryButton: {
    backgroundColor: colors.gold,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: fontSizes.body,
    fontWeight: fontWeights.semibold,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.gray300,
  },
  secondaryButtonText: {
    color: colors.gray900,
    fontSize: fontSizes.body,
    fontWeight: fontWeights.medium,
  },
  loginPrompt: {
    padding: spacing.lg,
    backgroundColor: colors.gray100,
    borderRadius: 8,
    alignItems: 'center',
  },
  loginPromptText: {
    fontSize: fontSizes.body,
    color: colors.gray700,
    textAlign: 'center',
  },
});
