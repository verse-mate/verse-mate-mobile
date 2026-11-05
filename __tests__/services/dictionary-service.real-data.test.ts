/**
 * lookupWord against the dictionaries the app ships, for the words an audit of
 * NASB1995 found answered with the wrong entry. The unit tests mock every
 * source, so they could not see that an ordinary word reached a biblical
 * name's entry ("will" → Wall, "anew" → Anab, "so" → King So).
 *
 * Webster's is loaded through `import()` in the app, which Jest's module
 * system does not run; this serves the same shard files with require.
 */
import { lookupWord } from '@/services/dictionary-service';

jest.mock('@/services/webster-service', () => {
  const { normalizeWord } = jest.requireActual('@/services/word-mapping-service');
  const shards: Record<string, Record<string, { term: string; definition: string }>> = {};
  return {
    lookupWebster: async (word: string) => {
      const key = normalizeWord(word);
      const letter = key[0];
      if (!letter || letter < 'a' || letter > 'z') return null;
      shards[letter] ??= require(`@/assets/data/webster-${letter}.json`);
      return shards[letter][key] ?? null;
    },
  };
});

jest.mock('@/services/lexicon-service', () => ({
  lookup: async () => ({ found: false, entry: null }),
  isValidStrongsNumber: () => false,
}));

async function termFor(word: string) {
  const r = await lookupWord(word);
  return { source: r.source, term: (r.eastonEntry ?? r.websterEntry)?.term ?? null };
}

describe('lookupWord on the shipped dictionaries', () => {
  it.each([
    ['will', 'Wall'],
    ['soul', 'Saul'],
    ['holy', 'Hold'],
    ['servant', 'Serpent'],
    ['anew', 'Anab'],
    ['with', 'Witch'],
    ['before', 'Beor'],
  ])('"%s" is not answered with the name/entry %s', async (word, wrong) => {
    const { term } = await termFor(word);
    expect(term).not.toBeNull();
    expect(term).not.toBe(wrong);
  });

  it.each([
    ['so', 'So'],
    ['So', 'So'],
    ['on', 'On'],
    ['no', 'No'],
    ['a', 'A'],
  ])('"%s" gets the English word, not the biblical name', async (word) => {
    const r = await lookupWord(word);
    expect(r.source).toBe('webster');
  });

  it('lowercase "ram" is the animal; "Ram" is the man', async () => {
    expect((await lookupWord('ram')).source).toBe('webster');
    expect((await lookupWord('Ram')).source).toBe('easton');
  });

  it('a plural reaches its singular, not a near spelling ("sons" was Songs)', async () => {
    const { term } = await termFor('sons');
    expect(term?.toLowerCase()).toBe('son');
  });

  it.each([
    ['called', 'call'],
    ['commanded', 'command'],
    ['hoped', 'hope'],
    ['sinned', 'sin'],
    ['died', 'die'],
    ['eyes', 'eye'],
    ['cities', 'city'],
    ['brought', 'bring'],
    ['does', 'do'],
    ['sprouts', 'sprout'],
  ])('an inflected "%s" reaches %s', async (word, base) => {
    const r = await lookupWord(word);
    const entry = r.eastonEntry ?? r.websterEntry;
    expect(entry).toBeDefined();
    // Either the base's own entry, or a Webster's pointer to it followed through.
    expect(`${entry?.term}\n${entry?.definition}`.toLowerCase()).toContain(base);
  });

  it('a possessive reaches its noun', async () => {
    expect((await termFor('David’s')).term).toBe('David');
    expect((await termFor('king’s,')).term?.toLowerCase()).toBe('king');
  });

  it('follows a Webster’s inflection pointer ("swept" → Sweep)', async () => {
    const r = await lookupWord('swept');
    expect(r.websterEntry?.term.toLowerCase()).toBe('sweep');
    expect(r.websterEntry?.definition).toMatch(/^imp\. & p\. p\. of Sweep\./);
    expect(r.websterEntry?.definition).toMatch(/broom/);
  });

  it('still finds other spellings of a name', async () => {
    expect((await termFor('Zaccheus')).term).toMatch(/^Zacch/);
    expect((await termFor('Bathsheba')).term).toMatch(/Bath-?sheba/i);
    expect((await termFor('Jebusite')).term).toMatch(/Jebusites/);
    expect((await termFor('Pilate')).term).toMatch(/Pilate/);
  });

  it('does not swap one name for a different name', async () => {
    expect((await termFor('Ramah')).term).toMatch(/^Ramah?$/i);
    expect((await termFor('Herod')).term ?? '').not.toMatch(/^Harod$/i);
    expect((await termFor('Neco')).term ?? '').not.toMatch(/^Nebo$/i);
  });
});
