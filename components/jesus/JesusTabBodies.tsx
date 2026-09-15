/**
 * The Insight bodies for a Jesus event — the same four tabs the Bible side
 * uses, filled from the event graph.
 *
 * Deliberately the same four, so the pill group means the same thing wherever
 * the reader is. Compare stands where Visuals does on a chapter, because "which
 * Gospels tell this, and what does each add" is the question an event raises
 * that a chapter does not.
 *
 * Only Summary and Compare have a generated source of their own. By-Line and
 * Study are assembled from what this event already carries — its facets, in
 * passage order — rather than from a second request.
 */
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { StudyPanel } from '@/components/bible/StudyPanel';
import {
  ConfidenceBadge,
  JesusPlaceholder,
  queryPhase,
  uniqueGospels,
} from '@/components/jesus/JesusParts';
import { useTheme } from '@/contexts/ThemeContext';
import { useJesusCompare } from '@/hooks/jesus';
import { eventVerseSpan, narrowStudyToEvent, spanRangeLabel } from '@/lib/jesus/study-scope';
import { useStudy } from '@/src/api';
import { fontSizes, fontWeights, type getColors, radii, spacing } from '@/theme/tokens';
import type { JesusEventDetail, JesusFacet, JesusReveal } from '@/types/jesus';

type Colors = ReturnType<typeof getColors>;

export const JESUS_TABS = [
  { id: 'summary', label: 'Summary' },
  { id: 'byline', label: 'By-Line' },
  { id: 'study', label: 'Study' },
  { id: 'compare', label: 'Compare' },
] as const;

export type JesusTab = (typeof JESUS_TABS)[number]['id'];

export function JesusTabBodies({ tab, detail }: { tab: JesusTab; detail: JesusEventDetail }) {
  if (tab === 'summary') return <SummaryBody detail={detail} />;
  if (tab === 'byline') return <BylineBody detail={detail} />;
  if (tab === 'study') return <StudyBody detail={detail} />;
  return <CompareBody detail={detail} />;
}

// ─── Summary ─────────────────────────────────────────────────────────────────

function SummaryBody({ detail }: { detail: JesusEventDetail }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { event, reveals, reactions } = detail;

  const where = [event.location, (event.people ?? []).map((p) => p.person).join(', ')]
    .filter(Boolean)
    .join(' · ');

  const groups: { key: keyof typeof reveals; label: string; fallback: string }[] = [
    {
      key: 'says_about_himself',
      label: 'jesus.event.saysAboutHimself',
      fallback: 'What He says about Himself',
    },
    { key: 'demonstrates', label: 'jesus.event.demonstrates', fallback: 'What He demonstrates' },
    { key: 'others_say', label: 'jesus.event.othersSay', fallback: 'What others say' },
    { key: 'narrator_says', label: 'jesus.event.narratorSays', fallback: 'What the narrator says' },
  ];
  const hasReveals = groups.some((g) => reveals?.[g.key]?.length);

  return (
    <View style={styles.body} testID="jesus-summary-body">
      <Text style={styles.tabTitle}>
        {t('jesus.event.summaryOf', 'Summary of {{title}}', { title: event.title })}
      </Text>
      {where ? (
        <Text style={styles.where} testID="jesus-event-where">
          {where}
        </Text>
      ) : null}

      {detail.explanation?.overview ? (
        <Text style={styles.prose}>{detail.explanation.overview}</Text>
      ) : event.summary ? (
        <Text style={styles.prose}>{event.summary}</Text>
      ) : null}

      {hasReveals ? (
        <>
          <Text style={styles.sectionLabel}>{t('jesus.event.reveals', 'What this reveals')}</Text>
          <View testID="jesus-event-reveals">
            {groups.map((group) => {
              const items = (reveals?.[group.key] ?? []) as JesusReveal[];
              if (!items.length) return null;
              return (
                <View key={group.key} style={styles.group}>
                  <Text style={styles.groupLabel}>{t(group.label, group.fallback)}</Text>
                  {items.map((item) => (
                    <View key={`${group.key}-${item.content}`} style={styles.revealRow}>
                      <Text style={styles.revealText}>{item.content}</Text>
                      {item.source_ref ? (
                        <Text style={styles.reference}>{item.source_ref}</Text>
                      ) : null}
                    </View>
                  ))}
                </View>
              );
            })}
          </View>
        </>
      ) : null}

      {reactions?.length ? (
        <>
          <Text style={styles.sectionLabel}>
            {t('jesus.event.reactions', 'How people reacted')}
          </Text>
          {reactions.map((reaction) => (
            <View key={`${reaction.who}-${reaction.what}`} style={styles.revealRow}>
              <Text style={styles.revealWho}>{reaction.who}</Text>
              <Text style={styles.revealText}>{reaction.what}</Text>
              {reaction.source_ref ? (
                <Text style={styles.reference}>{reaction.source_ref}</Text>
              ) : null}
            </View>
          ))}
        </>
      ) : null}
    </View>
  );
}

// ─── By-Line ─────────────────────────────────────────────────────────────────

/**
 * Every facet this event carries, in passage order — the closest thing to the
 * chapter reader's line-by-line pass that an event has without a second
 * request. Words and actions are interleaved rather than split into two tabs,
 * because the point of a by-line reading is the order it happened in.
 */
function BylineBody({ detail }: { detail: JesusEventDetail }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const facets: JesusFacet[] = useMemo(
    () => [...(detail.words ?? []), ...(detail.actions ?? [])],
    [detail]
  );

  if (facets.length === 0) {
    return (
      <JesusPlaceholder
        message={t('jesus.event.noByline', 'No line-by-line reading for this event yet.')}
        testID="jesus-byline-empty"
      />
    );
  }

  return (
    <View style={styles.body} testID="jesus-byline-body">
      <Text style={styles.tabTitle}>
        {t('jesus.event.bylineOf', 'Line by line: {{title}}', { title: detail.event.title })}
      </Text>
      {facets.map((facet) => (
        <View key={facet.slug} style={styles.facetCard}>
          <Text style={styles.facetTitle}>{facet.title}</Text>
          {facet.text ? (
            <Text style={styles.facetQuote}>
              {t('jesus.event.quoted', '“{{text}}”', { text: facet.text })}
            </Text>
          ) : null}
          {facet.reference ? <Text style={styles.reference}>{facet.reference}</Text> : null}
        </View>
      ))}
    </View>
  );
}

// ─── Study ───────────────────────────────────────────────────────────────────

/**
 * The event as something to work through: who was there, where, when, and the
 * questions it raises. Assembled from the event's own fields rather than the
 * chapter's inductive study, because an event spans several chapters and the
 * chapter study would not be about it.
 */
function StudyBody({ detail }: { detail: JesusEventDetail }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { event } = detail;

  /**
   * The chapter's inductive study, narrowed to this event's verses.
   *
   * Reported as "Study structure of Jesus feature didn't make app version":
   * this tab rendered a five-row metadata table where web renders the nine-step
   * Precept study scoped to the pericope. There is no event-scoped study
   * content and there does not need to be — the study tags almost everything
   * with a verse reference, and an event knows the verses it covers, so
   * keeping only what touches them turns the Luke 2 study into a study of
   * Luke 2:41-52. Same helper web uses, ported verbatim.
   *
   * The PRIMARY passage decides the span: an event told by three Gospels has
   * three chapter studies, and the one being read is the one to narrow.
   */
  const primary = useMemo(() => {
    const passages = detail.passages ?? [];
    return passages.find((p) => p.is_primary) ?? passages[0] ?? null;
  }, [detail.passages]);
  const span = useMemo(() => eventVerseSpan(primary), [primary]);
  const { data: chapterStudy } = useStudy(span?.bookId ?? 0, span?.chapter ?? 0);
  const narrowed = useMemo(
    () => (chapterStudy && span ? narrowStudyToEvent(chapterStudy, span) : null),
    [chapterStudy, span]
  );

  const rows = [
    // jesus.event.where is the Summary body's SENTENCE ("Where: {{location}}").
    // Using it as a table label rendered the raw placeholder, because no
    // interpolation is passed here. The table wants the bare noun.
    { label: t('jesus.study.where', 'Where'), value: event.location },
    { label: t('jesus.study.when', 'When'), value: event.approximate_date },
    { label: t('jesus.study.period', 'Period'), value: event.period_name },
    {
      label: t('jesus.study.accounts', 'Accounts'),
      value: uniqueGospels(event.gospels).join(' · '),
    },
    {
      label: t('jesus.study.people', 'People'),
      value: (event.people ?? []).map((p) => p.person).join(', '),
    },
  ].filter((row) => Boolean(row.value));

  const questions = (detail.words ?? []).filter((f) => f.type_slug === 'questions');

  return (
    <View style={styles.body} testID="jesus-study-body">
      <Text style={styles.tabTitle}>
        {t('jesus.event.studyOf', 'Study: {{title}}', { title: event.title })}
      </Text>

      {rows.map((row) => (
        <View key={row.label} style={styles.studyRow}>
          <Text style={styles.studyLabel}>{row.label}</Text>
          <Text style={styles.studyValue}>{row.value}</Text>
        </View>
      ))}

      {questions.length > 0 ? (
        <>
          <Text style={styles.sectionLabel}>
            {t('jesus.study.questions', 'Questions He asks here')}
          </Text>
          {questions.map((question) => (
            <View key={question.slug} style={styles.facetCard}>
              <Text style={styles.facetQuote}>
                {t('jesus.event.quoted', '“{{text}}”', { text: question.text ?? question.title })}
              </Text>
              {question.reference ? (
                <Text style={styles.reference}>{question.reference}</Text>
              ) : null}
            </View>
          ))}
        </>
      ) : null}

      {/*
        The chapter's study, scoped to this event. Rendered through the app's
        OWN StudyPanel rather than a Jesus-specific copy, so the nine-step
        spine, the card chrome and the frame-ramp behaviour are the same ones
        the reader's Study tab uses and cannot drift from them.
      */}
      {narrowed && span ? (
        <StudyPanel
          bookId={span.bookId}
          chapter={span.chapter}
          study={narrowed.study}
          testID="jesus-study-panel"
          header={
            <Text style={styles.studyScope} testID="jesus-study-scope">
              {narrowed.narrowed
                ? t('jesus.study.scopedTo', 'Scoped to {{range}} of this chapter’s study', {
                    range: spanRangeLabel(span),
                  })
                : t('jesus.study.wholeChapter', 'This chapter’s study')}
            </Text>
          }
        />
      ) : null}
    </View>
  );
}

// ─── Compare ─────────────────────────────────────────────────────────────────

function CompareBody({ detail }: { detail: JesusEventDetail }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const compare = useJesusCompare(detail.event.slug, true);
  const phase = queryPhase(compare);

  if (phase === 'offline') {
    return (
      <JesusPlaceholder
        message={t('jesus.offline.message', "You're offline — this needs a connection.")}
        testID="jesus-compare-offline"
      />
    );
  }
  if (phase === 'loading') return <JesusPlaceholder loading testID="jesus-compare-loading" />;
  if (!compare.data?.accounts?.length) {
    return (
      <JesusPlaceholder
        message={t('jesus.event.noCompare', 'No comparison available.')}
        testID="jesus-compare-empty"
      />
    );
  }

  return (
    <View style={styles.body} testID="jesus-compare-body">
      <Text style={styles.tabTitle}>
        {t('jesus.event.compareOf', 'Compare: {{title}}', { title: detail.event.title })}
      </Text>
      {compare.data.parallel_confidence ? (
        <View style={styles.confidenceRow}>
          <ConfidenceBadge value={compare.data.parallel_confidence} />
        </View>
      ) : null}

      {compare.data.note ? <Text style={styles.prose}>{compare.data.note}</Text> : null}

      {compare.data.shared_by?.length ? (
        <>
          <Text style={styles.sectionLabel}>{t('jesus.compare.sharedBy', 'Told by')}</Text>
          <Text style={styles.reference}>{uniqueGospels(compare.data.shared_by).join(' · ')}</Text>
        </>
      ) : null}

      {compare.data.accounts.map((account) => (
        <View key={account.gospel} style={styles.accountCard}>
          <Text style={styles.accountName}>{account.gospel}</Text>
          {!account.records_it ? (
            <Text style={styles.reference}>
              {t('jesus.event.notRecorded', 'Does not record it')}
            </Text>
          ) : (
            // What each Gospel ADDS is carried per passage, not per account —
            // one Gospel can tell an event across two passages and emphasise
            // something different in each.
            (account.passages ?? []).map((passage) => (
              <View key={passage.display} style={styles.accountPassage}>
                <Text style={styles.reference}>{passage.display}</Text>
                {passage.emphasis ? (
                  <Text style={styles.accountEmphasis}>{passage.emphasis}</Text>
                ) : null}
                {passage.unique_to_account ? (
                  <Text style={styles.accountAdds}>
                    {t('jesus.event.adds', 'Only here: {{adds}}', {
                      adds: passage.unique_to_account,
                    })}
                  </Text>
                ) : null}
              </View>
            ))
          )}
        </View>
      ))}
    </View>
  );
}

function createStyles(colors: Colors) {
  return StyleSheet.create({
    body: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
    tabTitle: {
      fontSize: fontSizes.heading3,
      fontWeight: fontWeights.semibold,
      color: colors.textPrimary,
    },
    where: { fontSize: fontSizes.caption, color: colors.textTertiary, marginTop: spacing.xs },
    prose: {
      fontSize: fontSizes.body,
      lineHeight: 24,
      color: colors.textPrimary,
      marginTop: spacing.md,
    },
    sectionLabel: {
      fontSize: fontSizes.caption,
      fontWeight: fontWeights.semibold,
      letterSpacing: 1,
      textTransform: 'uppercase',
      color: colors.gold,
      marginTop: spacing.xl,
      marginBottom: spacing.sm,
    },
    group: { marginBottom: spacing.md },
    groupLabel: {
      fontSize: fontSizes.caption,
      fontWeight: fontWeights.semibold,
      color: colors.textSecondary,
      marginBottom: spacing.xs,
    },
    revealRow: { marginBottom: spacing.sm },
    revealWho: { fontSize: fontSizes.bodySmall, color: colors.gold },
    revealText: { fontSize: fontSizes.body, color: colors.textPrimary },
    reference: { fontSize: fontSizes.caption, color: colors.textTertiary, marginTop: 2 },
    facetCard: {
      marginTop: spacing.sm,
      padding: spacing.md,
      borderRadius: radii.md,
      backgroundColor: colors.backgroundSecondary,
    },
    facetTitle: {
      fontSize: fontSizes.bodySmall,
      fontWeight: fontWeights.semibold,
      color: colors.textPrimary,
    },
    facetQuote: {
      fontSize: fontSizes.body,
      fontStyle: 'italic',
      color: colors.textPrimary,
      marginTop: 2,
    },
    studyScope: {
      fontSize: fontSizes.caption,
      color: colors.textTertiary,
      marginBottom: spacing.sm,
    },
    studyRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
    studyLabel: { width: 90, fontSize: fontSizes.bodySmall, color: colors.textTertiary },
    studyValue: { flex: 1, fontSize: fontSizes.bodySmall, color: colors.textPrimary },
    confidenceRow: { flexDirection: 'row', marginTop: spacing.sm },
    accountCard: {
      marginTop: spacing.sm,
      padding: spacing.md,
      borderRadius: radii.md,
      backgroundColor: colors.backgroundSecondary,
    },
    accountName: {
      fontSize: fontSizes.body,
      fontWeight: fontWeights.semibold,
      color: colors.textPrimary,
    },
    accountPassage: { marginTop: spacing.sm },
    accountAdds: { fontSize: fontSizes.bodySmall, color: colors.gold, marginTop: spacing.xs },
    accountEmphasis: {
      fontSize: fontSizes.bodySmall,
      color: colors.textSecondary,
      marginTop: spacing.xs,
    },
  });
}
