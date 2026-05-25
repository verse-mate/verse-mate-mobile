import * as Linking from 'expo-linking';
import { useEffect } from 'react';
import { AccessibilityInfo, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/contexts/ThemeContext';
import { AnalyticsEvent, analytics } from '@/lib/analytics';

// TODO: replace APPLE_STORE_ID constant with real App Store Connect ID
const APPLE_STORE_ID = 'REPLACE_ME';

const ANDROID_STORE_URL = 'https://play.google.com/store/apps/details?id=org.versemate.app';
const IOS_STORE_URL = `https://apps.apple.com/app/id${APPLE_STORE_ID}`;

interface UpgradePromptScreenProps {
  appVersion: string;
  minVersion: string;
  onDismiss: () => void;
}

export function UpgradePromptScreen({
  appVersion,
  minVersion,
  onDismiss,
}: UpgradePromptScreenProps) {
  const { colors, spacing, typography } = useTheme();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    analytics.track(AnalyticsEvent.UPGRADE_PROMPT_SHOWN, { appVersion, minVersion });
    AccessibilityInfo.announceForAccessibility(
      'An update is available for Verse Mate. Tap Update Now to upgrade or Maybe Later to continue.'
    );
  }, [appVersion, minVersion]);

  const handleUpdateNow = () => {
    analytics.track(AnalyticsEvent.UPGRADE_PROMPT_CTA_TAPPED, {
      appVersion,
      minVersion,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
    });
    const url = Platform.OS === 'ios' ? IOS_STORE_URL : ANDROID_STORE_URL;
    Linking.openURL(url);
  };

  const handleMaybeLater = () => {
    analytics.track(AnalyticsEvent.UPGRADE_PROMPT_DISMISSED, { appVersion, minVersion });
    onDismiss();
  };

  const styles = StyleSheet.create({
    overlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.55)',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
    },
    card: {
      backgroundColor: colors.backgroundElevated,
      borderRadius: 16,
      padding: spacing.xl,
      width: '100%',
      maxWidth: 380,
      paddingBottom: insets.bottom > 0 ? insets.bottom + spacing.md : spacing.xl,
    },
    title: {
      ...typography.heading2,
      color: colors.textPrimary,
      marginBottom: spacing.sm,
    },
    body: {
      ...typography.body,
      color: colors.textSecondary,
      marginBottom: spacing.xl,
    },
    ctaButton: {
      backgroundColor: colors.gold,
      borderRadius: 8,
      paddingVertical: spacing.md,
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    ctaText: {
      ...typography.body,
      fontWeight: '600',
      color: colors.white,
    },
    dismissButton: {
      alignItems: 'center',
      paddingVertical: spacing.sm,
    },
    dismissText: {
      ...typography.body,
      color: colors.textSecondary,
    },
  });

  return (
    <View style={styles.overlay} testID="upgrade-prompt-overlay">
      <View style={styles.card} testID="upgrade-prompt-card">
        <Text style={styles.title} testID="upgrade-prompt-title">
          Update Available
        </Text>
        <Text style={styles.body} testID="upgrade-prompt-body">
          A new version of Verse Mate is required to continue. Please update to the latest version
          to keep enjoying the app.
        </Text>
        <Pressable
          style={styles.ctaButton}
          onPress={handleUpdateNow}
          accessibilityLabel="Update Now"
          accessibilityRole="button"
          testID="upgrade-prompt-update-now"
        >
          <Text style={styles.ctaText}>Update Now</Text>
        </Pressable>
        <Pressable
          style={styles.dismissButton}
          onPress={handleMaybeLater}
          accessibilityLabel="Maybe Later, skip upgrade"
          accessibilityRole="button"
          testID="upgrade-prompt-maybe-later"
        >
          <Text style={styles.dismissText}>Maybe Later</Text>
        </Pressable>
      </View>
    </View>
  );
}
