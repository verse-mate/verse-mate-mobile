/**
 * Locales — `jesus.*` keys
 *
 * Every supported locale must carry every Jesus UI string. A missing key shows
 * the reader the raw key or an English fallback mid-sentence, which is worse
 * than an untranslated screen because it looks like a bug rather than a gap.
 */
import fs from 'node:fs';
import path from 'node:path';
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

/**
 * Every `t('jesus.…')` / `t('navigation.…')` the source calls must exist in
 * English (as the key, or as its `_one`/`_other` plural forms).
 *
 * The checks above walk the keys English HAS, so a key the code uses but
 * English lacks was invisible to them: `jesus.event.reveals`,
 * `jesus.event.openVerse` and `jesus.event.noBylineForAccount` shipped
 * English-only in every language that way.
 */
describe('locales — keys the source uses', () => {
  const ROOT = path.resolve(__dirname, '../..');
  const DIRS = ['app', 'components', 'hooks', 'lib'];

  function sourceFiles(dir: string): string[] {
    const out: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) out.push(...sourceFiles(full));
      else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
    }
    return out;
  }

  function lookup(tree: unknown, key: string): unknown {
    return key
      .split('.')
      .reduce<unknown>(
        (node, part) =>
          node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined,
        tree
      );
  }

  const used = new Set<string>();
  for (const dir of DIRS) {
    for (const file of sourceFiles(path.join(ROOT, dir))) {
      const text = fs.readFileSync(file, 'utf8');
      for (const m of text.matchAll(/\bt\(\s*['"]((?:jesus|navigation)\.[A-Za-z0-9_.]+)['"]/g)) {
        used.add(m[1]);
      }
    }
  }

  it('finds the keys the screens use', () => {
    expect(used.size).toBeGreaterThan(20);
  });

  it.each(Object.keys(LOCALES))('%s defines every key the source uses', (code) => {
    const tree = LOCALES[code];
    const missing = [...used].filter(
      (key) =>
        typeof lookup(tree, key) !== 'string' &&
        typeof lookup(tree, `${key}_one`) !== 'string' &&
        typeof lookup(tree, `${key}_other`) !== 'string'
    );
    expect(missing).toEqual([]);
  });
});
