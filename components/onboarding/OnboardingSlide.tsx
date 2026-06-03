/**
 * OnboardingSlide
 *
 * Shared layout for every onboarding screen: a feature preview on top, then an
 * eyebrow label, a serif title, and a description. Theme-reactive (light/dark)
 * via the app's ThemeContext. Used by both the original welcome screens and the
 * new feature-tour screens so the whole flow shares one look and feel.
 */

import type { ReactNode } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

/**
 * Cross-platform serif stack for onboarding titles. React Native has no
 * `serif` alias on iOS, so we name a bundled system serif per platform.
 */
export const SERIF_FONT = Platform.select({
  ios: 'Georgia',
  android: 'serif',
  default: 'Georgia',
});

interface OnboardingSlideProps {
  eyebrow: string;
  title: string;
  body: string;
  /** Feature preview rendered above the text block. */
  children: ReactNode;
  testID?: string;
}

export function OnboardingSlide({ eyebrow, title, body, children, testID }: OnboardingSlideProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.container} testID={testID}>
      <View style={styles.previewWrap}>{children}</View>

      <View style={styles.textBlock}>
        <Text style={[styles.eyebrow, { color: colors.gold }]}>{eyebrow}</Text>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>{body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 32,
  },
  previewWrap: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: {
    width: '100%',
    alignItems: 'center',
    gap: 12,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  title: {
    fontFamily: SERIF_FONT,
    fontSize: 30,
    fontWeight: '700',
    lineHeight: 38,
    textAlign: 'center',
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    maxWidth: 420,
  },
});
