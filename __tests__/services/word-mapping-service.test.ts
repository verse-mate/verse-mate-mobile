import { getStrongsNumber, normalizeWord } from '@/services/word-mapping-service';

describe('normalizeWord', () => {
  it('lowercases and strips punctuation', () => {
    expect(normalizeWord('Jesus,')).toBe('jesus');
    expect(normalizeWord("Christ's")).toBe('christs');
  });

  // VER-43: KJV typography uses æ/Æ/œ/Œ ligatures (e.g., "Zacchæus"), which Unicode
  // does not treat as compatibility decompositions. Without explicit mapping, dictionary
  // keys like "zacchaeus" never matched and the lookup returned "no definition found".
  it('expands KJV ligatures so dictionary keys match (VER-43)', () => {
    expect(normalizeWord('Zacchæus')).toBe('zacchaeus');
    expect(normalizeWord('Cæsar')).toBe('caesar');
    expect(normalizeWord('Phœnicia')).toBe('phoenicia');
    expect(normalizeWord('Æneas')).toBe('aeneas');
    expect(normalizeWord('Judæa')).toBe('judaea');
    expect(normalizeWord('Galilæan')).toBe('galilaean');
  });

  it('strips combining diacritics', () => {
    expect(normalizeWord('résumé')).toBe('resume');
    expect(normalizeWord('naïve')).toBe('naive');
  });

  it('leaves plain ASCII words unchanged apart from case', () => {
    expect(normalizeWord('LOVE')).toBe('love');
    expect(normalizeWord('Heaven')).toBe('heaven');
  });
});

// VER-119: "Repent" in Jer 26:3 (OT) was resolving to G3340 (Greek metanoeo) instead
// of H5162 (Hebrew nacham) because the combined map always gave Greek precedence.
describe('getStrongsNumber testament context (VER-119)', () => {
  it('returns Hebrew H5162 for "Repent" in OT context', () => {
    expect(getStrongsNumber('Repent', 'OT')).toBe('H5162');
  });

  it('returns Greek G3340 for "repent" in NT context', () => {
    expect(getStrongsNumber('repent', 'NT')).toBe('G3340');
  });

  it('falls back to Greek when no testament provided (existing behaviour)', () => {
    expect(getStrongsNumber('repent')).toBe('G3340');
  });
});
