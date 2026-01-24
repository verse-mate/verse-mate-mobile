/**
 * About Screen
 *
 * Displays information about VerseMate's mission, values, and team.
 * Two-section scrollable layout with hero images and descriptive content.
 *
 * Features:
 * - Header with back navigation
 * - Hero images with mission statements
 * - Scrollable content sections
 * - Theme-aware styling
 */

import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import { router, Stack } from 'expo-router';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { type getColors, spacing } from '@/constants/bible-design-tokens';
import { useTheme } from '@/contexts/ThemeContext';

export default function AboutScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const handleBackPress = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
          <Pressable
            onPress={handleBackPress}
            style={styles.backButton}
            accessibilityLabel="Go back"
            accessibilityRole="button"
            testID="about-back-button"
          >
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>About</Text>
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
        >
          {/* Section 1: Built by Believers */}
          <View style={styles.section}>
            <Image
              source={require('@/assets/images/about-hero-1.jpg')}
              style={styles.heroImage}
              resizeMode="cover"
            />
            <View style={styles.textContainer}>
              <Text style={styles.heading}>Built by Believers.{'\n'}Guided by the Word.</Text>
              <Text style={styles.body}>
                Versemate is a nonprofit organization on a mission to make the Bible easier to
                understand, study, and love - for everyone, everywhere.{'\n\n'}We are developers,
                translators, and believers from around the world, united by one calling: to help
                more people connect with God through His Word.{'\n\n'}To make the Word of God easy
                to understand, deeply accessible, and f to everyone - so more people around the
                world can encounter Scripture, grow in faith, and walk closer with Christ.
              </Text>
            </View>
          </View>

          {/* Section 2: Illuminating God's Word */}
          <View style={styles.section}>
            <Image
              source={require('@/assets/images/about-hero-2.jpg')}
              style={styles.heroImage}
              resizeMode="cover"
            />
            <View style={styles.textContainer}>
              <Text style={styles.heading}>Illuminating God&apos;s Word for Everyone</Text>
              <Text style={styles.body}>
                We believe the Bible isn&apos;t just for scholars or clergy - it&apos;s for
                everyone. Whether you&apos;re discovering Scripture for the first time or leading a
                study group, Versemate helps illuminate God&apos;s Word for real understanding and
                lasting transformation.
              </Text>
            </View>

            {/* Version */}
            <Text style={styles.version}>Version {Constants.expoConfig?.version || '0.1.1'}</Text>

            {/* Team Signatures - Easter Egg */}
            <Text style={styles.signatures}>SB · AC · AM · AZ · SZ · VB · VK · VK · AT</Text>
          </View>
        </ScrollView>
      </View>
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
    section: {
      backgroundColor: colors.background,
      paddingHorizontal: 24,
      paddingVertical: 32,
      gap: 32,
    },
    heroImage: {
      width: '100%',
      height: 358,
      borderRadius: 50,
    },
    textContainer: {
      gap: 16,
    },
    heading: {
      fontSize: 32,
      fontWeight: 'bold',
      color: colors.textPrimary,
      lineHeight: 40,
    },
    body: {
      fontSize: 16,
      fontWeight: '300',
      color: colors.textSecondary,
      lineHeight: 24,
    },
    version: {
      fontSize: 14,
      fontWeight: '400',
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 32,
      opacity: 0.6,
    },
    signatures: {
      fontSize: 14,
      fontWeight: '300',
      color: colors.textTertiary,
      textAlign: 'center',
      marginTop: 16,
      opacity: 0.7,
      letterSpacing: 1,
    },
  });
