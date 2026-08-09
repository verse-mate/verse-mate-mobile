/**
 * Android Verse-of-the-Day widget UI (GH-265).
 *
 * react-native-android-widget renders this RN-like tree into a native
 * RemoteViews widget. Layout follows the "Verse of the Day — home-screen
 * widget" design doc (turn 2, panel 2B — Android):
 *
 *  - `compact`  (4×2, 336×148dp): verse clamped to 3 lines, reference + wordmark
 *    pinned to the bottom baseline. No header, no accent rail — at this size the
 *    design reads the widget as a plain rounded Material surface.
 *  - `expanded` (4×4, 336×336dp): eyebrow + version, verse clamped to 4 lines,
 *    gold reference, then a nested rounded "Why it matters" panel. The design
 *    uses an inset surface instead of a hairline divider, and each block is its
 *    own tap target (verse → chapter, note → the explanation tab).
 *
 * Type never shrinks to fit (design rule: "clamp lines, never shrink the type"),
 * so every day's verse occupies the same slots regardless of length.
 */
import { FlexWidget, TextWidget } from "react-native-android-widget";

export interface VerseData {
  verseNumber: number;
  text: string;
}

/** Which of the design's two Android compositions to paint. */
export type WidgetSize = "compact" | "expanded";

export interface VerseOfTheDayWidgetProps {
  /** Per-verse data from the API; null when rendering the fallback state. */
  verses: VerseData[] | null;
  /** Rendered reference, e.g. "Genesis 1:1-2". Empty in the fallback state. */
  reference: string;
  /** Universal-link deep link with verse range + src=widget. */
  deepLink: string;
  /** Message shown when `verses` is null/empty (empty pool or fetch failure). */
  fallbackText: string;
  /** Which palette to paint; the handler renders one tree per system theme. */
  theme: "light" | "dark";
  /** Which composition to paint, derived from the host cell size. */
  size?: WidgetSize;
  /**
   * Short "why it matters" summary (≤220 chars per the design). Only the
   * `expanded` size has room for it; when absent that size paints a verse-only
   * composition rather than an empty panel.
   */
  explanation?: string | null;
  /** Deep link for the explanation tab; used by the note block's tap zone. */
  noteDeepLink?: string;
  /** Translation label shown in the expanded header, e.g. "NASB1995". */
  versionLabel?: string;
}

// Palette from the design doc (2B). The dark values are the design's verbatim;
// light is the same structure resolved against the app's light tokens — gold
// drops to #b09a6d there, the only gold that clears WCAG AA on white.
const PALETTES = {
  light: {
    background: "#ffffff",
    border: "#e8e4dc",
    verseText: "#1a1a1a",
    reference: "#b09a6d",
    eyebrow: "#6e6e77",
    version: "#8a8a8a",
    wordmark: "#9b9b9b",
    panel: "#f7f5f1",
    panelLabel: "#8a7345",
    explanation: "#4a4a4a",
    link: "#8a7345",
  },
  dark: {
    background: "#1b1b1b",
    border: "#2a2a2a",
    verseText: "#ededed",
    reference: "#e0b872",
    eyebrow: "#8a8a8a",
    version: "#6e6e6e",
    wordmark: "#8a8a8a",
    panel: "#141414",
    panelLabel: "#e0b872",
    explanation: "#bdbdbd",
    link: "#e0b872",
  },
} as const;

type Palette = (typeof PALETTES)[keyof typeof PALETTES];

const SUPERSCRIPTS = ["⁰", "¹", "²", "³", "⁴", "⁵", "⁶", "⁷", "⁸", "⁹"];

/** Render a verse number as Unicode superscript, matching the in-app reader. */
function toSuperscript(n: number): string {
  return String(n)
    .split("")
    .map((d) => SUPERSCRIPTS[Number(d)] ?? d)
    .join("");
}

/** Inline the verse text with superscript verse numbers, e.g. "¹ In the…  ² The…". */
function composeVerseText(verses: VerseData[]): string {
  return verses.map((v) => `${toSuperscript(v.verseNumber)} ${v.text}`).join("  ");
}

/**
 * Reference + wordmark row that closes every composition. Pinned so the widget's
 * silhouette is identical whatever the verse length (design 2B, stress test).
 *
 * A PLAIN FUNCTION, called directly — deliberately not a component. React
 * Compiler instruments components with a `useMemoCache` call, and
 * react-native-android-widget renders via its own `buildWidgetTree` with no React
 * dispatcher, so that call reads from null and throws (GH-265). This row only
 * appears in the non-fallback path, so when it was a `<FooterRow />` component
 * the widget silently painted its tap-to-open fallback forever — it looked like
 * "the verse never loads". A `"use no memo"` directive did NOT fix it here (the
 * compiler kept instrumenting it), and no unit test can catch it: the compiler
 * transform runs in the release babel build, not under jest. Keeping it a plain
 * call-site helper removes the failure mode entirely.
 */
function footerRow(reference: string, palette: Palette, referenceSize: number) {
  return (
    <FlexWidget
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        width: "match_parent",
      }}
    >
      <TextWidget
        text={reference}
        maxLines={1}
        truncate="END"
        style={{ fontSize: referenceSize, color: palette.reference, fontWeight: "600" }}
      />
      <TextWidget
        text="✦ VerseMate"
        maxLines={1}
        style={{ fontSize: 10, color: palette.wordmark, fontWeight: "500" }}
      />
    </FlexWidget>
  );
}

export function VerseOfTheDayWidget({
  verses,
  reference,
  deepLink,
  fallbackText,
  theme,
  size = "compact",
  explanation,
  noteDeepLink,
  versionLabel,
}: VerseOfTheDayWidgetProps) {
  // React Compiler (app.config.js `experiments.reactCompiler`) instruments this
  // component with a `useMemoCache` call. react-native-android-widget renders
  // the tree via its own `buildWidgetTree`, NOT React's reconciler, so there is
  // no React dispatcher — `useMemoCache` reads from null and throws, leaving the
  // Android widget blank/transparent (GH-265). Opt this component out of the
  // compiler; it's a pure render-to-tree, so memoization buys nothing here.
  // The eslint react-compiler rule flags this as an "unused" directive, but its
  // static analysis disagrees with the actual babel build — on-device testing
  // confirmed the directive IS what stops the crash (with it the widget renders,
  // without it the useMemoCache TypeError above recurs). Suppress the false positive.
  // eslint-disable-next-line react-compiler/react-compiler
  "use no memo";

  const palette = PALETTES[theme];
  const isFallback = !verses || verses.length === 0;
  const bodyText = isFallback ? fallbackText : composeVerseText(verses);
  // The note panel needs both room and copy; without a summary the expanded
  // size paints a verse-only composition instead of an empty surface.
  const showNote = size === "expanded" && !isFallback && !!explanation;

  const surface = {
    height: "match_parent",
    width: "match_parent",
    flexDirection: "column",
    backgroundColor: palette.background,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: palette.border,
    overflow: "hidden",
  } as const;

  if (size === "compact") {
    return (
      <FlexWidget
        style={{
          ...surface,
          justifyContent: isFallback ? "center" : "space-between",
          paddingVertical: 16,
          paddingHorizontal: 18,
        }}
        clickAction="OPEN_VERSE"
        clickActionData={{ url: deepLink }}
      >
        <TextWidget
          text={bodyText}
          maxLines={3}
          truncate="END"
          style={{ fontSize: 15, color: palette.verseText, fontFamily: "serif" }}
        />
        {isFallback ? null : (
          footerRow(reference, palette, 12)
        )}
      </FlexWidget>
    );
  }

  return (
    <FlexWidget style={surface}>
      {/* Verse block — its own tap zone, deep-links to the chapter. */}
      <FlexWidget
        style={{
          width: "match_parent",
          flexDirection: "column",
          flexGap: 10,
          paddingTop: 18,
          paddingHorizontal: 18,
          paddingBottom: 14,
          // Without the note panel this block owns the whole surface.
          ...(showNote ? {} : { flex: 1 }),
        }}
        clickAction="OPEN_VERSE"
        clickActionData={{ url: deepLink }}
      >
        <FlexWidget
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            width: "match_parent",
          }}
        >
          <TextWidget
            text="VERSE OF THE DAY"
            maxLines={1}
            style={{
              fontSize: 9,
              fontWeight: "700",
              letterSpacing: 0.14,
              color: palette.eyebrow,
            }}
          />
          <TextWidget
            text={versionLabel ?? ""}
            maxLines={1}
            style={{ fontSize: 10, color: palette.version }}
          />
        </FlexWidget>

        <TextWidget
          text={bodyText}
          // Without the note panel the verse takes the freed rows.
          maxLines={showNote ? 4 : 9}
          truncate="END"
          style={{ fontSize: 16, color: palette.verseText, fontFamily: "serif" }}
        />

        {isFallback ? null : (
          footerRow(reference, palette, 13)
        )}
      </FlexWidget>

      {/* Note block — nested rounded surface, deep-links to the explanation tab.
          Deliberately FLAT: label, copy and link are direct siblings spaced with
          margins. An earlier version wrapped them in an inner column and used
          `flex: 1` + `justifyContent: "space-between"` + `flexGap`; RemoteViews
          did not resolve that nesting, and on-device it clipped the explanation
          mid-sentence and dropped the link entirely. Margins are predictable
          where nested flex weights are not. */}
      {showNote ? (
        <FlexWidget
          style={{
            flex: 1,
            width: "match_parent",
            flexDirection: "column",
            marginHorizontal: 12,
            marginBottom: 12,
            padding: 14,
            backgroundColor: palette.panel,
            borderRadius: 20,
          }}
          clickAction="OPEN_VERSE"
          clickActionData={{ url: noteDeepLink ?? deepLink }}
        >
          <TextWidget
            text="WHY IT MATTERS"
            maxLines={1}
            style={{
              fontSize: 9,
              fontWeight: "700",
              letterSpacing: 0.14,
              color: palette.panelLabel,
            }}
          />
          <TextWidget
            text={explanation ?? ""}
            maxLines={5}
            truncate="END"
            style={{
              fontSize: 13,
              color: palette.explanation,
              fontFamily: "serif",
              marginTop: 8,
            }}
          />
          <TextWidget
            text="Read the full note →"
            maxLines={1}
            style={{
              fontSize: 11,
              fontWeight: "500",
              color: palette.link,
              marginTop: 10,
            }}
          />
        </FlexWidget>
      ) : null}
    </FlexWidget>
  );
}
