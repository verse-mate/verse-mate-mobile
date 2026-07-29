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
import { InteractionManager } from 'react-native';
import { useOfflineContext } from '@/contexts/OfflineContext';
import { perfSpan } from '@/lib/perf';
import { fetchTaggedChapterAlignment } from '@/services/api-chapter-alignment';

const ENGLISH_VERSION_KEYS = new Set(['NASB1995', 'KJV']);

/**
 * How many English alignment loads have happened this process.
 *
 * Module scope, not a ref: the point is to identify the ONE call that pays the whole-lexicon parse,
 * and that cost is per-process, not per-component. A ref would restart the count on every remount and
 * mislabel a warm call as the first.
 */
let alignmentCalls = 0;

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
        // Instrumented because the three worst JS blocks in the swipe capture had
        // NOTHING of ours open during them — so the cost is in an uninstrumented
        // path, and this is the heaviest candidate. `loadAlignmentFor` rebuilds
        // two whole-lexicon structures (an 18,100-entry object spread, then an
        // Object.entries pass over it) on every chapter that is not already in
        // its module-level cache, none of which depends on the chapter.
        // FIRST call gets its own span name, because the two costs inside are completely
        // different and lumping them made the number useless.
        //
        // `loadAlignmentFor` awaits `loadGeneratedLexicon()`, an `import()` of an 18MB
        // `_lemmas.json`, which happens exactly ONCE per process — plus per-chapter work that
        // happens every time. Reported as one span, `data.alignment` showed mean 1902.6ms over 7
        // calls and was read (by me) as "13.3s of cost, the biggest item in the app". It is not:
        // the same report says the JS thread was blocked 5197ms for the WHOLE session, and a span
        // cannot burn more CPU than the thread was ever blocked. Most of that total is the span
        // sitting open across an `await`.
        //
        // What IS real is one ~2s block, seen as `worst 1991.2ms` / `1946.1ms` / `2162.7ms` /
        // `2206.7ms` across four independent captures. Splitting the span settles whether that
        // block is the one-time parse: if `.first` is ~2s and `data.alignment` is small, it is, and
        // the lexicon work is justified. If both are large, the premise is wrong and the per-chapter
        // path needs the attention instead.
        const isFirstAlignment = alignmentCalls === 0;
        alignmentCalls += 1;
        const endSpan = perfSpan(isFirstAlignment ? 'data.alignment.first' : 'data.alignment', {
          book: bookId,
          chapter: chapterNumber,
        });
        try {
          // `lite` skips the 18.7MB `_lemmas.json` and uses a 1.15MB columnar projection instead —
          // 16x smaller. That file is what made this call a ~2s block of the JS thread; 12.1MB of it
          // is `notes` + `related` + `semanticRange`, which are only read when a reader taps a word.
          // `ChapterReader`'s tap handler upgrades to the full entry via `lookupLemma` at that point.
          //
          // The light lexicon still answers everything a chapter needs: whether a lemma has an entry
          // (which gates the underline), its Strong's number (homograph disambiguation), and
          // `translit`/`basicGloss`/`loaded` for accessibility labels and the context-sensitive marker.
          const a = await loadAlignmentFor(bookId, chapterNumber, { lite: true });
          if (!cancelled) setAlignment(a);
        } finally {
          endSpan();
        }
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

    // Deferred until interactions settle, so it cannot block first paint.
    //
    // Instrumenting startup showed the worst JS block in every capture — ~2s in the first two
    // seconds — is not startup work at all: offline init is ~213ms and the DB open 196ms,
    // while the block belongs to this call. It parses a 17.8MB, 18,100-entry lexicon file,
    // measured at 652ms on a Raspberry Pi 5 and worse on a phone.
    //
    // Underlines are decoration: they can arrive a moment after the text without anything
    // being wrong, and the reader's null-alignment path already renders plain text. A stalled
    // first paint is far more costly than a late underline.
    const handle = InteractionManager.runAfterInteractions(() => {
      if (!cancelled) load();
    });

    return () => {
      cancelled = true;
      handle.cancel();
    };
  }, [bookId, chapterNumber, versionKey, isOnline]);

  return alignment;
}
