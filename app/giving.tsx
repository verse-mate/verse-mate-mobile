/**
 * Giving Screen
 *
 * Displays the VerseMate mission and a donation menu for supporting the project.
 * Replaces the prior contact-form flow with an app-style donation UI that mirrors
 * the web prototype's "Warm Mission" design approved via /design-shotgun.
 *
 * Features:
 * - Header with back navigation
 * - Hero image + SUPPORT VERSEMATE heading and mission body
 * - Monthly / One-time cadence toggle
 * - Preset donation amount chips ($10 / $25 / $50 / $100 / $250 / $500)
 * - Custom amount input
 * - Dynamic "Give $X" CTA that composes a prefilled mailto with amount + cadence
 * - Trust badges (501(c)(3), Secure)
 * - Theme-aware styling, haptics on interactions
 */

import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import {
  ImageBackground,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ErrorModal } from '@/components/bible/ErrorModal';
import { useTheme } from '@/contexts/ThemeContext';
import { type getColors, spacing } from '@/theme/tokens';

type Cadence = 'monthly' | 'once';

const PRESETS = [10, 25, 50, 100, 250, 500] as const;

export default function GivingScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const [cadence, setCadence] = useState<Cadence>('monthly');
  const [selectedAmount, setSelectedAmount] = useState<number>(25);
  const [customAmount, setCustomAmount] = useState<string>('');

  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorModalContent, setErrorModalContent] = useState({ title: '', message: '' });

  const effectiveAmount = customAmount
    ? Math.max(1, Number.parseInt(customAmount.replace(/\D/g, ''), 10) || 0)
    : selectedAmount;

  const handleBackPress = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  const handleCadenceSelect = async (next: Cadence) => {
    if (next === cadence) return;
    await Haptics.selectionAsync();
    setCadence(next);
  };

  const handlePresetSelect = async (amount: number) => {
    await Haptics.selectionAsync();
    setSelectedAmount(amount);
    setCustomAmount('');
  };

  const handleDonate = async () => {
    if (effectiveAmount < 1) {
      setErrorModalContent({
        title: 'Enter an amount',
        message: 'Please choose a preset amount or enter a custom amount greater than $0.',
      });
      setErrorModalVisible(true);
      return;
    }

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const cadenceLabel = cadence === 'monthly' ? 'Monthly' : 'One-time';
    const subject = encodeURIComponent(`${cadenceLabel} donation — $${effectiveAmount}`);
    const bodyText = [
      'Hi VerseMate Team,',
      '',
      `I'd like to give $${effectiveAmount} ${
        cadence === 'monthly' ? 'monthly' : 'as a one-time gift'
      } to support VerseMate.`,
      '',
      'Please send me the next steps to complete this donation.',
      '',
      'Thank you,',
    ].join('\n');
    const body = encodeURIComponent(bodyText);
    const mailtoUrl = `mailto:info@versemate.org?subject=${subject}&body=${body}`;

    try {
      const canOpen = await Linking.canOpenURL(mailtoUrl);
      if (canOpen) {
        await Linking.openURL(mailtoUrl);
      } else {
        setErrorModalContent({
          title: 'Email Not Available',
          message: 'Unable to open email app. Please email us directly at info@versemate.org',
        });
        setErrorModalVisible(true);
      }
    } catch (error) {
      console.error('Error opening email:', error);
      setErrorModalContent({
        title: 'Error',
        message: 'Unable to open email app. Please email us directly at info@versemate.org',
      });
      setErrorModalVisible(true);
    }
  };

  const cadenceLabel = cadence === 'monthly' ? ' / month' : '';

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
          <Pressable
            onPress={handleBackPress}
            style={styles.backButton}
            accessibilityLabel="Go back"
            accessibilityRole="button"
            testID="giving-back-button"
          >
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Giving</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Content */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.contentContainer,
            { paddingBottom: insets.bottom + spacing.xl },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Hero Section — kept from prior design */}
          <View style={styles.heroSection}>
            <ImageBackground
              source={require('@/assets/images/giving-hero.jpg')}
              style={styles.heroBackground}
              resizeMode="cover"
            >
              <View style={styles.heroOverlay}>
                <View style={styles.heroContent}>
                  <View style={styles.titleBorder}>
                    <Text style={styles.supportTitle}>SUPPORT VERSEMATE</Text>
                  </View>

                  <View style={styles.textContainer}>
                    <Text style={styles.heroHeading}>
                      Help People Everywhere Engage with God&apos;s Word
                    </Text>
                    <Text style={styles.heroBody}>
                      Your generosity helps us create resources and tools that make Scripture clear
                      and accessible to people worldwide. Every gift you give makes a direct
                      impact—whether it&apos;s supporting the translation of content, improving our
                      technology, or helping us reach new communities with the truth of God&apos;s
                      Word.{'\n\n'}Through your partnership, VerseMate can continue developing
                      simple, powerful tools that guide people not only to read the Bible, but to
                      truly understand and apply it in their daily lives.
                    </Text>
                  </View>
                </View>
              </View>
            </ImageBackground>
          </View>

          {/* Donation Menu — mirrors web "Warm Mission" design */}
          <View style={styles.donationSection}>
            {/* Kicker + divider */}
            <View style={styles.kickerWrapper}>
              <Text style={styles.kicker}>GIVE TODAY</Text>
              <View style={styles.kickerDivider} />
            </View>

            {/* Headline */}
            <Text style={styles.donationHeadline}>Give the Word to the world.</Text>

            {/* Lead */}
            <Text style={styles.donationLead}>
              Every gift keeps Scripture free, clear, and accessible for everyone, everywhere.
            </Text>

            {/* Cadence toggle */}
            <View style={styles.cadenceToggle} accessibilityRole="tablist">
              {(['monthly', 'once'] as const).map((c) => {
                const active = cadence === c;
                return (
                  <Pressable
                    key={c}
                    onPress={() => handleCadenceSelect(c)}
                    style={[styles.cadenceButton, active && styles.cadenceButtonActive]}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={c === 'monthly' ? 'Monthly donation' : 'One-time donation'}
                    testID={`giving-cadence-${c}`}
                  >
                    <Text
                      style={[styles.cadenceButtonText, active && styles.cadenceButtonTextActive]}
                    >
                      {c === 'monthly' ? 'Monthly' : 'One-time'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Preset amount chips — 3x2 grid */}
            <View style={styles.presetGrid}>
              {PRESETS.map((amount) => {
                const selected = !customAmount && amount === selectedAmount;
                return (
                  <Pressable
                    key={amount}
                    onPress={() => handlePresetSelect(amount)}
                    style={[styles.presetChip, selected && styles.presetChipSelected]}
                    accessibilityRole="button"
                    accessibilityLabel={`Donate $${amount}`}
                    accessibilityState={{ selected }}
                    testID={`giving-preset-${amount}`}
                  >
                    <Text
                      style={[styles.presetChipText, selected && styles.presetChipTextSelected]}
                    >
                      ${amount}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Custom amount input */}
            <View style={styles.customAmountContainer}>
              <Text style={styles.customAmountPrefix}>$</Text>
              <TextInput
                style={styles.customAmountInput}
                value={customAmount}
                onChangeText={(v) => setCustomAmount(v.replace(/\D/g, ''))}
                placeholder="Other amount"
                placeholderTextColor={colors.textTertiary}
                keyboardType="number-pad"
                inputMode="numeric"
                maxLength={6}
                accessibilityLabel="Custom donation amount"
                testID="giving-custom-amount"
              />
            </View>

            {/* CTA — dynamic amount + cadence */}
            <Pressable
              style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
              onPress={handleDonate}
              accessibilityRole="button"
              accessibilityLabel={`Give $${effectiveAmount}${cadenceLabel}`}
              testID="giving-submit-button"
            >
              <Ionicons name="heart" size={18} color="#000000" />
              <Text style={styles.ctaText}>
                Give ${effectiveAmount}
                {cadenceLabel}
              </Text>
            </Pressable>

            {/* Trust badges */}
            <View style={styles.trustBadges}>
              <View style={styles.trustBadge}>
                <Ionicons name="shield-checkmark-outline" size={14} color="#808080" />
                <Text style={styles.trustBadgeText}>501(c)(3)</Text>
              </View>
              <View style={styles.trustBadge}>
                <Ionicons name="lock-closed-outline" size={14} color="#808080" />
                <Text style={styles.trustBadgeText}>Secure</Text>
              </View>
            </View>

            {/* Footer note */}
            <Text style={styles.footerNote}>
              Tap “Give” and our team will follow up with a secure donation link. Your gift is
              tax-deductible.
            </Text>
          </View>
        </ScrollView>

        <ErrorModal
          visible={errorModalVisible}
          title={errorModalContent.title}
          message={errorModalContent.message}
          onClose={() => setErrorModalVisible(false)}
        />
      </KeyboardAvoidingView>
    </>
  );
}

const createStyles = (colors: ReturnType<typeof getColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.backgroundSecondary,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
      backgroundColor: colors.backgroundSecondary,
    },
    backButton: {
      width: 40,
      alignItems: 'flex-start',
    },
    headerTitle: {
      flex: 1,
      fontSize: 18,
      fontWeight: '300',
      color: colors.textPrimary,
      textAlign: 'center',
    },
    headerSpacer: {
      width: 40,
    },
    scrollView: {
      flex: 1,
      backgroundColor: colors.background,
    },
    contentContainer: {
      flexGrow: 1,
    },

    // Hero
    heroSection: {
      width: '100%',
    },
    heroBackground: {
      width: '100%',
      minHeight: 520,
    },
    heroOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    heroContent: {
      paddingHorizontal: 24,
      paddingVertical: 48,
      gap: 40,
    },
    titleBorder: {
      borderBottomWidth: 6,
      borderBottomColor: '#c2b291',
      paddingVertical: 8,
      alignSelf: 'flex-start',
    },
    supportTitle: {
      fontSize: 16,
      fontWeight: 'bold',
      color: '#ffffff',
      letterSpacing: 1.6,
      textTransform: 'uppercase',
    },
    textContainer: {
      gap: 16,
    },
    heroHeading: {
      fontSize: 32,
      fontWeight: 'bold',
      color: '#ffffff',
      lineHeight: 40,
    },
    heroBody: {
      fontSize: 16,
      fontWeight: '300',
      color: '#ffffff',
      lineHeight: 24,
    },

    // Donation menu (dark section)
    donationSection: {
      backgroundColor: '#1b1b1b',
      paddingHorizontal: 24,
      paddingVertical: 40,
      gap: 20,
    },
    kickerWrapper: {
      alignItems: 'center',
      gap: 12,
    },
    kicker: {
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 2.4,
      color: '#b09a6d',
      textTransform: 'uppercase',
    },
    kickerDivider: {
      height: 1,
      width: 48,
      backgroundColor: '#b09a6d',
      opacity: 0.6,
    },
    donationHeadline: {
      fontSize: 26,
      fontWeight: '400',
      color: '#ffffff',
      textAlign: 'center',
      lineHeight: 34,
    },
    donationLead: {
      fontSize: 15,
      fontWeight: '300',
      color: 'rgba(255, 255, 255, 0.7)',
      textAlign: 'center',
      lineHeight: 22,
    },

    // Cadence toggle (pill)
    cadenceToggle: {
      flexDirection: 'row',
      backgroundColor: 'rgba(0, 0, 0, 0.4)',
      borderRadius: 999,
      padding: 4,
      marginTop: 4,
    },
    cadenceButton: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cadenceButtonActive: {
      backgroundColor: '#c2b291',
    },
    cadenceButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: 'rgba(255, 255, 255, 0.7)',
    },
    cadenceButtonTextActive: {
      color: '#000000',
    },

    // Preset grid (3 columns x 2 rows)
    presetGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    presetChip: {
      flexGrow: 1,
      flexBasis: '30%',
      height: 56,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: 'rgba(194, 178, 145, 0.4)',
      backgroundColor: 'rgba(194, 178, 145, 0.08)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    presetChipSelected: {
      borderColor: '#c2b291',
      backgroundColor: '#c2b291',
    },
    presetChipText: {
      fontSize: 18,
      fontWeight: '600',
      color: '#c2b291',
    },
    presetChipTextSelected: {
      color: '#000000',
    },

    // Custom amount input
    customAmountContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: 'rgba(255, 255, 255, 0.2)',
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: Platform.OS === 'ios' ? 14 : 10,
      gap: 12,
    },
    customAmountPrefix: {
      fontSize: 16,
      fontWeight: '600',
      color: 'rgba(255, 255, 255, 0.6)',
    },
    customAmountInput: {
      flex: 1,
      fontSize: 16,
      color: '#ffffff',
      padding: 0,
    },

    // CTA
    cta: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: '#c2b291',
      borderRadius: 999,
      paddingVertical: 16,
      marginTop: 4,
      shadowColor: '#c2b291',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.25,
      shadowRadius: 16,
      elevation: 3,
    },
    ctaPressed: {
      opacity: 0.88,
    },
    ctaText: {
      fontSize: 17,
      fontWeight: '700',
      color: '#000000',
      letterSpacing: 0.2,
    },

    // Trust badges
    trustBadges: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 24,
      marginTop: 8,
    },
    trustBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    trustBadgeText: {
      fontSize: 12,
      color: '#808080',
      fontWeight: '400',
    },

    // Footer note
    footerNote: {
      fontSize: 12,
      fontWeight: '300',
      color: 'rgba(255, 255, 255, 0.4)',
      textAlign: 'center',
      lineHeight: 18,
      marginTop: 4,
      paddingHorizontal: 8,
    },
  });
