/**
 * The event's insight tab row — Summary / By Line / Study / Compare.
 *
 * Drawn the way the reader draws its own row (`ChapterContentTabs`): a
 * full-width track on the elevated surface, equal-width pills, the active one
 * gold, and a gold rule under the row. `ChapterContentTabs` itself is typed to
 * the chapter's tab ids (Visuals rather than Compare), so this mirrors its look
 * instead of reusing it; the values come from the same `tabSpecs`.
 *
 * Sizing follows the reader too: the pills split the row evenly, never drop
 * below the reader's 88px floor, and the row scrolls sideways when they no
 * longer fit (a 320px phone). Unlike the reader's labels these are translated
 * ("Zusammenfassung"), so the floor is also raised to the widest label —
 * measured off-screen — rather than letting a pill cut its word short.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { JESUS_TABS, type JesusTab } from '@/components/jesus/JesusTabBodies';
import { useTheme } from '@/contexts/ThemeContext';
import { type getColors, getTabSpecs, spacing, type ThemeMode } from '@/theme/tokens';

type Colors = ReturnType<typeof getColors>;

/** ChapterContentTabs' MIN_TAB_WIDTH: the narrowest a pill may get before the row scrolls. */
const MIN_TAB_WIDTH = 88;
/** Track padding (4 each side) and the gap between pills, as in ChapterContentTabs. */
const TRACK_INSET = 8;
const TAB_GAP = 4;

export function JesusInsightTabs({
  active,
  onSelect,
  testID = 'jesus-event-tabs',
}: {
  active: JesusTab;
  onSelect: (tab: JesusTab) => void;
  testID?: string;
}) {
  const { colors, mode } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(colors, mode), [colors, mode]);
  const scrollRef = useRef<ScrollView>(null);

  const labels = JESUS_TABS.map((entry) => t(`jesus.tab.${entry.id}`, entry.label));
  const [trackWidth, setTrackWidth] = useState(0);
  // Natural width of each label, keyed by its text so a language switch re-measures.
  const [labelWidths, setLabelWidths] = useState<Record<string, number>>({});
  const widestLabel = Math.max(0, ...labels.map((label) => labelWidths[label] ?? 0));

  const n = JESUS_TABS.length;
  const tabWidth =
    trackWidth > 0
      ? Math.max(
          (trackWidth - TRACK_INSET - (n - 1) * TAB_GAP) / n,
          MIN_TAB_WIDTH,
          widestLabel + spacing.sm * 2
        )
      : 0;

  // When the row scrolls, keep the active pill in view (centred when possible).
  const activeIndex = JESUS_TABS.findIndex((entry) => entry.id === active);
  useEffect(() => {
    if (trackWidth <= 0 || tabWidth <= 0 || activeIndex < 0) return;
    const start = activeIndex * (tabWidth + TAB_GAP);
    scrollRef.current?.scrollTo({
      x: Math.max(0, start - (trackWidth - tabWidth) / 2),
      animated: true,
    });
  }, [activeIndex, tabWidth, trackWidth]);

  return (
    <View style={styles.container} testID={testID}>
      <View onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}>
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.track, trackWidth > 0 && { minWidth: trackWidth }]}
          keyboardShouldPersistTaps="handled"
        >
          {JESUS_TABS.map((entry, index) => {
            const selected = active === entry.id;
            return (
              <Pressable
                key={entry.id}
                onPress={() => onSelect(entry.id)}
                style={[
                  styles.tab,
                  tabWidth > 0 ? { width: tabWidth } : styles.tabUnmeasured,
                  selected && styles.tabActive,
                ]}
                testID={`jesus-event-tab-${entry.id}`}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
              >
                <Text style={[styles.tabText, selected && styles.tabTextActive]} numberOfLines={1}>
                  {labels[index]}
                </Text>
              </Pressable>
            );
          })}

          {/* Off-screen copies of the labels at their natural width, for the floor above. */}
          <View
            style={styles.measure}
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            {labels.map((label) => (
              <Text
                key={label}
                style={[styles.tabText, styles.measureText]}
                onLayout={(e) => {
                  const width = Math.ceil(e.nativeEvent.layout.width);
                  setLabelWidths((prev) =>
                    prev[label] === width ? prev : { ...prev, [label]: width }
                  );
                }}
              >
                {label}
              </Text>
            ))}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

function createStyles(colors: Colors, mode: ThemeMode) {
  const specs = getTabSpecs(mode);
  return StyleSheet.create({
    // ChapterContentTabs' container: page background, gold rule underneath.
    container: {
      backgroundColor: colors.background,
      paddingTop: spacing.sm,
      paddingBottom: spacing.md,
      paddingHorizontal: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.gold,
    },
    track: {
      flexDirection: 'row',
      gap: TAB_GAP,
      padding: TRACK_INSET / 2,
      minHeight: 36,
      borderRadius: 100,
      backgroundColor: colors.backgroundElevated,
    },
    tab: {
      minHeight: 28,
      paddingVertical: 2,
      paddingHorizontal: spacing.sm,
      borderRadius: 100,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
    },
    // Before the first layout pass: share the row evenly.
    tabUnmeasured: { flexGrow: 1 },
    tabActive: { backgroundColor: specs.active.backgroundColor },
    tabText: {
      fontSize: 14,
      fontWeight: '400',
      lineHeight: Math.round(14 * 1.4),
      color: specs.inactive.textColor,
    },
    tabTextActive: { color: specs.active.textColor },
    measure: {
      position: 'absolute',
      top: 0,
      left: 0,
      flexDirection: 'row',
      opacity: 0,
    },
    measureText: { flexShrink: 0 },
  });
}
