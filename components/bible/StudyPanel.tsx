/**
 * StudyPanel Component
 *
 * Renders the Hendricks OIA / Precept-method inductive Bible study for a
 * given chapter, mirroring the web app's StudyPanel.tsx.
 *
 * Data is loaded async via `getStudyFor` from the `@versemate/studies`
 * package — chapters are code-split (each is its own bundler chunk) so we
 * pay one fetch on first visit per chapter, then hit the in-package CACHE.
 *
 * Behavior parity with web:
 *   - Default state: every section collapsed.
 *   - Bulk Expand All / Collapse All toggle.
 *   - Per-card overrides win over bulk state once the user touches a card.
 *   - Copy / Share buttons emit the same plain-text payload as web.
 *   - Step kinds with sub-items (qa, lists) nest collapsibles per item.
 *
 * State persistence is in-memory only (BibleExplanationsPanel keeps this
 * tab mounted, so state survives tab switches). Switching chapters resets
 * to default-collapsed, since the IDs are chapter-scoped on web too.
 */

import { Ionicons } from '@expo/vector-icons';
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
import * as Clipboard from 'expo-clipboard';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { useTheme } from '@/contexts/ThemeContext';
import { fontSizes, fontWeights, type getColors, lineHeights, spacing } from '@/theme/tokens';

export interface StudyPanelProps {
  bookId: number;
  chapter: number;
  testID?: string;
}

type Colors = ReturnType<typeof getColors>;
type Styles = ReturnType<typeof createStyles>;
type MarkdownStyles = ReturnType<typeof createMarkdownStyles>;

export function StudyPanel({ bookId, chapter, testID = 'study-panel' }: StudyPanelProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const markdownStyles = useMemo(() => createMarkdownStyles(colors), [colors]);

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

  // Bulk state drives the default for every section. Per-card overrides
  // win when the user toggles individually after a bulk action.
  const [bulkState, setBulkState] = useState<'expanded' | 'collapsed'>('collapsed');
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  // Reset open/closed state when the chapter changes — IDs (step-1, step-2,
  // etc.) are generic across chapters, so without a reset the previous
  // chapter's expanded sections would bleed into the new chapter.
  useEffect(() => {
    setBulkState('collapsed');
    setOverrides({});
  }, [bookId, chapter]);

  const isOpen = useCallback(
    (id: string): boolean => {
      if (id in overrides) return overrides[id];
      return bulkState === 'expanded';
    },
    [bulkState, overrides]
  );
  const toggle = useCallback((id: string) => {
    setOverrides((prev) => {
      const wasOpen = id in prev ? prev[id] : false;
      return { ...prev, [id]: !wasOpen };
    });
  }, []);

  // Copy / Share feedback (checkmark flash after copy)
  const [copied, setCopied] = useState(false);
  const onCopy = useCallback(async () => {
    if (!study) return;
    try {
      await Clipboard.setStringAsync(buildStudyCopyText(study));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore — clipboard occasionally fails on simulator
    }
  }, [study]);
  const onShare = useCallback(async () => {
    if (!study) return;
    try {
      await Share.share({
        title: `Inductive Study of ${study.title}`,
        message: buildStudyCopyText(study),
      });
    } catch {
      // ignore — user dismissal also throws
    }
  }, [study]);

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

  // Build the full id list for bulk Expand-All / Collapse-All. Mirrors web.
  const allIds: string[] = [];
  allIds.push('observation-intro');
  for (const s of study.steps) {
    allIds.push(`step-${s.number}`);
    if (s.kind === 'qa') {
      s.items.forEach((_, i) => {
        allIds.push(`step-${s.number}-qa-${i}`);
      });
    }
    if (s.kind === 'lists') {
      s.lists.forEach((_, i) => {
        allIds.push(`step-${s.number}-list-${i}`);
      });
    }
  }
  if (study.interpretation.intro) allIds.push('interpretation-intro');
  for (const m of study.interpretation.movements) allIds.push(`mv-${m.number}`);
  allIds.push('application');

  const allOpen = allIds.every((id) => isOpen(id));
  const setAll = (open: boolean) => {
    setBulkState(open ? 'expanded' : 'collapsed');
    setOverrides({});
  };

  return (
    <View style={styles.container} testID={testID}>
      {/* Title row + Copy / Share */}
      <View style={styles.titleRow}>
        <Text style={styles.title} testID={`${testID}-title`} accessibilityRole="header">
          Inductive Study of {study.title}
        </Text>
        <View style={styles.titleActions}>
          <Pressable
            onPress={onCopy}
            style={styles.iconButton}
            accessibilityRole="button"
            accessibilityLabel="Copy study"
            testID={`${testID}-copy`}
            hitSlop={8}
          >
            <Ionicons
              name={copied ? 'checkmark' : 'copy-outline'}
              size={20}
              color={copied ? colors.gold : colors.textPrimary}
            />
          </Pressable>
          <Pressable
            onPress={onShare}
            style={styles.iconButton}
            accessibilityRole="button"
            accessibilityLabel="Share study"
            testID={`${testID}-share`}
            hitSlop={8}
          >
            <Ionicons name="share-outline" size={20} color={colors.textPrimary} />
          </Pressable>
        </View>
      </View>

      {/* Subtitle + theme line — small, muted, just below the title row */}
      {study.subtitle ? <Text style={styles.subtitle}>{study.subtitle}</Text> : null}
      {study.themeOneLine ? (
        <Text style={styles.theme} testID={`${testID}-theme`}>
          {study.themeOneLine}
        </Text>
      ) : null}

      {/* Expand All / Collapse All */}
      <View style={styles.expandAllRow}>
        <Pressable
          onPress={() => setAll(!allOpen)}
          accessibilityRole="button"
          testID={`${testID}-toggle-all`}
          hitSlop={6}
        >
          <Text style={styles.expandAllText}>{allOpen ? 'Collapse All' : 'Expand All'}</Text>
        </Pressable>
      </View>

      {/* OBSERVATION */}
      <SectionHeading label="Observation — 9 Inductive Steps" colors={colors} styles={styles} />
      <Card
        open={isOpen('observation-intro')}
        onToggle={() => toggle('observation-intro')}
        heading="About the nine observation steps"
        colors={colors}
        styles={styles}
        testID={`${testID}-observation-intro`}
      >
        <Text style={styles.sectionIntro}>
          Observation asks what the text says — slowing down to mark the keywords, contrasts,
          repetitions, and structural cues the author left for you. Each of the nine steps below
          builds the evidence the interpretation that follows is built on. Don&apos;t skip ahead;
          the meaning comes from what you observed.
        </Text>
      </Card>
      {study.steps.map((step) => (
        <StepCard
          key={step.number}
          step={step}
          isOpen={isOpen}
          toggle={toggle}
          colors={colors}
          styles={styles}
          markdownStyles={markdownStyles}
          testID={`${testID}-step-${step.number}`}
        />
      ))}

      {/* INTERPRETATION */}
      <SectionHeading label="Interpretation" colors={colors} styles={styles} />
      {study.interpretation.intro ? (
        <Card
          open={isOpen('interpretation-intro')}
          onToggle={() => toggle('interpretation-intro')}
          heading="About the interpretation movements"
          colors={colors}
          styles={styles}
          testID={`${testID}-interpretation-intro`}
        >
          <Text style={styles.sectionIntro}>{study.interpretation.intro}</Text>
        </Card>
      ) : null}
      {study.interpretation.movements.map((movement) => (
        <Card
          key={movement.number}
          open={isOpen(`mv-${movement.number}`)}
          onToggle={() => toggle(`mv-${movement.number}`)}
          heading={`Movement ${movement.number} — ${movement.title}`}
          subPill={movement.range}
          colors={colors}
          styles={styles}
          testID={`${testID}-movement-${movement.number}`}
        >
          <MovementBody movement={movement} styles={styles} markdownStyles={markdownStyles} />
        </Card>
      ))}

      {/* APPLICATION */}
      <SectionHeading label="Application" colors={colors} styles={styles} />
      <Card
        open={isOpen('application')}
        onToggle={() => toggle('application')}
        heading="Apply, one question per movement"
        colors={colors}
        styles={styles}
        testID={`${testID}-application`}
      >
        {study.application.intro ? (
          <Text style={[styles.sectionIntro, styles.applicationIntro]}>
            {study.application.intro}
          </Text>
        ) : null}
        {study.application.questions.map((q, i) => (
          <ApplicationRow
            key={`${q.range}-${i}`}
            question={q}
            colors={colors}
            styles={styles}
            testID={`${testID}-question-${i + 1}`}
          />
        ))}
      </Card>
    </View>
  );
}

// ─── Section heading ─────────────────────────────────────────────────────

interface SectionHeadingProps {
  label: string;
  colors: Colors;
  styles: Styles;
}

function SectionHeading({ label, styles }: SectionHeadingProps) {
  return (
    <View style={styles.sectionHeadingWrap}>
      <Text style={styles.sectionHeadingText} accessibilityRole="header">
        {label}
      </Text>
    </View>
  );
}

// ─── Step card ───────────────────────────────────────────────────────────

interface StepCardProps {
  step: StudyStep;
  isOpen: (id: string) => boolean;
  toggle: (id: string) => void;
  colors: Colors;
  styles: Styles;
  markdownStyles: MarkdownStyles;
  testID: string;
}

function StepCard({ step, isOpen, toggle, colors, styles, markdownStyles, testID }: StepCardProps) {
  const id = `step-${step.number}`;
  const open = isOpen(id);
  return (
    <Card
      open={open}
      onToggle={() => toggle(id)}
      heading={step.title}
      subheading={step.summary}
      stepNumber={step.number}
      colors={colors}
      styles={styles}
      testID={testID}
    >
      <StepBody
        step={step}
        isOpen={isOpen}
        toggle={toggle}
        colors={colors}
        styles={styles}
        markdownStyles={markdownStyles}
        testIDPrefix={testID}
      />
    </Card>
  );
}

interface StepBodyProps {
  step: StudyStep;
  isOpen: (id: string) => boolean;
  toggle: (id: string) => void;
  colors: Colors;
  styles: Styles;
  markdownStyles: MarkdownStyles;
  testIDPrefix: string;
}

function StepBody({
  step,
  isOpen,
  toggle,
  colors,
  styles,
  markdownStyles,
  testIDPrefix,
}: StepBodyProps) {
  switch (step.kind) {
    case 'prose':
      return <ProseStep step={step} markdownStyles={markdownStyles} />;
    case 'qa':
      return (
        <QAStep
          step={step}
          isOpen={isOpen}
          toggle={toggle}
          colors={colors}
          styles={styles}
          markdownStyles={markdownStyles}
          testIDPrefix={testIDPrefix}
        />
      );
    case 'keywords':
      return <KeywordsStep step={step} styles={styles} />;
    case 'lists':
      return (
        <ListsStep
          step={step}
          isOpen={isOpen}
          toggle={toggle}
          colors={colors}
          styles={styles}
          testIDPrefix={testIDPrefix}
        />
      );
    case 'contrasts':
      return <ContrastsStep step={step} colors={colors} styles={styles} />;
    case 'bullets':
      return <BulletsStep step={step} styles={styles} markdownStyles={markdownStyles} />;
    case 'segments':
      return <SegmentsStep step={step} styles={styles} markdownStyles={markdownStyles} />;
  }
}

// ─── Step-kind renderers ─────────────────────────────────────────────────

function ProseStep({ step, markdownStyles }: { step: StepProse; markdownStyles: MarkdownStyles }) {
  return <Markdown style={markdownStyles}>{step.body}</Markdown>;
}

function QAStep({
  step,
  isOpen,
  toggle,
  colors,
  styles,
  markdownStyles,
  testIDPrefix,
}: {
  step: StepQA;
  isOpen: (id: string) => boolean;
  toggle: (id: string) => void;
  colors: Colors;
  styles: Styles;
  markdownStyles: MarkdownStyles;
  testIDPrefix: string;
}) {
  return (
    <View>
      {step.items.map((item, i) => {
        const id = `step-${step.number}-qa-${i}`;
        return (
          <NestedCard
            key={`${item.q}-${i}`}
            open={isOpen(id)}
            onToggle={() => toggle(id)}
            heading={item.q}
            tag={item.tag}
            colors={colors}
            styles={styles}
            testID={`${testIDPrefix}-qa-${i}`}
          >
            <Markdown style={markdownStyles}>{item.a}</Markdown>
          </NestedCard>
        );
      })}
    </View>
  );
}

function KeywordsStep({ step, styles }: { step: StepKeywords; styles: Styles }) {
  return (
    <View>
      {step.inventory.map((kw, i) => (
        <View key={`${kw.word}-${i}`} style={styles.keywordRow}>
          <View style={styles.keywordHeader}>
            <Text style={styles.keywordWord}>{kw.word}</Text>
            {kw.greek ? <Text style={styles.keywordGreek}>{kw.greek}</Text> : null}
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>×{kw.count}</Text>
            </View>
          </View>
          <Text style={styles.keywordVerses}>
            <Text style={styles.keywordVersesLabel}>VERSES </Text>
            {kw.verses}
          </Text>
          {kw.definition ? <Text style={styles.keywordDef}>{kw.definition}</Text> : null}
        </View>
      ))}
    </View>
  );
}

function ListsStep({
  step,
  isOpen,
  toggle,
  colors,
  styles,
  testIDPrefix,
}: {
  step: StepLists;
  isOpen: (id: string) => boolean;
  toggle: (id: string) => void;
  colors: Colors;
  styles: Styles;
  testIDPrefix: string;
}) {
  return (
    <View>
      {step.lists.map((list, listIdx) => {
        const id = `step-${step.number}-list-${listIdx}`;
        const [colLeft, colRight] = list.columns;
        return (
          <NestedCard
            key={`${list.title}-${listIdx}`}
            open={isOpen(id)}
            onToggle={() => toggle(id)}
            heading={list.title}
            colors={colors}
            styles={styles}
            testID={`${testIDPrefix}-list-${listIdx}`}
          >
            <View style={styles.listHeaderRow}>
              <Text style={[styles.listHeaderCell, styles.listHeaderRef]}>{colLeft}</Text>
              <Text style={[styles.listHeaderCell, styles.listHeaderTruth]}>{colRight}</Text>
            </View>
            {list.rows.map((row, i) => (
              <View key={`${row.ref}-${i}`} style={styles.listRow}>
                <View style={styles.listRefPill}>
                  <Text style={styles.listRefPillText}>{row.ref}</Text>
                </View>
                <Text style={styles.listTruth}>{row.truth}</Text>
              </View>
            ))}
          </NestedCard>
        );
      })}
    </View>
  );
}

function ContrastsStep({
  step,
  colors,
  styles,
}: {
  step: StepContrasts;
  colors: Colors;
  styles: Styles;
}) {
  return (
    <View>
      {step.items.map((item, i) => (
        <View key={`${item.verses}-${i}`} style={styles.contrastRow}>
          <View style={styles.contrastMeta}>
            <View style={styles.contrastVersesPill}>
              <Text style={styles.contrastVersesPillText}>{item.verses}</Text>
            </View>
            <View style={[styles.contrastTypePill, contrastTypePillStyle(item.type, colors)]}>
              <Text
                style={[
                  styles.contrastTypePillText,
                  { color: contrastTypeTextColor(item.type, colors) },
                ]}
              >
                {String(item.type).toUpperCase()}
              </Text>
            </View>
          </View>
          <Text style={styles.contrastPairing}>{item.pairing}</Text>
        </View>
      ))}
    </View>
  );
}

/**
 * Web styles CONTRAST as solid-gold border and COMPARISON as dashed-gold;
 * other types (Metaphor, Irony, etc.) fall through to comparison.
 */
function contrastTypePillStyle(type: string, colors: Colors) {
  const upper = String(type).toUpperCase();
  const dashed = upper === 'COMPARISON';
  return {
    borderColor: colors.gold,
    borderStyle: dashed ? ('dashed' as const) : ('solid' as const),
  };
}

function contrastTypeTextColor(_type: string, colors: Colors) {
  return colors.gold;
}

function BulletsStep({
  step,
  styles,
  markdownStyles,
}: {
  step: StepBullets;
  styles: Styles;
  markdownStyles: MarkdownStyles;
}) {
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
  styles,
  markdownStyles,
}: {
  step: StepSegments;
  styles: Styles;
  markdownStyles: MarkdownStyles;
}) {
  return (
    <View>
      <View style={styles.themeBlock}>
        <Text style={styles.themeLabel}>CHAPTER THEME</Text>
        <Text style={styles.themeHeadline}>{step.themeHeadline}</Text>
      </View>
      {step.segments.map((seg, i) => (
        <View key={`${seg.title}-${i}`} style={styles.segmentBlock}>
          <Text style={styles.segmentTitle}>{seg.title}</Text>
          <Markdown style={markdownStyles}>{seg.body}</Markdown>
        </View>
      ))}
    </View>
  );
}

// ─── Movement (Interpretation) body ──────────────────────────────────────

function MovementBody({
  movement,
  styles,
  markdownStyles,
}: {
  movement: StudyMovement;
  styles: Styles;
  markdownStyles: MarkdownStyles;
}) {
  return (
    <View>
      {movement.excerpt ? (
        <View style={styles.excerptBlock}>
          <Text style={styles.excerptText}>&quot;{movement.excerpt}&quot;</Text>
        </View>
      ) : null}
      <Markdown style={markdownStyles}>{movement.body}</Markdown>
    </View>
  );
}

// ─── Application row ─────────────────────────────────────────────────────

function ApplicationRow({
  question,
  styles,
  testID,
}: {
  question: StudyApplication;
  colors: Colors;
  styles: Styles;
  testID: string;
}) {
  return (
    <View style={styles.appRow} testID={testID}>
      <View style={styles.appRangePill}>
        <Text style={styles.appRangePillText}>{question.range}</Text>
      </View>
      <Text style={styles.appQuestion}>{question.question}</Text>
    </View>
  );
}

// ─── Collapsible primitives ──────────────────────────────────────────────

interface CardProps {
  open: boolean;
  onToggle: () => void;
  heading: string;
  subheading?: string;
  /** Number for the gold circle on Observation step cards. */
  stepNumber?: number;
  /** Verse-range pill rendered to the left of the heading (interpretation movements). */
  subPill?: string;
  colors: Colors;
  styles: Styles;
  testID: string;
  children: React.ReactNode;
}

function Card({
  open,
  onToggle,
  heading,
  subheading,
  stepNumber,
  subPill,
  colors,
  styles,
  testID,
  children,
}: CardProps) {
  return (
    <View style={styles.card} testID={testID}>
      <Pressable
        onPress={onToggle}
        style={styles.cardHeaderPressable}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={heading}
        testID={`${testID}-toggle`}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderContent}>
            <View style={styles.cardHeadingRow}>
              {typeof stepNumber === 'number' ? (
                <View style={styles.stepNumberCircle}>
                  <Text style={styles.stepNumberText}>{stepNumber}</Text>
                </View>
              ) : null}
              {subPill ? (
                <View style={styles.rangePill}>
                  <Text style={styles.rangePillText}>{subPill}</Text>
                </View>
              ) : null}
              <Text style={styles.cardHeading} accessibilityRole="header">
                {heading}
              </Text>
            </View>
            {subheading ? <Text style={styles.cardSubheading}>{subheading}</Text> : null}
          </View>
          <Ionicons
            name={open ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={colors.textSecondary}
          />
        </View>
      </Pressable>
      {open ? <View style={styles.cardBody}>{children}</View> : null}
    </View>
  );
}

interface NestedCardProps {
  open: boolean;
  onToggle: () => void;
  heading: string;
  tag?: string;
  colors: Colors;
  styles: Styles;
  testID: string;
  children: React.ReactNode;
}

function NestedCard({
  open,
  onToggle,
  heading,
  tag,
  colors,
  styles,
  testID,
  children,
}: NestedCardProps) {
  return (
    <View style={styles.nestedCard} testID={testID}>
      <Pressable
        onPress={onToggle}
        style={styles.nestedHeaderPressable}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={heading}
        testID={`${testID}-toggle`}
      >
        <View style={styles.nestedHeader}>
          <View style={styles.nestedHeaderContent}>
            {tag ? (
              <View style={styles.nestedTag}>
                <Text style={styles.nestedTagText}>{tag}</Text>
              </View>
            ) : null}
            <Text style={styles.nestedHeading}>{heading}</Text>
          </View>
          <Ionicons
            name={open ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={colors.textSecondary}
          />
        </View>
      </Pressable>
      {open ? <View style={styles.nestedBody}>{children}</View> : null}
    </View>
  );
}

// ─── Copy-text helpers (parity with web buildStudyCopyText) ──────────────

function stripStudyMarkdown(text: string): string {
  return text
    .replace(/^#+\s*/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .trim();
}

/**
 * Serialise an InductiveStudy to plain text for the Copy / Share buttons.
 * Mirrors web/src/components/StudyPanel.tsx::buildStudyCopyText.
 */
export function buildStudyCopyText(study: InductiveStudy): string {
  const lines: string[] = [];
  lines.push(`Inductive Study of ${study.title}`);
  if (study.subtitle) lines.push(study.subtitle);
  if (study.themeOneLine) {
    lines.push('');
    lines.push(`Theme: ${study.themeOneLine}`);
  }
  lines.push('');
  lines.push('OBSERVATION — 9 INDUCTIVE STEPS');
  for (const step of study.steps) {
    lines.push('');
    lines.push(`${step.number}. ${step.title}`);
    if (step.summary) lines.push(`   ${step.summary}`);
    switch (step.kind) {
      case 'prose':
        lines.push('');
        lines.push(stripStudyMarkdown(step.body));
        break;
      case 'qa':
        for (const item of step.items) {
          lines.push('');
          if (item.tag) lines.push(`   [${item.tag}] ${item.q}`);
          else lines.push(`   ${item.q}`);
          lines.push(`   ${stripStudyMarkdown(item.a)}`);
        }
        break;
      case 'keywords':
        for (const row of step.inventory) {
          lines.push('');
          const greek = row.greek ? ` (${row.greek})` : '';
          lines.push(`   ${row.word}${greek} — ×${row.count} — ${row.verses}`);
          if (row.definition) lines.push(`   ${stripStudyMarkdown(row.definition)}`);
        }
        break;
      case 'lists':
        for (const list of step.lists) {
          lines.push('');
          lines.push(`   ${list.title}`);
          for (const r of list.rows) {
            lines.push(`   • ${r.ref} — ${stripStudyMarkdown(r.truth)}`);
          }
        }
        break;
      case 'contrasts':
        for (const item of step.items) {
          lines.push(`   • ${item.verses} (${item.type}) — ${stripStudyMarkdown(item.pairing)}`);
        }
        break;
      case 'bullets':
        if (step.intro) {
          lines.push('');
          lines.push(`   ${stripStudyMarkdown(step.intro)}`);
        }
        for (const item of step.items) {
          const tag = item.tag ? `[${item.tag}] ` : '';
          lines.push(`   • ${tag}${stripStudyMarkdown(item.text)}`);
        }
        if (step.note) {
          lines.push('');
          lines.push(`   ${stripStudyMarkdown(step.note)}`);
        }
        break;
      case 'segments':
        if (step.themeHeadline) {
          lines.push('');
          lines.push(`   Chapter theme: ${step.themeHeadline}`);
        }
        for (const seg of step.segments) {
          lines.push('');
          lines.push(`   ${seg.title}`);
          lines.push(`   ${stripStudyMarkdown(seg.body)}`);
        }
        break;
    }
  }
  lines.push('');
  lines.push('INTERPRETATION');
  for (const mv of study.interpretation.movements) {
    lines.push('');
    lines.push(`Movement ${mv.number} — ${mv.title} (${mv.range})`);
    if (mv.excerpt) lines.push(`   "${mv.excerpt}"`);
    lines.push('');
    lines.push(stripStudyMarkdown(mv.body));
  }
  lines.push('');
  lines.push('APPLICATION');
  if (study.application.intro) {
    lines.push('');
    lines.push(stripStudyMarkdown(study.application.intro));
  }
  for (const q of study.application.questions) {
    lines.push('');
    lines.push(`${q.range} — ${q.question}`);
  }
  return lines.join('\n');
}

// ─── Styles ──────────────────────────────────────────────────────────────

const createStyles = (colors: Colors) =>
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

    titleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: spacing.xs,
      gap: spacing.sm,
    },
    title: {
      flex: 1,
      fontSize: fontSizes.heading2,
      fontWeight: fontWeights.bold,
      color: colors.textPrimary,
      lineHeight: fontSizes.heading2 * lineHeights.heading,
    },
    titleActions: {
      flexDirection: 'row',
      gap: spacing.xs,
    },
    iconButton: {
      padding: 6,
    },
    subtitle: {
      fontSize: fontSizes.bodySmall,
      fontStyle: 'italic',
      color: colors.textSecondary,
      marginBottom: spacing.xs,
    },
    theme: {
      fontSize: fontSizes.body,
      fontWeight: fontWeights.semibold,
      color: colors.gold,
      lineHeight: fontSizes.body * lineHeights.body,
      marginBottom: spacing.sm,
    },

    expandAllRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginBottom: spacing.sm,
    },
    expandAllText: {
      fontSize: fontSizes.bodySmall,
      color: colors.gold,
      fontWeight: fontWeights.semibold,
    },

    sectionHeadingWrap: {
      marginTop: spacing.xl,
      marginBottom: spacing.sm,
    },
    sectionHeadingText: {
      fontSize: fontSizes.caption,
      fontWeight: fontWeights.bold,
      color: colors.gold,
      textTransform: 'uppercase',
      letterSpacing: 2,
    },

    sectionIntro: {
      fontSize: fontSizes.bodySmall,
      color: colors.textSecondary,
      lineHeight: fontSizes.bodySmall * lineHeights.body,
    },
    applicationIntro: {
      marginBottom: spacing.md,
    },

    // Card
    card: {
      borderBottomWidth: 1,
      borderBottomColor: colors.gray100,
    },
    cardHeaderPressable: {
      paddingVertical: spacing.md,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    cardHeaderContent: {
      flex: 1,
      minWidth: 0,
    },
    cardHeadingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      flexWrap: 'wrap',
    },
    cardHeading: {
      flexShrink: 1,
      fontSize: fontSizes.body,
      fontWeight: fontWeights.semibold,
      color: colors.textPrimary,
      lineHeight: fontSizes.body * lineHeights.heading,
    },
    cardSubheading: {
      fontSize: fontSizes.bodySmall,
      fontStyle: 'italic',
      color: colors.textSecondary,
      marginTop: spacing.xs,
      paddingLeft: 36, // align under step title (28px circle + ~8px gap)
      lineHeight: fontSizes.bodySmall * lineHeights.body,
    },
    cardBody: {
      paddingBottom: spacing.md,
    },

    // Step number circle
    stepNumberCircle: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.gold,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepNumberText: {
      fontSize: fontSizes.bodySmall,
      fontWeight: fontWeights.bold,
      color: colors.gray900,
    },

    // Range pill (used on interpretation movements + lists rows)
    rangePill: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: 999,
      backgroundColor: colors.gold,
      minWidth: 56,
      alignItems: 'center',
    },
    rangePillText: {
      fontSize: fontSizes.caption,
      fontWeight: fontWeights.bold,
      color: colors.gray900,
    },

    // NestedCard
    nestedCard: {
      borderTopWidth: 1,
      borderTopColor: colors.gray100,
    },
    nestedHeaderPressable: {
      paddingVertical: spacing.sm,
    },
    nestedHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    nestedHeaderContent: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      flexWrap: 'wrap',
    },
    nestedHeading: {
      flex: 1,
      flexShrink: 1,
      fontSize: fontSizes.bodySmall,
      fontWeight: fontWeights.semibold,
      color: colors.textPrimary,
      lineHeight: fontSizes.bodySmall * lineHeights.heading,
    },
    nestedTag: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: 999,
      backgroundColor: colors.gold,
    },
    nestedTagText: {
      fontSize: fontSizes.caption,
      fontWeight: fontWeights.bold,
      color: colors.gray900,
      letterSpacing: 0.5,
    },
    nestedBody: {
      paddingBottom: spacing.sm,
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
      color: colors.textSecondary,
    },
    countBadge: {
      marginLeft: 'auto',
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.gold,
    },
    countBadgeText: {
      fontSize: fontSizes.caption,
      fontWeight: fontWeights.bold,
      color: colors.gold,
    },
    keywordVerses: {
      fontSize: fontSizes.caption,
      color: colors.textSecondary,
      marginBottom: spacing.xs,
    },
    keywordVersesLabel: {
      fontSize: fontSizes.caption,
      fontWeight: fontWeights.bold,
      color: colors.textSecondary,
      letterSpacing: 1,
    },
    keywordDef: {
      fontSize: fontSizes.bodySmall,
      color: colors.textPrimary,
      lineHeight: fontSizes.bodySmall * lineHeights.body,
    },

    // Lists
    listHeaderRow: {
      flexDirection: 'row',
      paddingVertical: spacing.xs,
      borderBottomWidth: 1,
      borderBottomColor: colors.gray100,
      marginBottom: spacing.xs,
    },
    listHeaderCell: {
      fontSize: fontSizes.caption,
      fontWeight: fontWeights.bold,
      color: colors.gold,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    listHeaderRef: {
      width: 80,
    },
    listHeaderTruth: {
      flex: 1,
    },
    listRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingVertical: spacing.xs,
      gap: spacing.sm,
    },
    listRefPill: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: 999,
      backgroundColor: colors.gold,
      minWidth: 64,
      alignItems: 'center',
    },
    listRefPillText: {
      fontSize: fontSizes.caption,
      fontWeight: fontWeights.bold,
      color: colors.gray900,
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
      paddingHorizontal: spacing.sm,
      borderRadius: 8,
      backgroundColor: colors.backgroundElevated,
      borderWidth: 1,
      borderColor: colors.gray100,
      marginBottom: spacing.xs,
    },
    contrastMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.xs,
      flexWrap: 'wrap',
    },
    contrastVersesPill: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: 999,
      backgroundColor: colors.gold,
    },
    contrastVersesPillText: {
      fontSize: fontSizes.caption,
      fontWeight: fontWeights.bold,
      color: colors.gray900,
    },
    contrastTypePill: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: 999,
      borderWidth: 1,
    },
    contrastTypePillText: {
      fontSize: fontSizes.caption,
      fontWeight: fontWeights.bold,
      letterSpacing: 1,
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
      paddingVertical: spacing.sm,
      gap: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.gray100,
    },
    bulletTag: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: 999,
      backgroundColor: colors.gold,
      marginTop: 2,
    },
    bulletTagText: {
      fontSize: fontSizes.caption,
      fontWeight: fontWeights.bold,
      color: colors.gray900,
      letterSpacing: 0.5,
    },
    bulletBody: {
      flex: 1,
    },
    noteBlock: {
      marginTop: spacing.sm,
      padding: spacing.md,
      borderRadius: 8,
      backgroundColor: colors.backgroundElevated,
    },

    // Segments
    themeBlock: {
      marginBottom: spacing.md,
      padding: spacing.md,
      borderRadius: 10,
      backgroundColor: colors.backgroundElevated,
      borderLeftWidth: 3,
      borderLeftColor: colors.gold,
    },
    themeLabel: {
      fontSize: fontSizes.caption,
      fontWeight: fontWeights.bold,
      color: colors.gold,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: spacing.xs,
    },
    themeHeadline: {
      fontSize: fontSizes.body,
      fontStyle: 'italic',
      color: colors.textPrimary,
      fontWeight: fontWeights.semibold,
      lineHeight: fontSizes.body * lineHeights.body,
    },
    segmentBlock: {
      padding: spacing.md,
      borderRadius: 8,
      backgroundColor: colors.backgroundElevated,
      borderWidth: 1,
      borderColor: colors.gray100,
      marginBottom: spacing.sm,
    },
    segmentTitle: {
      fontSize: fontSizes.body,
      fontWeight: fontWeights.semibold,
      color: colors.textPrimary,
      marginBottom: spacing.xs,
    },

    // Movement excerpt
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
      color: colors.textPrimary,
      lineHeight: fontSizes.bodySmall * lineHeights.body,
    },

    // Application
    appRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
    },
    appRangePill: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: 999,
      backgroundColor: colors.gold,
      minWidth: 56,
      alignItems: 'center',
      marginTop: 2,
    },
    appRangePillText: {
      fontSize: fontSizes.caption,
      fontWeight: fontWeights.bold,
      color: colors.gray900,
    },
    appQuestion: {
      flex: 1,
      fontSize: fontSizes.bodySmall,
      color: colors.textPrimary,
      lineHeight: fontSizes.bodySmall * lineHeights.body,
    },
  });

const createMarkdownStyles = (colors: Colors) => ({
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
    fontStyle: 'italic' as const,
  },
  link: {
    color: colors.gold,
    textDecorationLine: 'underline' as const,
  },
});
