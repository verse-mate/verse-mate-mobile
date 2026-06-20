/**
 * Onboarding feature previews
 *
 * Theme-reactive recreations of each real in-app screen shown in the onboarding
 * flow, built from the app's own theme tokens (gold accent, elevated surfaces,
 * serif headings) rather than baked screenshots — so the tour responds to
 * light/dark mode and stays visually consistent.
 *
 * Layouts mirror the real product UI (Verse Insight sheet, the Insight level
 * tabs, the Topics browser, the Hebrew/Greek lexicon card, the inductive
 * observation steps, and the Visuals tab). The Visuals thumbnail uses a neutral
 * hand-drawn placeholder on purpose — the real screen shows licensed BibleProject
 * art which is not ours to ship in onboarding.
 */

import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { useTheme } from '@/contexts/ThemeContext';
import { SERIF_FONT } from './OnboardingSlide';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

/** Fixed dark ink for text/icons sitting on the gold accent (same in both themes). */
const ON_GOLD = '#1a1a1a';

const CARD_MAX_WIDTH = 340;

function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ============================================================================
// Shared primitives
// ============================================================================

function PreviewCard({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        {
          width: '100%',
          maxWidth: CARD_MAX_WIDTH,
          backgroundColor: colors.backgroundElevated,
          borderRadius: 20,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          padding: 16,
          shadowColor: colors.shadow,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 1,
          shadowRadius: 16,
          elevation: 6,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

function Pill({
  label,
  active = false,
  small = false,
}: {
  label: string;
  active?: boolean;
  small?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        paddingVertical: small ? 5 : 6,
        paddingHorizontal: small ? 10 : 14,
        borderRadius: 999,
        backgroundColor: active ? colors.gold : 'transparent',
        borderWidth: active ? 0 : StyleSheet.hairlineWidth,
        borderColor: colors.border,
      }}
    >
      <Text
        style={{
          fontSize: small ? 11 : 12,
          fontWeight: '600',
          color: active ? ON_GOLD : colors.textSecondary,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

function Chip({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'gold' }) {
  const { colors } = useTheme();
  const gold = tone === 'gold';
  return (
    <View
      style={{
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: 999,
        backgroundColor: gold ? withAlpha(colors.gold, 0.18) : colors.backgroundSecondary,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: gold ? colors.gold : colors.border,
      }}
    >
      <Text
        style={{
          fontSize: 12,
          fontWeight: '500',
          color: gold ? colors.gold : colors.textSecondary,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

function MiniActionButton({ icon, label }: { icon: IoniconName; label: string }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        flexDirection: 'row',
        gap: 6,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        borderRadius: 10,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
        backgroundColor: colors.backgroundSecondary,
      }}
    >
      <Ionicons name={icon} size={13} color={colors.textSecondary} />
      <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary }}>{label}</Text>
    </View>
  );
}

/** Gold uppercase section label, matching the in-app eyebrow style. */
function SectionLabel({ children }: { children: string }) {
  const { colors } = useTheme();
  return (
    <Text
      style={{
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 1,
        color: colors.gold,
        textTransform: 'uppercase',
      }}
    >
      {children}
    </Text>
  );
}

function Divider({ my = 10 }: { my?: number }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        height: StyleSheet.hairlineWidth,
        backgroundColor: colors.divider,
        marginVertical: my,
      }}
    />
  );
}

/** The four Insight level tabs (Summary · By Line · Study · Visuals). */
function InsightTabs({ active }: { active: 'Summary' | 'By Line' | 'Study' | 'Visuals' }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 4,
        backgroundColor: colors.backgroundSecondary,
        borderRadius: 999,
        padding: 4,
        alignSelf: 'center',
      }}
    >
      {(['Summary', 'By Line', 'Study', 'Visuals'] as const).map((t) => (
        <Pill key={t} label={t} active={t === active} small />
      ))}
    </View>
  );
}

function RoundIcon({ icon, size = 26 }: { icon: IoniconName; size?: number }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.backgroundSecondary,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ionicons name={icon} size={size * 0.55} color={colors.textSecondary} />
    </View>
  );
}

/** Neutral hand-drawn landscape — a deliberate placeholder for licensed art. */
function SketchPlaceholder({ height }: { height: number }) {
  const { colors } = useTheme();
  const stroke = colors.textTertiary;
  return (
    <View style={{ height, backgroundColor: colors.backgroundSecondary }}>
      <Svg width="100%" height="100%" viewBox="0 0 200 120" preserveAspectRatio="none">
        <Circle cx="152" cy="34" r="15" stroke={stroke} strokeWidth={2} fill="none" />
        <Path
          d="M0 90 Q 40 58 80 84 T 160 78 T 200 90"
          stroke={stroke}
          strokeWidth={2}
          fill="none"
        />
        <Path d="M0 104 Q 50 80 110 100 T 200 104" stroke={stroke} strokeWidth={2} fill="none" />
        <Line x1="18" y1="118" x2="74" y2="94" stroke={stroke} strokeWidth={2} />
      </Svg>
    </View>
  );
}

// ============================================================================
// 1 — Verse Insight (bottom sheet)
// ============================================================================

export function VerseInsightPreview() {
  const { colors } = useTheme();
  return (
    <PreviewCard>
      <View
        style={{
          width: 36,
          height: 4,
          borderRadius: 2,
          backgroundColor: colors.border,
          alignSelf: 'center',
          marginBottom: 12,
        }}
      />
      <Text
        style={{
          textAlign: 'center',
          color: colors.gold,
          fontSize: 13,
          fontWeight: '700',
          marginBottom: 8,
        }}
      >
        Verse Insight
      </Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <RoundIcon icon="chevron-back" />
        <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textPrimary }}>
          Genesis 1:4
        </Text>
        <RoundIcon icon="chevron-forward" />
      </View>
      <Text
        style={{
          fontSize: 12,
          fontStyle: 'italic',
          color: colors.textSecondary,
          textAlign: 'center',
          marginBottom: 12,
        }}
      >
        “God saw that the light was good; and God separated the light from the darkness.”
      </Text>
      <View
        style={{
          backgroundColor: colors.backgroundSecondary,
          borderRadius: 12,
          padding: 12,
          marginBottom: 12,
        }}
      >
        <Text
          style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary, marginBottom: 6 }}
        >
          Summary
        </Text>
        <Text style={{ fontSize: 12, lineHeight: 18, color: colors.textSecondary }}>
          God looks at the light and calls it good, then separates light from darkness — showing
          that creation’s order is good and right.
        </Text>
        <Divider my={10} />
        <SectionLabel>Cross references</SectionLabel>
        <View style={{ flexDirection: 'row', marginTop: 6 }}>
          <Chip label="Genesis 1:4" />
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        <MiniActionButton icon="copy-outline" label="Copy" />
        <MiniActionButton icon="share-outline" label="Share" />
        <MiniActionButton icon="bookmark-outline" label="Save" />
      </View>
      <View
        style={{
          backgroundColor: colors.gold,
          borderRadius: 12,
          paddingVertical: 11,
          alignItems: 'center',
        }}
      >
        <Text style={{ fontSize: 14, fontWeight: '700', color: ON_GOLD }}>Close</Text>
      </View>
    </PreviewCard>
  );
}

// ============================================================================
// 2 — Explanation levels (By Line)
// ============================================================================

export function LevelsPreview() {
  const { colors } = useTheme();
  return (
    <PreviewCard>
      <InsightTabs active="By Line" />
      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary, marginTop: 14 }}>
        Genesis 1:1
      </Text>
      <View
        style={{
          borderLeftWidth: 3,
          borderLeftColor: colors.gold,
          paddingLeft: 10,
          marginTop: 6,
          marginBottom: 10,
        }}
      >
        <Text style={{ fontSize: 12, fontStyle: 'italic', color: colors.textSecondary }}>
          In the beginning God created the heavens and the earth.
        </Text>
      </View>
      <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 }}>
        Summary
      </Text>
      <Text style={{ fontSize: 12, lineHeight: 18, color: colors.textSecondary, marginBottom: 10 }}>
        In Hebrew, <Text style={{ fontWeight: '700', color: colors.textPrimary }}>bara</Text> means
        God creates by His own power. The subject is{' '}
        <Text style={{ fontWeight: '700', color: colors.textPrimary }}>Elohim</Text>, the mighty
        personal God.
      </Text>
      <Divider my={0} />
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: 10,
        }}
      >
        <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textPrimary }}>
          Genesis 1:2
        </Text>
        <Ionicons name="chevron-down" size={16} color={colors.textTertiary} />
      </View>
    </PreviewCard>
  );
}

// ============================================================================
// 3 — Topics
// ============================================================================

function TopicRow({ title }: { title: string }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 9,
      }}
    >
      <Text style={{ fontSize: 13, color: colors.textPrimary }}>{title}</Text>
      <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
    </View>
  );
}

export function TopicsPreview() {
  const { colors } = useTheme();
  return (
    <PreviewCard>
      <View
        style={{
          flexDirection: 'row',
          backgroundColor: colors.backgroundSecondary,
          borderRadius: 999,
          padding: 4,
          marginBottom: 10,
        }}
      >
        {(['Old Testament', 'New Testament', 'Topics'] as const).map((t) => {
          const active = t === 'Topics';
          return (
            <View
              key={t}
              style={{
                flex: 1,
                paddingVertical: 6,
                borderRadius: 999,
                alignItems: 'center',
                backgroundColor: active ? colors.gold : 'transparent',
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: '600',
                  color: active ? ON_GOLD : colors.textSecondary,
                }}
              >
                {t}
              </Text>
            </View>
          );
        })}
      </View>
      <View
        style={{
          flexDirection: 'row',
          gap: 6,
          marginBottom: 10,
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}
      >
        <Pill label="Events" active small />
        <Pill label="Prophecies" small />
        <Pill label="Parables" small />
        <Pill label="Themes" small />
      </View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          backgroundColor: colors.backgroundSecondary,
          borderRadius: 999,
          paddingVertical: 8,
          paddingHorizontal: 12,
          marginBottom: 6,
        }}
      >
        <Ionicons name="search" size={14} color={colors.textTertiary} />
        <Text style={{ fontSize: 12, color: colors.textTertiary }}>Search…</Text>
      </View>
      <TopicRow title="The Creation of the World" />
      <Divider my={0} />
      <TopicRow title="The Fall of Man" />
      <Divider my={0} />
      <TopicRow title="The Great Flood" />
    </PreviewCard>
  );
}

// ============================================================================
// 4 — Greek & Hebrew lexicon definition
// ============================================================================

export function LexiconPreview() {
  const { colors } = useTheme();
  return (
    <View style={{ width: '100%', maxWidth: CARD_MAX_WIDTH, alignItems: 'center' }}>
      <Text
        style={{
          position: 'absolute',
          top: -10,
          left: 6,
          right: 6,
          fontSize: 13,
          lineHeight: 22,
          color: colors.textPrimary,
          opacity: 0.07,
        }}
      >
        Consider it all joy when you encounter various trials, knowing that the testing of your
        faith produces endurance.
      </Text>
      <PreviewCard>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
          <Text style={{ fontFamily: SERIF_FONT, fontSize: 26, color: colors.textPrimary }}>
            יוֹם
          </Text>
          <Text style={{ fontSize: 16, fontWeight: '600', color: colors.gold }}>yom</Text>
        </View>
        <Text style={{ fontSize: 11, color: colors.textTertiary, marginTop: 4 }}>
          Noun (masc.) · H3117 · 2037× in OT
        </Text>
        <Divider my={12} />
        <SectionLabel>Basic sense</SectionLabel>
        <Text style={{ fontSize: 13, color: colors.textPrimary, marginTop: 4 }}>day</Text>
        <Divider my={12} />
        <SectionLabel>Semantic range</SectionLabel>
        <Text style={{ fontSize: 12, lineHeight: 17, color: colors.textSecondary, marginTop: 4 }}>
          • a 24-hour period marked by evening and morning
        </Text>
        <Text style={{ fontSize: 12, lineHeight: 17, color: colors.textSecondary }}>
          • daylight hours; the light portion of a day
        </Text>
        <Divider my={12} />
        <SectionLabel>Related</SectionLabel>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
          <Text style={{ fontFamily: SERIF_FONT, fontSize: 14, color: colors.textPrimary }}>
            יוֹמָם
          </Text>
          <Text style={{ fontSize: 12, fontWeight: '600', color: colors.gold }}>yomam</Text>
          <Text style={{ fontSize: 11, color: colors.textTertiary, flex: 1 }}>
            by day; during the day
          </Text>
        </View>
      </PreviewCard>
    </View>
  );
}

// ============================================================================
// 5 — Inductive study method (Observation)
// ============================================================================

function ObservationStep({ n, title, note }: { n: number; title: string; note: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', paddingVertical: 8 }}>
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          backgroundColor: colors.gold,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 10,
        }}
      >
        <Text style={{ fontSize: 11, fontWeight: '700', color: ON_GOLD }}>{n}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textPrimary }}>
            {title}
          </Text>
          <Ionicons name="chevron-down" size={15} color={colors.textTertiary} />
        </View>
        <Text style={{ fontSize: 11, lineHeight: 16, color: colors.textTertiary, marginTop: 2 }}>
          {note}
        </Text>
      </View>
    </View>
  );
}

export function InductivePreview() {
  const { colors } = useTheme();
  return (
    <PreviewCard>
      <InsightTabs active="Study" />
      <View style={{ marginTop: 12, marginBottom: 4 }}>
        <SectionLabel>Observation — 9 inductive steps</SectionLabel>
      </View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: 4,
        }}
      >
        <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>
          About the nine observation steps
        </Text>
        <Ionicons name="chevron-down" size={15} color={colors.textTertiary} />
      </View>
      <ObservationStep
        n={1}
        title="Begin with prayer"
        note="Apart from the Holy Spirit’s illumination this is just a method."
      />
      <ObservationStep
        n={2}
        title="Ask the 5 W’s and an H"
        note="Setting the table — author, audience, occasion."
      />
      <ObservationStep
        n={3}
        title="Mark key words and phrases"
        note="Repeated words carry the author’s purpose."
      />
    </PreviewCard>
  );
}

// ============================================================================
// 6 — Visuals
// ============================================================================

export function VisualsPreview() {
  const { colors } = useTheme();
  const cardFrame: ViewStyle = {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.backgroundElevated,
  };
  return (
    <View style={{ width: '100%', maxWidth: CARD_MAX_WIDTH, gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>
          Visuals for Genesis 1
        </Text>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Ionicons name="copy-outline" size={15} color={colors.textTertiary} />
          <Ionicons name="share-outline" size={15} color={colors.textTertiary} />
        </View>
      </View>

      <View style={cardFrame}>
        <View>
          <SketchPlaceholder height={132} />
          <View
            style={[
              StyleSheet.absoluteFillObject,
              { alignItems: 'center', justifyContent: 'center' },
            ]}
          >
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: colors.gold,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="play" size={22} color={ON_GOLD} style={{ marginLeft: 2 }} />
            </View>
          </View>
          <View
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              padding: 10,
              backgroundColor: 'rgba(0,0,0,0.5)',
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#ffffff' }}>
              Genesis 1–11 — Overview
            </Text>
            <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)' }}>
              BibleProject overview · animated explainer
            </Text>
            <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>
              BibleProject · CC BY-SA 4.0
            </Text>
          </View>
        </View>
      </View>

      <View style={cardFrame}>
        <View>
          <SketchPlaceholder height={78} />
          <View
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              width: 26,
              height: 26,
              borderRadius: 13,
              backgroundColor: colors.backgroundOverlay,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="scan-outline" size={14} color={colors.textPrimary} />
          </View>
        </View>
      </View>
    </View>
  );
}

// ============================================================================
// 7 — Multiple languages (last screen)
// ============================================================================

export function LanguagesPreview() {
  const { colors } = useTheme();
  return (
    <View style={{ width: '100%', maxWidth: CARD_MAX_WIDTH, alignItems: 'center', gap: 20 }}>
      <Ionicons name="globe-outline" size={92} color={colors.gold} />
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
        <Chip label="English" />
        <Chip label="Español" />
        <Chip label="Français" />
        <Chip label="Português" />
        <Chip label="Deutsch" />
        <Chip label="Always free" tone="gold" />
      </View>
    </View>
  );
}
