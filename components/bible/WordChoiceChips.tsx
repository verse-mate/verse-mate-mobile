/**
 * The words of a multi-word selection, as chips above a definition.
 *
 * Define on a selection of several words opens the first one; these let the reader switch to any
 * other word they selected without selecting again. Shown by both definition sheets (the Greek/Hebrew
 * card and the English dictionary), so switching between a lexicon word and a plain word feels like
 * one control even though it swaps the sheet underneath.
 *
 * Colours come from the sheet, not from `useTheme()`: the lexicon card is a gorhom BottomSheetModal,
 * which renders through a portal above the ThemeProvider, so a theme hook in here threw "useTheme must
 * be used within a ThemeProvider" and crashed the app the first time Define opened chips (simulator,
 * 2026-10-31). The sheets read the theme where it exists and pass it down.
 */

import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { type getColors, spacing } from '@/theme/tokens';

export interface WordChoiceChipsProps {
  /** The sheet's theme colours (see the note above on why not `useTheme()`). */
  colors: ReturnType<typeof getColors>;
  words: string[];
  active: number;
  onChoose: (index: number) => void;
  testID?: string;
}

export function WordChoiceChips({
  colors,
  words,
  active,
  onChoose,
  testID = 'word-choice-chips',
}: WordChoiceChipsProps) {
  const styles = useMemo(() => createStyles(colors), [colors]);
  if (words.length < 2) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="always"
      contentContainerStyle={styles.row}
      testID={testID}
    >
      {words.map((word, index) => {
        const selected = index === active;
        return (
          <Pressable
            // biome-ignore lint/suspicious/noArrayIndexKey: the list is fixed for the sheet's life
            key={`${index}-${word}`}
            onPress={() => !selected && onChoose(index)}
            style={[styles.chip, selected && styles.chipSelected]}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            testID={`${testID}-${index}`}
          >
            <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{word}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const createStyles = (colors: ReturnType<typeof getColors>) =>
  StyleSheet.create({
    row: {
      gap: spacing.sm,
      paddingVertical: spacing.sm,
    },
    chip: {
      height: 32,
      paddingHorizontal: spacing.md,
      borderRadius: 100,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chipSelected: {
      backgroundColor: colors.gold,
      borderColor: colors.gold,
    },
    chipText: {
      fontSize: 13,
      color: colors.textPrimary,
    },
    chipTextSelected: {
      color: colors.black,
    },
  });
