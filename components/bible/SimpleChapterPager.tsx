/**
 * SimpleChapterPager Component
 *
 * A simplified 3-page pager for Bible chapter navigation (V3 architecture).
 * Replaces the 7-page ChapterPagerView with a cleaner, more reliable approach.
 *
 * Architecture:
 * - 3-page window: [previous, current, next]
 * - Stable positional keys: ["page-prev", "page-current", "page-next"]
 * - Initial page is always index 1 (center/current)
 * - No recentering logic - parent component updates props on navigation
 * - Internal useEffect resets pager position when props change (no remount)
 *
 * Boundary Handling (Linear Navigation - MVP):
 * - Genesis 1: Page 0 is empty, swipe does not trigger navigation (bounces back)
 * - Revelation 22: Page 2 is empty, swipe does not trigger navigation (bounces back)
 * - No circular navigation (Genesis 1 does NOT connect to Revelation 22)
 *
 * Navigation Flow:
 * 1. User swipes to page 0 or page 2
 * 2. onPageSelected fires with new position
 * 3. If not a boundary page, onChapterChange(newBookId, newChapter) is called
 * 4. Parent updates state, which changes props to this component
 * 5. Parent's key prop changes, causing full remount with new center
 *
 * @example
 * ```tsx
 * function ChapterScreen() {
 *   const { bookId, chapterNumber, bookName, navigateToChapter } = useChapterState();
 *   const { data: booksMetadata } = useBibleTestaments();
 *
 *   return (
 *     <SimpleChapterPager
 *       key={`${bookId}-${chapterNumber}`} // Forces remount on navigation
 *       bookId={bookId}
 *       chapterNumber={chapterNumber}
 *       bookName={bookName}
 *       booksMetadata={booksMetadata}
 *       onChapterChange={navigateToChapter}
 *       renderChapterPage={(bid, ch) => <ChapterPage bookId={bid} chapterNumber={ch} />}
 *     />
 *   );
 * }
 * ```
 *
 * @see Spec: agent-os/specs/2026-02-01-chapter-header-slide-sync-v3/spec.md
 */

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';
import { StyleSheet, View } from 'react-native';
import PagerView from '@/components/common/PagerView';
import {
  computeChapterNavigation,
  useChapterNavigation,
} from '@/hooks/bible/use-chapter-navigation';
import { perfAdd, perfSpan } from '@/lib/perf';
import type { TestamentBook } from '@/src/api';

/**
 * Props for SimpleChapterPager component
 */
export interface SimpleChapterPagerProps {
  /** Current book ID (1-66) */
  bookId: number;
  /** Current chapter number (1-based) */
  chapterNumber: number;
  /** Current book name (for display/accessibility - reserved for future use) */
  bookName: string;
  /** Array of all Bible books with chapter counts */
  booksMetadata: TestamentBook[] | undefined;
  /** Callback when user navigates to a different chapter */
  onChapterChange: (bookId: number, chapterNumber: number) => void;
  /** Render function for chapter content */
  renderChapterPage: (bookId: number, chapterNumber: number) => React.ReactNode;
}

/**
 * Ref type for imperative methods
 */
export interface SimpleChapterPagerRef {
  /** Navigate to a specific page index (0, 1, or 2) */
  setPage: (index: number) => void;
}

/**
 * Page position constants (used when all 3 pages exist)
 */
/**
 * Ceiling on how long a dev-only `swipe.settle` span may stay open, in ms.
 *
 * A settled swipe that is going to navigate does so well within this. Anything
 * longer means the gesture produced no chapter change, so the span is closed as
 * abandoned rather than left to accumulate — it previously stayed open until the
 * next real navigation and reported a 19-second "swipe latency".
 */
const SWIPE_SPAN_TIMEOUT_MS = 3000;

const PAGE_CURRENT_MIDDLE = 1; // Current page when prev exists

/**
 * SimpleChapterPager Component
 *
 * Renders a 3-page PagerView with previous, current, and next chapters.
 * Handles boundary pages at Genesis 1 and Revelation 22.
 */
export const SimpleChapterPager = forwardRef<SimpleChapterPagerRef, SimpleChapterPagerProps>(
  function SimpleChapterPager(
    {
      bookId,
      chapterNumber,
      bookName: _bookName,
      booksMetadata,
      onChapterChange,
      renderChapterPage,
    },
    ref
  ) {
    const pagerRef = useRef<PagerView>(null);

    // Get navigation metadata (linear mode - no circular wrap)
    const { prevChapter, nextChapter, canGoPrevious, canGoNext } = useChapterNavigation(
      bookId,
      chapterNumber,
      booksMetadata,
      false // Linear mode
    );

    // Track the previous chapter key to detect navigation
    const prevChapterKey = useRef(`${bookId}-${chapterNumber}`);

    /**
     * Where the PAGER believes it is, which can be ahead of what React has
     * committed.
     *
     * Props are the committed chapter, and committing takes ~520ms
     * (`swipe.settle`). Resolving a swipe's target from props therefore made every
     * swipe that landed inside that window aim at a chapter the user had already
     * left, so a fast run collapsed to a single step and then looked jammed. This
     * advances the instant a swipe settles, so six quick swipes resolve to six
     * consecutive chapters.
     *
     * Re-synced from props whenever a committed chapter change arrives, so an
     * external navigation (the dropdown, a deep link) is authoritative and any
     * drift is corrected rather than accumulated.
     */
    const virtualRef = useRef({ bookId, chapterNumber });

    /**
     * Chapter keys dispatched by a swipe but not yet seen in props, oldest first.
     *
     * Needed because a committed chapter change is NOT automatically a reason to
     * re-sync the virtual position. Swipe twice quickly from Genesis 3: the pager
     * dispatches Genesis 4 then Genesis 5, and Genesis 4 commits FIRST. Re-syncing
     * on that commit would drag the virtual position back to 4 and make a third
     * swipe re-target 5 — the same duplicate-navigation bug in a new place.
     *
     * So props only reset the virtual position once React has caught up with the
     * newest dispatch. A committed chapter that is NOT in this queue came from
     * somewhere else (the dropdown, a deep link, restored reading position); that
     * is authoritative and resets everything immediately.
     */
    const dispatchedQueueRef = useRef<string[]>([]);

    // Pending navigation target — set by onPageSelected, processed when pager reaches idle
    const pendingNavRef = useRef<{ bookId: number; chapterNumber: number } | null>(null);

    // Fallback timer for cases where onPageScrollStateChanged never fires `idle` after a
    // pageSelected (observed after setPageWithoutAnimation repositions — the native event queue
    // swallows the trailing idle). Without this, pendingNavRef stays stale and gets consumed by
    // the next swipe's idle event, producing the chapter-skip bug.
    const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const clearPendingTimer = () => {
      if (pendingTimerRef.current !== null) {
        clearTimeout(pendingTimerRef.current);
        pendingTimerRef.current = null;
      }
    };

    // Stable refs for the latest props so the fallback timer (created inside handlePageSelected)
    // doesn't capture stale `bookId`/`chapterNumber`/`onChapterChange` closures.
    const onChapterChangeRef = useRef(onChapterChange);
    onChapterChangeRef.current = onChapterChange;
    const currentKeyRef = useRef(`${bookId}-${chapterNumber}`);
    currentKeyRef.current = `${bookId}-${chapterNumber}`;

    useEffect(() => clearPendingTimer, []);

    // Dev-only swipe timing. Opened in handlePageSelected, closed here once the
    // resulting chapter change has committed. Held in a ref because it spans a
    // native callback and a later render.
    //
    // Cleanup closes the span for both cases that end a swipe: the deps
    // changing (the new chapter committed — cleanup runs after that commit) and
    // unmount (the user left the reader mid-settle). Either way the span never
    // stays open, which matters because an open span is attributed to every
    // JS block that follows it.
    const swipeSpanRef = useRef<(() => void) | null>(null);
    /** Phase span: pager settle -> navigation actually dispatched. */
    const swipeNavSpanRef = useRef<(() => void) | null>(null);
    /**
     * Close `swipe.pendingNav` at the instant the navigation is dispatched.
     *
     * This has to be called at every dispatch site. The first version closed it
     * nowhere, so it was only ever ended by the *next* swipe reopening it — which
     * silently turned the metric into "time between swipes" and reported a 4.5s
     * mean swipe on a device that was idle for four of those seconds. A phase span
     * with no close is worse than no span, because it reads as a plausible number.
     */
    const endPendingNavSpan = () => {
      swipeNavSpanRef.current?.();
      swipeNavSpanRef.current = null;
    };
    /**
     * Open span for the programmatic recenter, closed on the next `idle`.
     *
     * The remaining complaint is a small mandatory pause after every swipe at a
     * fast pace, and with the JS thread only ~8% busy it is unlikely to be our
     * work. The standing suspect is this recenter: after each chapter change the
     * pager snaps back to its centre page with `setPageWithoutAnimation`, and
     * ViewPager2 does not accept user drags while a programmatic scroll is in
     * flight. If that is it, the gesture never reaches JS at all — which is why no
     * existing counter can see it, and why it has to be timed directly rather than
     * inferred.
     */
    const recenterSpanRef = useRef<(() => void) | null>(null);
    const endRecenterSpan = () => {
      recenterSpanRef.current?.();
      recenterSpanRef.current = null;
    };

    const swipeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const clearSwipeTimeout = () => {
      if (swipeTimeoutRef.current !== null) {
        clearTimeout(swipeTimeoutRef.current);
        swipeTimeoutRef.current = null;
      }
    };
    // biome-ignore lint/correctness/useExhaustiveDependencies: bookId/chapterNumber are the trigger for the cleanup, not values read inside it
    useEffect(() => {
      return () => {
        clearSwipeTimeout();
        swipeSpanRef.current?.();
        swipeSpanRef.current = null;
        endRecenterSpan();
        // A swipe that ends by leaving the reader still has to close its phase
        // span, or it is attributed to every JS block for the rest of the session.
        endPendingNavSpan();
      };
    }, [bookId, chapterNumber]);

    // While a programmatic setPageWithoutAnimation is settling, the native
    // ViewPager fires `onPageSelected` for intermediate positions. Without
    // this guard, the very first reposition lands on position=0 (the prev
    // slot) and gets mistaken for a swipe — kicks navigateToChapter back
    // to the previous chapter.
    //
    // 2026-05-24 follow-up: clearing the guard on the FIRST event that
    // matches the target index isn't enough. The native ViewPager keeps
    // firing trailing `onPageSelected` events for ~50-200ms AFTER it
    // settles on the target (often emitting position=0 or back-and-forth
    // between adjacent positions). Those late events arrive with the
    // guard already cleared and are treated as real swipes — the bug
    // reproes as "every other dropdown navigation silently rewinds by
    // one chapter". Fix: hold the guard open via a timer instead of
    // clearing on first match.
    const programmaticTargetRef = useRef<number | null>(null);
    const programmaticTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    /**
     * Whether the user has physically dragged since the last programmatic seek.
     *
     * This is what makes the guard above discriminate instead of blanket-swallow,
     * and it is the fix for "you cannot fast-swipe".
     *
     * The guard's job is to reject the trailing `onPageSelected` events ViewPager
     * emits for up to ~400ms after a `setPageWithoutAnimation`. It did that by
     * dropping EVERY page-selected event in that window — including real swipes.
     * Since the window is armed right after each chapter change, and the change
     * itself takes ~520ms (`swipe.settle`), there was close to a one-second dead
     * zone after every swipe in which the user's input was silently discarded.
     * That is exactly the reported behaviour: swiping fast stops advancing, the
     * header sits a chapter behind, and it only recovers once you stop and let it
     * settle.
     *
     * A trailing programmatic event is never preceded by a drag; a real swipe
     * always is. So the drag flag separates the two cleanly, and no real input has
     * to be thrown away to keep the rewind protection.
     */
    const draggedSinceSeekRef = useRef(false);

    const armProgrammaticGuard = (targetIndex: number) => {
      programmaticTargetRef.current = targetIndex;
      draggedSinceSeekRef.current = false;
      if (programmaticTimerRef.current) clearTimeout(programmaticTimerRef.current);
      // 400ms covers the worst-case trailing-event window observed in
      // logs (~5 spurious events over ~250ms). Errs generous because
      // a too-short window reproduces the rewind bug, while a too-long
      // window only delays the user's next intentional swipe (no
      // correctness impact — the dropdown navigation is already in
      // flight by then).
      programmaticTimerRef.current = setTimeout(() => {
        programmaticTargetRef.current = null;
        programmaticTimerRef.current = null;
      }, 400);
    };
    useEffect(
      () => () => {
        if (programmaticTimerRef.current) clearTimeout(programmaticTimerRef.current);
      },
      []
    );

    // Reset pager position to center after props change (parent navigated). Runs in
    // useLayoutEffect so the setPageWithoutAnimation lands in the same paint frame as
    // the children-array swap. With useDeferredValue on the parent, the heavy commit
    // happens in the background priority — by the time this effect fires here, the
    // commit is done and the next paint reflects the new children at the recentered
    // index, so the user never sees the overshoot.
    useLayoutEffect(() => {
      const currentKey = `${bookId}-${chapterNumber}`;
      if (prevChapterKey.current === currentKey) return;
      prevChapterKey.current = currentKey;
      const queue = dispatchedQueueRef.current;
      const at = queue.indexOf(currentKey);
      if (at === -1) {
        // Not one of ours: an external navigation wins outright.
        queue.length = 0;
        virtualRef.current = { bookId, chapterNumber };
      } else {
        // Drop everything up to and including the chapter that just committed.
        queue.splice(0, at + 1);
        // Only when nothing is still in flight does the committed chapter also
        // describe where the pager is.
        if (queue.length === 0) virtualRef.current = { bookId, chapterNumber };
      }
      const targetIndex = canGoPrevious ? PAGE_CURRENT_MIDDLE : 0;
      // Suppress pageSelected handling for the full reposition window —
      // see armProgrammaticGuard. The guard auto-clears on a timer so
      // the trailing onPageSelected events ViewPager emits after the
      // seek finishes don't get treated as user swipes.
      armProgrammaticGuard(targetIndex);
      endRecenterSpan();
      recenterSpanRef.current = perfSpan('pager.recenter', { to: targetIndex });
      pagerRef.current?.setPageWithoutAnimation(targetIndex);
    }, [bookId, chapterNumber, canGoPrevious]);

    // Expose imperative methods
    useImperativeHandle(ref, () => ({
      setPage: (index: number) => {
        pagerRef.current?.setPage(index);
      },
    }));

    /**
     * Calculate the initial page index based on boundary conditions
     * - At Genesis 1 (no prev): pages = [current, next], initialPage = 0
     * - At Revelation 22 (no next): pages = [prev, current], initialPage = 1
     * - Middle chapters: pages = [prev, current, next], initialPage = 1
     */
    const initialPageIndex = canGoPrevious ? PAGE_CURRENT_MIDDLE : 0;

    /**
     * Handle page selection
     *
     * Called when user finishes swiping to a new page.
     * Page indices depend on which pages are rendered.
     */
    /**
     * Handle page selection — store pending navigation target.
     * Navigation is deferred until the pager reaches idle state via onPageScrollStateChanged.
     * This prevents rapid-swipe race conditions where a second swipe fires before reposition.
     */
    /**
     * Dev-only. Open the swipe-latency span, but ONLY for a settle that is going
     * to navigate.
     *
     * Two earlier versions of this were wrong in ways that produced numbers rather
     * than errors, which is worse:
     *
     *  - closing only on a chapter change left the span open until the NEXT
     *    navigation whenever a gesture settled without moving, reporting a 19s
     *    "swipe latency";
     *  - opening on every `onPageSelected` counted the spurious trailing events
     *    ViewPager emits after a settle (see armProgrammaticGuard). Those never
     *    navigate, so they all ran to the timeout and dragged the mean toward the
     *    ceiling — both arms sat at the 3s cap and the comparison said nothing.
     *
     * Opening it where the pending nav is recorded means one span per real
     * navigation. The timeout stays as a backstop for a nav that never commits.
     */
    const beginSwipeSpan = () => {
      swipeSpanRef.current?.();
      clearSwipeTimeout();
      // Phase 1 of the swipe: the pager has settled on a new page and a navigation
      // is pending, but React has not been told yet. Long here means the pager
      // itself is slow to report; long in swipe.commit means the new chapter is slow
      // to build. Splitting them is the difference between "the gesture is
      // sluggish" and "the content is slow", which feel identical to a user.
      endPendingNavSpan();
      swipeNavSpanRef.current = perfSpan('swipe.pendingNav', { from: currentKeyRef.current });
      swipeSpanRef.current = perfSpan('swipe.settle', { from: currentKeyRef.current });
      swipeTimeoutRef.current = setTimeout(() => {
        // Closed as abandoned, so a recorded duration is a known ceiling rather
        // than an arbitrary one.
        swipeSpanRef.current?.();
        swipeSpanRef.current = null;
        endPendingNavSpan();
        swipeTimeoutRef.current = null;
      }, SWIPE_SPAN_TIMEOUT_MS);
    };

    const handlePageSelected = (event: { nativeEvent: { position: number } }) => {
      const newPosition = event.nativeEvent.position;

      // Swallow ALL page-selected events while a programmatic reposition
      // is in flight (guard cleared by timer in armProgrammaticGuard).
      // ViewPager fires both intermediate AND trailing events during
      // the seek; clearing on first-match wasn't enough (caused phantom
      // rewind to prev chapter). The user-swipe path doesn't arm the
      // guard, so its events flow through normally.
      // Swallow ONLY the trailing events of a programmatic seek: guard armed and
      // the user has not dragged since. A real swipe inside the guard window is
      // let through, which is what makes fast swiping possible at all.
      if (programmaticTargetRef.current !== null) {
        if (!draggedSinceSeekRef.current) {
          perfAdd('swipe.trailingSwallowed', 1);
          return;
        }
        // Counted so the fix is provable rather than asserted: every one of these
        // is a swipe the previous blanket guard would have thrown away.
        perfAdd('swipe.rescuedDuringGuard', 1);
      }

      // Targets are resolved from the VIRTUAL position, not from props.
      //
      // Props describe the chapter React has committed. A swipe that arrives
      // while the previous chapter change is still in flight would resolve its
      // target from that stale chapter and navigate to somewhere the user has
      // already been — so a fast run of swipes collapsed into one step and then
      // appeared to jam. The virtual position advances the moment a swipe
      // settles, so N fast swipes resolve to N consecutive chapters.
      const virtual = virtualRef.current;
      const virtualNav = computeChapterNavigation(
        virtual.bookId,
        virtual.chapterNumber,
        booksMetadata,
        false
      );
      const goTo = (target: { bookId: number; chapterNumber: number }) => {
        beginSwipeSpan();
        virtualRef.current = target;
        pendingNavRef.current = target;
        dispatchedQueueRef.current.push(`${target.bookId}-${target.chapterNumber}`);
        perfAdd('swipe.navResolved', 1);
      };

      if (virtualNav.canGoPrevious && virtualNav.canGoNext) {
        // 3 pages: [prev, current, next]
        if (newPosition === 0 && virtualNav.prevChapter) {
          goTo(virtualNav.prevChapter);
        } else if (newPosition === 2 && virtualNav.nextChapter) {
          goTo(virtualNav.nextChapter);
        }
      } else if (!virtualNav.canGoPrevious && virtualNav.canGoNext) {
        // 2 pages at start: [current, next]
        if (newPosition === 1 && virtualNav.nextChapter) {
          goTo(virtualNav.nextChapter);
        }
      } else if (virtualNav.canGoPrevious && !virtualNav.canGoNext) {
        // 2 pages at end: [prev, current]
        if (newPosition === 0 && virtualNav.prevChapter) {
          goTo(virtualNav.prevChapter);
        }
      }

      // Arm fallback: if `idle` never fires within 500ms, force-fire navigation from pending and
      // clear it so the next swipe starts clean. The natural idle path cancels this timer.
      clearPendingTimer();
      if (pendingNavRef.current) {
        pendingTimerRef.current = setTimeout(() => {
          pendingTimerRef.current = null;
          if (!pendingNavRef.current) return;
          const { bookId: navBookId, chapterNumber: navChapter } = pendingNavRef.current;
          pendingNavRef.current = null;
          endPendingNavSpan();
          onChapterChangeRef.current(navBookId, navChapter);
        }, 500);
      }
    };

    /**
     * Process navigation only when the pager reaches idle state.
     * This ensures the swipe gesture + settling animation are fully complete before
     * we trigger the state update and reposition.
     */
    const handlePageScrollStateChanged = (event: { nativeEvent: { pageScrollState: string } }) => {
      const state = event.nativeEvent.pageScrollState;
      // A drag can only come from the user — `setPageWithoutAnimation` never
      // produces one. This is the signal the guard uses to tell a real swipe from
      // the trailing events of its own seek.
      if (state === 'dragging') draggedSinceSeekRef.current = true;
      // The recenter is over once the pager reports idle — that is the moment it
      // starts accepting drags again.
      if (state === 'idle') endRecenterSpan();
      if (state === 'idle' && pendingNavRef.current) {
        clearPendingTimer();
        const { bookId: navBookId, chapterNumber: navChapter } = pendingNavRef.current;
        pendingNavRef.current = null;
        // The pager has stopped moving and the nav is going out now: this is the
        // exact boundary between "the gesture layer was slow" and "the content was
        // slow to build", which is the whole reason the swipe is two spans.
        endPendingNavSpan();
        onChapterChange(navBookId, navChapter);
      }
    };

    /**
     * Build pages array dynamically based on boundary conditions
     * - At Genesis 1: [current, next] (no prev page)
     * - At Revelation 22: [prev, current] (no next page)
     * - Middle: [prev, current, next]
     */
    const pages = useMemo(() => {
      const result: React.ReactNode[] = [];

      // Keys are chapter-based, NOT slot-based ("page-prev/current/next").
      // Why: after a swipe, React's pages-array shifts so the chapter the user just
      // swiped to ends up in a different slot (was at the right edge, now in the
      // center). Slot-based keys would have React reuse the right-edge instance and
      // mutate it to a different chapter, then setPageWithoutAnimation moves the pager
      // to a different instance with scroll=0 — that's the "teleport back to top" bug.
      // Chapter-based keys make React migrate the user's actual chapter instance
      // between slots, preserving its ScrollView position.
      if (canGoPrevious && prevChapter) {
        result.push(
          <View
            key={`chapter-${prevChapter.bookId}-${prevChapter.chapterNumber}`}
            style={styles.page}
          >
            {renderChapterPage(prevChapter.bookId, prevChapter.chapterNumber)}
          </View>
        );
      }

      result.push(
        <View key={`chapter-${bookId}-${chapterNumber}`} style={styles.page}>
          {renderChapterPage(bookId, chapterNumber)}
        </View>
      );

      if (canGoNext && nextChapter) {
        result.push(
          <View
            key={`chapter-${nextChapter.bookId}-${nextChapter.chapterNumber}`}
            style={styles.page}
          >
            {renderChapterPage(nextChapter.bookId, nextChapter.chapterNumber)}
          </View>
        );
      }

      return result;
    }, [
      bookId,
      chapterNumber,
      prevChapter,
      nextChapter,
      canGoPrevious,
      canGoNext,
      renderChapterPage,
    ]);

    return (
      <PagerView
        ref={pagerRef}
        style={styles.pagerView}
        initialPage={initialPageIndex}
        onPageSelected={handlePageSelected}
        onPageScrollStateChanged={handlePageScrollStateChanged}
        testID="simple-chapter-pager"
        offscreenPageLimit={1}
      >
        {pages}
      </PagerView>
    );
  }
);

/**
 * Styles for SimpleChapterPager
 */
const styles = StyleSheet.create({
  pagerView: {
    flex: 1,
  },
  page: {
    flex: 1,
  },
});
