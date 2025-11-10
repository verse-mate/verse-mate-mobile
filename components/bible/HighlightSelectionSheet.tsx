/**
 * HighlightSelectionSheet Component
 *
 * Bottom sheet modal for creating a new highlight after text selection.
 * Displays color picker and additional quick actions.
 *
 * Features:
 * - Verse range label at top (e.g., "Verses 1-5" or "Verse 2")
 * - "HIGHLIGHT VERSE" section with 6-color picker
 * - Additional quick actions: Bookmarked, Take a Note, Copy Verse, Share Verse
 * - Slides up from bottom with backdrop
 * - Haptic feedback on color selection
 * - Closes on backdrop tap or after successful highlight creation
 *
 * @see Spec: .agent-os/specs/2025-11-06-highlight-feature/spec.md (lines 54-63)
 * @see Visual: .agent-os/specs/2025-11-06-highlight-feature/planning/visuals/selected-text-popup.png
 * @see Pattern: components/bible/NotesModal.tsx
 *
 * @example
 * ```tsx
 * <HighlightSelectionSheet
 *   visible={isVisible}
 *   verseRange={{ start: 1, end: 5 }}
 *   onColorSelect={(color) => handleCreateHighlight(color)}
 *   onClose={handleClose}
 * />
 * ```
 */

import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { HighlightColorPicker } from '@/components/bible/HighlightColorPicker';
import {
  colors,
  fontSizes,
  fontWeights,
  modalSpecs,
  spacing,
} from '@/constants/bible-design-tokens';
import type { HighlightColor } from '@/constants/highlight-colors';

/**
 * Verse range for the highlight selection
 */
export interface VerseRange {
  /** Starting verse number */
  start: number;
  /** Ending verse number (same as start for single verse) */
  end: number;
}

/**
 * Props for HighlightSelectionSheet component
 */
export interface HighlightSelectionSheetProps {
  /** Whether modal is visible */
  visible: boolean;
  /** Verse range being highlighted */
  verseRange: VerseRange;
  /** Callback when color is selected (creates highlight) */
  onColorSelect: (color: HighlightColor) => void;
  /** Callback when modal is closed */
  onClose: () => void;
}

/**
 * HighlightSelectionSheet Component
 *
 * Bottom sheet for creating new highlights with color selection and quick actions.
 */
export function HighlightSelectionSheet({
  visible,
  verseRange,
  onColorSelect,
  onClose,
}: HighlightSelectionSheetProps) {
  /**
   * Format verse range for display
   * Single verse: "Verse 2"
   * Multiple verses: "Verses 1-5"
   */
  const verseRangeLabel =
    verseRange.start === verseRange.end
      ? `Verse ${verseRange.start}`
      : `Verses ${verseRange.start}-${verseRange.end}`;

  /**
   * Handle color selection
   */
  const handleColorSelect = async (color: HighlightColor) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onColorSelect(color);
  };

  /**
   * Handle backdrop press with haptic feedback
   */
  const handleBackdropPress = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  /**
   * Handle quick action press (placeholder)
   */
  const handleQuickAction = async (action: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // TODO: Implement quick actions in future
    console.log(`Quick action: ${action}`);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalContainer}
      >
        <Pressable style={styles.backdrop} onPress={handleBackdropPress} testID="backdrop" />

        <SafeAreaView style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.verseRangeLabel}>{verseRangeLabel}</Text>
            <Pressable
              onPress={handleBackdropPress}
              style={styles.closeButton}
              testID="close-button"
            >
              <Ionicons name="close" size={24} color={colors.gray900} />
            </Pressable>
          </View>

          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
            {/* Highlight Verse Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>HIGHLIGHT VERSE</Text>

              <HighlightColorPicker
                selectedColor="yellow"
                onColorSelect={handleColorSelect}
                variant="light"
              />
            </View>

            {/* Quick Actions Section */}
            <View style={styles.quickActions}>
              {/* Bookmarked */}
              <Pressable
                style={styles.quickActionItem}
                onPress={() => handleQuickAction('bookmark')}
              >
                <Ionicons name="bookmark" size={20} color={colors.info} />
                <Text style={styles.quickActionText}>Bookmarked</Text>
              </Pressable>

              {/* Take a Note */}
              <Pressable style={styles.quickActionItem} onPress={() => handleQuickAction('note')}>
                <Ionicons name="document-text-outline" size={20} color={colors.gray700} />
                <Text style={styles.quickActionText}>Take a Note</Text>
              </Pressable>

              {/* Copy Verse */}
              <Pressable style={styles.quickActionItem} onPress={() => handleQuickAction('copy')}>
                <Ionicons name="copy-outline" size={20} color={colors.gray700} />
                <Text style={styles.quickActionText}>Copy Verse</Text>
              </Pressable>

              {/* Share Verse */}
              <Pressable style={styles.quickActionItem} onPress={() => handleQuickAction('share')}>
                <Ionicons name="share-outline" size={20} color={colors.gray700} />
                <Text style={styles.quickActionText}>Share Verse</Text>
              </Pressable>
            </View>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.backdrop,
  },
  modalContent: {
    height: modalSpecs.height,
    backgroundColor: colors.white,
    borderTopLeftRadius: modalSpecs.borderTopLeftRadius,
    borderTopRightRadius: modalSpecs.borderTopRightRadius,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  verseRangeLabel: {
    fontSize: fontSizes.heading2,
    fontWeight: fontWeights.semibold,
    color: colors.gray900,
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
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: fontSizes.caption,
    fontWeight: fontWeights.semibold,
    color: colors.gray500,
    letterSpacing: 1,
    marginBottom: spacing.md,
  },
  quickActions: {
    gap: spacing.xs,
  },
  quickActionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    borderRadius: 8,
    backgroundColor: colors.gray50,
  },
  quickActionText: {
    fontSize: fontSizes.body,
    fontWeight: fontWeights.regular,
    color: colors.gray900,
  },
});
