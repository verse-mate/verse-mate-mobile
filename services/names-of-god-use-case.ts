import { getAll } from '@/services/names-of-god-repository';
import type { LanguageFilter, NameOfGod } from '@/types/names-of-god';

export function getAllNames(): NameOfGod[] {
  return getAll();
}

/**
 * Case-insensitive substring search across English name, transliteration, and meaning.
 * All query tokens must match somewhere in those three fields.
 */
export function searchNames(query: string): NameOfGod[] {
  const trimmed = query.trim();
  if (!trimmed) return getAll();

  const tokens = trimmed.toLowerCase().split(/\s+/);

  return getAll().filter((entry) => {
    const haystack = `${entry.nameEn} ${entry.transliteration} ${entry.meaning}`.toLowerCase();
    return tokens.every((token) => haystack.includes(token));
  });
}

/** Filter by language. 'All' returns the full list. */
export function filterByCategory(category: LanguageFilter): NameOfGod[] {
  if (category === 'All') return getAll();
  return getAll().filter((entry) => entry.language === category);
}

export function getNameById(id: string): NameOfGod | null {
  return getAll().find((entry) => entry.id === id) ?? null;
}
