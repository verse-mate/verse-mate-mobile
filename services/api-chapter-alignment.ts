/**
 * API Chapter Alignment
 *
 * For non-English Bibles, the chapter endpoint serves Strong's-tagged tokens
 * directly (verse-mate#246's `?tagged=1` flag). This module fetches those
 * tokens and adapts them into the `ChapterAlignment` shape the bundled
 * `@versemate/lexicon` package emits for English, so `ChapterReader`'s
 * existing dotted-underline rendering pipeline keeps working unchanged.
 *
 * Why this shape:
 *   - English keeps using `loadAlignmentFor` from `@versemate/lexicon`
 *     (no network, pre-curated theme metadata, smaller payload).
 *   - Non-English calls the backend, runs the adapter, gets the same
 *     `ChapterAlignment` shape downstream. Zero changes to `HighlightedText`,
 *     verse rendering, tap handlers, or test mocks.
 *
 * The adapter produces stub `LexEntry` objects keyed by Strong's number —
 * just enough metadata to identify the tap target. `LexiconPopover` then
 * does a single `useLemma()` fetch on tap to populate the actual card,
 * which keeps per-chapter fetches to one (the chapter) instead of N+1.
 *
 * Lossless-join invariant from the backend means concatenating each
 * verse's `tokens[*].text` exactly reproduces `text`, so the adapter walks
 * the array and emits one `AlignedToken { surface }` per token that has a
 * Strong's number.
 */

import type { AlignedToken, ChapterAlignment, LemmaKey, LexEntry } from '@versemate/lexicon';

interface ApiVerseToken {
  text: string;
  strongs?: string;
  strongs_alt?: string[];
  confidence?: number;
}

interface ApiVerse {
  verseNumber: number;
  text: string;
  tokens?: ApiVerseToken[];
}

interface ApiChapter {
  chapterNumber: number;
  verses: ApiVerse[];
}

interface ApiBook {
  bookId: number;
  name: string;
  chapters: ApiChapter[];
}

export interface TaggedChapterResponse {
  book?: ApiBook;
  message?: string;
}

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://api.versemate.org';

/** Build the URL the chapter endpoint expects for tagged rendering. */
function taggedChapterUrl(bookId: number, chapterNumber: number, versionKey: string): string {
  const u = new URL(`/bible/book/${bookId}/${chapterNumber}`, API_URL);
  u.searchParams.set('bible_version', versionKey);
  u.searchParams.set('tagged', '1');
  return u.toString();
}

/**
 * Stable per-Strong's slug used as the `LemmaKey` in the synthesized
 * `ChapterAlignment.lexicon` map. Lowercased so it matches the casing the
 * bundled lexicon uses for its English keys.
 */
export function strongsLemmaKey(strongs: string): LemmaKey {
  return `strongs-${strongs.toLowerCase()}`;
}

/**
 * Convert the API's per-verse token arrays into the bundled
 * `ChapterAlignment` shape. Stub `LexEntry` carries just enough for the
 * renderer + popover to identify the tap target; `useLemma()` resolves the
 * full card on tap.
 *
 * A token without a `strongs` field is text-only joinery (spaces,
 * punctuation, untagged surface). Those don't become `AlignedToken`s —
 * they just appear in the verse text via the existing render path.
 */
export function adaptApiChapterToAlignment(
  response: TaggedChapterResponse,
  versionKey: string
): ChapterAlignment | null {
  const book = response.book;
  if (!book?.chapters?.length) return null;
  const chapter = book.chapters[0];
  if (!chapter) return null;

  const verses: Record<number, AlignedToken[]> = {};
  const lexicon: Record<LemmaKey, LexEntry> = {};

  for (const verse of chapter.verses ?? []) {
    if (!verse.tokens?.length) continue;
    const aligned: AlignedToken[] = [];
    for (const token of verse.tokens) {
      if (!token.strongs) continue;
      const key = strongsLemmaKey(token.strongs);
      aligned.push({ surface: token.text, lemma: key });
      if (!lexicon[key]) {
        // Stub — the popover overrides these on tap via useLemma(). We still
        // populate `strongs` and a placeholder `lemma`/`translit` so any
        // logic that reads them before the async fetch resolves doesn't
        // crash on undefined.
        lexicon[key] = {
          lemma: token.strongs,
          translit: '',
          strongs: token.strongs,
          pos: '',
          basicGloss: '',
        };
      }
    }
    if (aligned.length > 0) verses[verse.verseNumber] = aligned;
  }

  return {
    bookId: book.bookId,
    book: book.name,
    chapter: chapter.chapterNumber,
    version: versionKey,
    verses,
    lexicon,
  };
}

export async function fetchTaggedChapterAlignment(
  bookId: number,
  chapterNumber: number,
  versionKey: string,
  signal?: AbortSignal
): Promise<ChapterAlignment | null> {
  const response = await fetch(taggedChapterUrl(bookId, chapterNumber, versionKey), {
    method: 'GET',
    signal,
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(
      `Failed to fetch tagged chapter ${bookId}/${chapterNumber} (${versionKey}): HTTP ${response.status}`
    );
  }
  const body = (await response.json()) as TaggedChapterResponse;
  return adaptApiChapterToAlignment(body, versionKey);
}
