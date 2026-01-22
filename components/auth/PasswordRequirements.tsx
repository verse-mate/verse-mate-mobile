import { Ionicons } from '@expo/vector-icons';
import type React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { getColors } from '@/constants/bible-design-tokens';
import { useTheme } from '@/contexts/ThemeContext';
import { getPasswordRequirements } from '@/lib/auth/password-validation';

/**
 * PasswordRequirements Component
 *
 * Displays real-time password validation feedback with visual indicators.
 * Shows three requirements: minimum 8 characters, at least 1 number, at least 1 letter.
 *
 * Visual states:
 * - Unfilled circle (neutral): Requirement not met and password is empty
 * - Filled check circle (success): Requirement met
 * - Unfilled circle (error state): Requirement not met but password has content
 *
 * @param password - Current password value to validate
 */
export interface PasswordRequirementsProps {
  password: string;
}

export const PasswordRequirements: React.FC<PasswordRequirementsProps> = ({ password }) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const requirements = getPasswordRequirements(password);

  return (
    <View style={styles.container}>
      {requirements.map((requirement, index) => {
        const isMet = requirement.met;
        const hasContent = password.length > 0;

        return (
          <View key={requirement.text} style={styles.requirementItem}>
            {isMet ? (
              <Ionicons
                name="checkmark-circle"
                size={20}
                color={colors.gold}
                testID={`requirement-${index}-met`}
              />
            ) : (
              <Ionicons
                name="ellipse-outline"
                size={20}
                color={hasContent ? colors.error : colors.textTertiary}
                testID={`requirement-${index}-unmet`}
              />
            )}
            <Text style={styles.requirementText}>{requirement.text}</Text>
          </View>
        );
      })}
    </View>
  );
};

const createStyles = (colors: ReturnType<typeof getColors>) =>
  StyleSheet.create({
    container: {
      marginTop: 8,
      marginBottom: 16,
    },
    requirementItem: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: 4,
    },
    requirementText: {
      marginLeft: 8,
      fontSize: 14,
      color: colors.textSecondary,
    },
  });
