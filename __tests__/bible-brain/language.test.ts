/**
 * The bridge between the app's Bible catalogue (ISO-639-1, sometimes
 * regional) and Bible Brain's (ISO-639-3), plus the "is this the same
 * translation" test that decides the default voice.
 */
import {
  bibleBrainLanguage,
  isSameTranslation,
  stripLanguagePrefix,
} from '@/lib/bible-brain/language';

describe('bibleBrainLanguage', () => {
  it('maps every language the app ships Bible text for', () => {
    // Mirrors GET /bible/versions in production.
    expect(bibleBrainLanguage('en')).toBe('eng');
    expect(bibleBrainLanguage('de')).toBe('deu');
    expect(bibleBrainLanguage('es')).toBe('spa');
    expect(bibleBrainLanguage('fr')).toBe('fra');
    expect(bibleBrainLanguage('hi')).toBe('hin');
    expect(bibleBrainLanguage('it')).toBe('ita');
    expect(bibleBrainLanguage('pt')).toBe('por');
    expect(bibleBrainLanguage('ro')).toBe('ron');
    expect(bibleBrainLanguage('ru')).toBe('rus');
    expect(bibleBrainLanguage('tl')).toBe('tgl');
    expect(bibleBrainLanguage('uk')).toBe('ukr');
  });

  it('narrows a regional tag to its base language', () => {
    // NASB1995 is tagged en-US; Bible Brain has no regional split.
    expect(bibleBrainLanguage('en-US')).toBe('eng');
    expect(bibleBrainLanguage('pt-BR')).toBe('por');
  });

  it('is case-insensitive', () => {
    expect(bibleBrainLanguage('EN')).toBe('eng');
  });

  it('is null for an unknown or missing language', () => {
    expect(bibleBrainLanguage('xx')).toBeNull();
    expect(bibleBrainLanguage(undefined)).toBeNull();
    expect(bibleBrainLanguage('')).toBeNull();
  });
});

describe('stripLanguagePrefix', () => {
  it('drops the three-letter language prefix', () => {
    expect(stripLanguagePrefix('ENGESV')).toBe('ESV');
    expect(stripLanguagePrefix('RONDCV')).toBe('DCV');
  });

  it('leaves a short abbreviation alone', () => {
    expect(stripLanguagePrefix('KJV')).toBe('KJV');
  });
});

describe('isSameTranslation', () => {
  it('matches the app version key against the prefixed Bible Brain abbr', () => {
    expect(isSameTranslation('ENGKJV', 'KJV')).toBe(true);
    expect(isSameTranslation('ENGESV', 'ESV')).toBe(true);
  });

  it('tolerates an edition year on one side only', () => {
    // The app says NASB1995; Bible Brain would say NASB.
    expect(isSameTranslation('ENGNAS', 'NAS')).toBe(true);
    expect(isSameTranslation('ENGNASB', 'NASB1995')).toBe(true);
  });

  it('does NOT confuse NKJV with KJV', () => {
    // The whole reason the check is anchored rather than a substring search.
    expect(isSameTranslation('ENGNKJV', 'KJV')).toBe(false);
    expect(isSameTranslation('ENGKJV', 'NKJV')).toBe(false);
  });

  it('does not match on a one or two letter stub', () => {
    expect(isSameTranslation('ENGESV', 'ES')).toBe(false);
  });

  it('is false for empty input', () => {
    expect(isSameTranslation('ENG', '')).toBe(false);
  });
});
