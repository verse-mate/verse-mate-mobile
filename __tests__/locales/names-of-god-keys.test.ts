/**
 * Locales — `names_of_god.*` keys (VER-148)
 *
 * Ensures every supported locale file contains all Names of God UI string
 * keys. A missing key here means that locale would show the raw key string
 * or the English fallback instead of a real translation.
 */

import de from '@/locales/de.json';
import en from '@/locales/en.json';
import es from '@/locales/es.json';
import fr from '@/locales/fr.json';
import pt from '@/locales/pt.json';

type LocaleCatalog = { names_of_god: Record<string, string> };

const LOCALES: Record<string, LocaleCatalog> = { en, es, fr, de, pt } as Record<
  string,
  LocaleCatalog
>;

// All keys that must exist in every locale.
const REQUIRED_KEYS: (keyof (typeof en)['names_of_god'])[] = [
  'title',
  'testament_ot',
  'testament_nt',
  'testament_both',
  'verses_count',
  'page_label',
  'previous_page',
  'next_page',
  'loading_verses',
  'verse_error',
  'error_name_not_found',
  'error_name_not_found_detail',
  'go_back',
  'language_hebrew',
  'language_greek',
  'language_aramaic',
  'language_english',
  'search_placeholder',
  'filter_all',
  'names_count',
  'no_results',
];

describe('names_of_god locale completeness', () => {
  for (const [code, catalog] of Object.entries(LOCALES)) {
    describe(`${code}.json`, () => {
      it('has a names_of_god section', () => {
        expect(catalog.names_of_god).toBeDefined();
        expect(typeof catalog.names_of_god).toBe('object');
      });

      for (const key of REQUIRED_KEYS) {
        it(`has key: names_of_god.${key}`, () => {
          expect(catalog.names_of_god[key as string]).toBeDefined();
          expect(typeof catalog.names_of_god[key as string]).toBe('string');
          expect(catalog.names_of_god[key as string].length).toBeGreaterThan(0);
        });
      }

      it('verses_count retains {{count}} placeholder', () => {
        expect(catalog.names_of_god.verses_count).toContain('{{count}}');
      });

      it('names_count retains {{count}} placeholder', () => {
        expect(catalog.names_of_god.names_count).toContain('{{count}}');
      });

      it('page_label retains {{current}} and {{total}} placeholders', () => {
        expect(catalog.names_of_god.page_label).toContain('{{current}}');
        expect(catalog.names_of_god.page_label).toContain('{{total}}');
      });
    });
  }
});
