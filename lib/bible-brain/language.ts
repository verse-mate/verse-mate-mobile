/**
 * Bridges the app's Bible versions to Bible Brain's catalogue.
 *
 * The app tags each version with an ISO-639-1 `language_code` (`en`, `de`,
 * `ro`, sometimes regional like `en-US`). Bible Brain is keyed on ISO-639-3
 * (`eng`, `deu`, `ron`). Narration is offered for the language of the version
 * the user is *already reading* — there is no separate audio-language picker,
 * which is how YouVersion and Olive Tree behave and what keeps the choice
 * honest: you get the Bible you picked, read aloud.
 */

/** Only the languages the app actually ships Bible text for. */
const ISO1_TO_ISO3: Readonly<Record<string, string>> = {
  de: 'deu',
  en: 'eng',
  es: 'spa',
  fr: 'fra',
  hi: 'hin',
  it: 'ita',
  pt: 'por',
  ro: 'ron',
  ru: 'rus',
  tl: 'tgl',
  uk: 'ukr',
};

/**
 * ISO-639-3 code Bible Brain expects, from the app's language tag.
 * Regional tags are narrowed to their base language (`en-US` → `eng`) because
 * Bible Brain has no regional split at this level.
 */
export function bibleBrainLanguage(languageCode: string | undefined): string | null {
  if (!languageCode) return null;
  const base = languageCode.split('-')[0].toLowerCase();
  return ISO1_TO_ISO3[base] ?? null;
}

/**
 * Bible Brain abbreviations are the language prefix plus the version's own
 * abbreviation (`ENGESV`, `ENGKJV`, `RONDCV`). Stripping the prefix gives
 * something comparable to the app's `version_key`.
 */
export function stripLanguagePrefix(abbr: string): string {
  return abbr.length > 3 ? abbr.slice(3) : abbr;
}

/**
 * Does this Bible Brain version correspond to the translation being read?
 *
 * Deliberately fuzzy at the edges: the app says `KJV` and Bible Brain says
 * `ENGKJV`, but the app also says `NASB1995` where Bible Brain would say
 * `NASB`. Comparing on a normalised prefix catches both without pretending
 * `NKJV` and `KJV` are the same version — the check is anchored, not a
 * substring search, so `ENGNKJV` never matches `KJV`.
 */
export function isSameTranslation(bibleBrainAbbr: string, appVersionKey: string): boolean {
  const bb = stripLanguagePrefix(bibleBrainAbbr).replace(/[^A-Z0-9]/gi, '').toUpperCase();
  const app = appVersionKey.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  if (!bb || !app) return false;
  if (bb === app) return true;
  // One may carry a year or edition the other omits (NASB vs NASB1995).
  const shorter = bb.length < app.length ? bb : app;
  const longer = bb.length < app.length ? app : bb;
  if (shorter.length < 3) return false;
  return longer.startsWith(shorter) && /^\d*$/.test(longer.slice(shorter.length));
}
