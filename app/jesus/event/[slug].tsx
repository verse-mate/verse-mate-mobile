/**
 * JesusEventScreen — one event, with its tabs.
 *
 * Route: /jesus/event/[slug]
 *
 * Tabs are chosen from what the event actually carries rather than shown as a
 * fixed row: Compare is pointless for a single-account event, and Insight is
 * empty until the generation pipeline has run for it. An always-present tab
 * that opens onto "Nothing recorded yet" is the failure this avoids.
 *
 * Compare is a second request and is only issued once its tab is opened — most
 * readers never open it, and the event screen should not wait on it.
 */
import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ConfidenceBadge,
  JesusPlaceholder,
  queryPhase,
  SectionHeading,
  uniqueGospels,
} from '@/components/jesus/JesusParts';
import { useTheme } from '@/contexts/ThemeContext';
import { useJesusCompare, useJesusEvent } from '@/hooks/jesus';
import { fontSizes, fontWeights, type getColors, spacing } from '@/theme/tokens';
import type { JesusFacet, JesusReveal } from '@/types/jesus';

type Colors = ReturnType<typeof getColors>;
type TabKey = 'story' | 'said' | 'did' | 'compare' | 'insight';

/** Reveal channels in the order the page reads them, with their headings. */
const REVEAL_CHANNELS = [
  ['says_about_himself', 'jesus.event.saysAboutHimself', 'What He says about Himself'],
  ['demonstrates', 'jesus.event.demonstrates', 'What He shows'],
  ['others_say', 'jesus.event.othersSay', 'What others say'],
  ['narrator_says', 'jesus.event.narratorSays', 'What the Gospel says'],
] as const;

export default function JesusEventScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const event = useJesusEvent(slug);
  const { data } = event;
  const phase = queryPhase(event);
  const [tab, setTab] = useState<TabKey>('story');
  const bodyRef = useRef<ScrollView>(null);

  // The tabs share one scroll view, so without this a reader who is deep into
  // Story taps Compare and lands part-way down a much shorter tab — sometimes
  // past the end of it, which reads as a blank screen.
  const selectTab = useCallback((key: TabKey) => {
    setTab(key);
    bodyRef.current?.scrollTo({ y: 0, animated: false });
  }, []);
  const compare = useJesusCompare(slug, tab === 'compare');

  const tabs = useMemo(() => {
    if (!data) return [] as { key: TabKey; label: string }[];
    const out: { key: TabKey; label: string }[] = [
      { key: 'story', label: t('jesus.event.story', 'Story') },
    ];
    if (data.words?.length) out.push({ key: 'said', label: t('jesus.event.said', 'Said') });
    if (data.actions?.length) out.push({ key: 'did', label: t('jesus.event.did', 'Did') });
    if (uniqueGospels(data.event?.gospels).length > 1)
      out.push({ key: 'compare', label: t('jesus.event.compare', 'Compare') });
    if (Object.keys(data.explanation ?? {}).length)
      out.push({ key: 'insight', label: t('jesus.event.insight', 'Insight') });
    return out;
  }, [data, t]);

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/jesus');
  };

  if (phase === 'loading') return <JesusPlaceholder loading testID="jesus-event-loading" />;
  if (phase === 'offline') {
    return (
      <JesusPlaceholder
        message={t('jesus.offline.message', "You're offline — this needs a connection.")}
        testID="jesus-event-offline"
      />
    );
  }
  if (!data) {
    return (
      <JesusPlaceholder
        message={t('jesus.event.missing', "Couldn't load this event.")}
        testID="jesus-event-missing"
      />
    );
  }

  const ev = data.event;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <Pressable
          onPress={handleBack}
          style={styles.backButton}
          testID="jesus-event-back"
          accessibilityRole="button"
          accessibilityLabel={t('common.back', 'Back')}
        >
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {ev.title}
        </Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabStrip}
        contentContainerStyle={styles.tabStripContent}
        testID="jesus-event-tabs"
      >
        {tabs.map((tb) => (
          <Pressable
            key={tb.key}
            onPress={() => selectTab(tb.key)}
            style={[styles.tab, tab === tb.key && styles.tabActive]}
            testID={`jesus-tab-${tb.key}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === tb.key }}
          >
            <Text style={[styles.tabText, tab === tb.key && styles.tabTextActive]}>{tb.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView
        ref={bodyRef}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxxl }}
        testID="jesus-event-body"
      >
        {tab === 'story' && (
          <View>
            <View style={styles.metaRow}>
              {ev.period_name ? <Text style={styles.meta}>{ev.period_name}</Text> : null}
              <ConfidenceBadge value={ev.chronology_confidence} />
            </View>
            {ev.summary ? <Text style={styles.summary}>{ev.summary}</Text> : null}
            {ev.location ? (
              <Text style={styles.meta}>
                {t('jesus.event.where', 'Where: {{location}}', { location: ev.location })}
              </Text>
            ) : null}

            {/* The accounts live on `event.passages`; the top-level `passages`
                key is empty on this endpoint. Reading the wrong one renders
                nothing and reports no error. */}
            {ev.passages?.length ? (
              <>
                <SectionHeading title={t('jesus.event.accounts', 'Accounts')} />
                {ev.passages.map((p, i) => (
                  <View key={`${p.display}-${i}`} style={styles.passageRow}>
                    <Text style={styles.passageRef}>{p.display}</Text>
                  </View>
                ))}
              </>
            ) : null}

            {REVEAL_CHANNELS.map(([channel, key, fallback]) => {
              const items = (data.reveals?.[channel] ?? []) as JesusReveal[];
              if (!items.length) return null;
              return (
                <View key={channel}>
                  <SectionHeading title={t(key, fallback)} />
                  {/* Keyed on the content: the corpus gives reveals no id, and
                      these rows are static per event, so the text is the only
                      thing that is actually stable across a refetch. */}
                  {items.map((r) => (
                    <View key={`${channel}-${r.content}`} style={styles.revealRow}>
                      <Text style={styles.revealText}>{r.content}</Text>
                      {r.source_ref ? <Text style={styles.revealRef}>{r.source_ref}</Text> : null}
                    </View>
                  ))}
                </View>
              );
            })}

            {data.reactions?.length ? (
              <>
                <SectionHeading title={t('jesus.event.reactions', 'How people reacted')} />
                {data.reactions.map((r) => (
                  <View key={`${r.who}-${r.what}`} style={styles.revealRow}>
                    <Text style={styles.revealWho}>{r.who}</Text>
                    <Text style={styles.revealText}>{r.what}</Text>
                    {r.source_ref ? <Text style={styles.revealRef}>{r.source_ref}</Text> : null}
                  </View>
                ))}
              </>
            ) : null}

            {ev.people?.length ? (
              <>
                <SectionHeading title={t('jesus.event.people', 'Who was there')} />
                <Text style={styles.people}>
                  {ev.people
                    .map((p) => (p.role ? `${p.person} (${p.role})` : p.person))
                    .join(' · ')}
                </Text>
              </>
            ) : null}
          </View>
        )}

        {(tab === 'said' || tab === 'did') && (
          <FacetList facets={tab === 'said' ? data.words : data.actions} styles={styles} />
        )}

        {tab === 'compare' &&
          (queryPhase(compare) === 'offline' ? (
            <JesusPlaceholder
              message={t('jesus.offline.message', "You're offline — this needs a connection.")}
              testID="jesus-compare-offline"
            />
          ) : queryPhase(compare) === 'loading' ? (
            <JesusPlaceholder loading testID="jesus-compare-loading" />
          ) : !compare.data ? (
            <JesusPlaceholder
              message={t('jesus.event.noCompare', 'No comparison available.')}
              testID="jesus-compare-empty"
            />
          ) : (
            <View>
              {compare.data.note ? <Text style={styles.summary}>{compare.data.note}</Text> : null}
              {compare.data.accounts.map((a) => {
                // `unique_to_account` and `emphasis` are only served here, not
                // on the event endpoint — and "what does this Gospel add" is
                // exactly the question this tab exists to answer.
                const adds = a.passages
                  .map((p) => p.unique_to_account)
                  .filter(Boolean)
                  .join(' ');
                const emphasis = a.passages
                  .map((p) => p.emphasis)
                  .filter(Boolean)
                  .join(' ');
                return (
                  <View key={a.gospel} style={styles.accountRow}>
                    <Text style={styles.accountName}>{a.gospel}</Text>
                    <Text style={styles.accountBody}>
                      {a.records_it
                        ? a.passages.map((p) => p.display).join(' · ')
                        : t('jesus.event.notRecorded', 'Does not record it')}
                    </Text>
                    {adds ? (
                      <Text style={styles.accountAdds}>
                        {t('jesus.event.adds', 'Only here: {{adds}}', { adds })}
                      </Text>
                    ) : null}
                    {emphasis ? <Text style={styles.accountEmphasis}>{emphasis}</Text> : null}
                  </View>
                );
              })}
            </View>
          ))}

        {tab === 'insight' && (
          <View>
            {Object.entries(data.explanation ?? {}).map(([kind, body]) => (
              <View key={kind}>
                <SectionHeading title={t(`jesus.insight.${kind}`, kind)} />
                <Text style={styles.prose}>{body}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function FacetList({
  facets,
  styles,
}: {
  facets: JesusFacet[] | undefined;
  styles: ReturnType<typeof createStyles>;
}) {
  const { t } = useTranslation();
  if (!facets?.length) return null;
  return (
    <View>
      {facets.map((f, i) => (
        <View key={`${f.slug ?? i}`} style={styles.facetRow}>
          <Text style={styles.facetTitle}>{f.title}</Text>
          {f.text ? (
            <Text style={styles.facetText}>
              {t('jesus.event.quoted', '“{{text}}”', { text: f.text })}
            </Text>
          ) : null}
          {f.reference ? <Text style={styles.revealRef}>{f.reference}</Text> : null}
        </View>
      ))}
    </View>
  );
}

function createStyles(colors: Colors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.md,
    },
    backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    headerTitle: {
      flex: 1,
      textAlign: 'center',
      fontSize: fontSizes.heading3,
      fontWeight: fontWeights.semibold,
      color: colors.textPrimary,
    },
    tabStrip: {
      flexGrow: 0,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.divider,
    },
    tabStripContent: { paddingHorizontal: spacing.lg, gap: spacing.sm },
    tab: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    tabActive: { borderBottomColor: colors.gold },
    tabText: {
      fontSize: fontSizes.bodySmall,
      // Explicit, because the strip is a horizontal ScrollView that sizes to
      // its content: without it the line box comes out shorter than the glyphs
      // and iOS clips the descenders, so "Story" renders as "Storv".
      lineHeight: Math.round(fontSizes.bodySmall * 1.4),
      color: colors.textSecondary,
    },
    tabTextActive: { color: colors.gold, fontWeight: fontWeights.semibold },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
    },
    meta: {
      fontSize: fontSizes.bodySmall,
      color: colors.textTertiary,
      paddingHorizontal: spacing.lg,
    },
    summary: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      fontSize: fontSizes.body,
      color: colors.textPrimary,
      lineHeight: 22,
    },
    passageRow: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
    passageRef: {
      fontSize: fontSizes.body,
      color: colors.textPrimary,
      fontWeight: fontWeights.medium,
    },
    revealRow: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      gap: 2,
    },
    revealWho: {
      fontSize: fontSizes.bodySmall,
      color: colors.gold,
      fontWeight: fontWeights.medium,
    },
    revealText: { fontSize: fontSizes.body, color: colors.textPrimary, lineHeight: 21 },
    revealRef: { fontSize: fontSizes.caption, color: colors.textTertiary },
    people: {
      paddingHorizontal: spacing.lg,
      fontSize: fontSizes.bodySmall,
      color: colors.textSecondary,
    },
    facetRow: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.divider,
      gap: spacing.xs,
    },
    facetTitle: {
      fontSize: fontSizes.body,
      fontWeight: fontWeights.semibold,
      color: colors.textPrimary,
    },
    facetText: { fontSize: fontSizes.body, color: colors.textSecondary, lineHeight: 21 },
    accountRow: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.divider,
    },
    accountName: {
      fontSize: fontSizes.body,
      fontWeight: fontWeights.semibold,
      color: colors.textPrimary,
    },
    accountBody: { fontSize: fontSizes.bodySmall, color: colors.textSecondary, marginTop: 2 },
    accountAdds: {
      fontSize: fontSizes.bodySmall,
      color: colors.textPrimary,
      marginTop: spacing.xs,
      lineHeight: 20,
    },
    accountEmphasis: {
      fontSize: fontSizes.caption,
      color: colors.textTertiary,
      marginTop: 2,
      fontStyle: 'italic',
    },
    prose: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
      fontSize: fontSizes.body,
      color: colors.textPrimary,
      lineHeight: 23,
    },
  });
}
