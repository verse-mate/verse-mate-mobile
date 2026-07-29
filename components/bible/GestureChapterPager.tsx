/**
 * GestureChapterPager — chapter paging that owns its own gesture and its own layout.
 *
 * ## Why not ViewPager2
 *
 * ViewPager2 decides whether a drag becomes a page by measuring its own
 * distance/velocity thresholds against its CURRENT offset. A drag that begins while
 * it is still settling from the previous fling starts mid-transition, never crosses
 * the threshold, and resolves as an over-scroll bounce — the "swiping against the end
 * of a list" feel. A real 38-drag session produced 13 navigations and 14 snap-backs.
 *
 * That refusal is downstream of JS. Recovering the intent from `onPageScroll` and
 * calling `setPage` was tried and measured: four forced pages, zero additional
 * navigations, because a pager too busy to accept a drag is equally too busy to
 * accept a programmatic page.
 *
 * ## Why pages are positioned by ABSOLUTE index
 *
 * The first version of this component kept a window centred on the current chapter
 * and shifted it on every swipe, correcting the offset afterwards. That flashed a
 * neighbouring chapter for a frame on every single swipe, and the flash was measured
 * rather than argued: `gesturePager.correctionLagMs` came back at **67ms mean**, four
 * frames. The cause is structural — the window is React state and the offset is a
 * shared value, so the two cannot be made atomic no matter which effect the
 * correction goes in. Narrowing the timing was tried twice and failed twice.
 *
 * So the window never moves. Every chapter has a fixed absolute index, and every
 * mounted page sits at `index * width` for as long as it exists. Mounting and
 * unmounting pages therefore changes no other page's position, which buys:
 *
 *  - a page turn is one shared-value animation, with React uninvolved;
 *  - the target page is already mounted at its final position before the gesture
 *    starts, so there is nothing to wait for and nothing to flash;
 *  - the rendered range may follow along late with no visual consequence at all.
 *
 * The index is bounded by the Bible's 1189 chapters, so the largest translate is
 * about 1.3M px — well inside float precision, and only reachable by someone who
 * swipes the whole way without ever using the chapter picker.
 */

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {
  type ChapterLocation,
  chapterOrdinal,
  computeChapterNavigation,
} from '@/hooks/bible/use-chapter-navigation';
import { perfAdd, perfSpan, watchFrames } from '@/lib/perf';
import type { TestamentBook } from '@/src/api';

export interface GestureChapterPagerRef {
  /** Step one chapter forward from where the PAGER is, not where the route is. */
  goNext: () => void;
  /** Step one chapter back from where the PAGER is. */
  goPrevious: () => void;
}

export interface GestureChapterPagerProps {
  bookId: number;
  chapterNumber: number;
  bookName: string;
  booksMetadata: TestamentBook[] | undefined;
  onChapterChange: (bookId: number, chapterNumber: number) => void;
  renderChapterPage: (bookId: number, chapterNumber: number) => React.ReactNode;
  /**
   * Set by the screen ONLY when something other than this pager navigated, carrying the
   * target it navigated to.
   *
   * The pager watches this and ignores `bookId`/`chapterNumber` entirely. The route lags a
   * swipe, so its echoes cannot be told from a real navigation by inspection — two
   * heuristics were tried and both dragged the reader backwards.
   *
   * The target is part of the signal rather than read from props, because props reach this
   * component through `useDeferredValue` and therefore lag the signal. A bare counter
   * produced the chapter-nav button bug: the pager woke and read the chapter it was already
   * on, so the header moved and the page did not.
   */
  externalNav?: { seq: number; bookId: number; chapterNumber: number } | null;
}

/**
 * How many chapters either side of the current one stay mounted.
 *
 * Two, measured. It was raised to four when fast runs hit the edge of the mounted range and
 * were refused — but that had a different cause (bounds derived from stale React state) which
 * was fixed separately, and nobody rechecked the radius afterwards. Same flow, radius 4
 * against radius 2: jank 7.52% -> 5.78%, p90 14ms -> 12ms, missed vsync 5 -> 3, worst swipe
 * frame 109ms -> 82ms, reader renders 512 -> 314, and all 16 flicks still paged either way.
 *
 * The reason is the one this whole project keeps rediscovering: Fabric's commit cost scales
 * with the LIVE tree, so nine mounted pages cost every commit more than five do. Headroom is
 * not free, and it was buying nothing.
 */
const RENDER_RADIUS = 1;

/** Page elements kept cached. Comfortably above the mounted range. */
const PAGE_CACHE_LIMIT = 24;

/** Fraction of the screen a slow drag must cross to page. */
const PAGE_DISTANCE_RATIO = 0.28;

/** Velocity above which a gesture pages regardless of distance, in px/s. */
const PAGE_VELOCITY = 450;

/** Settle animation, in ms. */
const SETTLE_MS = 190;

/**
 * Horizontal travel before the pan claims the gesture, and vertical travel that
 * hands it to the ScrollView instead. Every page scrolls vertically, so the pan has
 * to lose that contest.
 */
/**
 * How long a swipe's frame recording runs, in ms.
 *
 * Longer than the 190ms settle so a stall landing just after the animation still shows up
 * — the interesting stutter is often the commit that follows, not the motion itself.
 */
const SWIPE_FRAME_WINDOW_MS = 500;

const ACTIVATE_X = 14;
const FAIL_Y = 18;

/**
 * Adaptive route dispatch.
 *
 * A fixed 140ms debounce was measured to do nothing at all: 19 flicks produced 19
 * route dispatches, because the gap between human swipes is longer than 140ms. Every
 * flick still cost a navigation, and the header fell progressively further behind — the
 * reported "works at first, then breaks once the header cannot keep up".
 *
 * So the delay depends on whether a run is under way. An isolated swipe dispatches
 * almost immediately, keeping the header live. A flick arriving within RUN_GAP_MS of
 * the previous one means the reader is mid-run, and the route waits for the run to
 * finish instead of chasing every chapter through it.
 */
const ROUTE_SETTLE_MS = 60;
const ROUTE_RUN_SETTLE_MS = 320;
const RUN_GAP_MS = 700;

/**
 * How many chapters of index space the row spans, and how far back it starts.
 *
 * The row needs a real width containing every page: Android does not deliver touches
 * to a child outside its parent's bounds, so with a one-screen-wide row and pages at
 * `index * width`, everything from index 1 onward became untappable and unscrollable
 * the moment the reader swiped once.
 *
 * A FIXED span fixes that without reintroducing the flash. Positions are computed
 * from `origin`, which does not move during normal reading, so mounting and
 * unmounting still cannot disturb any other page. 32 chapters of headroom each way
 * covers a long session; travelling beyond it re-bases while the pager is at rest.
 */
/**
 * Navigation trace, tagged so it can be grepped out of Metro's log.
 *
 * Added because the chapter picker "lags one selection behind" survived two fixes and a scripted flow that
 * PASSES — so the scripted interaction is not reproducing the operator's, and another hypothesis would
 * just be a third guess. This records, at every point that can move the reader, what the route asked for
 * against what the pager is actually showing. A divergence names itself instead of being inferred.
 *
 * Deliberately `console.log` rather than a perf counter: counters aggregate, and what matters here is the
 * ORDER and the pairing of values within a single navigation.
 */
/** Log the currently rendered window once per render, paired with the active index. */
function logRendered(
  index: number,
  rendered: { index: number; loc: ChapterLocation }[]
): undefined {
  if (__DEV__) {
    const active = rendered.find((r) => r.index === index);
    console.log(
      `[VMNAV] render {"index":${index},"active":"${active ? keyOf(active.loc) : 'MISSING'}","window":"${rendered
        .map((r) => keyOf(r.loc))
        .join(',')}"}`
    );
  }
  return undefined;
}

function logNav(event: string, data: Record<string, unknown>): void {
  if (!__DEV__) return;
  console.log(`[VMNAV] ${event} ${JSON.stringify(data)}`);
}

/**
 * Last measured pager width, kept at module scope.
 *
 * Seeds the next mount so a remount does not re-render blank for a frame while waiting for
 * `onLayout`. Every pager instance is the same full-width column in the same reader, so the previous
 * measurement is a correct opening bid — and it is corrected on the very next layout if it is not.
 */
let lastPagerWidth = 0;

const ORIGIN_BACK = 32;
const SPAN = ORIGIN_BACK * 2 + 1;

function keyOf(loc: ChapterLocation): string {
  return `${loc.bookId}-${loc.chapterNumber}`;
}

export const GestureChapterPager = forwardRef<GestureChapterPagerRef, GestureChapterPagerProps>(
  function GestureChapterPager(
    {
      bookId,
      chapterNumber,
      booksMetadata,
      onChapterChange,
      renderChapterPage,
      externalNav = null,
    },
    ref
  ) {
    /**
     * Seeded from the window width, not 0.
     *
     * The render below is gated on `width > 0`, and `width` used to start at 0 and only become real
     * when `onLayout` fired — so the pager rendered NOTHING on its first frame, every mount. On device
     * that is a blank frame before the chapter appears; under Jest `onLayout` never fires at all, so
     * the tree stayed permanently empty and three chapter-screen tests could not find their content
     * once this pager became the default. Both are the same bug.
     *
     * The window width is available synchronously and the pager fills the screen in every layout the
     * app has, so it is a correct opening value rather than a guess; `onLayout` still corrects it for
     * split view and rotation. `lastPagerWidth` then carries the real measurement across remounts, so
     * only the very first mount of a session uses the window value.
     */
    const [width, setWidth] = useState(lastPagerWidth || Dimensions.get('window').width);

    /**
     * Absolute index → chapter, filled outwards as the reader travels.
     *
     * Incremental rather than precomputed: resolving all 1189 chapters on mount would
     * walk the whole Bible for a reader who will visit four.
     */
    const chapterAt = useRef<Map<number, ChapterLocation>>(
      new Map([[0, { bookId, chapterNumber }]])
    );
    /** The same mapping inverted, for recognising a committed route change. */
    const indexOfKey = useRef<Map<string, number>>(
      new Map([[keyOf({ bookId, chapterNumber }), 0]])
    );

    /**
     * Index that sits at the row's left edge. Only moves on a re-base.
     *
     * Kept out of the gesture's way: the worklet reads `originSV`, so a re-base cannot
     * present it with a stale coordinate system.
     */
    const [origin, setOrigin] = useState(-ORIGIN_BACK);

    /** Absolute index of the chapter under the viewport. */
    const [index, setIndex] = useState(0);
    /**
     * Bumped whenever the index space is re-based, purely to publish a ref mutation.
     *
     * `chapterAt` / `indexOfKey` are refs (they are written from a gesture worklet's JS callback and
     * from effects, and making them state would re-render on every settle). A re-base rewrites both, and
     * that rewrite has to reach the render — see the comment at the re-base itself for the bug this
     * fixes.
     */
    const [, setRebaseSeq] = useState(0);
    const indexRef = useRef(0);
    indexRef.current = index;

    /**
     * Row translation in px. `-(index - origin) * width` at rest.
     *
     * This — not React state — is the authority on where the pager is. The gesture
     * derives the current index from it on the UI thread, so a second fast flick sees
     * the true position instead of a stale render. Closing over `index` from state was
     * why two quick swipes only advanced one chapter: the worklet computed the same
     * target twice.
     */
    const scrollX = useSharedValue(0);
    /** `scrollX` when the gesture began, so a takeover resumes from the right place. */
    const gestureStart = useSharedValue(0);
    /** Live page width and index bounds, readable from the gesture worklet. */
    const widthSV = useSharedValue(lastPagerWidth || Dimensions.get('window').width);
    const originSV = useSharedValue(-ORIGIN_BACK);
    const minIndexSV = useSharedValue(0);
    const maxIndexSV = useSharedValue(0);
    /**
     * The range that is actually MOUNTED.
     *
     * The gesture must never travel past this, or it lands on empty space — which is
     * exactly what happened when the bounds were widened to the whole Bible: a fast run
     * outran the rendered pages and left a black screen at Genesis 10 while the header
     * sat at 6. Bible bounds say where chapters EXIST; these say where content is, and a
     * swipe needs both to be true.
     */
    const minRenderedSV = useSharedValue(0);
    const maxRenderedSV = useSharedValue(0);
    /** Whether a gesture is in progress, so the invariant check leaves it alone. */
    const gestureActiveSV = useSharedValue(false);
    /**
     * Whether a settle animation is still flying.
     *
     * The invariant check needs this as much as it needs the gesture flag. `extendTowards`
     * moves the index the moment a flick STARTS, so between then and the animation landing,
     * index-at-target and offset-not-yet-there is the correct, expected state — not
     * divergence. Without this the guard fired on healthy runs (7 times in a 16-gesture
     * stress test with no external navigation at all) and snapped the offset mid-animation,
     * which would read as a teleport of its own making.
     */
    const settlingSV = useSharedValue(false);

    const onChapterChangeRef = useRef(onChapterChange);
    onChapterChangeRef.current = onChapterChange;

    /** Latest chapter awaiting a route dispatch, its timer, and when the last flick landed. */
    const pendingRouteRef = useRef<ChapterLocation | null>(null);
    const lastFlickAtRef = useRef(0);
    const routeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(
      () => () => {
        if (routeTimerRef.current) clearTimeout(routeTimerRef.current);
      },
      []
    );

    /**
     * Resolve and memoise the chapter at an absolute index.
     *
     * Walks one step at a time from the nearest already-known index, so the map fills
     * in as the reader moves and every later lookup is free. Returns null past the two
     * ends of the Bible — those indices genuinely do not exist.
     */
    const resolveIndex = useCallback(
      (target: number): ChapterLocation | null => {
        const known = chapterAt.current.get(target);
        if (known) return known;
        if (!booksMetadata) return null;

        const step = target > 0 ? 1 : -1;
        let cursor = target;
        // Walk back towards a resolved index.
        while (!chapterAt.current.has(cursor) && cursor !== 0) cursor -= step;
        if (!chapterAt.current.has(cursor)) return null;

        for (let i = cursor; i !== target; i += step) {
          const from = chapterAt.current.get(i);
          if (!from) return null;
          const nav = computeChapterNavigation(
            from.bookId,
            from.chapterNumber,
            booksMetadata,
            false
          );
          const next = step > 0 ? nav.nextChapter : nav.prevChapter;
          if (!next) return null;
          chapterAt.current.set(i + step, next);
          indexOfKey.current.set(keyOf(next), i + step);
        }
        return chapterAt.current.get(target) ?? null;
      },
      [booksMetadata]
    );

    /**
     * The mounted range and each page's absolute index.
     *
     * Moving the index changes only WHICH pages exist, never where any of them sits.
     * That is precisely what makes a late render harmless here and was impossible in
     * the sliding-window version.
     */
    const rendered = useMemo(() => {
      if (!booksMetadata) return [];
      const out: { index: number; loc: ChapterLocation }[] = [];
      for (let i = index - RENDER_RADIUS; i <= index + RENDER_RADIUS; i++) {
        const loc = resolveIndex(i);
        if (loc) out.push({ index: i, loc });
      }
      return out;
    }, [index, resolveIndex, booksMetadata]);

    /**
     * Publish the page width and the reachable index range to the gesture.
     *
     * The worklet cannot read React state without capturing a stale copy, and a stale
     * copy is exactly what made two quick swipes advance one chapter: the second flick
     * computed its target from the index the first flick had not yet committed, so both
     * aimed at the same page. Everything the gesture needs is now a shared value it
     * reads live.
     */
    useEffect(() => {
      widthSV.value = width;
      originSV.value = origin;
    }, [width, origin, widthSV, originSV]);

    // Publish the mounted range every time it changes, so the gesture can refuse to
    // travel into unrendered space rather than showing nothing.
    useEffect(() => {
      if (rendered.length === 0) return;
      minRenderedSV.value = rendered[0].index;
      maxRenderedSV.value = rendered[rendered.length - 1].index;
    }, [rendered, minRenderedSV, maxRenderedSV]);

    /**
     * Publish the ABSOLUTE reachable range, once per chapter-space anchor.
     *
     * Deliberately not derived from `index`. The previous version published "index ± what
     * resolves", and `index` is React state that lags during a fast run — so a third quick
     * flick found itself already at a stale maximum and was refused. That was measured:
     * flickCancelled 6 against flickPaged 4, more gestures rejected than accepted, which
     * is the reported "works at first then stops letting me swipe".
     *
     * The Bible's bounds do not move, so these are computed from the anchor chapter's
     * ordinal and cannot go stale no matter how far ahead of React the gesture runs.
     */
    useEffect(() => {
      const anchor = chapterAt.current.get(0);
      if (!anchor) return;
      const position = chapterOrdinal(anchor.bookId, anchor.chapterNumber, booksMetadata);
      if (!position) return;
      minIndexSV.value = -position.ordinal;
      maxIndexSV.value = position.total - 1 - position.ordinal;
    }, [booksMetadata, index, minIndexSV, maxIndexSV]);

    /**
     * Move the pager onto `target`, re-basing the index space when it has never been visited.
     *
     * Shared by the two paths that can move the reader from outside a gesture — the nav buttons via
     * `externalNav`, and a route change from the chapter picker — so they cannot drift apart.
     */
    const jumpTo = useCallback(
      (target: ChapterLocation) => {
        const targetKey = keyOf(target);
        const known = indexOfKey.current.get(targetKey);
        if (known !== undefined) {
          scrollX.value = -(known - origin) * width;
          setIndex(known);
          return;
        }
        // Somewhere the index space has never reached: re-base around it. Safe because every page
        // position derives from the index, so this moves everything at once.
        chapterAt.current = new Map([[0, target]]);
        indexOfKey.current = new Map([[targetKey, 0]]);
        originSV.value = -ORIGIN_BACK;
        setOrigin(-ORIGIN_BACK);
        scrollX.value = -(0 - -ORIGIN_BACK) * width;
        setIndex(0);
        // Force a render, because the two setters above are NO-OPS after the first re-base.
        //
        // This is the chapter-picker bug: `chapterAt` is a ref, and the only thing that made the new
        // map visible was one of those setState calls happening to change value. After a first re-base
        // both `index` and `origin` are ALREADY 0 and -ORIGIN_BACK, so React bails out of both updates,
        // never re-renders, and the screen keeps showing the previous chapter while the ref holds the
        // new one. Every picker jump therefore appeared exactly one selection behind: pick Genesis 5 and
        // stay on Genesis 1, pick Exodus 3 next and arrive at Genesis 5. Swiping worked because it moves
        // `index` to a genuinely different value.
        //
        // Mutating a ref and hoping an unrelated setState will publish it is the actual defect; an
        // explicit counter says what it needs.
        setRebaseSeq((n) => n + 1);
        perfAdd('gesturePager.rebased', 1);
      },
      [width, origin, scrollX, originSV]
    );

    /**
     * Follow an EXTERNAL navigation, and nothing else.
     *
     * Keyed on `externalNavSeq` alone. The chapter props are deliberately NOT dependencies:
     * during a run they describe where the route has got to, which is behind the pager, and
     * reacting to them is what produced the teleports. Two heuristics tried to tell the
     * route's echo from a real navigation — a dispatched-key set, then a time-bounded window
     * — and both failed, because the screen knows the answer for certain and was not being
     * asked. Now it says so.
     */
    const lastExternalSeqRef = useRef(externalNav?.seq ?? 0);
    useEffect(() => {
      if (!externalNav) return;
      if (externalNav.seq === lastExternalSeqRef.current) return;
      lastExternalSeqRef.current = externalNav.seq;
      if (width <= 0) return;

      // The signal's own target, never the props.
      const target = { bookId: externalNav.bookId, chapterNumber: externalNav.chapterNumber };
      const targetKey = keyOf(target);
      const currentLoc = chapterAt.current.get(indexRef.current);
      if (currentLoc && keyOf(currentLoc) === targetKey) return;

      perfAdd('gesturePager.externalNav', 1);
      logNav('externalNav', {
        target: targetKey,
        at: currentLoc ? keyOf(currentLoc) : 'none',
        index: indexRef.current,
        origin,
        width,
        known: indexOfKey.current.get(targetKey) ?? -1,
      });
      jumpTo(target);
    }, [externalNav, width, jumpTo]);

    /**
     * NO route-driven sync here, deliberately — and this is a scar, not an omission.
     *
     * A version of this file synced the pager whenever the `bookId`/`chapterNumber` PROPS disagreed with
     * its own position. It broke chapter-picker navigation in the most confusing possible way: every jump
     * landed one selection behind. Pick Genesis 5 and you stayed on Genesis 1; pick Exodus 3 next and you
     * arrived at Genesis 5.
     *
     * The cause is that this component is given `deferredBookId`/`deferredChapterNumber` — useDeferredValue
     * outputs, which lag by design. So the sequence was: `navigateExternally` correctly jumps to the new
     * chapter, then the deferred props arrive still holding the OLD chapter, the sync sees a disagreement
     * and jumps back. Reading a deliberately-lagging value as if it were the truth.
     *
     * It is also unnecessary: all three `onSelectChapter` handlers already call `navigateExternally`, so the
     * picker uses the same explicit signal as the nav buttons. The screenshot that prompted it — the header
     * reading "John 1" over Genesis 1 content — was a TRANSIENT one-frame lag between the immediate header
     * and the deferred page, frozen by a screenshot, not a persistent mismatch.
     */

    /**
     * Re-centre the index space when the reader approaches the row's edge.
     *
     * Only reachable after ~32 chapters of continuous swiping in one direction, and
     * only acted on while the pager is at rest, so the one-frame coordinate change this
     * involves is never visible mid-gesture. This is the single place where positions
     * shift, traded deliberately for touch delivery working at every index.
     */
    useEffect(() => {
      if (width <= 0) return;
      const fromEdge = Math.min(index - origin, origin + SPAN - 1 - index);
      if (fromEdge > RENDER_RADIUS + 1) return;
      const nextOrigin = index - ORIGIN_BACK;
      originSV.value = nextOrigin;
      scrollX.value = -(index - nextOrigin) * width;
      setOrigin(nextOrigin);
      perfAdd('gesturePager.originRebased', 1);
    }, [index, origin, width, scrollX, originSV]);

    /**
     * Report a settled page turn. Runs on the JS thread from the animation callback.
     *
     * The index moves immediately, because the mounted range follows it. The ROUTE is
     * coalesced: the pager's visuals no longer depend on it, so firing a navigation per
     * flick only spent React commits, header renders and a reading-position write on
     * chapters the reader was already past. That is the "state cannot keep up" the
     * operator felt, and the occasional stick. Only the chapter the run ends on is
     * dispatched.
     */
    const commitIndex = useCallback((target: number) => {
      const loc = chapterAt.current.get(target);
      if (!loc) return;
      const span = perfSpan('gesturePager.commit', { to: keyOf(loc) });
      // Note what is NOT here: any offset correction. `scrollX` already sits at the
      // target's absolute position and the target page is already mounted there, so
      // there is nothing left to reconcile. That absence is the fix for the flash.
      setIndex(target);
      perfAdd('gesturePager.flickPaged', 1);

      const now = Date.now();
      const inRun = now - lastFlickAtRef.current < RUN_GAP_MS;
      lastFlickAtRef.current = now;
      if (inRun) perfAdd('gesturePager.flickInRun', 1);

      pendingRouteRef.current = loc;
      if (routeTimerRef.current) clearTimeout(routeTimerRef.current);
      routeTimerRef.current = setTimeout(
        () => {
          routeTimerRef.current = null;
          const next = pendingRouteRef.current;
          pendingRouteRef.current = null;
          if (!next) return;
          perfAdd('gesturePager.routeDispatched', 1);
          onChapterChangeRef.current(next.bookId, next.chapterNumber);
        },
        inRun ? ROUTE_RUN_SETTLE_MS : ROUTE_SETTLE_MS
      );
      span();
    }, []);

    const cancelled = useCallback(() => {
      perfAdd('gesturePager.flickCancelled', 1);
    }, []);

    /**
     * Instrument one swipe, start to finish.
     *
     * The existing instruments cannot answer "was THAT swipe smooth". `dumpsys gfxinfo`
     * averages a 300ms gesture into a whole session, and the JS heartbeat reports blocks
     * without saying what was on screen at the time. So a swipe opens its own span — which
     * makes every JS block during it attributable — and its own scoped frame recording.
     *
     * Read them together. `anim.swipe.dropped` high with a clean `gesture.swipe` span means
     * the JS thread starved while the gesture itself was fine; the reverse means the work is
     * in our commit path. They lead to opposite fixes, which is why the sluggishness has to
     * be split before it can be chased.
     */
    const swipeSpanRef = useRef<(() => void) | null>(null);
    const beginSwipeMeasure = useCallback(() => {
      swipeSpanRef.current?.();
      swipeSpanRef.current = perfSpan('gesture.swipe');
      watchFrames('anim.swipe', SWIPE_FRAME_WINDOW_MS);
    }, []);
    const endSwipeMeasure = useCallback(() => {
      swipeSpanRef.current?.();
      swipeSpanRef.current = null;
    }, []);
    useEffect(() => () => swipeSpanRef.current?.(), []);

    /**
     * Guarantee the offset and the mounted content agree once the pager is at rest.
     *
     * There are three things that must stay consistent — the shared offset, the React
     * index, and the route — and five rounds of reconciliation rules did not stop them
     * diverging: a stress test of fast runs and quick reversals ended with Genesis 1
     * mounted, the header reading Genesis 1, and the offset pointing somewhere else
     * entirely, which renders as a blank screen.
     *
     * Rather than add a sixth rule about WHY they diverge, this makes divergence
     * self-correcting. Any mismatch is a bug and the counter records it, but the reader
     * gets a chapter instead of a blank page. A blank screen is far worse than a snap.
     */
    const assertPosition = useCallback(() => {
      if (width <= 0) return;
      if (gestureActiveSV.value || settlingSV.value) return;
      const expected = -(indexRef.current - origin) * width;
      if (Math.abs(scrollX.value - expected) < 1) return;
      perfAdd('gesturePager.selfHealed', 1);
      scrollX.value = expected;
    }, [width, origin, scrollX, gestureActiveSV, settlingSV]);

    // Checked shortly after things settle, and whenever the anchor moves.
    useEffect(() => {
      const timer = setTimeout(assertPosition, 350);
      return () => clearTimeout(timer);
    }, [assertPosition, index]);

    /**
     * Move the mounted range towards a flick's target as the animation starts.
     *
     * `commitIndex` runs when the animation FINISHES, which is one flick too late during
     * a run — the gesture would reach the edge of the mounted range before React had been
     * asked to extend it. This is the same state update, issued early.
     */
    const extendTowards = useCallback((target: number) => {
      setIndex((current) => (current === target ? current : target));
    }, []);

    const pan = useMemo(
      () =>
        Gesture.Pan()
          .activeOffsetX([-ACTIVATE_X, ACTIVATE_X])
          .failOffsetY([-FAIL_Y, FAIL_Y])
          .onStart(() => {
            'worklet';
            gestureActiveSV.value = true;
            runOnJS(beginSwipeMeasure)();
            // Take over any settle in flight. Nothing else owns the position, so input
            // is never refused — the property ViewPager2 has no equivalent for.
            cancelAnimation(scrollX);
            settlingSV.value = false;
            gestureStart.value = scrollX.value;
          })
          .onUpdate((e) => {
            'worklet';
            const w = widthSV.value;
            if (w <= 0) return;
            // Derived from scrollX, not from React state, so a flick that begins before
            // the previous one has committed still measures from where the pager
            // actually is.
            const from = originSV.value + Math.round(-gestureStart.value / w);
            const base = -(from - originSV.value) * w;
            let next = gestureStart.value + e.translationX;
            const lo = Math.max(minIndexSV.value, minRenderedSV.value);
            const hi = Math.min(maxIndexSV.value, maxRenderedSV.value);
            const max = from - 1 >= lo ? base + w : base;
            const min = from + 1 <= hi ? base - w : base;
            if (next > max) next = max;
            if (next < min) next = min;
            scrollX.value = next;
          })
          .onEnd((e) => {
            'worklet';
            const w = widthSV.value;
            if (w <= 0) return;
            const from = originSV.value + Math.round(-gestureStart.value / w);
            const base = -(from - originSV.value) * w;
            const travelled = scrollX.value - base;
            const fast = Math.abs(e.velocityX) > PAGE_VELOCITY;
            const far = Math.abs(travelled) > w * PAGE_DISTANCE_RATIO;
            // Velocity decides direction on a flick; on a slow drag, where the finger
            // ended up decides, since a slow drag can drift backwards at the end
            // without meaning to reverse.
            gestureActiveSV.value = false;
            const forward = fast ? e.velocityX < 0 : travelled < 0;
            const target = forward ? from + 1 : from - 1;
            // Both conditions: the chapter must exist AND be mounted.
            const allowed = forward
              ? target <= Math.min(maxIndexSV.value, maxRenderedSV.value)
              : target >= Math.max(minIndexSV.value, minRenderedSV.value);

            if ((fast || far) && allowed) {
              settlingSV.value = true;
              scrollX.value = withTiming(
                -(target - originSV.value) * w,
                { duration: SETTLE_MS, easing: Easing.out(Easing.cubic) },
                (finished) => {
                  'worklet';
                  settlingSV.value = false;
                  runOnJS(endSwipeMeasure)();
                  if (finished) runOnJS(commitIndex)(target);
                }
              );
              // Start extending the mounted range NOW rather than when the animation
              // ends, so a run of flicks keeps content ahead of itself instead of
              // catching up afterwards.
              runOnJS(extendTowards)(target);
              return;
            }
            settlingSV.value = true;
            scrollX.value = withTiming(
              base,
              { duration: SETTLE_MS, easing: Easing.out(Easing.cubic) },
              () => {
                'worklet';
                settlingSV.value = false;
                runOnJS(endSwipeMeasure)();
              }
            );
            runOnJS(cancelled)();
          }),
      [
        scrollX,
        gestureStart,
        widthSV,
        originSV,
        settlingSV,
        beginSwipeMeasure,
        endSwipeMeasure,
        minIndexSV,
        maxIndexSV,
        minRenderedSV,
        maxRenderedSV,
        commitIndex,
        cancelled,
        extendTowards,
      ]
    );

    /**
     * Cache each page's element by chapter, so moving the index does not recreate them.
     *
     * When React sees the SAME element object it skips that subtree entirely. Without this,
     * every index change built a fresh element for all nine mounted pages, so all nine
     * re-rendered even though eight were unchanged: reader.render.bible measured 735 renders
     * with 666 of them attributed to `nothing-tracked` — nothing the reader watches had
     * changed, because the cause was above it.
     *
     * Cleared when `renderChapterPage` changes identity, since a new render function may
     * close over different state and reusing an element built by the old one would show stale
     * content.
     */
    const pageCacheRef = useRef<{
      render: typeof renderChapterPage;
      map: Map<string, React.ReactNode>;
    }>({ render: renderChapterPage, map: new Map() });
    if (pageCacheRef.current.render !== renderChapterPage) {
      pageCacheRef.current = { render: renderChapterPage, map: new Map() };
    }
    const pageElement = useCallback(
      (loc: ChapterLocation): React.ReactNode => {
        const cacheKey = keyOf(loc);
        const cache = pageCacheRef.current.map;
        const existing = cache.get(cacheKey);
        if (existing !== undefined) return existing;
        const created = renderChapterPage(loc.bookId, loc.chapterNumber);
        cache.set(cacheKey, created);
        // Bounded so a long reading session cannot accumulate every chapter visited. Well
        // above the mounted range, so nothing on screen is ever evicted.
        if (cache.size > PAGE_CACHE_LIMIT) {
          const oldest = cache.keys().next().value;
          if (oldest !== undefined) cache.delete(oldest);
        }
        return created;
      },
      [renderChapterPage]
    );

    /**
     * Step a chapter on request from the chapter-nav buttons.
     *
     * The buttons used to compute their own target from the ROUTE's chapter, which lags — so
     * tapping faster than the route commits made them aim from a stale position, and the
     * pager then followed that stale target backwards. That is the "press the buttons really
     * fast and it teleports you back to where you started" report, and it is the same
     * stale-source bug that the swipe path had twice.
     *
     * Asking the pager to move instead means one source of position for both input methods.
     * The animation and the route dispatch are the same ones a flick uses, so a tap and a
     * swipe cannot diverge.
     */
    const step = useCallback(
      (direction: 1 | -1) => {
        const w = widthSV.value;
        if (w <= 0) return;
        const from = indexRef.current;
        const target = from + direction;
        if (target < minIndexSV.value || target > maxIndexSV.value) return;
        if (!resolveIndex(target)) return;

        perfAdd('gesturePager.buttonStep', 1);
        settlingSV.value = true;
        extendTowards(target);
        scrollX.value = withTiming(
          -(target - origin) * w,
          { duration: SETTLE_MS, easing: Easing.out(Easing.cubic) },
          (finished) => {
            'worklet';
            settlingSV.value = false;
            if (finished) runOnJS(commitIndex)(target);
          }
        );
      },
      [
        widthSV,
        minIndexSV,
        maxIndexSV,
        resolveIndex,
        settlingSV,
        extendTowards,
        scrollX,
        origin,
        commitIndex,
      ]
    );

    useImperativeHandle(ref, () => ({ goNext: () => step(1), goPrevious: () => step(-1) }), [step]);

    const rowStyle = useAnimatedStyle(() => ({
      transform: [{ translateX: scrollX.value }],
    }));

    return (
      <View
        style={styles.container}
        testID="gesture-chapter-pager"
        onLayout={(e) => {
          const next = Math.round(e.nativeEvent.layout.width);
          if (next > 0 && next !== width) {
            lastPagerWidth = next;
            setWidth(next);
            // Keep the current chapter under the viewport across a width change
            // (rotation, split view): every absolute position scales with it.
            scrollX.value = -(indexRef.current - origin) * next;
          }
        }}
      >
        {width > 0 && logRendered(index, rendered) === undefined && (
          <GestureDetector gesture={pan}>
            <Animated.View style={[styles.row, { width: SPAN * width }, rowStyle]}>
              {/* Trace the rendered set, so "what the screen shows" is in the log next to what the
                  route asked for. */}
              {rendered.map(({ index: i, loc }, renderedIdx) => (
                // Absolutely positioned from the absolute index, so mounting or
                // unmounting a page cannot move any other page. Chapter-keyed so React
                // migrates a page's instance rather than repurposing it, which is what
                // preserves its scroll position.
                <View key={keyOf(loc)} style={[styles.page, { left: (i - origin) * width, width }]}>
                  {pageElement(loc)}
                </View>
              ))}
            </Animated.View>
          </GestureDetector>
        )}
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  row: {
    flex: 1,
  },
  page: {
    position: 'absolute',
    top: 0,
    bottom: 0,
  },
});
