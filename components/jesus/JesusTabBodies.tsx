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
import { createInsightMarkdownStyles } from '@/components/bible/insightMarkdownStyles';
import { StudyPanel } from '@/components/bible/StudyPanel';
import {
  ConfidenceBadge,
  JesusPlaceholder,
  queryPhase,
  uniqueGospels,
} from '@/components/jesus/JesusParts';
import { useTheme } from '@/contexts/ThemeContext';
import { useFontSize } from '@/hooks/bible/use-font-size';
import { useJesusCompare } from '@/hooks/jesus';
import { useBibleVersion } from '@/hooks/use-bible-version';
import { usePreferredLanguage } from '@/hooks/use-preferred-language';
import { covers } from '@/lib/jesus/byline-scope';
import { eventVerseSpan, narrowStudyToEvent, spanRangeLabel } from '@/lib/jesus/study-scope';
import { Markdown } from '@/lib/markdown/Markdown';
import { useBibleByLine, useStudy } from '@/src/api';
import {
  fontSizes,
  fontWeights,
  type getColors,
  lineHeights,
  radii,
  spacing,
} from '@/theme/tokens';
import type { JesusEventDetail, JesusEventPassage, JesusReveal } from '@/types/jesus';
import { parseByLineSections } from '@/utils/bible/parseByLineExplanation';

type Colors = ReturnType<typeof getColors>;

/**
 * Text on the Jesus tabs is sized and coloured EXACTLY as the reader's Insight.
 *
 * It used to carry its own scale — prose at 16, By-Line at 14 in grey, labels
 * at 12 — all fixed, so the tabs read smaller than the chapter Insight beside
 * them and ignored the reader's font-size setting. Andy, on build 116: "some of
 * the font gets small on Jesus tabs" and "some of the colors aren't consistent
 * w the other pages — like line by line … make all Jesus same as others".
 *
 * So commentary renders through the reader's own markdown styles, and every
 * other piece of text scales by the same ratio the reader applies (the setting
 * over its 18pt default), which makes 1.0 at the default.
 */
function useTabStyles() {
  const { colors } = useTheme();
  const { fontSize } = useFontSize();
  return useMemo(
    () => ({
      styles: createStyles(colors, fontSize / fontSizes.bodyLarge),
      md: createInsightMarkdownStyles(colors, fontSize),
    }),
    [colors, fontSize]
  );
}

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
  const { t } = useTranslation();
  const { styles, md } = useTabStyles();
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

      {detail.explanation?.overview || event.summary ? (
        <View style={styles.prose}>
          <Markdown style={md}>{detail.explanation?.overview ?? event.summary ?? ''}</Markdown>
        </View>
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
/**
 * One account's line-by-line rows.
 *
 * Its own component because each account is a different chapter and therefore
 * a different fetch — hooks cannot run in a loop over passages.
 *
 * NOTHING COLLAPSES HERE. The first version made every verse a closed
 * accordion row, so the tab opened as a bare list of references and reading it
 * cost one tap per verse. That was invented, not asked for: web opens every
 * row by default (collapsing is its exception), and the reader's OWN By-Line
 * tab has no toggle at all — it prints each section one after the next
 * (ChapterReader maps `parseByLineSections` straight into <Markdown>). A
 * commentary meant to be read straight through must not arrive folded up, and
 * the Jesus feature should not be the one place in the app where it does.
 */
function BylineAccount({ passage, labelled }: { passage: JesusEventPassage; labelled: boolean }) {
  const { t } = useTranslation();
  const { styles, md } = useTabStyles();

  // The reader's own call (ChapterPage's useBibleByLine): same language, same
  // version, so this shares its cache and is not English for everyone.
  const language = usePreferredLanguage();
  const { bibleVersion } = useBibleVersion();
  const query = useBibleByLine(passage.book_id, passage.chapter, bibleVersion, { language });
  const data = query.data as { content?: string } | undefined;

  const rows = useMemo(() => {
    const content = data?.content;
    if (!content) return [];
    return parseByLineSections(content, passage.chapter)
      .filter((section) => section.verseNumber > 0 && covers(passage, section.verseNumber))
      .map((section) => ({
        verse: section.verseNumber,
        markdown: section.markdown,
      }));
  }, [data?.content, passage]);

  return (
    <View testID={`jesus-byline-account-${passage.display}`}>
      {/* One account needs no heading — the tab title already names it. Two or
          more and the reader has to be told which telling is which. */}
      {labelled ? <Text style={styles.bylineAccount}>{passage.display}</Text> : null}

      {query.isPending ? (
        <Text style={styles.bylineNote}>{t('common.loading', 'Loading…')}</Text>
      ) : rows.length === 0 ? (
        // Named, not omitted: an account that vanishes reads as "this verse has
        // no explanation", which is a different claim from "it is not written
        // yet".
        <Text style={styles.bylineNote} testID={`jesus-byline-empty-${passage.display}`}>
          {t(
            'jesus.event.noBylineForAccount',
            'The line-by-line reading of {{account}} hasn’t been generated yet.',
            { account: passage.display }
          )}
        </Text>
      ) : (
        // `row.markdown` already opens with the reference as its own heading —
        // the same subtree the reader renders — so nothing is printed above it.
        rows.map((row) => (
          <View
            key={row.verse}
            style={styles.bylineRow}
            testID={`jesus-byline-row-${passage.book_id}-${passage.chapter}-${row.verse}`}
          >
            <Markdown style={md}>{row.markdown}</Markdown>
          </View>
        ))
      )}
    </View>
  );
}

/**
 * The By-Line tab: the chapter's line-by-line commentary, scoped to this
 * event's verses, one section per Gospel account.
 *
 * Was a list of the event's facet cards — which is the Summary tab's material
 * in a different shape, and is why the tester said "By-Line doesn't have the
 * lines". Web builds this from the same by-line commentary the reader's own
 * By-Line tab shows; so does this now, through the same parser.
 */
function BylineBody({ detail }: { detail: JesusEventDetail }) {
  const { t } = useTranslation();
  const { styles } = useTabStyles();

  const passages = detail.passages ?? [];

  if (passages.length === 0) {
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
        {t('jesus.event.bylineOf', 'Line-by-Line Analysis of {{title}}', {
          title: detail.event.title,
        })}
      </Text>
      {passages.map((passage) => (
        <BylineAccount key={passage.display} passage={passage} labelled={passages.length > 1} />
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
  const { t } = useTranslation();
  const { styles } = useTabStyles();
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
  // In the reader's language, as StudyPanel asks for it.
  const language = usePreferredLanguage();
  const { data: chapterStudy } = useStudy(span?.bookId ?? 0, span?.chapter ?? 0, language);
  const narrowed = useMemo(
    () => (chapterStudy && span ? narrowStudyToEvent(chapterStudy, span) : null),
    [chapterStudy, span]
  );

  /*
   * No Where / When / Period / Accounts / People table.
   *
   * "On Jesus study - let's remove this top part and make consistent w other
   * study pages" — the tester circled exactly those four rows. They restated
   * what the Summary tab already says and gave the Study tab a header no other
   * study page has, which is what made it look like a different kind of page.
   *
   * Web goes further and nests the event's own material (His words, His acts,
   * the reactions, what it reveals) INSIDE the nine-step spine rather than
   * above it — see web's lib/jesusStudyEmbed. That needs per-step slots this
   * app's StudyPanel does not expose yet, so the questions still sit above the
   * spine here rather than inside step 4.
   */

  const questions = (detail.words ?? []).filter((f) => f.type_slug === 'questions');

  return (
    <View style={styles.body} testID="jesus-study-body">
      <Text style={styles.tabTitle}>
        {t('jesus.event.studyOf', 'Study: {{title}}', { title: event.title })}
      </Text>

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
  const { t } = useTranslation();
  const { styles, md } = useTabStyles();
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

      {/* Rendered like Summary's overview. It used to be a bare <Text> under
          `prose` — a margin-only container style — so it got React Native's
          default black text: invisible in dark mode. */}
      {compare.data.note ? (
        <View style={styles.prose} testID="jesus-compare-note">
          <Markdown style={md}>{compare.data.note}</Markdown>
        </View>
      ) : null}

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

/** Minimal markdown skin for a by-line row — body text, nothing structural. */

function createStyles(colors: Colors, scale: number) {
  const size = (base: number) => Math.round(base * scale);
  return StyleSheet.create({
    body: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
    // The reader's Insight title (ChapterReader `explanationTitle`), verbatim.
    tabTitle: {
      fontSize: fontSizes.heading1,
      fontWeight: fontWeights.bold,
      lineHeight: fontSizes.heading1 * lineHeights.heading,
      color: colors.textPrimary,
    },
    // Where + who — was 12pt tertiary, the smallest text on a screen Andy
    // flagged for small text. One step up and secondary, still clearly a
    // caption to the title rather than competing with the commentary.
    where: {
      fontSize: size(fontSizes.bodySmall),
      lineHeight: size(fontSizes.bodySmall) * 1.4,
      color: colors.textSecondary,
      marginTop: spacing.xs,
    },
    // Holds a <Markdown> using the reader's styles; only spacing lives here.
    prose: { marginTop: spacing.md },
    sectionLabel: {
      fontSize: size(fontSizes.caption),
      fontWeight: fontWeights.semibold,
      letterSpacing: 1,
      textTransform: 'uppercase',
      color: colors.gold,
      marginTop: spacing.xl,
      marginBottom: spacing.sm,
    },
    group: { marginBottom: spacing.md },
    groupLabel: {
      fontSize: size(fontSizes.bodySmall),
      fontWeight: fontWeights.semibold,
      color: colors.textSecondary,
      marginBottom: spacing.xs,
    },
    revealRow: { marginBottom: spacing.sm },
    revealWho: { fontSize: size(fontSizes.bodySmall), color: colors.gold },
    revealText: {
      fontSize: size(fontSizes.bodyLarge),
      lineHeight: size(fontSizes.bodyLarge) * 1.6,
      color: colors.textPrimary,
    },
    reference: { fontSize: size(fontSizes.caption), color: colors.textTertiary, marginTop: 2 },
    facetCard: {
      marginTop: spacing.sm,
      padding: spacing.md,
      borderRadius: radii.md,
      backgroundColor: colors.backgroundSecondary,
    },
    facetTitle: {
      fontSize: size(fontSizes.bodySmall),
      fontWeight: fontWeights.semibold,
      color: colors.textPrimary,
    },
    facetQuote: {
      fontSize: size(fontSizes.body),
      fontStyle: 'italic',
      color: colors.textPrimary,
      marginTop: 2,
    },
    bylineAccount: {
      fontSize: size(fontSizes.caption),
      fontWeight: fontWeights.semibold,
      letterSpacing: 1,
      textTransform: 'uppercase',
      color: colors.textTertiary,
      marginTop: spacing.lg,
      marginBottom: spacing.xs,
    },
    bylineNote: {
      fontSize: size(fontSizes.bodySmall),
      color: colors.textTertiary,
      fontStyle: 'italic',
      paddingVertical: spacing.sm,
    },
    // A rule between verses, not a row of controls: the reference heading comes
    // from the commentary's own markdown, as it does in the reader.
    bylineRow: {
      paddingBottom: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.divider,
    },
    studyScope: {
      fontSize: size(fontSizes.caption),
      color: colors.textTertiary,
      marginBottom: spacing.sm,
    },
    confidenceRow: { flexDirection: 'row', marginTop: spacing.sm },
    accountCard: {
      marginTop: spacing.sm,
      padding: spacing.md,
      borderRadius: radii.md,
      backgroundColor: colors.backgroundSecondary,
    },
    accountName: {
      fontSize: size(fontSizes.body),
      fontWeight: fontWeights.semibold,
      color: colors.textPrimary,
    },
    accountPassage: { marginTop: spacing.sm },
    accountAdds: { fontSize: size(fontSizes.bodySmall), color: colors.gold, marginTop: spacing.xs },
    accountEmphasis: {
      fontSize: size(fontSizes.bodySmall),
      color: colors.textSecondary,
      marginTop: spacing.xs,
    },
  });
}
