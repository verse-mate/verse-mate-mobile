/**
 * JesusEventScreen — one event, worn as the reader.
 *
 * Route: /jesus/event/[slug]
 *
 * This is the shape the web client uses and the first port got wrong. An event
 * behaves like a Bible reference for navigation, so it gets the reference's
 * chrome: the title in the selector slot, the Bible / Insight toggle, and the
 * same Summary / By-Line / Study / Compare pill group the chapter reader wears
 * (Compare standing where Visuals does). Bible is the event's own scripture —
 * every Gospel account, in full — and Insight is the commentary.
 *
 * The earlier version invented Story / Said / Did / Insight tabs over facet
 * metadata and never rendered a verse, which made the section feel like a
 * separate product bolted to the side of the app.
 */
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HamburgerMenu } from '@/components/bible/HamburgerMenu';
import { VerseMateTooltip } from '@/components/bible/VerseMateTooltip';
import { JesusChrome } from '@/components/jesus/JesusChrome';
import type { JesusEventView } from '@/components/jesus/JesusEventHeader';
import { JesusInsightPane } from '@/components/jesus/JesusInsightPane';
import { JesusInsightTabs } from '@/components/jesus/JesusInsightTabs';
import {
  EventRow,
  JesusPill,
  JesusPlaceholder,
  queryPhase,
  SectionHeading,
} from '@/components/jesus/JesusParts';
import { JesusPassageBlock } from '@/components/jesus/JesusPassageBlock';
import { type JesusTab, JesusTabBodies } from '@/components/jesus/JesusTabBodies';
import { SplitView } from '@/components/ui/SplitView';
import { useOptionalAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useJesusEvent } from '@/hooks/jesus';
import { useBibleVersion } from '@/hooks/use-bible-version';
import { useDeviceInfo } from '@/hooks/use-device-info';
import { fontSizes, fontWeights, type getColors, spacing } from '@/theme/tokens';
import type { JesusEventPassage } from '@/types/jesus';

type Colors = ReturnType<typeof getColors>;

export default function JesusEventScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { bibleVersion } = useBibleVersion();
  const [view, setView] = useState<JesusEventView>('bible');
  // Split-capable tablets (landscape iPad) lay the event out the way the reader
  // and a topic are laid out there: scripture left, insight right.
  const { useSplitView, splitRatio, setSplitRatio, splitViewMode, setSplitViewMode } =
    useDeviceInfo();
  const [tab, setTab] = useState<JesusTab>('summary');
  // Split view only: the menu moves to the insight pane (JesusChrome owns it otherwise).
  const [menuOpen, setMenuOpen] = useState(false);
  /**
   * Verse Insight, shown WITHOUT leaving the event.
   *
   * Rendered straight from local state rather than by mounting
   * BibleInteractionProvider around each passage: that provider is the
   * reader's whole interaction stack — auth, toasts, per-chapter highlight and
   * auto-highlight fetches — and an event spanning two Gospels would mount it
   * twice to show one popup. The tooltip takes plain props, so this costs one
   * piece of state and no requests.
   *
   * Highlighting and notes stay in the reader: they are per-chapter and
   * belong where the chapter is. The reference pill still goes there.
   */
  const [insight, setInsight] = useState<{
    passage: JesusEventPassage;
    verse: number;
    text?: string;
  } | null>(null);
  const auth = useOptionalAuth();

  const query = useJesusEvent(slug);
  const { data } = query;
  const phase = queryPhase(query);

  // The passages carrying scripture are the TOP-LEVEL ones; `event.passages` is
  // the reference list without verse text.
  const passages = data?.passages ?? [];

  /** The text of one verse inside a passage, for the tooltip's quote. */
  const verseTextOf = useCallback(
    (passage: JesusEventPassage, verse: number) =>
      (passage.verses ?? []).find((v) => v.verse_number === verse)?.text,
    []
  );

  const openInReader = useCallback((bookId: number, chapter: number) => {
    router.push(`/bible/${bookId}/${chapter}`);
  }, []);

  const body = (
    <>
      {data?.event.period_name ? (
        <Pressable
          onPress={() =>
            data.event.period_slug && router.push(`/jesus/life?period=${data.event.period_slug}`)
          }
          testID="jesus-event-period"
        >
          <Text style={styles.period}>{data.event.period_name}</Text>
        </Pressable>
      ) : null}

      <Text style={styles.title} testID="jesus-event-title">
        {data?.event.title}
      </Text>

      {data?.event.summary ? <Text style={styles.summary}>{data.event.summary}</Text> : null}

      <View testID="jesus-event-passages">
        {passages.map((passage) => (
          <JesusPassageBlock
            key={passage.display}
            passage={passage}
            onOpen={() => openInReader(passage.book_id, passage.chapter)}
            onOpenVerse={(verse) =>
              setInsight({ passage, verse, text: verseTextOf(passage, verse) })
            }
          />
        ))}
      </View>

      {data?.event.themes?.length ? (
        <>
          <SectionHeading title={t('jesus.event.themes', 'Themes')} />
          <View style={styles.pillRow} testID="jesus-event-themes">
            {data.event.themes.map((theme) => (
              <JesusPill
                key={theme.slug}
                label={theme.name}
                onPress={() => router.push(`/jesus/theme/${theme.slug}`)}
                testID={`jesus-event-theme-${theme.slug}`}
              />
            ))}
          </View>
        </>
      ) : null}

      {data?.related?.length ? (
        <>
          <SectionHeading title={t('jesus.event.related', 'Related events')} />
          <View testID="jesus-event-related">
            {data.related.slice(0, 6).map((related) => (
              <EventRow
                key={related.slug}
                event={related}
                onPress={(s) => router.push(`/jesus/event/${s}`)}
              />
            ))}
          </View>
        </>
      ) : null}
    </>
  );

  // Verse Insight, in place — see the `insight` state above.
  const tooltip = insight ? (
    <VerseMateTooltip
      visible
      verseNumber={insight.verse}
      highlightGroup={null}
      bookId={insight.passage.book_id}
      chapterNumber={insight.passage.chapter}
      bookName={insight.passage.book_name}
      verseText={insight.text}
      source="verse_number"
      isLoggedIn={Boolean(auth?.user)}
      onClose={() => setInsight(null)}
    />
  ) : null;

  if (useSplitView && phase !== 'offline' && phase !== 'loading' && data) {
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ headerShown: false }} />
        <SplitView
          splitRatio={splitRatio}
          onSplitRatioChange={setSplitRatio}
          viewMode={splitViewMode}
          onViewModeChange={setSplitViewMode}
          leftContent={
            <View style={styles.screen}>
              {/* No Bible / Insight toggle: both are on screen. The menu is on the
                  insight pane, as in the reader and topics. */}
              <JesusChrome
                title={data.event.title}
                subtitle={bibleVersion ?? undefined}
                backTestID="jesus-event-back"
                showMenu={false}
              />
              <ScrollView
                contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxxl }}
                testID="jesus-event-body"
              >
                {body}
              </ScrollView>
            </View>
          }
          rightContent={
            <JesusInsightPane
              title={data.event.title}
              detail={data}
              tab={tab}
              onTabChange={setTab}
              onMenuPress={() => setMenuOpen(true)}
            />
          }
        />
        {tooltip}
        <HamburgerMenu visible={menuOpen} onClose={() => setMenuOpen(false)} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <JesusChrome
        title={data?.event.title ?? t('jesus.hub.title', 'Jesus')}
        // The event's scripture is printed in this version, so it is as true
        // here as under a chapter title — and it is the reader's second line.
        subtitle={bibleVersion ?? undefined}
        view={view}
        onViewChange={setView}
        backTestID="jesus-event-back"
      />

      {/* The pills name the insight views only, so they belong to that side of
          the toggle — the reader hides them on its Bible view for the same
          reason. */}
      {view === 'insight' ? <JesusInsightTabs active={tab} onSelect={setTab} /> : null}

      {phase === 'offline' ? (
        <JesusPlaceholder
          message={t('jesus.offline.message', "You're offline — this needs a connection.")}
          testID="jesus-event-offline"
        />
      ) : phase === 'loading' ? (
        <JesusPlaceholder loading testID="jesus-event-loading" />
      ) : !data ? (
        <JesusPlaceholder
          message={t('jesus.event.missing', "That event doesn't exist.")}
          testID="jesus-event-missing"
        />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxxl }}
          testID="jesus-event-body"
        >
          {view === 'bible' ? (
            body
          ) : (
            <View testID={`jesus-event-panel-${tab}`}>
              <JesusTabBodies tab={tab} detail={data} />
            </View>
          )}
        </ScrollView>
      )}

      {tooltip}
    </View>
  );
}

function createStyles(colors: Colors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    period: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      fontSize: fontSizes.caption,
      fontWeight: fontWeights.semibold,
      letterSpacing: 1,
      textTransform: 'uppercase',
      color: colors.gold,
    },
    title: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xs,
      fontSize: fontSizes.displayMedium,
      // The reader's chapter title: 32 / bold.
      fontWeight: fontWeights.bold,
      color: colors.textPrimary,
    },
    summary: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      fontSize: fontSizes.bodySmall,
      lineHeight: 21,
      color: colors.textSecondary,
    },
    pillRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.sm,
    },
  });
}
