import { useQueries } from '@tanstack/react-query';
import { getBibleBookByBookIdByChapterNumberOptions } from '@/src/api/generated/@tanstack/react-query.gen';
import type { ParsedVerseRef } from '@/utils/names-of-god/parse-verse-ref';

export interface VerseTextResult {
  ref: ParsedVerseRef;
  text: string | null;
  isLoading: boolean;
  hasError: boolean;
}

/**
 * Fetches verse text for a page of parsed verse refs in the user's selected
 * Bible version. Deduplicates chapter fetches so one chapter is only fetched
 * once even if multiple verses from it appear on the page.
 */
export function useVerseTexts(refs: ParsedVerseRef[], bibleVersion: string): VerseTextResult[] {
  // Unique (bookId, chapter) pairs for this page
  const uniqueChapters = Array.from(
    new Map(refs.map((r) => [`${r.bookId}-${r.chapter}`, r])).values()
  ).map((r) => ({ bookId: r.bookId, chapter: r.chapter }));

  const results = useQueries({
    queries: uniqueChapters.map(({ bookId, chapter }) =>
      getBibleBookByBookIdByChapterNumberOptions({
        path: { bookId, chapterNumber: chapter },
        query: { versionKey: bibleVersion },
      })
    ),
  });

  // Build lookup: "bookId-chapter" → verse array
  const chapterVersesMap = new Map<string, { verseNumber: number; text: string }[]>();
  uniqueChapters.forEach(({ bookId, chapter }, i) => {
    const result = results[i];
    if (!result?.data) return;
    const book = (
      result.data as {
        book?: {
          chapters?: { chapterNumber: number; verses: { verseNumber: number; text: string }[] }[];
        };
      }
    ).book;
    const ch = book?.chapters?.find((c) => c.chapterNumber === chapter);
    if (ch) {
      chapterVersesMap.set(`${bookId}-${chapter}`, ch.verses);
    }
  });

  return refs.map((ref) => {
    const key = `${ref.bookId}-${ref.chapter}`;
    const idx = uniqueChapters.findIndex((c) => `${c.bookId}-${c.chapter}` === key);
    const queryResult = idx >= 0 ? results[idx] : undefined;
    const verses = chapterVersesMap.get(key);
    const verseData = verses?.find((v) => v.verseNumber === ref.verse);

    return {
      ref,
      text: verseData?.text ?? null,
      isLoading: queryResult?.isLoading ?? false,
      hasError: !!(queryResult?.isError && !verseData),
    };
  });
}
