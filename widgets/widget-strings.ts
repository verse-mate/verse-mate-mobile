/**
 * Localised chrome for the Verse-of-the-Day widget (GH-265 UX follow-up).
 *
 * The widget's *content* has always localised — the backend resolves the summary
 * language from the selected translation — but its frame did not: "VERSE OF THE
 * DAY", "WHY IT MATTERS", the read-more link and the fallback message were
 * English string literals. A Portuguese reader got a Portuguese verse in an
 * English shell, which is more jarring than an untranslated app.
 *
 * WHY NOT i18next. The app's i18n module (`lib/i18n`) pulls in `react-i18next`
 * and `expo-localization` and needs an async init. The widget runs in a HEADLESS
 * JS task with no React tree, where every extra import is a new way to throw
 * before anything renders — and a throw there paints the fallback tree, which
 * looks like "the verse never loads". This file reads the same statically
 * bundled catalogs directly instead: no init, no React, no async, no new
 * dependency. Four strings do not justify the blast radius.
 *
 * Kept in sync with `locales/*.json` by construction — the catalogs are the
 * source, this only selects from them.
 */
import de from '@/locales/de.json';
import en from '@/locales/en.json';
import es from '@/locales/es.json';
import fr from '@/locales/fr.json';
import pt from '@/locales/pt.json';

/** Same key the app's i18n resolver reads (`lib/i18n/index.ts`). */
export const LANGUAGE_KEY = '@versemate:preferred_language';

const CATALOGS = { en, es, fr, de, pt } as const;
type Catalog = keyof typeof CATALOGS;

export interface WidgetStrings {
  eyebrow: string;
  why: string;
  readNote: string;
  fallback: string;
}

const ENGLISH = en.widget as WidgetStrings;

/**
 * Resolve the widget's chrome for a stored language code.
 *
 * Accepts full locales ("pt-BR") and selects the catalog ("pt"), matching the
 * app's own behaviour. Anything unknown, absent, or malformed falls back to
 * English — including the case where the widget is placed before the app has
 * ever run and written the key, which is the same limitation that already
 * applies to the preferred translation and the personalization id.
 */
export function widgetStrings(languageCode: string | null): WidgetStrings {
  const base = (languageCode ?? '').trim().toLowerCase().split(/[-_]/)[0];
  const catalog = CATALOGS[base as Catalog];
  return (catalog?.widget as WidgetStrings | undefined) ?? ENGLISH;
}
