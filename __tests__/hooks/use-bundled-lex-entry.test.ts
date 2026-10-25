import { renderHook, waitFor } from '@testing-library/react-native';
import type { LexEntry } from '@versemate/lexicon';
import { loadStrongsIndex } from '@versemate/lexicon';
import { useBundledLexEntry } from '@/hooks/use-bundled-lex-entry';
import type { LemmaCard } from '@/hooks/use-lemma';

jest.mock('@versemate/lexicon', () => ({
  loadStrongsIndex: jest.fn(),
}));

const mockLoadStrongsIndex = loadStrongsIndex as jest.MockedFunction<typeof loadStrongsIndex>;

const BUNDLED: LexEntry = {
  lemma: 'סוּס',
  translit: 'sus',
  strongs: 'H5483',
  pos: 'Noun (masc.)',
  basicGloss: 'horse',
};

// Outside the backend's `loaded` lemmas the card arrives with no text.
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

const TRANSLATED_CARD: LemmaCard = {
  ...BARE_CARD,
  loaded: true,
  pos: 'Sustantivo (masc.)',
  basic_gloss: 'caballo',
  semantic_range: ['caballo, sobre todo de guerra'],
  notes: 'En el mundo de Israel el caballo es sobre todo un arma de guerra.',
  language_code: 'es',
  is_translated: true,
};

beforeEach(() => {
  mockLoadStrongsIndex.mockReset();
  mockLoadStrongsIndex.mockResolvedValue({ H5483: BUNDLED });
});

describe('useBundledLexEntry', () => {
  it('never loads the lexicon for a translated card', () => {
    const { result } = renderHook(() => useBundledLexEntry('H5483', TRANSLATED_CARD, false));
    expect(mockLoadStrongsIndex).not.toHaveBeenCalled();
    expect(result.current).toEqual({ bundled: null, isPending: false });
  });

  it('waits for the card before deciding', () => {
    const { result } = renderHook(() => useBundledLexEntry('H5483', undefined, true));
    expect(mockLoadStrongsIndex).not.toHaveBeenCalled();
    expect(result.current.isPending).toBe(false);
  });

  it('loads the bundled entry for a card with no text', async () => {
    const { result } = renderHook(() => useBundledLexEntry('h5483', BARE_CARD, false));
    expect(result.current.isPending).toBe(true);
    await waitFor(() => expect(result.current.bundled).toBe(BUNDLED));
    expect(result.current.isPending).toBe(false);
    expect(mockLoadStrongsIndex).toHaveBeenCalledTimes(1);
  });

  it('loads the bundled entry when the request failed', async () => {
    const { result } = renderHook(() => useBundledLexEntry('H5483', undefined, false));
    await waitFor(() => expect(result.current.bundled).toBe(BUNDLED));
  });

  it('settles with no entry when the lexicon has none or fails to load', async () => {
    mockLoadStrongsIndex.mockRejectedValueOnce(new Error('import failed'));
    const { result } = renderHook(() => useBundledLexEntry('H5483', BARE_CARD, false));
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.bundled).toBeNull();
  });

  it('does nothing when the popover is not resolving an API card', () => {
    const { result } = renderHook(() => useBundledLexEntry(null, BARE_CARD, false));
    expect(mockLoadStrongsIndex).not.toHaveBeenCalled();
    expect(result.current).toEqual({ bundled: null, isPending: false });
  });
});
