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
import { planLayout } from "./widget-layout";
import type { WidgetStrings } from "./widget-strings";

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
   * Short "why it matters" summary. Only the `expanded` size has room for it;
   * when absent that size paints a verse-only composition rather than an empty
   * panel. No longer server-clamped to 220 chars — the client decides what fits
   * from `height` (GH-265 UX follow-up).
   */
  explanation?: string | null;
  /**
   * MEASURED cell height in dp (`props.widgetInfo.height`). Drives every line
   * count below. Trustworthy only while the providers stay `resizeMode:
   * "horizontal"` — min and max height are equal there, so the reported max IS
   * the cell. Re-enabling vertical resize silently invalidates all of it.
   */
  height: number;
  /** Localised chrome; see widget-strings.ts for why this is not i18next. */
  strings: WidgetStrings;
  /** Topic tags from the API, e.g. ["faith","hope"]. Shown only on large cells. */
  tags?: string[];
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

/**
 * Topic chips for the largest cells only — the last rung of the content ladder.
 *
 * A PLAIN FUNCTION for the same reason as footerRow: anything rendered through
 * buildWidgetTree that is a React component gets instrumented with useMemoCache,
 * which throws with no React dispatcher and silently paints the fallback tree.
 */
function tagRow(tags: string[], palette: Palette) {
  return (
    <FlexWidget
      style={{
        flexDirection: "row",
        width: "match_parent",
        flexGap: 6,
        marginTop: 10,
      }}
    >
      {tags.slice(0, 3).map((tag) => (
        <TextWidget
          key={tag}
          text={tag}
          maxLines={1}
          style={{
            fontSize: 10,
            color: palette.eyebrow,
            backgroundColor: palette.panel,
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 10,
          }}
        />
      ))}
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
  height,
  strings,
  tags,
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

  // Line counts come from the MEASURED cell, never from the text — see
  // widget-layout.ts for why counting characters is the wrong instrument.
  const plan = planLayout({ height, size, hasNote: showNote });
  const showTags = plan.showTags && !isFallback && !!tags?.length;

  // Screen readers see a bitmap in an ImageView — every word here is painted
  // pixels, so without this the widget announces as "VerseMate, image" and the
  // verse is simply unreadable. The library maps this to setContentDescription.
  const a11y = isFallback
    ? fallbackText
    : `${strings.eyebrow}. ${bodyText} ${reference}`;

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
          // Centred, not space-between. A pinned footer on a cell taller than
          // the design (measured ~200dp against 148dp) parks the verse at the
          // top and the reference at the bottom with a hole between them —
          // half of the original bug report. Centring lets the layout engine
          // distribute slack around the real rendered heights, which is the
          // only way to do it without measuring text.
          justifyContent: "center",
          paddingVertical: 16,
          paddingHorizontal: 18,
        }}
        clickAction="OPEN_VERSE"
        clickActionData={{ url: deepLink }}
        accessibilityLabel={a11y}
      >
        <TextWidget
          text={bodyText}
          maxLines={plan.verseMaxLines}
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
    <FlexWidget
      style={{
        ...surface,
        // Same reasoning as compact: blocks hug their real content and the root
        // centres them, so leftover space becomes symmetric framing rather than
        // a hole. The median summary is 234 chars against ~11 lines of room, so
        // "content shorter than the cell" is the common case, not the edge.
        justifyContent: "center",
      }}
      accessibilityLabel={a11y}
    >
      {/* Verse block — its own tap zone, deep-links to the chapter. */}
      <FlexWidget
        style={{
          width: "match_parent",
          flexDirection: "column",
          flexGap: 10,
          paddingTop: 18,
          paddingHorizontal: 18,
          paddingBottom: 14,
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
            text={strings.eyebrow}
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
          // From the measured cell, not a constant. With no note to promote
          // into the slack, the budget hands those rows to the verse instead.
          maxLines={plan.verseMaxLines}
          truncate="END"
          style={{ fontSize: 16, color: palette.verseText, fontFamily: "serif" }}
        />

        {isFallback ? null : (
          footerRow(reference, palette, 13)
        )}
      </FlexWidget>

      {/* Note block — nested rounded surface, deep-links to the explanation tab.
          Label, copy and link are direct siblings spaced with explicit margins;
          an earlier version used `justifyContent: "space-between"` + `flexGap`
          here, which the library implements by injecting invisible weighted
          spacers — on-device that clipped the explanation mid-sentence and
          dropped the link entirely. Margins for spacing, one weighted child
          (below) for the growth. */}
      {showNote ? (
        <FlexWidget
          style={{
            // Hugs its content rather than stretching. Stretching is what left
            // a gap between the summary and the read-more link; the root's
            // centring now absorbs slack for the whole card at once.
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
            text={strings.why}
            maxLines={1}
            style={{
              fontSize: 9,
              fontWeight: "700",
              letterSpacing: 0.14,
              color: palette.panelLabel,
            }}
          />
          {/* Budgeted from the measured cell, so this ellipsizes cleanly at a
              line count rather than being clipped mid-glyph by a container
              bound — RemoteViews can only truncate at maxLines, never at a
              height. The weighted box this replaces filled the space but cut
              the last line in half. */}
          <TextWidget
            text={explanation ?? ""}
            maxLines={plan.noteMaxLines}
            truncate="END"
            style={{
              fontSize: 13,
              color: palette.explanation,
              fontFamily: "serif",
              marginTop: 8,
            }}
          />
          <TextWidget
            text={strings.readNote}
            maxLines={1}
            style={{
              fontSize: 11,
              fontWeight: "500",
              color: palette.link,
              marginTop: 10,
            }}
          />
          {showTags && tags ? tagRow(tags, palette) : null}
        </FlexWidget>
      ) : null}
    </FlexWidget>
  );
}
