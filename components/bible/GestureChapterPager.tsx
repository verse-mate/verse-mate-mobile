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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
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
import { perfAdd, perfSpan } from '@/lib/perf';
import type { TestamentBook } from '@/src/api';

export interface GestureChapterPagerProps {
  bookId: number;
  chapterNumber: number;
  bookName: string;
  booksMetadata: TestamentBook[] | undefined;
  onChapterChange: (bookId: number, chapterNumber: number) => void;
  renderChapterPage: (bookId: number, chapterNumber: number) => React.ReactNode;
}

/**
 * How many chapters either side of the current one stay mounted.
 *
 * Two is enough for a fast run to stay ahead of React, and off-centre pages are
 * already cheap: `ChapterPage` defers a buffer chapter's real content to idle time
 * and renders exact-height placeholders until then.
 */
const RENDER_RADIUS = 2;

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
const ORIGIN_BACK = 32;
const SPAN = ORIGIN_BACK * 2 + 1;

function keyOf(loc: ChapterLocation): string {
  return `${loc.bookId}-${loc.chapterNumber}`;
}

export function GestureChapterPager({
  bookId,
  chapterNumber,
  booksMetadata,
  onChapterChange,
  renderChapterPage,
}: GestureChapterPagerProps) {
  const [width, setWidth] = useState(0);

  /**
   * Absolute index → chapter, filled outwards as the reader travels.
   *
   * Incremental rather than precomputed: resolving all 1189 chapters on mount would
   * walk the whole Bible for a reader who will visit four.
   */
  const chapterAt = useRef<Map<number, ChapterLocation>>(new Map([[0, { bookId, chapterNumber }]]));
  /** The same mapping inverted, for recognising a committed route change. */
  const indexOfKey = useRef<Map<string, number>>(new Map([[keyOf({ bookId, chapterNumber }), 0]]));

  /**
   * Index that sits at the row's left edge. Only moves on a re-base.
   *
   * Kept out of the gesture's way: the worklet reads `originSV`, so a re-base cannot
   * present it with a stale coordinate system.
   */
  const [origin, setOrigin] = useState(-ORIGIN_BACK);

  /** Absolute index of the chapter under the viewport. */
  const [index, setIndex] = useState(0);
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
  const widthSV = useSharedValue(0);
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
        const nav = computeChapterNavigation(from.bookId, from.chapterNumber, booksMetadata, false);
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
   * Follow an external navigation — the chapter picker, a deep link, a restored
   * reading position.
   *
   * A route change the pager itself caused is already reflected in `index` and is
   * recognised and ignored. Anything else moves the index and the offset together,
   * which needs no correction afterwards because every position derives from the
   * index.
   */
  useEffect(() => {
    const committedKey = keyOf({ bookId, chapterNumber });
    const currentLoc = chapterAt.current.get(indexRef.current);
    if (currentLoc && keyOf(currentLoc) === committedKey) return;

    const known = indexOfKey.current.get(committedKey);
    if (known !== undefined) {
      scrollX.value = -(known - origin) * width;
      setIndex(known);
      return;
    }
    // Somewhere the index space has never reached. Re-base around it: safe, because
    // every page position is derived from the index, so this moves everything at
    // once rather than shifting pages relative to each other.
    chapterAt.current = new Map([[0, { bookId, chapterNumber }]]);
    indexOfKey.current = new Map([[committedKey, 0]]);
    originSV.value = -ORIGIN_BACK;
    setOrigin(-ORIGIN_BACK);
    scrollX.value = -(0 - -ORIGIN_BACK) * width;
    setIndex(0);
    perfAdd('gesturePager.rebased', 1);
  }, [bookId, chapterNumber, width, origin, scrollX, originSV]);

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
          // Take over any settle in flight. Nothing else owns the position, so input
          // is never refused — the property ViewPager2 has no equivalent for.
          cancelAnimation(scrollX);
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
          const forward = fast ? e.velocityX < 0 : travelled < 0;
          const target = forward ? from + 1 : from - 1;
          // Both conditions: the chapter must exist AND be mounted.
          const allowed = forward
            ? target <= Math.min(maxIndexSV.value, maxRenderedSV.value)
            : target >= Math.max(minIndexSV.value, minRenderedSV.value);

          if ((fast || far) && allowed) {
            scrollX.value = withTiming(
              -(target - originSV.value) * w,
              { duration: SETTLE_MS, easing: Easing.out(Easing.cubic) },
              (finished) => {
                'worklet';
                if (finished) runOnJS(commitIndex)(target);
              }
            );
            // Start extending the mounted range NOW rather than when the animation
            // ends, so a run of flicks keeps content ahead of itself instead of
            // catching up afterwards.
            runOnJS(extendTowards)(target);
            return;
          }
          scrollX.value = withTiming(base, {
            duration: SETTLE_MS,
            easing: Easing.out(Easing.cubic),
          });
          runOnJS(cancelled)();
        }),
    [
      scrollX,
      gestureStart,
      widthSV,
      originSV,
      minIndexSV,
      maxIndexSV,
      minRenderedSV,
      maxRenderedSV,
      commitIndex,
      cancelled,
      extendTowards,
    ]
  );

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
          setWidth(next);
          // Keep the current chapter under the viewport across a width change
          // (rotation, split view): every absolute position scales with it.
          scrollX.value = -(indexRef.current - origin) * next;
        }
      }}
    >
      {width > 0 && (
        <GestureDetector gesture={pan}>
          <Animated.View style={[styles.row, { width: SPAN * width }, rowStyle]}>
            {rendered.map(({ index: i, loc }) => (
              // Absolutely positioned from the absolute index, so mounting or
              // unmounting a page cannot move any other page. Chapter-keyed so React
              // migrates a page's instance rather than repurposing it, which is what
              // preserves its scroll position.
              <View key={keyOf(loc)} style={[styles.page, { left: (i - origin) * width, width }]}>
                {renderChapterPage(loc.bookId, loc.chapterNumber)}
              </View>
            ))}
          </Animated.View>
        </GestureDetector>
      )}
    </View>
  );
}

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
