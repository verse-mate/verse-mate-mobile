/**
 * Onboarding feature previews
 *
 * Lightweight, theme-reactive recreations of each feature shown in the
 * onboarding flow. They are built from the app's own theme tokens (gold accent,
 * elevated surfaces, serif headings) rather than baked screenshots, so the whole
 * tour shares one look and responds to light/dark mode.
 *
 * The Visuals preview uses a neutral hand-drawn placeholder on purpose — the
 * real screen shows licensed thumbnails (BibleProject etc.) which are not ours
 * to ship in onboarding art.
 */

import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { StyleSheet, Text, type TextStyle, View, type ViewStyle } from 'react-native';
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
          padding: 18,
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

function Pill({ label, active = false }: { label: string; active?: boolean }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        paddingVertical: 6,
        paddingHorizontal: 14,
        borderRadius: 999,
        backgroundColor: active ? colors.gold : 'transparent',
        borderWidth: active ? 0 : StyleSheet.hairlineWidth,
        borderColor: colors.border,
      }}
    >
      <Text
        style={{
          fontSize: 12,
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
      <Ionicons name={icon} size={14} color={colors.textSecondary} />
      <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary }}>{label}</Text>
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
// 1 — Welcome (highlighted verses)
// ============================================================================

function VerseLine({
  text,
  highlight,
  muted,
}: {
  text: string;
  highlight?: string;
  muted?: boolean;
}) {
  const { colors } = useTheme();
  const base: TextStyle = {
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 6,
    color: muted ? colors.textTertiary : colors.textPrimary,
  };
  return (
    <Text style={highlight ? [base, { backgroundColor: highlight, borderRadius: 4 }] : base}>
      {text}
    </Text>
  );
}

export function WelcomePreview() {
  const { colors } = useTheme();
  return (
    <PreviewCard>
      <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>Genesis 1</Text>
      <Text
        style={{
          fontSize: 10,
          color: colors.textTertiary,
          textTransform: 'uppercase',
          letterSpacing: 1,
          marginTop: 2,
          marginBottom: 12,
        }}
      >
        The Creation
      </Text>
      <VerseLine
        text="In the beginning God created the heavens and the earth."
        highlight="rgba(176,80,70,0.28)"
      />
      <VerseLine
        text="The earth was formless and void, and darkness was over the surface of the deep."
        muted
      />
      <VerseLine
        text="Then God said, “Let there be light”; and there was light."
        highlight="rgba(58,120,180,0.30)"
      />
      <VerseLine
        text="God called the light day, and the darkness He called night."
        highlight={withAlpha(colors.gold, 0.32)}
      />
    </PreviewCard>
  );
}

// ============================================================================
// 2 — Verse Insight
// ============================================================================

export function VerseInsightPreview() {
  const { colors } = useTheme();
  return (
    <PreviewCard>
      <Text
        style={{
          textAlign: 'center',
          color: colors.gold,
          fontSize: 11,
          fontWeight: '700',
          letterSpacing: 1,
          textTransform: 'uppercase',
          marginBottom: 10,
        }}
      >
        Verse Insight
      </Text>
      <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>
        Genesis 1:1
      </Text>
      <Text
        style={{
          fontSize: 13,
          fontStyle: 'italic',
          color: colors.textSecondary,
          marginTop: 4,
          marginBottom: 12,
        }}
      >
        “In the beginning God created the heavens and the earth.”
      </Text>
      <View
        style={{
          height: StyleSheet.hairlineWidth,
          backgroundColor: colors.divider,
          marginBottom: 12,
        }}
      />
      <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textPrimary, marginBottom: 6 }}>
        Analysis
      </Text>
      <Text style={{ fontSize: 12, lineHeight: 18, color: colors.textSecondary, marginBottom: 14 }}>
        God is the uncaused origin of everything — time, space, and matter begin here, created by
        His word.
      </Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <MiniActionButton icon="copy-outline" label="Copy" />
        <MiniActionButton icon="share-outline" label="Share" />
      </View>
    </PreviewCard>
  );
}

// ============================================================================
// 3 — Levels (Summary / By Line / Detailed)
// ============================================================================

export function LevelsPreview() {
  const { colors } = useTheme();
  return (
    <PreviewCard>
      <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center', marginBottom: 14 }}>
        <Pill label="Summary" />
        <Pill label="By Line" active />
        <Pill label="Detailed" />
      </View>
      <View
        style={{
          borderLeftWidth: 3,
          borderLeftColor: colors.gold,
          paddingLeft: 10,
          marginBottom: 10,
        }}
      >
        <Text style={{ fontSize: 12, color: colors.textPrimary }}>
          In the beginning God created the heavens and the earth.
        </Text>
      </View>
      <Text style={{ fontSize: 12, lineHeight: 18, color: colors.textSecondary }}>
        In Hebrew, <Text style={{ fontWeight: '700', color: colors.textPrimary }}>bara</Text> means
        God creates by His own power — bringing something from nothing.
      </Text>
    </PreviewCard>
  );
}

// ============================================================================
// 4 — Topics
// ============================================================================

function TopicRow({ title, sub }: { title: string; sub: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textPrimary }}>{title}</Text>
        <Text style={{ fontSize: 11, color: colors.textTertiary }} numberOfLines={1}>
          {sub}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
    </View>
  );
}

export function TopicsPreview() {
  const { colors } = useTheme();
  return (
    <PreviewCard>
      <View style={{ flexDirection: 'row', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
        <Pill label="Events" />
        <Pill label="Prophecies" active />
        <Pill label="Themes" />
      </View>
      <TopicRow title="The Seed of the Woman" sub="God foretells the serpent's defeat." />
      <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.divider }} />
      <TopicRow title="Blessing to All Nations" sub="All nations blessed through Abraham." />
    </PreviewCard>
  );
}

// ============================================================================
// 5 — Share
// ============================================================================

export function SharePreview() {
  const { colors } = useTheme();
  return (
    <PreviewCard>
      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>
        Genesis 1:1
      </Text>
      <Text
        style={{
          fontSize: 13,
          fontStyle: 'italic',
          color: colors.textSecondary,
          marginTop: 4,
          marginBottom: 14,
        }}
      >
        “In the beginning God created the heavens and the earth.”
      </Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <MiniActionButton icon="copy-outline" label="Copy" />
        <MiniActionButton icon="share-social-outline" label="Share" />
        <MiniActionButton icon="bookmark-outline" label="Save" />
      </View>
    </PreviewCard>
  );
}

// ============================================================================
// 6 — Greek & Hebrew lexicon definition (NEW)
// ============================================================================

export function LexiconPreview() {
  const { colors } = useTheme();
  return (
    <View style={{ width: '100%', maxWidth: CARD_MAX_WIDTH, alignItems: 'center' }}>
      <Text
        style={{
          position: 'absolute',
          top: -8,
          left: 6,
          right: 6,
          fontSize: 13,
          lineHeight: 22,
          color: colors.textPrimary,
          opacity: 0.07,
        }}
      >
        In the beginning was the Word, and the Word was with God, and the Word was God. He was in
        the beginning with God.
      </Text>
      <PreviewCard>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <View
            style={{
              backgroundColor: colors.gold,
              borderRadius: 6,
              paddingHorizontal: 8,
              paddingVertical: 3,
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: '700', color: ON_GOLD }}>G2316</Text>
          </View>
          <Text style={{ fontSize: 11, color: colors.textTertiary }}>Strong’s · noun</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
          <Text style={{ fontFamily: SERIF_FONT, fontSize: 28, color: colors.textPrimary }}>
            θεός
          </Text>
          <Text style={{ fontSize: 13, fontStyle: 'italic', color: colors.textSecondary }}>
            the·os
          </Text>
        </View>
        <Text
          style={{
            fontSize: 12,
            lineHeight: 18,
            color: colors.textSecondary,
            marginTop: 6,
            marginBottom: 14,
          }}
        >
          God; the supreme Divinity; the one true God.
        </Text>
        <Text
          style={{
            fontSize: 10,
            fontWeight: '700',
            letterSpacing: 1,
            textTransform: 'uppercase',
            color: colors.textTertiary,
            marginBottom: 8,
          }}
        >
          Related words
        </Text>
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          <Chip label="θεότης" />
          <Chip label="θεῖος" />
          <Chip label="divine" tone="gold" />
        </View>
      </PreviewCard>
    </View>
  );
}

// ============================================================================
// 7 — Inductive study method (NEW)
// ============================================================================

function InductiveStep({ n, label, open = false }: { n: number; label: string; open?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 7 }}>
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          backgroundColor: open ? colors.gold : colors.backgroundSecondary,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 10,
          borderWidth: open ? 0 : StyleSheet.hairlineWidth,
          borderColor: colors.border,
        }}
      >
        <Text
          style={{ fontSize: 11, fontWeight: '700', color: open ? ON_GOLD : colors.textSecondary }}
        >
          {n}
        </Text>
      </View>
      <Text
        style={{
          flex: 1,
          fontSize: 13,
          fontWeight: open ? '600' : '400',
          color: open ? colors.textPrimary : colors.textSecondary,
        }}
      >
        {label}
      </Text>
      <Ionicons
        name={open ? 'chevron-down' : 'chevron-forward'}
        size={15}
        color={colors.textTertiary}
      />
    </View>
  );
}

export function InductivePreview() {
  const { colors } = useTheme();
  return (
    <PreviewCard>
      <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center', marginBottom: 12 }}>
        <Pill label="Observe" active />
        <Pill label="Interpret" />
        <Pill label="Apply" />
      </View>
      <Text
        style={{
          fontSize: 11,
          fontWeight: '700',
          letterSpacing: 0.5,
          color: colors.textTertiary,
          textTransform: 'uppercase',
          marginBottom: 2,
        }}
      >
        9 inductive steps
      </Text>
      <InductiveStep n={1} label="Observe what the text says" open />
      <InductiveStep n={2} label="Ask who, what, when, where" />
      <InductiveStep n={3} label="Interpret what it means" />
      <InductiveStep n={4} label="Apply it to your life" />
      <Text style={{ fontSize: 11, color: colors.textTertiary, marginTop: 4, marginLeft: 32 }}>
        + 5 more steps
      </Text>
    </PreviewCard>
  );
}

// ============================================================================
// 8 — Visuals (NEW)
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
    <View style={{ width: '100%', maxWidth: CARD_MAX_WIDTH, gap: 12 }}>
      <View style={cardFrame}>
        <View>
          <SketchPlaceholder height={128} />
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
        </View>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 10,
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textPrimary }}>
            Book Overview
          </Text>
          <View
            style={{
              backgroundColor: colors.backgroundSecondary,
              paddingHorizontal: 8,
              paddingVertical: 2,
              borderRadius: 6,
            }}
          >
            <Text style={{ fontSize: 10, letterSpacing: 1, color: colors.textTertiary }}>
              VIDEO
            </Text>
          </View>
        </View>
      </View>

      <View style={cardFrame}>
        <View>
          <SketchPlaceholder height={84} />
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
        <View style={{ padding: 10 }}>
          <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textPrimary }}>
            Visual summary
          </Text>
        </View>
      </View>
    </View>
  );
}

// ============================================================================
// 9 — Multiple languages (relocated to the end)
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
