/**
 * Locales — `jesus.*` keys
 *
 * Every supported locale must carry every Jesus UI string. A missing key shows
 * the reader the raw key or an English fallback mid-sentence, which is worse
 * than an untranslated screen because it looks like a bug rather than a gap.
 */
import de from '@/locales/de.json';
import en from '@/locales/en.json';
import es from '@/locales/es.json';
import fr from '@/locales/fr.json';
import pt from '@/locales/pt.json';

const LOCALES = { en, es, fr, de, pt } as Record<
  string,
  { jesus?: Record<string, Record<string, string>> }
>;

/** Walk the English catalog so a new string is covered without editing this file. */
function flatten(tree: Record<string, Record<string, string>>): string[] {
  return Object.entries(tree).flatMap(([group, entries]) =>
    Object.keys(entries).map((key) => `${group}.${key}`)
  );
}

describe('locales — jesus.*', () => {
  const required = flatten(en.jesus as Record<string, Record<string, string>>);

  it('English defines the strings the screens ask for', () => {
    expect(required.length).toBeGreaterThan(0);
    expect(required).toContain('hub.title');
    expect(required).toContain('event.saysAboutHimself');
  });

  it.each(Object.keys(LOCALES))('%s has every jesus key', (code) => {
    const tree = LOCALES[code].jesus;
    expect(tree).toBeDefined();
    const missing = required.filter((path) => {
      const [group, key] = path.split('.');
      return typeof tree?.[group]?.[key] !== 'string' || tree[group][key] === '';
    });
    expect(missing).toEqual([]);
  });

  it.each(Object.keys(LOCALES).filter((c) => c !== 'en'))(
    '%s is actually translated, not copied from English',
    (code) => {
      const tree = LOCALES[code].jesus as Record<string, Record<string, string>>;
      const enTree = en.jesus as Record<string, Record<string, string>>;
      // Proper nouns legitimately match ("Jesus" in de, "Compare"/"Application"
      // share spelling in fr), so this asserts the catalog is not wholesale
      // English rather than that every single string differs.
      const identical = required.filter((path) => {
        const [g, k] = path.split('.');
        return tree[g][k] === enTree[g][k];
      });
      expect(identical.length).toBeLessThan(required.length / 2);
    }
  );

  it.each(Object.keys(LOCALES))('%s keeps every interpolation placeholder', (code) => {
    // A translation that drops `{{location}}` renders the label with the value
    // silently missing — no error, no fallback, just a half sentence. The
    // placeholders are part of the contract, so they are checked like keys.
    const tree = LOCALES[code].jesus as Record<string, Record<string, string>>;
    const enTree = en.jesus as Record<string, Record<string, string>>;
    const placeholders = (text: string) => (text.match(/\{\{(\w+)\}\}/g) ?? []).sort();

    const broken = required
      .map((path) => {
        const [g, k] = path.split('.');
        const expected = placeholders(enTree[g][k]);
        const actual = placeholders(tree[g][k]);
        return expected.join() === actual.join()
          ? null
          : `${path}: expected ${expected.join() || 'none'}, got ${actual.join() || 'none'}`;
      })
      .filter(Boolean);

    expect(broken).toEqual([]);
  });
});
