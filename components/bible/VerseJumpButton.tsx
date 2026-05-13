/**
 * VerseJumpButton
 *
 * Floating action button + verse-number grid modal. Used by the By Line
 * explanation tab so readers can jump to a specific verse instead of scrolling
 * through long chapters (e.g. Psalm 119, 176 verses).
 *
 * @see verse-mate-mobile issue #77
 */

import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { fontSizes, fontWeights, type getColors, spacing, type ThemeMode } from '@/theme/tokens';

export interface VerseJumpButtonProps {
  /** Ordered list of verse numbers available in the By Line view */
  verses: number[];
  /** Called with the chosen verse number after the modal closes */
  onSelect: (verseNumber: number) => void;
  /** Hide the button entirely (e.g. when the tab is not active) */
  visible?: boolean;
  /** Test id prefix; sub-elements append a suffix (verse cells, backdrop, modal) */
  testID?: string;
}

const HAPTICS_ENABLED = Platform.OS !== 'web';

function triggerHaptic() {
  if (!HAPTICS_ENABLED) return;
  // Fire-and-forget; failures are non-fatal in tests.
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

export function VerseJumpButton({
  verses,
  onSelect,
  visible = true,
  testID = 'verse-jump-button',
}: VerseJumpButtonProps) {
  const { mode, colors } = useTheme();
  const [open, setOpen] = useState(false);
  const styles = createStyles(mode, colors);

  if (!visible || verses.length === 0) return null;

  const handleOpen = () => {
    triggerHaptic();
    setOpen(true);
  };

  const handleClose = () => setOpen(false);

  const handleSelect = (verseNumber: number) => {
    triggerHaptic();
    setOpen(false);
    // Defer to the next tick so the modal can dismiss before the scroll
    // animation begins — feels smoother on iOS.
    setTimeout(() => onSelect(verseNumber), 0);
  };

  return (
    <>
      <Pressable
        onPress={handleOpen}
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        accessibilityLabel="Jump to verse"
        accessibilityRole="button"
        accessibilityHint="Open the list of verses to jump to one in the By Line view"
        testID={testID}
      >
        <Ionicons name="list" size={22} color="#ffffff" />
        <Text style={styles.fabLabel} accessibilityElementsHidden>
          Verse
        </Text>
      </Pressable>
      <Modal
        visible={open}
        animationType="fade"
        transparent
        onRequestClose={handleClose}
        testID={`${testID}-modal`}
      >
        <Pressable
          style={styles.backdrop}
          onPress={handleClose}
          accessibilityLabel="Close verse list"
          testID={`${testID}-backdrop`}
        >
          {/* Inner pressable swallows taps so the sheet doesn't close. */}
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.title}>Jump to verse</Text>
            <ScrollView
              style={styles.gridScroll}
              contentContainerStyle={styles.grid}
              showsVerticalScrollIndicator={false}
            >
              {verses.map((verseNumber) => (
                <Pressable
                  key={verseNumber}
                  onPress={() => handleSelect(verseNumber)}
                  style={({ pressed }) => [styles.cell, pressed && styles.cellPressed]}
                  accessibilityLabel={`Jump to verse ${verseNumber}`}
                  accessibilityRole="button"
                  testID={`${testID}-verse-${verseNumber}`}
                >
                  <Text style={styles.cellText}>{verseNumber}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const FAB_SIZE = 52;
const CELL_SIZE = 48;

const createStyles = (mode: ThemeMode, colors: ReturnType<typeof getColors>) =>
  StyleSheet.create({
    fab: {
      position: 'absolute',
      right: spacing.lg,
      bottom: spacing.lg + 60, // sit above the progress bar / FAB row
      width: FAB_SIZE,
      height: FAB_SIZE,
      borderRadius: FAB_SIZE / 2,
      backgroundColor: colors.gold,
      justifyContent: 'center',
      alignItems: 'center',
      ...Platform.select({
        ios: {
          shadowColor: colors.shadow,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: mode === 'dark' ? 0.4 : 0.2,
          shadowRadius: 6,
        },
        android: {
          elevation: 6,
        },
        default: {},
      }),
    },
    fabPressed: {
      opacity: 0.85,
    },
    fabLabel: {
      position: 'absolute',
      bottom: 4,
      fontSize: 9,
      color: '#ffffff',
      fontWeight: fontWeights.semibold,
    },
    backdrop: {
      flex: 1,
      backgroundColor: colors.backdrop,
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.backgroundElevated,
      borderTopLeftRadius: spacing.lg,
      borderTopRightRadius: spacing.lg,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.xxl,
      maxHeight: '70%',
    },
    title: {
      fontSize: fontSizes.heading2,
      fontWeight: fontWeights.semibold,
      color: colors.textPrimary,
      marginBottom: spacing.md,
    },
    gridScroll: {
      flexGrow: 0,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
    },
    cell: {
      width: CELL_SIZE,
      height: CELL_SIZE,
      borderRadius: spacing.sm,
      backgroundColor: colors.backgroundSecondary,
      borderWidth: 1,
      borderColor: colors.borderSecondary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    cellPressed: {
      backgroundColor: colors.gold,
      borderColor: colors.gold,
    },
    cellText: {
      fontSize: fontSizes.body,
      fontWeight: fontWeights.semibold,
      color: colors.textPrimary,
    },
  });
