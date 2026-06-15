/**
 * Android Verse-of-the-Day widget UI (GH-265).
 *
 * react-native-android-widget renders this RN-like tree into a native
 * RemoteViews widget. Authored without an Android build — verify with
 * `expo prebuild -p android` + a device/emulator.
 */
import { FlexWidget, TextWidget } from "react-native-android-widget";

export interface VerseOfTheDayWidgetProps {
  verseText: string;
  reference: string;
  /** Universal-link deep link with verse range + src=widget. */
  deepLink: string;
}

export function VerseOfTheDayWidget({
  verseText,
  reference,
  deepLink,
}: VerseOfTheDayWidgetProps) {
  // React Compiler (app.config.js `experiments.reactCompiler`) instruments this
  // component with a `useMemoCache` call. react-native-android-widget renders
  // the tree via its own `buildWidgetTree`, NOT React's reconciler, so there is
  // no React dispatcher — `useMemoCache` reads from null and throws, leaving the
  // Android widget blank/transparent (GH-265). Opt this component out of the
  // compiler; it's a pure render-to-tree, so memoization buys nothing here.
  "use no memo";

  return (
    <FlexWidget
      style={{
        height: "match_parent",
        width: "match_parent",
        flexDirection: "column",
        justifyContent: "space-between",
        backgroundColor: "#ffffff",
        borderRadius: 16,
        padding: 14,
      }}
      clickAction="OPEN_VERSE"
      clickActionData={{ url: deepLink }}
    >
      <TextWidget
        text={verseText}
        maxLines={6}
        style={{ fontSize: 15, color: "#1a1a1a" }}
      />
      <FlexWidget
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          width: "match_parent",
        }}
      >
        <TextWidget
          text={reference}
          style={{ fontSize: 12, color: "#6b6b6b", fontWeight: "600" }}
        />
        <TextWidget
          text="VerseMate"
          style={{ fontSize: 11, color: "#9b9b9b" }}
        />
      </FlexWidget>
    </FlexWidget>
  );
}
