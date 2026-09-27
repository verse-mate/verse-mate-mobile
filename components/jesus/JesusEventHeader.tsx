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
import {
  fontSizes,
  fontWeights,
  type getColors,
  getHeaderSpecs,
  radii,
  spacing,
} from '@/theme/tokens';

type Colors = ReturnType<typeof getColors>;
export type JesusEventView = 'bible' | 'insight';

export function JesusEventHeader({
  title,
  view,
  onTitlePress,
  onViewChange,
  onMenuPress,
  onBack,
  backTestID = 'jesus-back-button',
  titleTestID,
}: {
  title: string;
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
  // The reader's header colour lives in the header specs, not in the palette —
  // same source the chapter and topic headers read, so the three match.
  const headerSpecs = getHeaderSpecs(mode);
  const styles = useMemo(() => createStyles(colors, headerSpecs), [colors, headerSpecs]);

  const select = (next: JesusEventView) => {
    if (next === view) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onViewChange?.(next);
  };

  return (
    <View style={[styles.bar, { paddingTop: insets.top }]}>
      {onBack ? (
        <Pressable
          onPress={onBack}
          style={styles.backButton}
          testID={backTestID}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={24} color={headerSpecs.titleColor} />
        </Pressable>
      ) : null}
      <Pressable
        onPress={onTitlePress}
        style={[styles.titleButton, view ? styles.titleButtonBeside : styles.titleButtonAlone]}
        testID="jesus-selector-button"
        accessibilityRole="button"
        accessibilityLabel={title}
      >
        <Text style={styles.title} numberOfLines={1} testID={titleTestID}>
          {title}
        </Text>
        <Ionicons name="chevron-down" size={16} color={headerSpecs.titleColor} />
      </Pressable>

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
        // With no toggle to push it right, the menu takes the bar's far edge
        // itself. Both carrying an auto margin would split the free space and
        // strand the toggle mid-bar.
        style={[styles.menuButton, !view && { marginLeft: 'auto' }]}
        testID="hamburger-menu-button"
        accessibilityRole="button"
      >
        <Ionicons name="menu" size={24} color={headerSpecs.titleColor} />
      </Pressable>
    </View>
  );
}

/**
 * The header bar is DARK in both themes (headerSpecs.backgroundColor is black
 * in light mode, dark grey in dark mode), so its contents must be coloured
 * from the same spec — `colors.textPrimary` is dark in light mode and painted
 * the title dark-on-black, effectively invisible. The reader's own header has
 * always used headerSpecs.titleColor; this one was reading the body palette.
 */
function createStyles(colors: Colors, headerSpecs: ReturnType<typeof getHeaderSpecs>) {
  const headerBackground = headerSpecs.backgroundColor;
  return StyleSheet.create({
    bar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.sm,
      backgroundColor: headerBackground,
    },
    titleButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      flexShrink: 1,
    },
    // Beside the toggle the title must leave it room; alone it takes the bar.
    titleButtonBeside: { maxWidth: 150 },
    titleButtonAlone: { flex: 1 },
    backButton: { width: 28, alignItems: 'flex-start' },
    title: {
      fontSize: fontSizes.body,
      fontWeight: fontWeights.semibold,
      color: headerSpecs.titleColor,
    },
    toggle: {
      flexDirection: 'row',
      marginLeft: 'auto',
      borderRadius: radii.full,
      // The reader's own toggle track, verbatim. backgroundSecondary is a body
      // colour and rendered a pale track on the dark header bar, which is not
      // the control the rest of the app uses.
      backgroundColor: '#323232',
      padding: 2,
    },
    toggleItem: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radii.full,
    },
    toggleItemActive: { backgroundColor: colors.gold },
    toggleText: { fontSize: fontSizes.bodySmall, color: headerSpecs.titleColor },
    toggleTextActive: { color: colors.black, fontWeight: fontWeights.semibold },
    menuButton: { width: 32, alignItems: 'flex-end' },
  });
}
