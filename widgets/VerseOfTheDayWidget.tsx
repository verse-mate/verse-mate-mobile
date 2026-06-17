/**
 * Android Verse-of-the-Day widget UI (GH-265).
 *
 * react-native-android-widget renders this RN-like tree into a native
 * RemoteViews widget. Styled to match the in-app reader: a gold accent rail,
 * Unicode-superscript verse numbers, the verse text, and a gold reference with
 * a small wordmark. Light + dark variants are rendered by the task handler.
 */
import { FlexWidget, TextWidget } from "react-native-android-widget";

export interface VerseData {
  verseNumber: number;
  text: string;
}

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
}

// VerseMate brand palette (mobile theme/tokens.ts): gold accent #b09a6d.
const PALETTES = {
  light: {
    background: "#ffffff",
    accent: "#b09a6d",
    verseText: "#1a1a1a",
    reference: "#b09a6d",
    wordmark: "#9b9b9b",
  },
  dark: {
    background: "#121212",
    accent: "#b09a6d",
    verseText: "#e8e8e8",
    reference: "#e0b890",
    wordmark: "#8a8a8a",
  },
} as const;

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

export function VerseOfTheDayWidget({
  verses,
  reference,
  deepLink,
  fallbackText,
  theme,
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

  return (
    <FlexWidget
      style={{
        height: "match_parent",
        width: "match_parent",
        flexDirection: "row",
        backgroundColor: palette.background,
        borderRadius: 16,
        overflow: "hidden",
      }}
      clickAction="OPEN_VERSE"
      clickActionData={{ url: deepLink }}
    >
      {/* Gold accent rail (matches the app's brand accent). */}
      <FlexWidget
        style={{ height: "match_parent", width: 5, backgroundColor: palette.accent }}
      />

      <FlexWidget
        style={{
          flex: 1,
          height: "match_parent",
          flexDirection: "column",
          justifyContent: isFallback ? "center" : "space-between",
          paddingTop: 14,
          paddingBottom: 12,
          paddingLeft: 14,
          paddingRight: 14,
        }}
      >
        <TextWidget
          text={bodyText}
          maxLines={6}
          truncate="END"
          style={{
            fontSize: isFallback ? 14 : 15,
            color: palette.verseText,
            fontFamily: "serif",
          }}
        />

        <FlexWidget
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            width: "match_parent",
            ...(isFallback ? { marginTop: 12 } : {}),
          }}
        >
          <TextWidget
            text={isFallback ? "" : reference}
            maxLines={1}
            truncate="END"
            style={{ fontSize: 12, color: palette.reference, fontWeight: "700" }}
          />
          <TextWidget
            text="✦ VerseMate"
            maxLines={1}
            style={{ fontSize: 11, color: palette.wordmark, fontWeight: "600" }}
          />
        </FlexWidget>
      </FlexWidget>
    </FlexWidget>
  );
}
