import type React from 'react';
import { StyleSheet, Text, View } from 'react-native';

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

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHighlighted: {
    backgroundColor: '#FEF3C7',
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  reference: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6B7280',
    marginBottom: 8,
  },
  text: {
    fontSize: 16,
    lineHeight: 24,
    color: '#1F2937',
  },
});
