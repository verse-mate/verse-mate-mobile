/**
 * StudyPanel Component
 *
 * Renders the Hendricks OIA / Precept-method inductive Bible study for a
 * given chapter. Data is bundled via the @versemate/studies package — no
 * API fetch, no loading state, no offline concerns. Returns null when no
 * authored study exists for the chapter.
 *
 * The data shape is a discriminated union (StudyStep.kind), so each step
 * type has its own renderer (prose / qa / keywords / lists / contrasts /
 * bullets / segments).
 *
 * Mirrors the web app's StudyPanel.tsx — same content, ported to React
 * Native primitives (View / Text / StyleSheet) instead of Tailwind.
 */

import { getStudyFor, type InductiveStudy } from '@versemate/studies';
import type {
  StepBullets,
  StepContrasts,
  StepKeywords,
  StepLists,
  StepProse,
  StepQA,
  StepSegments,
  StudyApplication,
  StudyMovement,
  StudyStep,
} from '@versemate/studies/types';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { useTheme } from '@/contexts/ThemeContext';
import { fontSizes, fontWeights, type getColors, lineHeights, spacing } from '@/theme/tokens';

export interface StudyPanelProps {
  bookId: number;
  chapter: number;
  testID?: string;
}

export function StudyPanel({ bookId, chapter, testID = 'study-panel' }: StudyPanelProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const markdownStyles = useMemo(() => createMarkdownStyles(colors), [colors]);

  // getStudyFor is async — each chapter is its own bundler chunk to keep
  // assets under Cloudflare Workers' 25 MiB per-file limit at full Bible
  // coverage. First visit to a chapter pays one fetch; subsequent reads
  // hit Metro's module cache + the in-package CACHE map.
  const [study, setStudy] = useState<InductiveStudy | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getStudyFor(bookId, chapter).then((s) => {
      if (cancelled) return;
      setStudy(s);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [bookId, chapter]);

  if (loading) {
    return (
      <View style={styles.emptyContainer} testID={`${testID}-loading`}>
        <Text style={styles.emptyText}>Loading…</Text>
      </View>
    );
  }

  if (!study) {
    return (
      <View style={styles.emptyContainer} testID={`${testID}-empty`}>
        <Text style={styles.emptyText}>No study available for this chapter yet.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container} testID={testID}>
      {/* Title + chapter theme */}
      <View style={styles.header}>
        <Text style={styles.title} testID={`${testID}-title`}>
          {study.title}
        </Text>
        <Text style={styles.subtitle}>{study.subtitle}</Text>
        <Text style={styles.theme} testID={`${testID}-theme`}>
          {study.themeOneLine}
        </Text>
      </View>

      {/* Observation — 9 steps */}
      <SectionHeader label="Observation" colors={colors} testID={`${testID}-observation`} />
      {study.steps.map((step) => (
        <StepRenderer
          key={step.number}
          step={step}
          colors={colors}
          markdownStyles={markdownStyles}
          testID={`${testID}-step-${step.number}`}
        />
      ))}

      {/* Interpretation — 4-6 movements */}
      <SectionHeader label="Interpretation" colors={colors} testID={`${testID}-interpretation`} />
      {study.interpretation.intro ? (
        <Text style={styles.intro}>{study.interpretation.intro}</Text>
      ) : null}
      {study.interpretation.movements.map((movement) => (
        <MovementRenderer
          key={movement.number}
          movement={movement}
          colors={colors}
          markdownStyles={markdownStyles}
          testID={`${testID}-movement-${movement.number}`}
        />
      ))}

      {/* Application — 5-9 questions */}
      <SectionHeader label="Application" colors={colors} testID={`${testID}-application`} />
      {study.application.intro ? <Text style={styles.intro}>{study.application.intro}</Text> : null}
      {study.application.questions.map((q, i) => (
        <ApplicationRenderer
          key={`${q.range}-${i}`}
          question={q}
          colors={colors}
          testID={`${testID}-question-${i + 1}`}
        />
      ))}
    </View>
  );
}

// ─── Section header ──────────────────────────────────────────────────────

interface SectionHeaderProps {
  label: string;
  colors: ReturnType<typeof getColors>;
  testID: string;
}

function SectionHeader({ label, colors, testID }: SectionHeaderProps) {
  return (
    <View
      style={{
        marginTop: spacing.xl,
        marginBottom: spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.gold,
        paddingTop: spacing.md,
      }}
      testID={testID}
    >
      <Text
        style={{
          fontSize: fontSizes.caption,
          fontWeight: '700',
          color: colors.gold,
          textTransform: 'uppercase',
          letterSpacing: 2,
        }}
        accessibilityRole="header"
      >
        {label}
      </Text>
    </View>
  );
}

// ─── Step dispatcher ─────────────────────────────────────────────────────

interface StepRendererProps {
  step: StudyStep;
  colors: ReturnType<typeof getColors>;
  markdownStyles: ReturnType<typeof createMarkdownStyles>;
  testID: string;
}

function StepRenderer({ step, colors, markdownStyles, testID }: StepRendererProps) {
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.stepCard} testID={testID}>
      <View style={styles.stepHeader}>
        <Text style={styles.stepNumber}>{step.number}</Text>
        <View style={styles.stepTitleBlock}>
          <Text style={styles.stepTitle} accessibilityRole="header">
            {step.title}
          </Text>
          <Text style={styles.stepSummary}>{step.summary}</Text>
        </View>
      </View>

      <View style={styles.stepBody}>
        {step.kind === 'prose' && <ProseStep step={step} markdownStyles={markdownStyles} />}
        {step.kind === 'qa' && <QAStep step={step} colors={colors} />}
        {step.kind === 'keywords' && <KeywordsStep step={step} colors={colors} />}
        {step.kind === 'lists' && <ListsStep step={step} colors={colors} />}
        {step.kind === 'contrasts' && <ContrastsStep step={step} colors={colors} />}
        {step.kind === 'bullets' && (
          <BulletsStep step={step} colors={colors} markdownStyles={markdownStyles} />
        )}
        {step.kind === 'segments' && (
          <SegmentsStep step={step} colors={colors} markdownStyles={markdownStyles} />
        )}
      </View>
    </View>
  );
}

// ─── Step-kind renderers ─────────────────────────────────────────────────

function ProseStep({
  step,
  markdownStyles,
}: {
  step: StepProse;
  markdownStyles: ReturnType<typeof createMarkdownStyles>;
}) {
  return <Markdown style={markdownStyles}>{step.body}</Markdown>;
}

function QAStep({ step, colors }: { step: StepQA; colors: ReturnType<typeof getColors> }) {
  const styles = createStyles(colors);
  return (
    <View>
      {step.items.map((item, i) => (
        <View key={`${item.q}-${i}`} style={styles.qaItem}>
          {item.tag ? (
            <View style={styles.tagPill}>
              <Text style={styles.tagPillText}>{item.tag}</Text>
            </View>
          ) : null}
          <Text style={styles.qaQuestion}>{item.q}</Text>
          <Text style={styles.qaAnswer}>{item.a}</Text>
        </View>
      ))}
    </View>
  );
}

function KeywordsStep({
  step,
  colors,
}: {
  step: StepKeywords;
  colors: ReturnType<typeof getColors>;
}) {
  const styles = createStyles(colors);
  return (
    <View>
      {step.inventory.map((kw, i) => (
        <View key={`${kw.word}-${i}`} style={styles.keywordRow}>
          <View style={styles.keywordHeader}>
            <Text style={styles.keywordWord}>{kw.word}</Text>
            {kw.greek ? <Text style={styles.keywordGreek}>{kw.greek}</Text> : null}
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{kw.count}×</Text>
            </View>
          </View>
          {kw.definition ? <Text style={styles.keywordDef}>{kw.definition}</Text> : null}
          <Text style={styles.keywordVerses}>{kw.verses}</Text>
        </View>
      ))}
    </View>
  );
}

function ListsStep({ step, colors }: { step: StepLists; colors: ReturnType<typeof getColors> }) {
  const styles = createStyles(colors);
  return (
    <View>
      {step.lists.map((list, listIdx) => (
        <View key={`${list.title}-${listIdx}`} style={styles.listBlock}>
          <Text style={styles.listTitle}>{list.title}</Text>
          {list.rows.map((row, i) => (
            <View key={`${row.ref}-${i}`} style={styles.listRow}>
              <Text style={styles.listRef}>{row.ref}</Text>
              <Text style={styles.listTruth}>{row.truth}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function ContrastsStep({
  step,
  colors,
}: {
  step: StepContrasts;
  colors: ReturnType<typeof getColors>;
}) {
  const styles = createStyles(colors);
  return (
    <View>
      {step.items.map((item, i) => (
        <View key={`${item.verses}-${i}`} style={styles.contrastRow}>
          <View style={styles.contrastMeta}>
            <Text style={styles.contrastVerses}>{item.verses}</Text>
            <View style={[styles.contrastTypePill, contrastTypeColor(item.type, colors)]}>
              <Text style={styles.contrastTypeText}>{item.type}</Text>
            </View>
          </View>
          <Text style={styles.contrastPairing}>{item.pairing}</Text>
        </View>
      ))}
    </View>
  );
}

function contrastTypeColor(type: string, colors: ReturnType<typeof getColors>) {
  // Three canonical tints; model-emitted variants ("Irony", etc.) fall
  // through to the comparison tint so the row still renders cleanly.
  switch (type) {
    case 'Contrast':
      return { backgroundColor: colors.gold };
    case 'Comparison':
    case 'Metaphor':
    default:
      return { backgroundColor: colors.backgroundElevated };
  }
}

function BulletsStep({
  step,
  colors,
  markdownStyles,
}: {
  step: StepBullets;
  colors: ReturnType<typeof getColors>;
  markdownStyles: ReturnType<typeof createMarkdownStyles>;
}) {
  const styles = createStyles(colors);
  return (
    <View>
      {step.intro ? <Markdown style={markdownStyles}>{step.intro}</Markdown> : null}
      {step.items.map((item, i) => (
        <View key={`${item.text.slice(0, 30)}-${i}`} style={styles.bulletItem}>
          {item.tag ? (
            <View style={styles.bulletTag}>
              <Text style={styles.bulletTagText}>{item.tag}</Text>
            </View>
          ) : null}
          <View style={styles.bulletBody}>
            <Markdown style={markdownStyles}>{item.text}</Markdown>
          </View>
        </View>
      ))}
      {step.note ? (
        <View style={styles.noteBlock}>
          <Markdown style={markdownStyles}>{step.note}</Markdown>
        </View>
      ) : null}
    </View>
  );
}

function SegmentsStep({
  step,
  colors,
  markdownStyles,
}: {
  step: StepSegments;
  colors: ReturnType<typeof getColors>;
  markdownStyles: ReturnType<typeof createMarkdownStyles>;
}) {
  const styles = createStyles(colors);
  return (
    <View>
      <Text style={styles.themeHeadline}>{step.themeHeadline}</Text>
      {step.segments.map((seg, i) => (
        <View key={`${seg.title}-${i}`} style={styles.segmentBlock}>
          <Text style={styles.segmentTitle}>{seg.title}</Text>
          <Markdown style={markdownStyles}>{seg.body}</Markdown>
        </View>
      ))}
    </View>
  );
}

// ─── Interpretation movements ────────────────────────────────────────────

function MovementRenderer({
  movement,
  colors,
  markdownStyles,
  testID,
}: {
  movement: StudyMovement;
  colors: ReturnType<typeof getColors>;
  markdownStyles: ReturnType<typeof createMarkdownStyles>;
  testID: string;
}) {
  const styles = createStyles(colors);
  return (
    <View style={styles.movementCard} testID={testID}>
      <View style={styles.movementHeader}>
        <Text style={styles.movementNumber}>Movement {movement.number}</Text>
        <Text style={styles.movementRange}>{movement.range}</Text>
      </View>
      <Text style={styles.movementTitle} accessibilityRole="header">
        {movement.title}
      </Text>
      {movement.excerpt ? (
        <View style={styles.excerptBlock}>
          <Text style={styles.excerptText}>“{movement.excerpt}”</Text>
        </View>
      ) : null}
      <View style={styles.movementBody}>
        <Markdown style={markdownStyles}>{movement.body}</Markdown>
      </View>
    </View>
  );
}

// ─── Application question ────────────────────────────────────────────────

function ApplicationRenderer({
  question,
  colors,
  testID,
}: {
  question: StudyApplication;
  colors: ReturnType<typeof getColors>;
  testID: string;
}) {
  const styles = createStyles(colors);
  return (
    <View style={styles.appCard} testID={testID}>
      <Text style={styles.appRange}>{question.range}</Text>
      <Text style={styles.appQuestion}>{question.question}</Text>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────

const createStyles = (colors: ReturnType<typeof getColors>) =>
  StyleSheet.create({
    container: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.xxl,
    },
    emptyContainer: {
      padding: spacing.xl,
      alignItems: 'center',
    },
    emptyText: {
      fontSize: fontSizes.body,
      color: colors.textSecondary,
      textAlign: 'center',
    },

    header: {
      marginBottom: spacing.lg,
    },
    title: {
      fontSize: fontSizes.heading1,
      fontWeight: fontWeights.bold,
      color: colors.textPrimary,
      marginBottom: spacing.xs,
    },
    subtitle: {
      fontSize: fontSizes.bodySmall,
      fontStyle: 'italic',
      color: colors.textSecondary,
      marginBottom: spacing.sm,
    },
    theme: {
      fontSize: fontSizes.body,
      fontWeight: fontWeights.semibold,
      color: colors.gold,
      lineHeight: fontSizes.body * lineHeights.body,
    },

    intro: {
      fontSize: fontSizes.bodySmall,
      color: colors.textSecondary,
      lineHeight: fontSizes.bodySmall * lineHeights.body,
      marginBottom: spacing.md,
    },

    // Observation step card
    stepCard: {
      backgroundColor: colors.backgroundElevated,
      borderRadius: 12,
      padding: spacing.md,
      marginBottom: spacing.md,
      borderLeftWidth: 3,
      borderLeftColor: colors.gold,
    },
    stepHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: spacing.sm,
    },
    stepNumber: {
      fontSize: fontSizes.heading1,
      fontWeight: fontWeights.bold,
      color: colors.gold,
      width: 36,
      lineHeight: fontSizes.heading1,
    },
    stepTitleBlock: {
      flex: 1,
    },
    stepTitle: {
      fontSize: fontSizes.heading3,
      fontWeight: fontWeights.semibold,
      color: colors.textPrimary,
      marginBottom: spacing.xs,
    },
    stepSummary: {
      fontSize: fontSizes.bodySmall,
      fontStyle: 'italic',
      color: colors.textSecondary,
    },
    stepBody: {
      marginTop: spacing.sm,
    },

    // QA
    qaItem: {
      marginBottom: spacing.md,
      paddingTop: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.gray100,
    },
    tagPill: {
      alignSelf: 'flex-start',
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: 4,
      backgroundColor: colors.gold,
      marginBottom: spacing.xs,
    },
    tagPillText: {
      fontSize: fontSizes.caption,
      fontWeight: fontWeights.bold,
      color: colors.gray900,
      letterSpacing: 1,
    },
    qaQuestion: {
      fontSize: fontSizes.body,
      fontWeight: fontWeights.semibold,
      color: colors.textPrimary,
      marginBottom: spacing.xs,
    },
    qaAnswer: {
      fontSize: fontSizes.bodySmall,
      color: colors.textSecondary,
      lineHeight: fontSizes.bodySmall * lineHeights.body,
    },

    // Keywords
    keywordRow: {
      paddingVertical: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.gray100,
    },
    keywordHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginBottom: spacing.xs,
    },
    keywordWord: {
      fontSize: fontSizes.body,
      fontWeight: fontWeights.bold,
      color: colors.textPrimary,
    },
    keywordGreek: {
      fontSize: fontSizes.bodySmall,
      fontStyle: 'italic',
      color: colors.gold,
    },
    countBadge: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: 4,
      backgroundColor: colors.backgroundElevated,
    },
    countBadgeText: {
      fontSize: fontSizes.caption,
      fontWeight: fontWeights.semibold,
      color: colors.textSecondary,
    },
    keywordDef: {
      fontSize: fontSizes.bodySmall,
      color: colors.textSecondary,
      lineHeight: fontSizes.bodySmall * lineHeights.body,
      marginBottom: spacing.xs,
    },
    keywordVerses: {
      fontSize: fontSizes.caption,
      color: colors.textSecondary,
      fontFamily: undefined,
    },

    // Lists
    listBlock: {
      marginBottom: spacing.lg,
    },
    listTitle: {
      fontSize: fontSizes.body,
      fontWeight: fontWeights.bold,
      color: colors.textPrimary,
      marginBottom: spacing.sm,
    },
    listRow: {
      flexDirection: 'row',
      paddingVertical: spacing.xs,
      borderTopWidth: 1,
      borderTopColor: colors.gray100,
    },
    listRef: {
      width: 70,
      fontSize: fontSizes.bodySmall,
      fontWeight: fontWeights.semibold,
      color: colors.gold,
    },
    listTruth: {
      flex: 1,
      fontSize: fontSizes.bodySmall,
      color: colors.textPrimary,
      lineHeight: fontSizes.bodySmall * lineHeights.body,
    },

    // Contrasts
    contrastRow: {
      paddingVertical: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.gray100,
    },
    contrastMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.xs,
    },
    contrastVerses: {
      fontSize: fontSizes.bodySmall,
      fontWeight: fontWeights.semibold,
      color: colors.gold,
    },
    contrastTypePill: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: 4,
    },
    contrastTypeText: {
      fontSize: fontSizes.caption,
      fontWeight: fontWeights.semibold,
      color: colors.gray900,
    },
    contrastPairing: {
      fontSize: fontSizes.bodySmall,
      color: colors.textPrimary,
      lineHeight: fontSizes.bodySmall * lineHeights.body,
    },

    // Bullets
    bulletItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: spacing.sm,
      gap: spacing.sm,
    },
    bulletTag: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: 4,
      backgroundColor: colors.gold,
      marginTop: 2,
    },
    bulletTagText: {
      fontSize: fontSizes.caption,
      fontWeight: fontWeights.bold,
      color: colors.gray900,
      letterSpacing: 1,
    },
    bulletBody: {
      flex: 1,
    },
    noteBlock: {
      marginTop: spacing.md,
      padding: spacing.md,
      borderRadius: 8,
      backgroundColor: colors.backgroundElevated,
    },

    // Segments (chapter theme)
    themeHeadline: {
      fontSize: fontSizes.heading3,
      fontWeight: fontWeights.bold,
      fontStyle: 'italic',
      color: colors.gold,
      marginBottom: spacing.md,
      lineHeight: fontSizes.heading3 * lineHeights.body,
    },
    segmentBlock: {
      marginBottom: spacing.md,
    },
    segmentTitle: {
      fontSize: fontSizes.body,
      fontWeight: fontWeights.semibold,
      color: colors.textPrimary,
      marginBottom: spacing.xs,
    },

    // Movements
    movementCard: {
      marginBottom: spacing.lg,
      paddingBottom: spacing.md,
    },
    movementHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.xs,
    },
    movementNumber: {
      fontSize: fontSizes.caption,
      fontWeight: fontWeights.bold,
      color: colors.gold,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    movementRange: {
      fontSize: fontSizes.caption,
      fontWeight: fontWeights.semibold,
      color: colors.textSecondary,
    },
    movementTitle: {
      fontSize: fontSizes.heading3,
      fontWeight: fontWeights.bold,
      color: colors.textPrimary,
      marginBottom: spacing.sm,
    },
    excerptBlock: {
      borderLeftWidth: 3,
      borderLeftColor: colors.gold,
      paddingLeft: spacing.md,
      paddingVertical: spacing.xs,
      marginBottom: spacing.sm,
    },
    excerptText: {
      fontSize: fontSizes.bodySmall,
      fontStyle: 'italic',
      color: colors.textSecondary,
      lineHeight: fontSizes.bodySmall * lineHeights.body,
    },
    movementBody: {
      marginTop: spacing.sm,
    },

    // Application
    appCard: {
      backgroundColor: colors.backgroundElevated,
      borderRadius: 8,
      padding: spacing.md,
      marginBottom: spacing.sm,
      borderLeftWidth: 3,
      borderLeftColor: colors.gold,
    },
    appRange: {
      fontSize: fontSizes.caption,
      fontWeight: fontWeights.bold,
      color: colors.gold,
      marginBottom: spacing.xs,
    },
    appQuestion: {
      fontSize: fontSizes.bodySmall,
      color: colors.textPrimary,
      lineHeight: fontSizes.bodySmall * lineHeights.body,
    },
  });

const createMarkdownStyles = (colors: ReturnType<typeof getColors>) => ({
  body: {
    fontSize: fontSizes.bodySmall,
    color: colors.textPrimary,
    lineHeight: fontSizes.bodySmall * lineHeights.body,
  },
  paragraph: {
    marginBottom: spacing.sm,
  },
  strong: {
    fontWeight: fontWeights.bold,
    color: colors.textPrimary,
  },
  em: {
    fontStyle: 'italic' as const,
  },
  blockquote: {
    borderLeftWidth: 3,
    borderLeftColor: colors.gold,
    paddingLeft: spacing.md,
    marginVertical: spacing.sm,
    backgroundColor: 'transparent',
  },
  link: {
    color: colors.gold,
    textDecorationLine: 'underline' as const,
  },
});
