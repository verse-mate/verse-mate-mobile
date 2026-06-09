/**
 * Widget setup / install instructions (GH-265).
 *
 * Discovery is settings-only (no push, no onboarding nag). This screen
 * explains how to add the Verse-of-the-Day home-screen widget per platform.
 *
 * NOTE: the Android programmatic pin-request (AppWidgetManager
 * .requestPinAppWidget, D-35) is intentionally NOT implemented. The
 * react-native-android-widget dependency (v0.20.x) exposes no pin-request API
 * (no requestPinAppWidget / requestWidgetPin), so wiring it would require a
 * custom native module. Until that module exists, both platforms show manual
 * instructions. See GH-265 R-008.
 */
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

const IOS_STEPS = [
  'Touch and hold an empty area of your Home Screen until the apps jiggle.',
  'Tap the "+" (Edit / Add Widget) button in the top corner.',
  'Search for "VerseMate" and pick the Verse of the Day widget.',
  'Choose a size and tap "Add Widget", then "Done".',
];

const ANDROID_STEPS = [
  'Touch and hold an empty area of your Home Screen.',
  'Tap "Widgets".',
  'Find "VerseMate" and the Verse of the Day widget.',
  'Touch and hold it, then drag it to your Home Screen.',
];

export default function WidgetInfoScreen() {
  const { colors } = useTheme();
  const steps = Platform.OS === 'ios' ? IOS_STEPS : ANDROID_STEPS;

  return (
    <>
      <Stack.Screen options={{ title: 'Home Screen Widget' }} />
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={styles.content}
        testID="widget-info-screen"
      >
        <View style={styles.hero}>
          <Ionicons name="calendar-outline" size={40} color={colors.gold} />
          <Text style={[styles.title, { color: colors.textPrimary }]}>Verse of the Day</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            A fresh verse on your home screen each day. Tap it to open the passage in VerseMate.
          </Text>
        </View>

        <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>How to add it</Text>
        {steps.map((step, i) => (
          <View key={step} style={styles.step}>
            <View style={[styles.stepNumber, { backgroundColor: colors.gold }]}>
              <Text style={styles.stepNumberText}>{i + 1}</Text>
            </View>
            <Text style={[styles.stepText, { color: colors.textPrimary }]}>{step}</Text>
          </View>
        ))}

        <Text style={[styles.footnote, { color: colors.textSecondary }]}>
          The widget shows the verse in your preferred translation and refreshes automatically each
          day.
        </Text>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 8 },
  hero: { alignItems: 'center', gap: 8, marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '700' },
  subtitle: { fontSize: 15, textAlign: 'center', lineHeight: 21 },
  sectionLabel: { fontSize: 16, fontWeight: '600', marginTop: 8, marginBottom: 4 },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 8 },
  stepNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: { color: '#fff', fontWeight: '700' },
  stepText: { flex: 1, fontSize: 15, lineHeight: 21 },
  footnote: { fontSize: 13, marginTop: 16, lineHeight: 19 },
});
