/**
 * useChapterAlignment Hook
 *
 * Resolves the per-chapter `ChapterAlignment` that `ChapterReader` uses to
 * decorate verse text with dotted underlines + tap-to-meaning popovers.
 *
 *   - English (NASB1995, KJV, …): use the bundled `@versemate/lexicon`
 *     package's `loadAlignmentFor`. No network, pre-curated, exactly the
 *     behavior the app has shipped since the lexicon landed.
 *
 *   - Non-English: fetch `?tagged=1` against the chapter endpoint and adapt
 *     API tokens to the same `ChapterAlignment` shape. The lossless-join
 *     guarantee on the backend means the surface strings line up byte-for-
 *     byte with the verse text the user sees.
 *
 *   - Offline + non-English: skip the fetch entirely and return null
 *     (graceful degradation — text still renders from SQLite as today, just
 *     no underlines). Extending the offline cache to store tokens is a
 *     separate, larger project; this matches the user-visible behavior the
 *     app already exhibits when a chapter has no English alignment authored.
 *
 * Returns `null` while loading or when no alignment is available. The
 * `ChapterReader`'s existing null-check on alignment handles both cases.
 */

import { type ChapterAlignment, loadAlignmentFor } from '@versemate/lexicon';
import { useEffect, useState } from 'react';
import { useOfflineContext } from '@/contexts/OfflineContext';
import { fetchTaggedChapterAlignment } from '@/services/api-chapter-alignment';

const ENGLISH_VERSION_KEYS = new Set(['NASB1995', 'KJV']);

export function isEnglishVersion(versionKey: string | null | undefined): boolean {
  if (!versionKey) return true;
  return ENGLISH_VERSION_KEYS.has(versionKey);
}

export function useChapterAlignment(
  bookId: number,
  chapterNumber: number,
  versionKey: string | undefined
): ChapterAlignment | null {
  const [alignment, setAlignment] = useState<ChapterAlignment | null>(null);
  const { isOnline } = useOfflineContext();

  useEffect(() => {
    let cancelled = false;
    setAlignment(null);

    const load = async () => {
      // English path — unchanged, no network.
      if (isEnglishVersion(versionKey)) {
        const a = await loadAlignmentFor(bookId, chapterNumber);
        if (!cancelled) setAlignment(a);
        return;
      }

      // Non-English + offline: skip the fetch entirely. The page degrades
      // gracefully to plain text — the existing null-check in ChapterReader
      // handles `alignment === null` already (same path as a chapter with
      // no curated English alignment).
      if (!isOnline) {
        if (!cancelled) setAlignment(null);
        return;
      }

      try {
        const a = await fetchTaggedChapterAlignment(bookId, chapterNumber, versionKey as string);
        if (!cancelled) setAlignment(a);
      } catch (e) {
        // Network/server error — degrade silently, same outcome as
        // an offline view or an unauthored chapter.
        if (!cancelled) {
          console.warn(
            `useChapterAlignment: failed to fetch tagged chapter ${bookId}/${chapterNumber} (${versionKey})`,
            e
          );
          setAlignment(null);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [bookId, chapterNumber, versionKey, isOnline]);

  return alignment;
}
