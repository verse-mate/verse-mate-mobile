/**
 * Bible Versions
 *
 * Available Bible translations/versions exposed in the in-app picker.
 * Keys match `bible_versions.version_key` on the backend (the same keys
 * `GET /bible/versions` returns); see `verse-mate-web/src/constants/
 * bible-versions.ts` for the canonical list shared with web. Open-licensed
 * versions are sourced via `scripts/bible-ingest` from eBible.org and seeded
 * into prod alongside the API endpoint.
 *
 * Notes:
 * - `language` is the bare ISO 639 code the chapter endpoint expects (en,
 *   de, fr, …) — not the explanation BCP-47 (en-US, es-MX) used by the
 *   commentary endpoint. The two are kept distinct on purpose.
 * - Non-English versions get Strong's-tagged tap-to-meaning popovers via
 *   the backend (`?tagged=1` + `GET /lemma/:strongs?lang=`); English uses
 *   the bundled `@versemate/lexicon` package as before.
 */

export interface BibleVersion {
  key: string;
  value: string;
  language: string;
}

export const bibleVersions: BibleVersion[] = [
  {
    key: 'NASB1995',
    value: 'New American Standard Bible 1995 (NASB1995)',
    language: 'en',
  },
  { key: 'KJV', value: 'King James (Authorized) Version (KJV)', language: 'en' },
  { key: 'SCH51', value: 'Schlachter-Bibel 1951 (SCH51)', language: 'de' },
  { key: 'LSG', value: 'Louis Segond 1910 (LSG)', language: 'fr' },
  { key: 'TGLULB', value: 'Banal na Bibliya (TGLULB)', language: 'tl' },
  { key: 'HCV', value: 'हिंदी समकालीन संस्करण (HCV)', language: 'hi' },
  { key: 'BLIV', value: 'Bíblia Livre (BLIV)', language: 'pt' },
  { key: 'RIV', value: 'Riveduta 1927 (RIV)', language: 'it' },
  { key: 'SYN', value: 'Синодальный перевод (SYN)', language: 'ru' },
  { key: 'RVR09', value: 'Reina-Valera 1909 (RVR09)', language: 'es' },
  { key: 'VDC', value: 'Biblia Cornilescu 1924 (VDC)', language: 'ro' },
  // Ukrainian: full Bible (NT + OT, 1903 Kulish/Puluj/Nechuy-Levytskyi).
  { key: 'UKRKL', value: 'Переклад Куліша (UKRKL)', language: 'uk' },
];

// English-language labels for the version-picker's group headers. Matches
// `verse-mate-web/src/constants/bible-versions.ts` — mobile mirrors web's
// language-grouped picker exactly so the two surfaces stay in sync. Falls
// back to Intl.DisplayNames (then the raw code) for any code not listed.
const LANGUAGE_LABELS: Record<string, string> = {
  en: 'English',
  de: 'German',
  fr: 'French',
  tl: 'Tagalog',
  hi: 'Hindi',
  pt: 'Portuguese',
  it: 'Italian',
  ru: 'Russian',
  es: 'Spanish',
  ro: 'Romanian',
  uk: 'Ukrainian',
};

export function languageLabel(code: string): string {
  if (LANGUAGE_LABELS[code]) return LANGUAGE_LABELS[code];
  try {
    const dn = new Intl.DisplayNames(['en'], { type: 'language' });
    return dn.of(code) || code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
}

/**
 * Group versions by language with stable ordering — English first (matches
 * the user's likely default), then alphabetical by English language name.
 * Same posture as web.
 */
export function bibleVersionGroups(): {
  code: string;
  label: string;
  versions: BibleVersion[];
}[] {
  const byLang = new Map<string, BibleVersion[]>();
  for (const v of bibleVersions) {
    const list = byLang.get(v.language) ?? [];
    list.push(v);
    byLang.set(v.language, list);
  }
  return [...byLang.entries()]
    .sort(([a], [b]) => {
      if (a === 'en') return -1;
      if (b === 'en') return 1;
      return languageLabel(a).localeCompare(languageLabel(b));
    })
    .map(([code, versions]) => ({
      code,
      label: languageLabel(code),
      versions,
    }));
}
