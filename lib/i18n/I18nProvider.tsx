/**
 * I18nProvider — wires i18next into the React tree.
 *
 * Per spec feat-mobile-ui-i18n (D-016):
 * - Initialize i18next on mount with the resolved active locale
 * - Active locale priority:
 *   1. AsyncStorage `@versemate:preferred_language` (user's settings choice)
 *   2. Device locale via `expo-localization`
 *   3. 'en' fallback
 * - Subscribe to language changes triggered by settings (`notifyLanguageChanged`)
 *   so all `t()` consumers re-render
 *
 * Suspense disabled (sync resources today). Children render immediately even
 * before init completes — i18next's t() returns the key as a graceful fallback
 * during the brief init window.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import { type ReactNode, useEffect, useState } from 'react';
import { I18nextProvider } from 'react-i18next';

import { changeLanguage, FALLBACK_LANGUAGE, i18n, initI18n } from '.';

const PREFERRED_LANGUAGE_KEY = '@versemate:preferred_language';

async function resolveInitialLocale(): Promise<string> {
  // 1. AsyncStorage user preference
  try {
    const stored = await AsyncStorage.getItem(PREFERRED_LANGUAGE_KEY);
    if (stored) return stored;
  } catch {
    /* fall through */
  }

  // 2. Device locale
  try {
    const deviceCode = Localization.getLocales()[0]?.languageCode;
    if (deviceCode) return deviceCode;
  } catch {
    /* fall through */
  }

  // 3. Fallback
  return FALLBACK_LANGUAGE;
}

interface Props {
  children: ReactNode;
}

export function I18nProvider({ children }: Props) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const locale = await resolveInitialLocale();
      await initI18n(locale);
      if (active) setReady(true);
    })();
    return () => {
      active = false;
    };
  }, []);

  // Render children immediately even before init resolves — t() returns the key
  // as a sane fallback during the brief window. Avoids a blocking splash.
  if (!ready) {
    return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
  }

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}

/**
 * Programmatic locale switch (used by settings language picker).
 * Persists to AsyncStorage and updates i18next.
 */
export async function setActiveLocale(languageCode: string): Promise<void> {
  await AsyncStorage.setItem(PREFERRED_LANGUAGE_KEY, languageCode);
  await changeLanguage(languageCode);
}
