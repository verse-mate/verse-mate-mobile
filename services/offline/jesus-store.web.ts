/**
 * Web has no offline store (see sqlite-manager.web.ts), so every Jesus read
 * finds nothing locally and goes to the network exactly as before.
 */
export interface JesusLocalRow {
  payload: unknown;
  bibleVersion: string | null;
  updatedAt: string;
}

type QueryValue = string | number | boolean | undefined;

export function jesusContentLanguage(language: string | null | undefined): string {
  const base = (language ?? '').trim().toLowerCase().split(/[-_]/)[0];
  return base || 'en';
}

export function jesusCacheKey(
  path: string,
  query: Record<string, QueryValue> = {},
  language?: string | null
): string {
  const entries = Object.entries(query)
    .filter(([k, v]) => k !== 'bible_version' && v !== undefined && v !== '')
    .map(([k, v]) => [k, String(v)] as const)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const qs = new URLSearchParams(entries as [string, string][]).toString();
  return `${jesusContentLanguage(language)}:${qs ? `${path}?${qs}` : path}`;
}

export function parseStoredTime(value: string): number {
  return Date.parse(value.replace(/(\.\d{3})\d+/, '$1').replace(/\+00:00$/, 'Z'));
}

export function __TEST_ONLY_RESET_IMPORT(): void {}

export async function importJesusSeed(): Promise<void> {}
export async function getJesusLocal(_key: string): Promise<JesusLocalRow | null> {
  return null;
}
export async function putJesusLocal(
  _key: string,
  _payload: unknown,
  _bibleVersion: string | null
): Promise<void> {}
export async function reinjectPassages<T>(_detail: T, _bibleVersion: string): Promise<T | null> {
  return null;
}
