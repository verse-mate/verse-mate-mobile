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
import { BibleNavigationModal } from '@/components/bible/BibleNavigationModal';
import { HamburgerMenu } from '@/components/bible/HamburgerMenu';
import { JesusEventHeader, type JesusEventView } from '@/components/jesus/JesusEventHeader';
import {
  EventRow,
  JesusPill,
  JesusPlaceholder,
  queryPhase,
  SectionHeading,
  uniqueGospels,
} from '@/components/jesus/JesusParts';
import { JesusPassageBlock } from '@/components/jesus/JesusPassageBlock';
import { JESUS_TABS, type JesusTab, JesusTabBodies } from '@/components/jesus/JesusTabBodies';
import { useTheme } from '@/contexts/ThemeContext';
import { useJesusEvent } from '@/hooks/jesus';
import { fontSizes, fontWeights, type getColors, radii, spacing } from '@/theme/tokens';

type Colors = ReturnType<typeof getColors>;

export default function JesusEventScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [view, setView] = useState<JesusEventView>('bible');
  const [tab, setTab] = useState<JesusTab>('summary');
  const [navOpen, setNavOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const query = useJesusEvent(slug);
  const { data } = query;
  const phase = queryPhase(query);

  // The passages carrying scripture are the TOP-LEVEL ones; `event.passages` is
  // the reference list without verse text.
  const passages = data?.passages ?? [];

  const openInReader = useCallback((bookId: number, chapter: number) => {
    router.push(`/bible/${bookId}/${chapter}`);
  }, []);

  /**
   * Open ONE verse in the reader. The reader already accepts `?verse=` (the
   * widget and deep links use it), so a tapped verse lands on that verse with
   * the full interaction system — highlight, note, lexicon, Verse Insight —
   * rather than at the top of the chapter.
   */
  const openVerseInReader = useCallback((bookId: number, chapter: number, verse: number) => {
    router.push(`/bible/${bookId}/${chapter}?verse=${verse}`);
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
            onOpenVerse={(verse) => openVerseInReader(passage.book_id, passage.chapter, verse)}
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

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <JesusEventHeader
        title={data?.event.title ?? t('jesus.hub.title', 'Jesus')}
        view={view}
        onTitlePress={() => setNavOpen(true)}
        onViewChange={setView}
        onMenuPress={() => setMenuOpen(true)}
      />

      {/* The pills name the insight views only, so they belong to that side of
          the toggle — the reader hides them on its Bible view for the same
          reason. */}
      {view === 'insight' ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabStrip}
          contentContainerStyle={styles.tabStripContent}
          testID="jesus-event-tabs"
        >
          <View style={styles.tabTrack}>
            {JESUS_TABS.map((entry) => (
              <Pressable
                key={entry.id}
                onPress={() => setTab(entry.id)}
                style={[styles.tab, tab === entry.id && styles.tabActive]}
                testID={`jesus-event-tab-${entry.id}`}
                accessibilityRole="tab"
                accessibilityState={{ selected: tab === entry.id }}
              >
                <Text style={[styles.tabText, tab === entry.id && styles.tabTextActive]}>
                  {t(`jesus.tab.${entry.id}`, entry.label)}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      ) : null}

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

      {navOpen ? (
        <BibleNavigationModal
          visible={navOpen}
          initialTab="JESUS"
          // An event is not a chapter, so there is nothing to highlight as
          // current; the selector opens on the Jesus tab and a book pick simply
          // leaves for the reader.
          currentBookId={0}
          currentChapter={0}
          onClose={() => setNavOpen(false)}
          onSelectChapter={(bookId, chapter) => {
            setNavOpen(false);
            router.push(`/bible/${bookId}/${chapter}`);
          }}
        />
      ) : null}
      <HamburgerMenu visible={menuOpen} onClose={() => setMenuOpen(false)} />
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
      fontWeight: fontWeights.medium,
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
    /*
     * Pills on a track, matching the testament row and the Bible|Insight
     * toggle. This was an underline strip, which is a convention the app uses
     * nowhere else — the tester flagged it as "missing consistent pill
     * approach". The container still carries an explicit height: a horizontal
     * ScrollView sizes to content and measures a couple of points short of the
     * font's descenders, which clipped "Summary" to "Summarv".
     */
    tabStrip: {
      flexGrow: 0,
      height: 52,
      paddingHorizontal: spacing.lg,
    },
    tabStripContent: { alignItems: 'center', paddingVertical: spacing.sm },
    tabTrack: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      padding: 4,
      borderRadius: 100,
      backgroundColor: colors.backgroundSecondary,
    },
    tab: {
      paddingHorizontal: spacing.lg,
      borderRadius: 100,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 28,
      backgroundColor: 'transparent',
    },
    tabActive: { backgroundColor: colors.gold },
    tabText: {
      fontSize: 14,
      lineHeight: Math.round(14 * 1.4),
      color: colors.textPrimary,
    },
    tabTextActive: { color: colors.black, fontWeight: fontWeights.semibold },
  });
}
