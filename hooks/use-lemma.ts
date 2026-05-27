/**
 * useLemma Hook
 *
 * Fetches a Strong's-keyed lemma card from the backend `GET /lemma/:strongs`
 * endpoint and caches it via React Query. Per the deployed contract:
 *
 *   - English baseline lives on the `lemmas` row; non-English overrides on
 *     `lemma_translations`. The endpoint LEFT-JOINs and falls back to English
 *     field-by-field, so the returned card always renders.
 *   - The endpoint canonicalizes the strongs path param (`g80` → `G0080`)
 *     and normalizes `lang` (`es-MX` → `es`) server-side, so callers can
 *     pass whatever the picker/locale gave them.
 *
 * This hook is the data source for the lemma popover when the user is
 * reading a non-English Bible. For English, the bundled `@versemate/lexicon`
 * package keeps serving the popover (no network, smaller payload, parity
 * with web). The two paths are intentionally separate.
 *
 * Cache key includes the requested language so switching language refetches
 * instead of serving stale-language data.
 *
 * @see verse-mate#248 (endpoint) and verse-mate#249 (lang normalization).
 */

import { useQuery } from '@tanstack/react-query';

export interface RelatedWord {
  translit: string;
  note: string;
}

/**
 * One lemma card returned by the API. Field shapes mirror the typebox schema
 * in `packages/backend-base/src/lemmas/lemma.plugin.ts:LemmaCardSchema`.
 */
export interface LemmaCard {
  strongs: string;
  lemma: string;
  translit: string | null;
  pronunciation: string | null;
  nt_frequency: number | null;
  ot_frequency: number | null;
  loaded: boolean;
  pos: string | null;
  basic_gloss: string | null;
  semantic_range: string[] | null;
  notes: string | null;
  related: RelatedWord[] | null;
  /**
   * Language actually represented by the payload. Equals the requested
   * (normalized) language whenever a translation row exists — even a
   * partial one — else "en" (baseline fallback).
   */
  language_code: string;
  /**
   * Origin tag: "llm:claude-haiku-4-5", "uw" (unfoldingWord), "hand", or
   * null when there's no translation row.
   */
  source: string | null;
  /**
   * True only when the card reads as fully translated — every English
   * prose field present on the baseline has a non-null translation. A
   * row that translates only some fields stays false, so the
   * "Translated" badge never claims a half-English card.
   */
  is_translated: boolean;
}

interface ApiErrorBody {
  error?: string;
  message?: string;
}

export class LemmaNotFoundError extends Error {
  constructor(strongs: string) {
    super(`Lemma not found: ${strongs}`);
    this.name = 'LemmaNotFoundError';
  }
}

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://api.versemate.org';

async function fetchLemma(strongs: string, lang: string | undefined): Promise<LemmaCard> {
  const url = new URL(`/lemma/${encodeURIComponent(strongs)}`, API_URL);
  if (lang) url.searchParams.set('lang', lang);

  const response = await fetch(url.toString(), { method: 'GET' });

  if (response.status === 404) {
    // Distinguish "lemma doesn't exist in DB" from generic errors so the UI
    // can degrade silently (no popover) instead of surfacing a hard error.
    throw new LemmaNotFoundError(strongs);
  }
  if (!response.ok) {
    let detail = '';
    try {
      const body = (await response.json()) as ApiErrorBody;
      detail = body.message ?? body.error ?? '';
    } catch {
      // Body not JSON — fall through with status only.
    }
    throw new Error(
      `Failed to fetch lemma ${strongs}: HTTP ${response.status}${detail ? ` (${detail})` : ''}`
    );
  }
  return (await response.json()) as LemmaCard;
}

/**
 * Fetch a lemma card. Disabled when `strongs` is falsy so callers can hold
 * the hook stable across renders and gate enabling on UI state (e.g. a
 * popover only opens once a word is tapped).
 */
export function useLemma(
  strongs: string | null | undefined,
  lang: string | undefined,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: ['lemma', strongs, lang ?? null],
    queryFn: () => fetchLemma(strongs as string, lang),
    enabled: (options?.enabled ?? true) && Boolean(strongs),
    // Lemma cards are immutable within a session — heavy cache, no refetch.
    staleTime: Number.POSITIVE_INFINITY,
    // Don't retry a 404 (the lemma genuinely doesn't exist) — but do retry
    // transient network/5xx errors a couple of times.
    retry: (failureCount, error) => {
      if (error instanceof LemmaNotFoundError) return false;
      return failureCount < 2;
    },
  });
}
