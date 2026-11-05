import { normalizeWord } from '@/services/word-mapping-service';

describe('normalizeWord', () => {
  it('lowercases and strips punctuation', () => {
    expect(normalizeWord('Jesus,')).toBe('jesus');
  });

  // A possessive looks up its noun. NASB writes the curly ’, which used to survive
  // normalization, so "Lord’s" and "king’s" found no definition at all.
  it('reduces possessives to their noun', () => {
    expect(normalizeWord("Christ's")).toBe('christ');
    expect(normalizeWord('Lord’s')).toBe('lord');
    expect(normalizeWord('David’s,')).toBe('david');
    expect(normalizeWord('fathers’')).toBe('fathers');
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
