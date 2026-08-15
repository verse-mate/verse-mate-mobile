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
import { VerseOfTheDayWidget, type WidgetSize } from "./VerseOfTheDayWidget";

const BIBLE_VERSION_KEY = "bible-version";
const DEFAULT_VERSION = "NASB1995";
// Personalization id (the logged-in user's own id) the app mirrors into
// AsyncStorage; sent as `pid` so the widget shows the user's personal verse
// (PD-7). Absent when logged out → the endpoint serves the global verse.
const USER_ID_KEY = "widget-user-id";
const FALLBACK_MESSAGE = "Open VerseMate to see today's verse";
/**
 * Last successfully fetched verse. The OS only runs the widget's update task
 * every few hours, so without this a single failed fetch (offline at boot, API
 * hiccup, a `date` the API rejects) left the widget showing FALLBACK_MESSAGE
 * until the next tick — the reported "sometimes it doesn't load any content".
 */
const VERSE_CACHE_KEY = "widget-verse-cache";

/**
 * Base for the tap deep link — the app's custom scheme (versemate://), NOT the
 * https App Link host.
 *
 * A home-screen widget always has the app installed, and the custom scheme
 * opens the native app directly. The https form (app.versemate.org) depends on
 * Android App Links / iOS Universal Links domain verification
 * (`.well-known/assetlinks.json` / `apple-app-site-association`); when that
 * isn't verified the OS falls back to the browser — which is exactly what
 * happened (the widget tap opened the web app). The triple slash yields an
 * empty authority so the path is `/bible/...` — the shape parseChapterShareUrl
 * (utils/sharing/generate-chapter-share-url.ts) parses; it accepts the
 * `versemate:` scheme alongside the web host.
 */
const DEEP_LINK_BASE = "versemate:///bible";

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
  versionKey?: string;
  /**
   * Short "why it matters" summary for the expanded widget (design: ≤220 chars).
   * NOT served by /bible/verse-of-the-day yet — the field is read optionally so
   * the note panel lights up the day the API starts returning it, and the
   * expanded size falls back to a verse-only composition until then.
   */
  explanation?: string | null;
}

/**
 * Insight tab the note block opens. `summary` is the reader's short overview
 * tab — the in-app counterpart of the widget's "Why it matters" panel.
 */
const NOTE_TAB = "summary";

/** Provider that paints the 4×4 "verse + why it matters" composition. */
const NOTE_WIDGET_NAME = "VerseOfTheDayNote";

/**
 * Which composition to paint, from the widget's provider name (app.config.js).
 *
 * Deliberately NOT derived from `widgetInfo.height`: in portrait the library
 * reports OPTION_APPWIDGET_MAX_HEIGHT — the provider's maximum resize bound, not
 * the widget's current height — so a 4×2 and a 4×4 both report 358dp on the
 * Pixel launcher (measured on an API 35 emulator, confirmed against the
 * launcher's own `getMinMaxSizes: Rect(360, 210 - 676, 358)`). Thresholding that
 * value silently painted the expanded layout inside a 4×2 cell. The name is the
 * one signal that actually distinguishes them.
 */
export function pickWidgetSize(widgetName: string): WidgetSize {
  return widgetName === NOTE_WIDGET_NAME ? "expanded" : "compact";
}

function localDate(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

/**
 * Build the widget's tap deep link. Pass `tab` for the note block's zone so the
 * reader opens on that insight tab (design 2B: two tap zones, one per block).
 */
export function buildDeepLink(ref?: VerseResponse["reference"], tab?: string): string {
  const suffix = tab ? `&src=widget&tab=${tab}` : "&src=widget";
  if (!ref) return `${DEEP_LINK_BASE}/1/1?src=widget${tab ? `&tab=${tab}` : ""}`;
  let url = `${DEEP_LINK_BASE}/${ref.bookId}/${ref.chapterNumber}?verseStart=${ref.verseStart}`;
  if (ref.verseEnd) url += `&verseEnd=${ref.verseEnd}`;
  return `${url}${suffix}`;
}

export interface WidgetVerseData {
  /** Per-verse data; null when the pool is empty or the fetch failed. */
  verses: { verseNumber: number; text: string }[] | null;
  /** Rendered reference (e.g. "Genesis 1:1-2"); empty in the fallback state. */
  reference: string;
  deepLink: string;
  /** Message rendered when `verses` is null. */
  fallbackText: string;
  /** Same target as `deepLink`, but opens the reader's insight tab. */
  noteDeepLink: string;
  /** Translation label for the expanded header; empty when unknown. */
  versionLabel: string;
  /** "Why it matters" summary; null until the API serves one. */
  explanation: string | null;
}

interface VerseCache {
  /** Local date the verse was fetched for, `YYYY-MM-DD`. */
  date: string;
  data: WidgetVerseData;
}

/** Cached verse, or null when absent, unreadable, or older than yesterday. */
async function readCache(): Promise<VerseCache | null> {
  try {
    const raw = await AsyncStorage.getItem(VERSE_CACHE_KEY);
    if (!raw) return null;
    const cache = JSON.parse(raw) as VerseCache;
    // Same window the API itself serves ("date must be today or yesterday"),
    // so a device that has been offline for days shows the honest "open the
    // app" state rather than a stale verse under a "VERSE OF THE DAY" header.
    const ageDays = (Date.parse(localDate()) - Date.parse(cache.date)) / 86_400_000;
    return ageDays >= 0 && ageDays <= 1 ? cache : null;
  } catch {
    return null;
  }
}

async function writeCache(date: string, data: WidgetVerseData): Promise<void> {
  try {
    await AsyncStorage.setItem(VERSE_CACHE_KEY, JSON.stringify({ date, data }));
  } catch {
    // Best-effort: a failed cache write must never fail the render.
  }
}

export async function fetchVerse(): Promise<WidgetVerseData> {
  const apiBase = process.env.EXPO_PUBLIC_API_URL ?? "https://api.versemate.org";

  try {
    // Read inside the try: in the headless widget task AsyncStorage can throw
    // if its native module isn't ready yet. A throw here must fall through to
    // the rendered fallback below — never bubble out of fetchVerse, which would
    // skip the widget render and leave a blank (transparent) widget.
    const today = localDate();
    const version =
      (await AsyncStorage.getItem(BIBLE_VERSION_KEY)) ?? DEFAULT_VERSION;
    const pid = await AsyncStorage.getItem(USER_ID_KEY);
    let url = `${apiBase}/bible/verse-of-the-day?date=${today}&bible_version=${version}`;
    if (pid) url += `&pid=${encodeURIComponent(pid)}`;
    const res = await fetch(url);
    const data = (await res.json()) as VerseResponse;
    if (data.empty || !data.verses?.length) {
      // Covers a genuinely empty pool AND every error shape (e.g. the API's
      // `invalid_date` when the device's local date runs ahead of the server's).
      // Yesterday's verse beats an empty widget; the message is the last resort.
      return (
        (await readCache())?.data ?? {
          ...emptyState(data.fallbackMessage ?? FALLBACK_MESSAGE),
          deepLink: buildDeepLink(data.reference),
          noteDeepLink: buildDeepLink(data.reference, NOTE_TAB),
        }
      );
    }
    const verse: WidgetVerseData = {
      verses: data.verses,
      reference: data.referenceText ?? "",
      deepLink: buildDeepLink(data.reference),
      noteDeepLink: buildDeepLink(data.reference, NOTE_TAB),
      fallbackText: FALLBACK_MESSAGE,
      versionLabel: data.versionKey ?? "",
      explanation: data.explanation ?? null,
    };
    await writeCache(today, verse);
    return verse;
  } catch {
    return (await readCache())?.data ?? emptyState(FALLBACK_MESSAGE);
  }
}

/** Verse-less state: a tap-to-open fallback pointing at Genesis 1. */
function emptyState(fallbackText: string): WidgetVerseData {
  return {
    verses: null,
    reference: "",
    deepLink: `${DEEP_LINK_BASE}/1/1?src=widget`,
    noteDeepLink: `${DEEP_LINK_BASE}/1/1?src=widget`,
    fallbackText,
    versionLabel: "",
    explanation: null,
  };
}

/** Both providers the app registers (app.config.js `react-native-android-widget`). */
const WIDGET_NAMES = ["VerseOfTheDay", NOTE_WIDGET_NAME];

/**
 * Repaint every placed widget from the app process. Called on foreground so the
 * fallback's own instruction — "Open VerseMate to see today's verse" — is true:
 * the OS runs the widget's own update task only every few hours, so a widget
 * left empty by a failed fetch had no way to recover on demand.
 *
 * No-ops once today's verse is already cached (so a normal launch costs one
 * AsyncStorage read, not a network call) and when no widget is on the home
 * screen. Best-effort throughout — never let a widget failure surface in the app.
 */
export async function refreshWidgets(): Promise<void> {
  try {
    if ((await readCache())?.date === localDate()) return;

    const { getWidgetInfo, requestWidgetUpdate } = await import(
      "react-native-android-widget"
    );
    const placed = await Promise.all(WIDGET_NAMES.map((name) => getWidgetInfo(name)));
    if (placed.every((widgets) => widgets.length === 0)) return;

    const data = await fetchVerse();
    await Promise.all(
      WIDGET_NAMES.map((widgetName) =>
        requestWidgetUpdate({
          widgetName,
          renderWidget: (info) => {
            const size = pickWidgetSize(info.widgetName);
            return {
              light: <VerseOfTheDayWidget {...data} size={size} theme="light" />,
              dark: <VerseOfTheDayWidget {...data} size={size} theme="dark" />,
            };
          },
        }),
      ),
    );
  } catch {
    // Best-effort: widget module unavailable, no widgets placed, or draw failed.
  }
}

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  switch (props.widgetAction) {
    case "WIDGET_ADDED":
    case "WIDGET_UPDATE":
    case "WIDGET_RESIZED": {
      // Always render *something* — a blank/transparent widget is the worst
      // outcome. fetchVerse no longer rejects, but guard the whole render so
      // any unexpected failure still paints a tap-to-open fallback. Render a
      // light + dark variant so the widget matches the launcher's theme.
      // Which provider was placed picks the composition (design 2B: 4×2 vs 4×4).
      const size = pickWidgetSize(props.widgetInfo.widgetName);
      try {
        const data = await fetchVerse();
        props.renderWidget({
          light: <VerseOfTheDayWidget {...data} size={size} theme="light" />,
          dark: <VerseOfTheDayWidget {...data} size={size} theme="dark" />,
        });
      } catch {
        const fallback = emptyState(FALLBACK_MESSAGE);
        props.renderWidget({
          light: <VerseOfTheDayWidget {...fallback} size={size} theme="light" />,
          dark: <VerseOfTheDayWidget {...fallback} size={size} theme="dark" />,
        });
      }
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
