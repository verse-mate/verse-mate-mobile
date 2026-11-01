/**
 * HighlightSelectionSheet Component
 *
 * Bottom sheet modal for creating a new highlight after text selection.
 * Displays color picker and additional quick actions.
 *
 * Features:
 * - Verse range label at top (e.g., "Verses 1-5" or "Verse 2")
 * - Colour picker; tapping a colour highlights the chosen scope
 * - Scope, for words selected in the text: just those words, the whole verse, or every place the
 *   words occur in the book ("Highlight all", Andy 2026-11-01: a study method for repeated words
 *   and phrases, like "I am" in John)
 * - Copy, Share and Note for the selected words, the same actions as the selection menu's (Andy
 *   lists them here too, repeats and all). They used to be placeholders that did nothing.
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
import type { ComponentProps } from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HighlightColorPicker } from '@/components/bible/HighlightColorPicker';
import type { HighlightColor } from '@/constants/highlight-colors';
import { useTheme } from '@/contexts/ThemeContext';
import { useDeviceInfo } from '@/hooks/use-device-info';
import {
  fontSizes,
  fontWeights,
  type getColors,
  getModalSpecs,
  spacing,
  type ThemeMode,
} from '@/theme/tokens';

/**
 * Verse range for the highlight selection
 */
export interface VerseRange {
  /** Starting verse number */
  start: number;
  /** Ending verse number (same as start for single verse) */
  end: number;
  /** Offset into the start verse's text where a word-level highlight begins. */
  startChar?: number;
  /** Offset into the end verse's text where it ends (exclusive). */
  endChar?: number;
}

/**
 * What a colour applies to: the selected words, the verses they are in, or every place those words
 * occur in the book.
 */
export type HighlightScope = 'selection' | 'verse' | 'book';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

/** Longest selection "Highlight all" is offered for: a word or a phrase, not a sentence. */
const HIGHLIGHT_ALL_MAX_WORDS = 6;

/**
 * The scopes the sheet offers, in order. None when there is nothing to choose: a whole-verse
 * selection can only highlight its verses.
 */
export function highlightScopes({
  verseRange,
  text,
  canHighlightAll,
}: {
  verseRange: VerseRange;
  text?: string;
  canHighlightAll: boolean;
}): HighlightScope[] {
  const words = text?.trim().split(/\s+/).filter(Boolean) ?? [];
  const isWords = verseRange.startChar !== undefined && verseRange.endChar !== undefined;
  if (!isWords) return [];
  const scopes: HighlightScope[] = ['selection', 'verse'];
  if (
    canHighlightAll &&
    verseRange.start === verseRange.end &&
    words.length > 0 &&
    words.length <= HIGHLIGHT_ALL_MAX_WORDS
  ) {
    scopes.push('book');
  }
  return scopes;
}

/** The selection menu's own Copy / Share / Note, offered again in the sheet. */
export interface HighlightSheetActions {
  copy?: () => void;
  share?: () => void;
  note?: () => void;
}

/**
 * Props for HighlightSelectionSheet component
 */
export interface HighlightSelectionSheetProps {
  /** Whether modal is visible */
  visible: boolean;
  /** Verse range being highlighted */
  verseRange: VerseRange;
  /** The selected words, for the "Highlight all" description. */
  text?: string;
  /** Book name, for the "All in John" label. */
  bookName?: string;
  /** Offer "Highlight all": every place the selected words occur in the book. */
  canHighlightAll?: boolean;
  /** A colour was chosen for this scope. */
  onColorSelect: (color: HighlightColor, scope: HighlightScope) => void;
  /** Copy / Share / Note for the selection; a row shows for each one given. */
  actions?: HighlightSheetActions;
  /** Callback when modal is closed */
  onClose: () => void;
  /** Whether to use a system Modal (true) or a View overlay (false) */
  useModal?: boolean;
}

/**
 * HighlightSelectionSheet Component
 *
 * Bottom sheet for creating new highlights with color selection and quick actions.
 */
export function HighlightSelectionSheet({
  visible,
  verseRange,
  text,
  bookName,
  canHighlightAll = false,
  actions,
  onColorSelect,
  onClose,
  useModal = true,
}: HighlightSelectionSheetProps) {
  const scopes = highlightScopes({ verseRange, text, canHighlightAll });
  const [scope, setScope] = useState<HighlightScope>('selection');
  // Every opening starts on the selected words, whatever the last one chose.
  useEffect(() => {
    if (visible) setScope('selection');
  }, [visible]);
  const activeScope: HighlightScope = scopes.length === 0 ? 'verse' : scope;
  const { colors, mode } = useTheme();
  const { useSplitView, splitRatio, splitViewMode } = useDeviceInfo();
  const { width: windowWidth } = useWindowDimensions();

  // Calculate dynamic right panel width if in split view (and right panel is visible)
  const rightPanelWidth =
    useSplitView && splitViewMode !== 'left-full' ? windowWidth * (1 - splitRatio) : undefined;

  const styles = useMemo(
    () => createStyles(colors, mode, rightPanelWidth),
    [colors, mode, rightPanelWidth]
  );

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
    onColorSelect(color, activeScope);
  };

  /** Close the sheet, then act: Note opens the notes sheet, which must not stack on this one. */
  const handleAction = async (action: () => void) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
    action();
  };

  const actionRows: { key: keyof HighlightSheetActions; label: string; icon: IoniconName }[] = [
    { key: 'copy', label: 'Copy', icon: 'copy-outline' },
    { key: 'share', label: 'Share', icon: 'share-outline' },
    { key: 'note', label: 'Take a Note', icon: 'document-text-outline' },
  ];

  const scopeLabel = (value: HighlightScope) => {
    if (value === 'selection') return 'Selection';
    if (value === 'verse')
      return verseRange.start === verseRange.end ? 'Whole verse' : 'Whole verses';
    return bookName ? `All in ${bookName}` : 'All in book';
  };

  /**
   * Handle backdrop press with haptic feedback
   */
  const handleBackdropPress = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  const content = (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.modalContainer}
      pointerEvents="box-none"
    >
      <Pressable
        style={[
          styles.backdrop,
          // Constrain backdrop to right panel in split view mode
          !useModal && rightPanelWidth
            ? {
                left: windowWidth - rightPanelWidth,
                width: rightPanelWidth,
              }
            : undefined,
        ]}
        onPress={handleBackdropPress}
        testID="backdrop"
        pointerEvents="auto"
      />

      <SafeAreaView style={styles.modalContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.verseRangeLabel}>{verseRangeLabel}</Text>
          <Pressable onPress={handleBackdropPress} style={styles.closeButton} testID="close-button">
            <Ionicons name="close" size={24} color={colors.textPrimary} />
          </Pressable>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {scopes.length > 0 ? (
            <View style={styles.section}>
              <View style={styles.scopeRow} accessibilityRole="radiogroup">
                {scopes.map((value) => {
                  const selected = value === activeScope;
                  return (
                    <Pressable
                      key={value}
                      style={[styles.scopeOption, selected && styles.scopeOptionSelected]}
                      onPress={() => setScope(value)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      testID={`highlight-scope-${value}`}
                    >
                      <Text
                        style={[styles.scopeText, selected && styles.scopeTextSelected]}
                        numberOfLines={1}
                      >
                        {scopeLabel(value)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {activeScope === 'book' && text ? (
                <Text style={styles.scopeHint} testID="highlight-scope-hint">
                  {`Highlights every \u201C${text.trim()}\u201D in ${bookName ?? 'this book'}`}
                </Text>
              ) : null}
            </View>
          ) : null}

          <View style={[styles.section, styles.lastSection]}>
            <Text style={styles.sectionTitle}>
              {activeScope === 'verse' && scopes.length === 0 ? 'HIGHLIGHT VERSE' : 'HIGHLIGHT'}
            </Text>

            <HighlightColorPicker
              selectedColor="yellow"
              onColorSelect={handleColorSelect}
              variant={mode === 'dark' ? 'dark' : 'light'}
            />
          </View>
        </ScrollView>

        {/* At the bottom of the sheet, outside the scrolling colour area (Sebastian). */}
        {actions ? (
          <View style={styles.quickActions} testID="highlight-actions">
            {actionRows.map(({ key, label, icon }) => {
              const action = actions[key];
              if (!action) return null;
              return (
                <Pressable
                  key={key}
                  style={styles.quickActionItem}
                  onPress={() => handleAction(action)}
                  testID={`highlight-action-${key}`}
                >
                  <Ionicons name={icon} size={20} color={colors.textSecondary} />
                  <Text style={styles.quickActionText}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </SafeAreaView>
    </KeyboardAvoidingView>
  );

  if (useModal) {
    return (
      <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
        {content}
      </Modal>
    );
  }

  // Non-modal rendering (Overlay)
  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {content}
    </View>
  );
}

const createStyles = (
  colors: ReturnType<typeof getColors>,
  mode: ThemeMode,
  rightPanelWidth?: number
) => {
  const modalSpecs = getModalSpecs(mode);

  return StyleSheet.create({
    modalContainer: {
      flex: 1,
      justifyContent: 'flex-end',
      alignItems: rightPanelWidth ? 'flex-end' : undefined, // Align to right if split view
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: modalSpecs.backdropColor,
    },
    modalContent: {
      // As tall as its content (capped), so Copy / Share / Note at the bottom sit just under the
      // colours rather than a screen-height away from them.
      maxHeight: modalSpecs.height,
      width: rightPanelWidth ?? '100%', // Use dynamic width or full width
      backgroundColor: modalSpecs.backgroundColor,
      borderTopLeftRadius: modalSpecs.borderTopLeftRadius,
      borderTopRightRadius: rightPanelWidth ? 0 : modalSpecs.borderTopRightRadius, // Remove corner if pinned
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    verseRangeLabel: {
      fontSize: fontSizes.heading2,
      fontWeight: fontWeights.semibold,
      color: colors.textPrimary,
      flex: 1,
    },
    closeButton: {
      padding: spacing.xs,
    },
    scrollView: {
      flexGrow: 0,
      flexShrink: 1,
    },
    scrollContent: {
      padding: spacing.lg,
      paddingBottom: 0,
    },
    section: {
      marginBottom: spacing.xl,
    },
    lastSection: {
      marginBottom: 0,
    },
    sectionTitle: {
      fontSize: fontSizes.caption,
      fontWeight: fontWeights.semibold,
      color: colors.textSecondary,
      letterSpacing: 1,
      marginBottom: spacing.md,
    },
    scopeRow: {
      flexDirection: 'row',
      borderRadius: 10,
      padding: 3,
      backgroundColor: colors.gray50,
      gap: 3,
    },
    scopeOption: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.xs,
      borderRadius: 8,
    },
    scopeOptionSelected: {
      backgroundColor: colors.backgroundElevated,
    },
    scopeText: {
      fontSize: fontSizes.bodySmall,
      fontWeight: fontWeights.medium,
      color: colors.textSecondary,
    },
    scopeTextSelected: {
      color: colors.textPrimary,
      fontWeight: fontWeights.semibold,
    },
    quickActions: {
      gap: spacing.xs,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xxxl,
      paddingBottom: spacing.lg,
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
      color: colors.textPrimary,
    },
    scopeHint: {
      marginTop: spacing.sm,
      fontSize: fontSizes.caption,
      color: colors.textTertiary,
    },
  });
};
