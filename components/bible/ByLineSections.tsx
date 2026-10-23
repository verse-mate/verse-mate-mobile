/**
 * Collapsible By Line sections, with Expand All / Collapse All.
 *
 * Andy (App Store build): "expand/contract all missing on line by line". Web's Line-by-Line tab
 * makes every verse a row that can be folded and has an Expand All / Collapse All button; mobile
 * printed the sections one after another with neither. Mirrors web's behaviour, including its
 * default: every row starts OPEN, because a commentary is read straight through and must not
 * arrive folded up — folding is the reader's choice, not the screen's.
 *
 * Shared by the three places that render By Line: the reader's Insight tab (ChapterReader), the
 * landscape split view (BibleExplanationsPanel) and the Jesus event's By-Line tab, so they cannot
 * drift apart.
 */

import { Ionicons } from '@expo/vector-icons';
import { type ComponentProps, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { Markdown } from '@/lib/markdown/Markdown';
import { fontSizes, fontWeights, type getColors, spacing } from '@/theme/tokens';

type MarkdownStyle = ComponentProps<typeof Markdown>['style'];

const EMPTY: ReadonlySet<string> = new Set();

/**
 * Split a section's markdown into its reference heading and its body.
 *
 * `parseByLineSections` keeps the `## Book C:V` line at the top of each section, so the heading is
 * rendered by the same Markdown styles as before — a folded row looks exactly like the top of an
 * open one. A section with no heading (the preamble before the first verse) is not foldable.
 */
export function splitByLineHeading(markdown: string): { heading: string | null; body: string } {
  const trimmed = markdown.replace(/^\s+/, '');
  const match = trimmed.match(/^(#{1,6}\s+[^\n]*)(?:\n|$)/);
  if (!match) return { heading: null, body: markdown };
  return { heading: match[1], body: trimmed.slice(match[0].length).trim() };
}

/**
 * Which rows are folded, reset whenever `resetKey` changes (a new chapter or event).
 *
 * Stored as a default plus the rows the reader flipped away from it, so Expand All / Collapse All
 * needs no list of rows — the Jesus tab's rows live in one child per Gospel account, each with its
 * own fetch — and a row that appears later (progressive reveal) follows the default without being
 * told. The default is open.
 */
export function useByLineExpansion(resetKey: string) {
  const [state, setState] = useState<{
    key: string;
    defaultOpen: boolean;
    flipped: ReadonlySet<string>;
  }>({ key: resetKey, defaultOpen: true, flipped: EMPTY });
  // Derived reset rather than an effect, so the first render of a new chapter is already unfolded
  // instead of flashing the previous chapter's folds for a frame.
  const current =
    state.key === resetKey ? state : { key: resetKey, defaultOpen: true, flipped: EMPTY };

  const isOpen = useCallback(
    (id: string) => current.defaultOpen !== current.flipped.has(id),
    [current]
  );
  const toggle = useCallback(
    (id: string) => {
      const flipped = new Set(current.flipped);
      if (flipped.has(id)) flipped.delete(id);
      else flipped.add(id);
      setState({ ...current, flipped });
    },
    [current]
  );
  const setAll = useCallback(
    (open: boolean) => setState({ key: resetKey, defaultOpen: open, flipped: EMPTY }),
    [resetKey]
  );

  return {
    isOpen,
    toggle,
    setAll,
    // Anything folded means the control offers to expand; only a fully open list offers to collapse.
    allOpen: current.defaultOpen && current.flipped.size === 0,
  };
}

/** The Expand All / Collapse All control, right-aligned like StudyPanel's. */
export function ByLineToggleAll({
  allOpen,
  onPress,
  testID,
}: {
  allOpen: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.toggleAllRow}>
      <Pressable onPress={onPress} accessibilityRole="button" hitSlop={8} testID={testID}>
        <Text style={styles.toggleAllText}>
          {allOpen
            ? t('chapter_reader.collapse_all', 'Collapse All')
            : t('chapter_reader.expand_all', 'Expand All')}
        </Text>
      </Pressable>
    </View>
  );
}

/** One verse's section: its reference as a tappable row, and the commentary when open. */
export function ByLineSection({
  markdown,
  open,
  onToggle,
  markdownStyles,
  sectionRef,
  testID,
}: {
  markdown: string;
  open: boolean;
  onToggle: () => void;
  markdownStyles: MarkdownStyle;
  /** For the verse-jump button, which measures the section to scroll to it. */
  sectionRef?: (node: View | null) => void;
  testID?: string;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { heading, body } = useMemo(() => splitByLineHeading(markdown), [markdown]);

  return (
    <View ref={sectionRef} testID={testID} collapsable={false}>
      {heading ? (
        <Pressable
          onPress={onToggle}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          style={styles.headingRow}
          testID={testID ? `${testID}-toggle` : undefined}
        >
          <View style={styles.headingText}>
            <Markdown style={markdownStyles}>{heading}</Markdown>
          </View>
          <Ionicons
            name={open ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={colors.textSecondary}
            style={styles.chevron}
          />
        </Pressable>
      ) : null}
      {(open || !heading) && body ? <Markdown style={markdownStyles}>{body}</Markdown> : null}
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof getColors>) =>
  StyleSheet.create({
    toggleAllRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginBottom: spacing.sm,
    },
    toggleAllText: {
      fontSize: fontSizes.bodySmall,
      color: colors.gold,
      fontWeight: fontWeights.semibold,
    },
    headingRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    headingText: {
      flex: 1,
    },
    chevron: {
      marginLeft: spacing.sm,
    },
  });
