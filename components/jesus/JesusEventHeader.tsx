/**
 * The event's reader chrome: title dropdown, Bible / Insight toggle, menu.
 *
 * Modelled on the reader's own header (and the topic screen's copy of it),
 * because on web an event "behaves like a Bible reference for navigation, so it
 * gets the reference's chrome rather than a second pattern". The first port
 * missed that and gave the event a bespoke back-arrow header with invented
 * tabs, which is the single biggest way it diverged.
 *
 * Bible shows the event's scripture; Insight shows the commentary tabs. There
 * is no Content pill — the event's passages ARE the Bible side here, the same
 * as a chapter.
 *
 * EVERY Jesus page wears this bar, not only the event. The browse, life, study,
 * theme and entry pages had a light back-arrow bar of their own, so walking
 * hub → Miracles → an event swapped the whole header and dropped the menu
 * halfway. Andy: "some of the Jesus pages lose the header and menu bar.
 * Recommend we keep for all pages to make navigation consistent." The toggle
 * only appears where there is a Bible/Insight choice to make (the event).
 *
 * And it carries a BACK button, which the reader's own bar does not need — a
 * chapter is reached through the selector, not by drilling down. The Jesus
 * section is a hierarchy, and without it the only way out of an event was the
 * edge swipe: "we should ideally have a 'back' that take you back to the last
 * page you were on."
 */
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { type getColors, getHeaderSpecs, spacing } from '@/theme/tokens';

type Colors = ReturnType<typeof getColors>;
export type JesusEventView = 'bible' | 'insight';

export function JesusEventHeader({
  title,
  subtitle,
  view,
  onTitlePress,
  onViewChange,
  onMenuPress,
  onBack,
  backTestID = 'jesus-back-button',
  titleTestID,
}: {
  title: string;
  /**
   * The reader's second header line (the Bible version). Omit it and the bar
   * keeps the same height with the title centred in it.
   */
  subtitle?: string;
  /** Omit for pages with no Bible / Insight choice — the toggle is not drawn. */
  view?: JesusEventView;
  onTitlePress: () => void;
  onViewChange?: (view: JesusEventView) => void;
  onMenuPress: () => void;
  onBack?: () => void;
  backTestID?: string;
  titleTestID?: string;
}) {
  const { colors, mode } = useTheme();
  const insets = useSafeAreaInsets();
  const headerSpecs = getHeaderSpecs(mode);
  const styles = useMemo(() => createStyles(colors, headerSpecs), [colors, headerSpecs]);

  const select = (next: JesusEventView) => {
    if (next === view) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onViewChange?.(next);
  };

  return (
    // Same padding the reader's ChapterHeader uses — top inset + md.
    <View style={[styles.header, { paddingTop: insets.top + spacing.md }]} testID="jesus-header">
      <View style={styles.leading}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            style={styles.backButton}
            testID={backTestID}
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={8}
          >
            <Ionicons
              name="chevron-back"
              size={headerSpecs.iconSize}
              color={headerSpecs.iconColor}
            />
          </Pressable>
        ) : null}
        <Pressable
          onPress={onTitlePress}
          style={styles.titleButton}
          testID="jesus-selector-button"
          accessibilityRole="button"
          accessibilityLabel={title}
        >
          {subtitle ? (
            <>
              <View style={styles.titleRow}>
                <Text style={styles.title} numberOfLines={1} testID={titleTestID}>
                  {title}
                </Text>
                <Ionicons name="chevron-down" size={16} color={headerSpecs.iconColor} />
              </View>
              <Text style={styles.subtitle} numberOfLines={1}>
                {subtitle}
              </Text>
            </>
          ) : (
            /*
              No second line to show, but the bar must stay the reader's
              two-line height or the menu button moves (the reason this line
              was reserved at all). So an invisible title + subtitle pair sets
              the height, and the real title is laid over it, centred —
              "the dropdown … is not centered in the height of the header".
              Measured by layout, not a guessed number, so it holds on both
              platforms and at any text size.
            */
            <View>
              <View
                style={styles.ghost}
                aria-hidden
                importantForAccessibility="no-hide-descendants"
              >
                <View style={styles.titleRow}>
                  <Text style={styles.title} numberOfLines={1}>
                    {title}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color={headerSpecs.iconColor} />
                </View>
                <Text style={styles.subtitle} numberOfLines={1}>
                  {' '}
                </Text>
              </View>
              <View style={styles.centred}>
                <View style={styles.titleRow}>
                  <Text style={styles.title} numberOfLines={1} testID={titleTestID}>
                    {title}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color={headerSpecs.iconColor} />
                </View>
              </View>
            </View>
          )}
        </Pressable>
      </View>

      <View style={styles.actions}>
        {view ? (
          <View style={styles.toggle}>
            {(['bible', 'insight'] as const).map((key) => (
              <Pressable
                key={key}
                onPress={() => select(key)}
                style={[styles.toggleItem, view === key && styles.toggleItemActive]}
                testID={`jesus-view-${key}`}
                accessibilityRole="tab"
                accessibilityState={{ selected: view === key }}
              >
                <Text style={[styles.toggleText, view === key && styles.toggleTextActive]}>
                  {key === 'bible' ? 'Bible' : 'Insight'}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        <Pressable
          onPress={onMenuPress}
          style={styles.iconButton}
          testID="hamburger-menu-button"
          accessibilityRole="button"
        >
          <Ionicons name="menu" size={headerSpecs.iconSize} color={headerSpecs.iconColor} />
        </Pressable>
      </View>
    </View>
  );
}

/**
 * The reader's ChapterHeader styles (app/bible/[bookId]/[chapterNumber].tsx,
 * createHeaderStyles), value for value.
 *
 * The first shared Jesus bar was an approximation of it — its own padding, its
 * own toggle sizing, one line where the reader has two — and it showed: the
 * operator, on build 111, "it's not consistent with the old one, it should
 * have the same height so the buttons look similarly placed like the hamburger
 * menu". So nothing here is chosen; every number is the reader's.
 *
 * The bar is DARK in both themes, so its contents are coloured from the header
 * spec, never the body palette (textPrimary is dark in light mode).
 */
function createStyles(colors: Colors, headerSpecs: ReturnType<typeof getHeaderSpecs>) {
  return StyleSheet.create({
    header: {
      minHeight: headerSpecs.height,
      backgroundColor: headerSpecs.backgroundColor,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: headerSpecs.padding,
      paddingBottom: spacing.sm,
    },
    leading: { flexDirection: 'row', alignItems: 'center', flexShrink: 1, marginRight: spacing.sm },
    backButton: { paddingVertical: spacing.xs, paddingRight: spacing.xs, marginLeft: -spacing.xs },
    titleButton: { padding: spacing.xs, flexShrink: 1 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    ghost: { opacity: 0 },
    centred: { ...StyleSheet.absoluteFillObject, justifyContent: 'center' },
    title: {
      fontSize: headerSpecs.titleFontSize,
      fontWeight: headerSpecs.titleFontWeight,
      color: headerSpecs.titleColor,
      flexShrink: 1,
    },
    subtitle: {
      fontSize: 11,
      fontWeight: '500',
      color: headerSpecs.titleColor,
      opacity: 0.55,
      marginTop: 1,
      letterSpacing: 0.3,
    },
    actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
    iconButton: { padding: spacing.xs, justifyContent: 'center', alignItems: 'center' },
    toggle: {
      backgroundColor: '#323232',
      borderRadius: 100,
      padding: 4,
      flexDirection: 'row',
      gap: 4,
    },
    toggleItem: {
      paddingHorizontal: 10,
      paddingVertical: 2,
      borderRadius: 100,
      minHeight: 28,
      justifyContent: 'center',
      alignItems: 'center',
    },
    toggleItemActive: { backgroundColor: colors.gold },
    toggleText: { fontSize: 14, color: headerSpecs.titleColor, fontWeight: '400' },
    toggleTextActive: { color: colors.black },
  });
}
