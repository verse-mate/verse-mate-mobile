import type React from 'react';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { getColors } from '@/constants/bible-design-tokens';
import { useTheme } from '@/contexts/ThemeContext';

/**
 * VerseCard Component
 * Displays a Bible verse with reference for VerseMate app
 */
export interface VerseCardProps {
  book: string;
  chapter: number;
  verse: number;
  text: string;
  highlighted?: boolean;
  testID?: string;
}

export const VerseCard: React.FC<VerseCardProps> = ({
  book,
  chapter,
  verse,
  text,
  highlighted = false,
  testID,
}) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const reference = `${book} ${chapter}:${verse}`;

  return (
    <View
      style={[styles.card, highlighted && styles.cardHighlighted]}
      testID={testID}
      accessible={true}
      accessibilityRole="text"
      accessibilityLabel={`${reference}. ${text}`}
      accessibilityHint="Double tap to read full verse details"
    >
      <Text
        style={styles.reference}
        accessibilityRole="header"
        accessibilityLabel={`Reference: ${reference}`}
      >
        {reference}
      </Text>
      <Text style={styles.text} accessibilityRole="text">
        {text}
      </Text>
    </View>
  );
};

const createStyles = (colors: ReturnType<typeof getColors>) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.backgroundElevated,
      borderRadius: 12,
      padding: 16,
      marginVertical: 8,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    cardHighlighted: {
      backgroundColor: colors.goldLight,
      borderLeftWidth: 4,
      borderLeftColor: colors.gold,
    },
    reference: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textSecondary,
      marginBottom: 8,
    },
    text: {
      fontSize: 16,
      lineHeight: 24,
      color: colors.textPrimary,
    },
  });
