import type { LexEntry } from '@versemate/lexicon';
import type { LemmaCard } from '@/hooks/use-lemma';
import { canonicalStrongs, cardLacksText, mergeLemmaCard } from '@/lib/lexicon/lemma-card';

const STUB: LexEntry = {
  lemma: 'H5483',
  translit: '',
  strongs: 'H5483',
  pos: '',
  basicGloss: '',
};

const BUNDLED: LexEntry = {
  lemma: 'סוּס',
  translit: 'sus',
  strongs: 'H5483',
  pos: 'Noun (masc.)',
  basicGloss: 'horse',
  semanticRange: ['horse, esp. war or chariot horse'],
  notes: "In Israel's world the horse is mainly a weapon of war.",
  related: [{ lemma: 'רֶכֶב', translit: 'rekhev', note: 'chariotry' }],
};

// Outside the ~2,200 `loaded` lemmas the backend stores no prose in any
// language, so the card arrives bare.
const BARE_CARD: LemmaCard = {
  strongs: 'H5483',
  lemma: 'סוּס',
  translit: 'sus',
  pronunciation: null,
  nt_frequency: null,
  ot_frequency: 140,
  loaded: false,
  pos: null,
  basic_gloss: null,
  semantic_range: null,
  notes: null,
  related: null,
  language_code: 'en',
  source: null,
  is_translated: false,
};

describe('mergeLemmaCard', () => {
  it('defaults a word with no backend text to the bundled English definition', () => {
    const entry = mergeLemmaCard(BARE_CARD, BUNDLED, STUB);
    expect(entry.basicGloss).toBe('horse');
    expect(entry.pos).toBe('Noun (masc.)');
    expect(entry.semanticRange).toEqual(['horse, esp. war or chariot horse']);
    expect(entry.notes).toContain('weapon of war');
    expect(entry.related?.[0].lemma).toBe('רֶכֶב');
    expect(entry.otFrequency).toBe(140);
  });

  it('prefers the translated card wherever it has text', () => {
    const translated: LemmaCard = {
      ...BARE_CARD,
      pos: 'Sustantivo (masc.)',
      basic_gloss: 'caballo',
      semantic_range: ['caballo, sobre todo de guerra'],
      notes: 'En el mundo de Israel el caballo es sobre todo un arma de guerra.',
      related: [{ translit: 'rekhev', note: 'carros de guerra' }],
      language_code: 'es',
      is_translated: true,
    };
    const entry = mergeLemmaCard(translated, BUNDLED, STUB);
    expect(entry.basicGloss).toBe('caballo');
    expect(entry.pos).toBe('Sustantivo (masc.)');
    expect(entry.notes).toContain('arma de guerra');
    // Original script restored from the bundled entry by position.
    expect(entry.related).toEqual([{ lemma: 'רֶכֶב', translit: 'rekhev', note: 'carros de guerra' }]);
  });

  it('falls back to the stub when the bundled lexicon has no entry', () => {
    const entry = mergeLemmaCard(
      { ...BARE_CARD, related: [{ translit: 'rekhev', note: 'chariotry' }] },
      null,
      STUB
    );
    expect(entry.basicGloss).toBe('');
    expect(entry.lemma).toBe('סוּס');
    expect(entry.related?.[0].lemma).toBe('rekhev');
  });
});

describe('cardLacksText', () => {
  const FULL: LemmaCard = {
    ...BARE_CARD,
    pos: 'Sustantivo (masc.)',
    basic_gloss: 'caballo',
    semantic_range: ['caballo'],
    notes: 'Un arma de guerra.',
  };

  it('is false when the card has every prose field', () => {
    expect(cardLacksText(FULL)).toBe(false);
  });

  it('is true when the card is bare or missing any prose field', () => {
    expect(cardLacksText(BARE_CARD)).toBe(true);
    expect(cardLacksText({ ...FULL, basic_gloss: null })).toBe(true);
    expect(cardLacksText({ ...FULL, pos: '' })).toBe(true);
    expect(cardLacksText({ ...FULL, semantic_range: [] })).toBe(true);
    expect(cardLacksText({ ...FULL, notes: null })).toBe(true);
  });
});

describe('canonicalStrongs', () => {
  it('pads and upper-cases to the loadStrongsIndex key', () => {
    expect(canonicalStrongs('g80')).toBe('G0080');
    expect(canonicalStrongs('H5483')).toBe('H5483');
    expect(canonicalStrongs('H0430G')).toBe('H0430');
    expect(canonicalStrongs('x')).toBeNull();
  });
});
