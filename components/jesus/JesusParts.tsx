/**
 * Shared building blocks for the Jesus tab.
 *
 * The web client spreads these across several `Jesus*Parts.tsx` files; on
 * mobile they are small enough to live together, and keeping them in one place
 * makes the styling consistent across five screens without a component library.
 *
 * Everything here is presentational — no fetching, no navigation decisions — so
 * the screens stay readable and these stay testable without a router.
 */
import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { fontSizes, fontWeights, type getColors, radii, spacing } from '@/theme/tokens';
import type { JesusConfidence, JesusEventCard } from '@/types/jesus';

type Colors = ReturnType<typeof getColors>;

/**
 * What a Jesus query is actually doing, for screens to branch on.
 *
 * `isLoading` is NOT enough. React Query pauses a query when `onlineManager`
 * reports offline — this app bridges that to NetInfo — and a paused query has
 * `isLoading: false` with `data: undefined`, because it never started. A screen
 * that branches on `isLoading` alone falls straight through to its empty state
 * and tells the reader the corpus is empty when the truth is that the request
 * was never made. That is the worst available answer: it is wrong, it looks
 * authoritative, and it gives them nothing to act on.
 */
/**
 * The distinct Gospels that record an event.
 *
 * The API lists one entry per PASSAGE, so an event John tells across three
 * passages comes back as `['John','John','John']`. Rendered raw that reads as
 * "John · John · John", and counted raw it makes a single-account event look
 * like it has three accounts — which is what decides whether the event screen
 * offers a Compare tab at all. Both bugs are the same missing dedupe.
 */
export function uniqueGospels(gospels: string[] | undefined | null): string[] {
  return gospels ? [...new Set(gospels)] : [];
}

export type QueryPhase = 'loading' | 'offline' | 'ready';

export function queryPhase(query: {
  isPending: boolean;
  fetchStatus: 'fetching' | 'paused' | 'idle';
}): QueryPhase {
  if (query.fetchStatus === 'paused') return 'offline';
  return query.isPending ? 'loading' : 'ready';
}

/** A full-bleed centred state, used for loading and for "nothing here". */
export function JesusPlaceholder({
  loading,
  message,
  testID,
}: {
  loading?: boolean;
  message?: string;
  testID?: string;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.placeholder} testID={testID}>
      {loading ? (
        <ActivityIndicator color={colors.gold} />
      ) : (
        <Text style={styles.placeholderText}>{message}</Text>
      )}
    </View>
  );
}

/**
 * How firmly an event is fixed in the chronology.
 *
 * Shown rather than hidden because the value is now assessed per event rather
 * than defaulted — a "disputed" badge tells the reader the Gospels place it
 * differently, which is information, not a disclaimer.
 */
export function ConfidenceBadge({ value }: { value: JesusConfidence | string }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(colors), [colors]);
  if (value === 'high') return null; // the default expectation; no badge needed
  const disputed = value === 'disputed';
  return (
    <View
      style={[styles.badge, disputed ? styles.badgeDisputed : styles.badgeProbable]}
      testID={`confidence-${value}`}
    >
      {/* The API's enum is English; the badge is reader-facing, so it is
          translated rather than printed raw. An unrecognised value falls back
          to "uncertain" instead of leaking the wire format onto the screen. */}
      <Text style={[styles.badgeText, disputed && styles.badgeTextDisputed]}>
        {t(`jesus.confidence.${value}`, t('jesus.confidence.unknown', 'uncertain'))}
      </Text>
    </View>
  );
}

/** Section heading with an optional count, used down every screen. */
export function SectionHeading({
  title,
  count,
  testID,
}: {
  title: string;
  count?: number;
  testID?: string;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.headingRow} testID={testID}>
      <Text style={styles.heading}>{title}</Text>
      {count !== undefined && <Text style={styles.headingCount}>{count}</Text>}
    </View>
  );
}

/**
 * One event in a list.
 *
 * Shows the Gospels that record it, because "which accounts have this" is the
 * question the corpus is organised around and it is otherwise invisible until
 * you open the Compare tab.
 */
export function EventRow({
  event,
  onPress,
}: {
  event: JesusEventCard;
  onPress: (slug: string) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={() => onPress(event.slug)}
      testID={`jesus-event-${event.slug}`}
      accessibilityRole="button"
      accessibilityLabel={event.title}
    >
      <View style={styles.rowBody}>
        <View style={styles.rowTitleLine}>
          <Text style={styles.rowTitle} numberOfLines={2}>
            {event.title}
          </Text>
          <ConfidenceBadge value={event.chronology_confidence} />
        </View>
        {event.summary ? (
          <Text style={styles.rowSummary} numberOfLines={2}>
            {event.summary}
          </Text>
        ) : null}
        {uniqueGospels(event.gospels).length ? (
          <Text style={styles.rowGospels}>{uniqueGospels(event.gospels).join(' · ')}</Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
    </Pressable>
  );
}

function createStyles(colors: Colors) {
  return StyleSheet.create({
    placeholder: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xxl,
      minHeight: 160,
    },
    placeholderText: {
      color: colors.textSecondary,
      fontSize: fontSizes.body,
      textAlign: 'center',
    },
    badge: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: radii.sm,
      marginLeft: spacing.sm,
    },
    badgeProbable: { backgroundColor: colors.backgroundSecondary },
    badgeDisputed: { backgroundColor: colors.warning },
    badgeText: {
      fontSize: fontSizes.caption,
      color: colors.textSecondary,
      textTransform: 'lowercase',
    },
    badgeTextDisputed: { color: colors.white },
    headingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xl,
      paddingBottom: spacing.sm,
    },
    heading: {
      fontSize: fontSizes.bodySmall,
      fontWeight: fontWeights.semibold,
      color: colors.gold,
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    headingCount: { fontSize: fontSizes.bodySmall, color: colors.textTertiary },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.lg,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.divider,
      gap: spacing.md,
    },
    rowPressed: { backgroundColor: colors.ripple },
    rowBody: { flex: 1, gap: spacing.xs },
    rowTitleLine: { flexDirection: 'row', alignItems: 'center' },
    rowTitle: {
      flexShrink: 1,
      fontSize: fontSizes.body,
      fontWeight: fontWeights.semibold,
      color: colors.textPrimary,
    },
    rowSummary: { fontSize: fontSizes.bodySmall, color: colors.textSecondary },
    navCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      marginHorizontal: spacing.lg,
      marginBottom: spacing.sm,
      borderRadius: radii.md,
      backgroundColor: colors.backgroundSecondary,
    },
    navCardEmphasis: { borderWidth: 1, borderColor: colors.gold },
    navIcon: { width: 24, alignItems: 'center' },
    navTitle: {
      fontSize: fontSizes.body,
      fontWeight: fontWeights.medium,
      color: colors.textPrimary,
    },
    navBlurb: { fontSize: fontSizes.bodySmall, color: colors.textTertiary, marginTop: 2 },
    navCount: { fontSize: fontSizes.bodySmall, color: colors.textTertiary },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.md,
      borderRadius: radii.full,
      backgroundColor: colors.backgroundSecondary,
    },
    pillActive: { backgroundColor: colors.gold },
    pillText: { fontSize: fontSizes.bodySmall, color: colors.textPrimary },
    pillTextActive: { color: colors.background, fontWeight: fontWeights.semibold },
    pillCount: { fontSize: fontSizes.caption, color: colors.textTertiary },
    rowGospels: { fontSize: fontSizes.caption, color: colors.textTertiary },
  });
}

/**
 * A browse row: title, blurb, count, chevron.
 *
 * This is the hub's and the list screens' one repeating unit — `JesusNavCard`
 * on web. It replaced a three-column grid of bare counts, which dropped the
 * blurb the taxonomy ships for every kind ("What He taught, and what it means")
 * and made the hub a wall of numbers.
 *
 * `emphasis` is the gold-bordered treatment "Follow His Life" gets, so the one
 * chronological way in reads as the hero rather than as another row.
 */
export function JesusNavCard({
  title,
  blurb,
  count,
  emphasis,
  icon,
  onPress,
  testID,
}: {
  title: string;
  blurb?: string | null;
  count?: number;
  emphasis?: boolean;
  icon?: React.ReactNode;
  onPress: () => void;
  testID?: string;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={count === undefined ? title : `${title}, ${count}`}
      style={({ pressed }) => [
        styles.navCard,
        emphasis && styles.navCardEmphasis,
        pressed && styles.rowPressed,
      ]}
    >
      {icon ? <View style={styles.navIcon}>{icon}</View> : null}
      <View style={{ flex: 1 }}>
        <Text style={styles.navTitle}>{title}</Text>
        {blurb ? <Text style={styles.navBlurb}>{blurb}</Text> : null}
      </View>
      {count !== undefined && count > 0 ? <Text style={styles.navCount}>{count}</Text> : null}
      <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
    </Pressable>
  );
}

/** A theme chip — "Kingdom 51" — as used by Explore by Topic. */
export function JesusPill({
  label,
  count,
  active,
  onPress,
  testID,
}: {
  label: string;
  count?: number;
  active?: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(active) }}
      style={({ pressed }) => [
        styles.pill,
        active && styles.pillActive,
        pressed && styles.rowPressed,
      ]}
    >
      <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
      {count !== undefined ? <Text style={styles.pillCount}>{count}</Text> : null}
    </Pressable>
  );
}
