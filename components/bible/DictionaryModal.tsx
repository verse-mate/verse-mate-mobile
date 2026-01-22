/**
 * DictionaryModal Component
 *
 * Bottom sheet modal for displaying word definitions.
 * Uses a hybrid approach:
 * - First checks native OS dictionary (iOS UIReferenceLibraryViewController, Android ACTION_DEFINE)
 * - Falls back to embedded Strong's Concordance lexicon for Hebrew/Greek terms
 *
 * Features:
 * - Displays word, Strong's number (if applicable), and definition
 * - Option to open in native OS dictionary
 * - Theme-aware styling (light/dark mode)
 * - Loading state while fetching definitions
 * - Error handling for unavailable definitions
 *
 * @example
 * ```tsx
 * <DictionaryModal
 *   visible={showDictionary}
 *   word="love"
 *   onClose={() => setShowDictionary(false)}
 * />
 * ```
 */

import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
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
import { useNativeDictionary } from '@/hooks/use-native-dictionary';
import { AnalyticsEvent, analytics } from '@/lib/analytics';
import { isValidStrongsNumber, lookup } from '@/services/lexicon-service';
import { getStrongsNumber, hasStrongsNumber } from '@/services/word-mapping-service';
import type { StrongsEntry } from '@/types/dictionary';

export interface DictionaryModalProps {
  /** Whether modal is visible */
  visible: boolean;
  /** Word to look up */
  word: string;
  /** Strong's number (if known from verse mapping) */
  strongsNumber?: string;
  /** Callback when modal is closed */
  onClose: () => void;
}

interface DictionaryState {
  loading: boolean;
  strongsEntry: StrongsEntry | null;
  strongsNum: string | null;
  hasNative: boolean;
  error: string | null;
}

/**
 * DictionaryModal Component
 *
 * Bottom sheet modal for word definitions with native dictionary integration.
 */
export function DictionaryModal({ visible, word, strongsNumber, onClose }: DictionaryModalProps) {
  const { colors, mode } = useTheme();
  const styles = createStyles(colors, mode);
  const { showDefinition, hasDefinition, isAvailable: nativeAvailable } = useNativeDictionary();

  const [state, setState] = useState<DictionaryState>({
    loading: true,
    strongsEntry: null,
    strongsNum: null,
    hasNative: false,
    error: null,
  });

  /**
   * Fetch definition data when word changes
   */
  useEffect(() => {
    if (!visible || !word) return;

    const fetchDefinitions = async () => {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        // Determine Strong's number to look up
        let strongsNum = strongsNumber || null;

        // If no Strong's number provided, check word mapping
        if (!strongsNum && hasStrongsNumber(word)) {
          strongsNum = getStrongsNumber(word);
        }

        // If word looks like a Strong's number itself (e.g., "G26", "H430")
        if (!strongsNum && isValidStrongsNumber(word)) {
          strongsNum = word.toUpperCase();
        }

        // Look up Strong's entry if we have a number
        let strongsEntry: StrongsEntry | null = null;
        if (strongsNum) {
          const result = await lookup(strongsNum);
          if (result.found && result.entry) {
            strongsEntry = result.entry;

            // Track analytics: DICTIONARY_LOOKUP event on successful lookup
            const language = strongsNum.startsWith('G') ? 'greek' : 'hebrew';
            analytics.track(AnalyticsEvent.DICTIONARY_LOOKUP, {
              strongsNumber: strongsNum,
              language: language as 'greek' | 'hebrew',
            });
          }
        }

        // Check native dictionary availability
        let hasNative = false;
        if (nativeAvailable) {
          hasNative = await hasDefinition(word);
        }

        setState({
          loading: false,
          strongsEntry,
          strongsNum,
          hasNative,
          error: !strongsEntry && !hasNative ? 'No definition available' : null,
        });
      } catch {
        setState({
          loading: false,
          strongsEntry: null,
          strongsNum: null,
          hasNative: false,
          error: 'Failed to load definition',
        });
      }
    };

    fetchDefinitions();
  }, [visible, word, strongsNumber, nativeAvailable, hasDefinition]);

  /**
   * Handle close button press
   */
  const handleClose = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  /**
   * Handle "Open in Dictionary" button press
   */
  const handleOpenNative = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const shown = await showDefinition(word);
    if (shown) {
      // Optionally close modal after opening native dictionary
      // onClose();
    }
  };

  /**
   * Clean up word for display (capitalize first letter)
   */
  const displayWord = word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalContainer}
      >
        <Pressable style={styles.backdrop} onPress={handleClose} testID="dictionary-backdrop" />

        <View style={styles.modalContent}>
          <SafeAreaView style={{ flex: 1 }}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.wordTitle}>{displayWord}</Text>
              <Pressable
                onPress={handleClose}
                style={styles.closeButton}
                testID="dictionary-close-button"
              >
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </Pressable>
            </View>

            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
              {/* Loading State */}
              {state.loading && (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={colors.gold} />
                  <Text style={styles.loadingText}>Looking up definition...</Text>
                </View>
              )}

              {/* Error State */}
              {!state.loading && state.error && !state.strongsEntry && !state.hasNative && (
                <View style={styles.errorContainer}>
                  <Ionicons name="alert-circle-outline" size={48} color={colors.textSecondary} />
                  <Text style={styles.errorText}>{state.error}</Text>
                </View>
              )}

              {/* Strong's Definition */}
              {!state.loading && state.strongsEntry && (
                <View style={styles.section}>
                  {/* Strong's Number Badge */}
                  {state.strongsNum && (
                    <View style={styles.strongsBadge}>
                      <Text style={styles.strongsBadgeText}>{state.strongsNum}</Text>
                    </View>
                  )}

                  {/* Original Word (Lemma) */}
                  <Text style={styles.lemmaText}>{state.strongsEntry.lemma}</Text>

                  {/* Definition */}
                  <View style={styles.definitionBox}>
                    <Text style={styles.definitionText}>{state.strongsEntry.definition}</Text>
                  </View>

                  {/* Derivation */}
                  {state.strongsEntry.derivation && (
                    <View style={styles.derivationContainer}>
                      <Text style={styles.derivationLabel}>Derivation:</Text>
                      <Text style={styles.derivationText}>{state.strongsEntry.derivation}</Text>
                    </View>
                  )}

                  {/* KJV Translation */}
                  {state.strongsEntry.kjvTranslation && (
                    <View style={styles.kjvContainer}>
                      <Text style={styles.kjvLabel}>KJV:</Text>
                      <Text style={styles.kjvText}>{state.strongsEntry.kjvTranslation}</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Native Dictionary Button */}
              {!state.loading && state.hasNative && (
                <Pressable
                  style={styles.nativeDictionaryButton}
                  onPress={handleOpenNative}
                  testID="open-native-dictionary"
                >
                  <Ionicons name="book" size={20} color={colors.gold} />
                  <Text style={styles.nativeDictionaryText}>
                    Open in {Platform.OS === 'ios' ? 'iOS' : 'System'} Dictionary
                  </Text>
                  <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                </Pressable>
              )}
            </ScrollView>
          </SafeAreaView>
        </View>
      </KeyboardAvoidingView>
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
      maxHeight: '70%',
      minHeight: 350,
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
    wordTitle: {
      fontSize: fontSizes.heading1,
      fontWeight: fontWeights.bold,
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
    },
    loadingContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.xxl,
      gap: spacing.md,
    },
    loadingText: {
      fontSize: fontSizes.body,
      color: colors.textSecondary,
    },
    errorContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.xxl,
      gap: spacing.md,
    },
    errorText: {
      fontSize: fontSizes.body,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    section: {
      marginBottom: spacing.lg,
    },
    strongsBadge: {
      alignSelf: 'flex-start',
      backgroundColor: colors.gold,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: 16,
      marginBottom: spacing.md,
    },
    strongsBadgeText: {
      fontSize: fontSizes.caption,
      fontWeight: fontWeights.semibold,
      color: '#FFFFFF',
    },
    lemmaText: {
      fontSize: fontSizes.heading1,
      fontWeight: fontWeights.medium,
      color: colors.textPrimary,
      marginBottom: spacing.md,
    },
    definitionBox: {
      backgroundColor: colors.gray50,
      padding: spacing.lg,
      borderRadius: 12,
      marginBottom: spacing.md,
    },
    definitionText: {
      fontSize: fontSizes.body,
      color: colors.textPrimary,
      lineHeight: fontSizes.body * 1.5,
    },
    derivationContainer: {
      marginBottom: spacing.sm,
    },
    derivationLabel: {
      fontSize: fontSizes.caption,
      fontWeight: fontWeights.semibold,
      color: colors.textSecondary,
      marginBottom: spacing.xs,
    },
    derivationText: {
      fontSize: fontSizes.bodySmall,
      color: colors.textSecondary,
      fontStyle: 'italic',
    },
    kjvContainer: {
      marginTop: spacing.sm,
    },
    kjvLabel: {
      fontSize: fontSizes.caption,
      fontWeight: fontWeights.semibold,
      color: colors.textSecondary,
      marginBottom: spacing.xs,
    },
    kjvText: {
      fontSize: fontSizes.bodySmall,
      color: colors.textSecondary,
    },
    nativeDictionaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      backgroundColor: colors.gray50,
      borderRadius: 12,
      gap: spacing.md,
      marginTop: spacing.md,
    },
    nativeDictionaryText: {
      flex: 1,
      fontSize: fontSizes.body,
      color: colors.gold,
      fontWeight: fontWeights.medium,
    },
  });
};
