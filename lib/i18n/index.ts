/**
 * i18n Initialization
 *
 * Per spec feat-mobile-ui-i18n (D-016): mobile UI strings externalized via
 * i18next + react-i18next. Locale resolved per priority:
 *   1. AsyncStorage `@versemate:preferred_language` (user's settings choice)
 *   2. Authenticated user's `preferred_language`
 *   3. Device locale via `expo-localization`
 *   4. Fallback: 'en'
 *
 * Supported locales: en, es, fr, de, pt. All catalogs bundled statically.
 */

import * as Localization from 'expo-localization';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

import de from '../../locales/de.json';
import en from '../../locales/en.json';
import es from '../../locales/es.json';
import fr from '../../locales/fr.json';
import pt from '../../locales/pt.json';

export const FALLBACK_LANGUAGE = 'en';

/** Maps the device locale (e.g. "pt-BR") to a catalog key (e.g. "pt"). */
function detectInitialLanguage(): string {
  try {
    const deviceLocale = Localization.getLocales()[0]?.languageCode;
    if (deviceLocale) return deviceLocale;
  } catch {
    /* fall through */
  }
  return FALLBACK_LANGUAGE;
}

let initialized = false;

export async function initI18n(initialLanguage?: string): Promise<typeof i18next> {
  if (initialized) return i18next;

  await i18next.use(initReactI18next).init({
    resources: {
      en: { translation: en },
      es: { translation: es },
      fr: { translation: fr },
      de: { translation: de },
      pt: { translation: pt },
    },
    lng: initialLanguage ?? detectInitialLanguage(),
    fallbackLng: FALLBACK_LANGUAGE,
    interpolation: {
      escapeValue: false, // React already escapes
    },
    react: {
      // Allow nested elements in <Trans> (no <Suspense> needed for sync resources)
      useSuspense: false,
    },
    returnNull: false,
    returnEmptyString: false,
  });

  initialized = true;
  return i18next;
}

/** Programmatically change the active language at runtime. */
export async function changeLanguage(languageCode: string): Promise<void> {
  if (!initialized) await initI18n(languageCode);
  await i18next.changeLanguage(languageCode);
}

export { default as i18n } from 'i18next';
