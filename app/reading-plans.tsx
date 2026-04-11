import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, Stack } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BIBLE_BOOKS } from '@/constants/bible-books';
import { fontSizes, type getColors, spacing } from '@/constants/bible-design-tokens';
import { READING_PLANS } from '@/constants/reading-plans';
import { useOfflineContext } from '@/contexts/OfflineContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useBibleVersion } from '@/hooks/use-bible-version';
import {
  getActiveReadingPlan,
  getEntriesForDay,
  getUpcomingEntries,
  markDayComplete,
  startReadingPlan,
  stopReadingPlan,
} from '@/services/reading-plans/reading-plan-service';
import type { UserReadingPlanProgress } from '@/types/reading-plans';

export default function ReadingPlansScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [activePlan, setActivePlan] = useState<UserReadingPlanProgress | null>(null);
  const { downloadBibleBook, downloadedBibleVersions } = useOfflineContext();
  const { bibleVersion } = useBibleVersion();

  useEffect(() => {
    getActiveReadingPlan().then(setActivePlan);
  }, []);

  // Pre-download upcoming reading-plan chapters. Only runs when the user
  // already has their selected Bible version downloaded — we never pull a
  // full version silently on their behalf.
  useEffect(() => {
    if (!activePlan) return;
    if (!downloadedBibleVersions.includes(bibleVersion)) return;

    const upcoming = getUpcomingEntries(activePlan.planId, activePlan.currentDay, 7);
    const uniqueBookIds = Array.from(new Set(upcoming.map((e) => e.bookId)));
    let cancelled = false;

    (async () => {
      for (const bookId of uniqueBookIds) {
        if (cancelled) return;
        try {
          await downloadBibleBook(bibleVersion, bookId);
        } catch (err) {
          if (__DEV__) {
            console.warn('[ReadingPlan] Pre-download failed for book', bookId, err);
          }
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activePlan, bibleVersion, downloadedBibleVersions, downloadBibleBook]);

  const handleBackPress = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  const handleStartPlan = useCallback(async (planId: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const progress = await startReadingPlan(planId);
    setActivePlan(progress);
  }, []);

  const handleStopPlan = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await stopReadingPlan();
    setActivePlan(null);
  }, []);

  const handleMarkComplete = useCallback(async (day: number) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const updated = await markDayComplete(day);
    setActivePlan(updated);
  }, []);

  const handleReadChapter = useCallback((bookId: number, chapter: number) => {
    router.push(`/bible/${bookId}/${chapter}`);
  }, []);

  const getBookName = (bookId: number) => {
    return BIBLE_BOOKS.find((b) => b.id === bookId)?.name ?? `Book ${bookId}`;
  };

  const activePlanData = activePlan ? READING_PLANS.find((p) => p.id === activePlan.planId) : null;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
          <Pressable
            onPress={handleBackPress}
            style={styles.backButton}
            accessibilityLabel="Go back"
            accessibilityRole="button"
            testID="reading-plans-back"
          >
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Reading Plans</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.contentContainer,
            { paddingBottom: insets.bottom + spacing.xl },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Active Plan */}
          {activePlan && activePlanData && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Current Plan</Text>
              <View style={styles.activePlanCard}>
                <Text style={styles.planName}>{activePlanData.name}</Text>
                <Text style={styles.planProgress}>
                  Day {activePlan.currentDay} of {activePlanData.durationDays} &middot;{' '}
                  {activePlan.completedDays.length} days completed
                </Text>

                {/* Today's reading */}
                <View style={styles.todaySection}>
                  <Text style={styles.todayLabel}>Today&apos;s Reading</Text>
                  {getEntriesForDay(activePlan.planId, activePlan.currentDay).map((entry, idx) => (
                    <Pressable
                      key={`${entry.bookId}-${entry.chapterStart}-${idx}`}
                      style={styles.entryRow}
                      onPress={() => handleReadChapter(entry.bookId, entry.chapterStart)}
                    >
                      <Text style={styles.entryText}>
                        {getBookName(entry.bookId)} {entry.chapterStart}
                        {entry.chapterEnd !== entry.chapterStart ? `-${entry.chapterEnd}` : ''}
                      </Text>
                      <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                    </Pressable>
                  ))}
                  <Pressable
                    style={styles.completeButton}
                    onPress={() => handleMarkComplete(activePlan.currentDay)}
                  >
                    <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
                    <Text style={styles.completeButtonText}>Mark Day Complete</Text>
                  </Pressable>
                </View>

                <Pressable style={styles.stopButton} onPress={handleStopPlan}>
                  <Text style={styles.stopButtonText}>Stop Plan</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* Available Plans */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {activePlan ? 'Other Plans' : 'Available Plans'}
            </Text>
            {READING_PLANS.filter((p) => p.id !== activePlan?.planId).map((plan) => (
              <View key={plan.id} style={styles.planCard}>
                <Text style={styles.planName}>{plan.name}</Text>
                <Text style={styles.planDescription}>{plan.description}</Text>
                <Text style={styles.planDuration}>{plan.durationDays} days</Text>
                <Pressable
                  style={styles.startButton}
                  onPress={() => handleStartPlan(plan.id)}
                  testID={`start-plan-${plan.id}`}
                >
                  <Text style={styles.startButtonText}>Start Plan</Text>
                </Pressable>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    </>
  );
}

function createStyles(colors: ReturnType<typeof getColors>) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
      backgroundColor: colors.background,
    },
    backButton: {
      padding: spacing.sm,
      marginRight: spacing.sm,
    },
    headerTitle: {
      flex: 1,
      fontSize: fontSizes.heading2,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    headerSpacer: {
      width: 40,
    },
    scrollView: {
      flex: 1,
    },
    contentContainer: {
      padding: spacing.lg,
    },
    section: {
      marginBottom: spacing.xl,
    },
    sectionTitle: {
      fontSize: fontSizes.heading3,
      fontWeight: '600',
      color: colors.textPrimary,
      marginBottom: spacing.md,
    },
    activePlanCard: {
      backgroundColor: colors.backgroundElevated,
      borderRadius: 12,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.gold,
    },
    planCard: {
      backgroundColor: colors.backgroundElevated,
      borderRadius: 12,
      padding: spacing.lg,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: colors.borderSecondary,
    },
    planName: {
      fontSize: fontSizes.bodyLarge,
      fontWeight: '600',
      color: colors.textPrimary,
      marginBottom: spacing.xs,
    },
    planDescription: {
      fontSize: fontSizes.body,
      color: colors.textSecondary,
      lineHeight: 22,
      marginBottom: spacing.sm,
    },
    planDuration: {
      fontSize: fontSizes.caption,
      color: colors.textTertiary,
      marginBottom: spacing.md,
    },
    planProgress: {
      fontSize: fontSizes.caption,
      color: colors.gold,
      marginBottom: spacing.lg,
    },
    todaySection: {
      borderTopWidth: 1,
      borderTopColor: colors.divider,
      paddingTop: spacing.md,
    },
    todayLabel: {
      fontSize: fontSizes.bodySmall,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: spacing.sm,
    },
    entryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.sm,
    },
    entryText: {
      fontSize: fontSizes.body,
      color: colors.textPrimary,
    },
    completeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      backgroundColor: colors.gold,
      paddingVertical: spacing.md,
      borderRadius: 8,
      marginTop: spacing.md,
    },
    completeButtonText: {
      color: '#FFFFFF',
      fontWeight: '600',
      fontSize: fontSizes.body,
    },
    startButton: {
      backgroundColor: colors.gold,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
      borderRadius: 8,
      alignSelf: 'flex-start',
    },
    startButtonText: {
      color: '#FFFFFF',
      fontWeight: '600',
      fontSize: fontSizes.bodySmall,
    },
    stopButton: {
      marginTop: spacing.md,
      paddingVertical: spacing.sm,
      alignItems: 'center',
    },
    stopButtonText: {
      color: colors.textTertiary,
      fontSize: fontSizes.caption,
    },
  });
}
