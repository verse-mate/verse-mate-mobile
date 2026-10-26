/**
 * The right-hand pane of an event on a split-view tablet.
 *
 * The same arrangement the topic screen's `TopicExplanationsPanel` uses: a
 * dark bar naming the insights ("The boy in the temple Insights"), the tab
 * row, then the active insight body scrolling on its own — so an
 * event on an iPad in landscape reads the way a chapter and a topic do, with
 * the scripture beside its commentary instead of a phone layout stretched
 * across the screen.
 */
import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { JesusInsightTabs } from '@/components/jesus/JesusInsightTabs';
import { type JesusTab, JesusTabBodies } from '@/components/jesus/JesusTabBodies';
import { useTheme } from '@/contexts/ThemeContext';
import { fontSizes, fontWeights, getSplitViewSpecs, spacing, type ThemeMode } from '@/theme/tokens';
import type { JesusEventDetail } from '@/types/jesus';

export function JesusInsightPane({
  title,
  detail,
  tab,
  onTabChange,
  onMenuPress,
}: {
  title: string;
  detail: JesusEventDetail;
  tab: JesusTab;
  onTabChange: (tab: JesusTab) => void;
  onMenuPress: () => void;
}) {
  const { colors, mode } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const specs = getSplitViewSpecs(mode);
  const styles = useMemo(() => createStyles(mode, colors.background), [mode, colors.background]);
  return (
    <View style={styles.container} testID="jesus-insight-pane">
      {/* The reader's pane header (BibleExplanationsPanel): dark up under the
          status bar, so it lines up with the scripture pane's header. */}
      <View
        style={[
          styles.header,
          { minHeight: specs.headerHeight + insets.top, paddingTop: insets.top },
        ]}
      >
        <View style={styles.headerRow}>
          {/* Worded exactly as the topic pane's bar ("{topicName} Insights"). */}
          <Text style={styles.headerTitle} numberOfLines={1}>
            {`${title} ${t('jesus.insight.insights', 'Insights')}`}
          </Text>
          {/* The menu sits here, as on the reader's and the topic's insight pane —
            so it is still there when the scripture pane is collapsed. */}
          <Pressable
            style={styles.menuButton}
            onPress={onMenuPress}
            accessibilityLabel="Open menu"
            accessibilityRole="button"
            testID="hamburger-menu-button"
          >
            <Ionicons name="menu" size={24} color={specs.headerTextColor} />
          </Pressable>
        </View>
      </View>

      <JesusInsightTabs active={tab} onSelect={onTabChange} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        testID={`jesus-event-panel-${tab}`}
      >
        <JesusTabBodies tab={tab} detail={detail} />
      </ScrollView>
    </View>
  );
}

function createStyles(mode: ThemeMode, background: string) {
  const specs = getSplitViewSpecs(mode);
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: background },
    header: {
      paddingBottom: spacing.sm,
      backgroundColor: specs.headerBackground,
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
    },
    headerRow: {
      height: specs.headerHeight,
      flexDirection: 'row',
      alignItems: 'center',
    },
    headerTitle: {
      flex: 1,
      fontSize: fontSizes.body,
      fontWeight: fontWeights.medium,
      color: specs.headerTextColor,
    },
    menuButton: { padding: spacing.xs },
    scroll: { flex: 1 },
    scrollContent: { paddingBottom: 60 },
  });
}
