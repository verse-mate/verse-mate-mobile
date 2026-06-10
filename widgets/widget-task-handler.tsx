/**
 * Android widget task handler (GH-265).
 *
 * Runs in a headless JS context when the OS adds/updates the widget or the
 * user taps it. Fetches today's verse in the user's preferred translation
 * (read from the same AsyncStorage key the app uses — Android shares the JS
 * sandbox, so no App Group is needed), renders the widget tree, and opens the
 * deep link on tap.
 *
 * Authored without an Android build — verify on device/emulator.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Linking } from "react-native";
import type { WidgetTaskHandlerProps } from "react-native-android-widget";
import { VerseOfTheDayWidget } from "./VerseOfTheDayWidget";

const BIBLE_VERSION_KEY = "bible-version";
const DEFAULT_VERSION = "NASB1995";
// Personalization id (the logged-in user's own id) the app mirrors into
// AsyncStorage; sent as `pid` so the widget shows the user's personal verse
// (PD-7). Absent when logged out → the endpoint serves the global verse.
const USER_ID_KEY = "widget-user-id";
const FALLBACK_MESSAGE = "Open VerseMate to see today's verse";

/**
 * Base web host for the tap deep link.
 *
 * Must match the host the deep-link parser expects: parseChapterShareUrl
 * (utils/sharing/generate-chapter-share-url.ts) rejects any URL whose host
 * differs from `EXPO_PUBLIC_WEB_URL`. Deriving from the same env here keeps the
 * widget link and the parser in sync on every build (staging/preview/dev),
 * instead of hardcoding prod. Falls back to prod when the env is unset.
 */
const WEB_BASE_URL = process.env.EXPO_PUBLIC_WEB_URL ?? "https://app.versemate.org";

interface VerseResponse {
  empty: boolean;
  referenceText?: string;
  verses?: { verseNumber: number; text: string }[];
  reference?: {
    bookId: number;
    chapterNumber: number;
    verseStart: number;
    verseEnd: number | null;
  };
  fallbackMessage?: string;
}

function localDate(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

export function buildDeepLink(ref?: VerseResponse["reference"]): string {
  if (!ref) return `${WEB_BASE_URL}/bible/1/1?src=widget`;
  let url = `${WEB_BASE_URL}/bible/${ref.bookId}/${ref.chapterNumber}?verseStart=${ref.verseStart}`;
  if (ref.verseEnd) url += `&verseEnd=${ref.verseEnd}`;
  return `${url}&src=widget`;
}

export async function fetchVerse(): Promise<{
  verseText: string;
  reference: string;
  deepLink: string;
}> {
  const apiBase = process.env.EXPO_PUBLIC_API_URL ?? "https://api.versemate.org";
  const version =
    (await AsyncStorage.getItem(BIBLE_VERSION_KEY)) ?? DEFAULT_VERSION;
  const pid = await AsyncStorage.getItem(USER_ID_KEY);

  try {
    let url = `${apiBase}/bible/verse-of-the-day?date=${localDate()}&bible_version=${version}`;
    if (pid) url += `&pid=${encodeURIComponent(pid)}`;
    const res = await fetch(url);
    const data = (await res.json()) as VerseResponse;
    if (data.empty || !data.verses?.length) {
      return {
        verseText: data.fallbackMessage ?? FALLBACK_MESSAGE,
        reference: "VerseMate",
        deepLink: buildDeepLink(data.reference),
      };
    }
    return {
      verseText: data.verses.map((v) => v.text).join(" "),
      reference: data.referenceText ?? "VerseMate",
      deepLink: buildDeepLink(data.reference),
    };
  } catch {
    return {
      verseText: FALLBACK_MESSAGE,
      reference: "VerseMate",
      deepLink: `${WEB_BASE_URL}/bible/1/1?src=widget`,
    };
  }
}

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  switch (props.widgetAction) {
    case "WIDGET_ADDED":
    case "WIDGET_UPDATE":
    case "WIDGET_RESIZED": {
      const { verseText, reference, deepLink } = await fetchVerse();
      props.renderWidget(
        <VerseOfTheDayWidget
          verseText={verseText}
          reference={reference}
          deepLink={deepLink}
        />
      );
      break;
    }
    case "WIDGET_CLICK": {
      if (props.clickAction === "OPEN_VERSE") {
        const url = props.clickActionData?.url;
        if (typeof url === "string") {
          Linking.openURL(url).catch(() => {
            /* no-op: launcher without deep-link support */
          });
        }
      }
      break;
    }
    default:
      break;
  }
}
