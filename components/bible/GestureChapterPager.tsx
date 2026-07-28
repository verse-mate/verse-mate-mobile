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

  /** Absolute index of the chapter under the viewport. */
  const [index, setIndex] = useState(0);
  const indexRef = useRef(0);
  indexRef.current = index;

  /** Row translation in px. `-index * width` at rest. */
  const scrollX = useSharedValue(0);
  /** `scrollX` when the gesture began, so a takeover resumes from the right place. */
  const gestureStart = useSharedValue(0);

  const onChapterChangeRef = useRef(onChapterChange);
  onChapterChangeRef.current = onChapterChange;

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

  /** Whether an adjacent chapter exists, for clamping the drag at the two ends. */
  const hasPrev = useMemo(() => resolveIndex(index - 1) !== null, [index, resolveIndex]);
  const hasNext = useMemo(() => resolveIndex(index + 1) !== null, [index, resolveIndex]);

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
      scrollX.value = -known * width;
      setIndex(known);
      return;
    }
    // Somewhere the index space has never reached. Re-base around it: safe, because
    // every page position is derived from the index, so this moves everything at
    // once rather than shifting pages relative to each other.
    chapterAt.current = new Map([[0, { bookId, chapterNumber }]]);
    indexOfKey.current = new Map([[committedKey, 0]]);
    scrollX.value = 0;
    setIndex(0);
    perfAdd('gesturePager.rebased', 1);
  }, [bookId, chapterNumber, width, scrollX]);

  /** Report a settled page turn. Runs on the JS thread from the animation callback. */
  const commitIndex = useCallback((target: number) => {
    const loc = chapterAt.current.get(target);
    if (!loc) return;
    const span = perfSpan('gesturePager.commit', { to: keyOf(loc) });
    // Note what is NOT here: any offset correction. `scrollX` already sits at the
    // target's absolute position and the target page is already mounted there, so
    // there is nothing left to reconcile. That absence is the fix for the flash.
    setIndex(target);
    perfAdd('gesturePager.flickPaged', 1);
    onChapterChangeRef.current(loc.bookId, loc.chapterNumber);
    span();
  }, []);

  const cancelled = useCallback(() => {
    perfAdd('gesturePager.flickCancelled', 1);
  }, []);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-ACTIVATE_X, ACTIVATE_X])
        .failOffsetY([-FAIL_Y, FAIL_Y])
        .onStart(() => {
          'worklet';
          // Take over any settle in flight. This is the line ViewPager2 has no
          // equivalent for: input is never refused, because nothing else owns the
          // position.
          cancelAnimation(scrollX);
          gestureStart.value = scrollX.value;
        })
        .onUpdate((e) => {
          'worklet';
          if (width <= 0) return;
          const base = -index * width;
          let next = gestureStart.value + e.translationX;
          // Refuse to travel into a chapter that does not exist, rather than
          // rubber-banding into empty space.
          const max = hasPrev ? base + width : base;
          const min = hasNext ? base - width : base;
          if (next > max) next = max;
          if (next < min) next = min;
          scrollX.value = next;
        })
        .onEnd((e) => {
          'worklet';
          if (width <= 0) return;
          const base = -index * width;
          const travelled = scrollX.value - base;
          const fast = Math.abs(e.velocityX) > PAGE_VELOCITY;
          const far = Math.abs(travelled) > width * PAGE_DISTANCE_RATIO;
          // Velocity decides direction on a flick; on a slow drag, where the finger
          // ended up decides, since a slow drag can drift backwards at the end
          // without meaning to reverse.
          const forward = fast ? e.velocityX < 0 : travelled < 0;
          const target = forward ? index + 1 : index - 1;
          const allowed = forward ? hasNext : hasPrev;

          if ((fast || far) && allowed) {
            scrollX.value = withTiming(
              -target * width,
              { duration: SETTLE_MS, easing: Easing.out(Easing.cubic) },
              (finished) => {
                'worklet';
                if (finished) runOnJS(commitIndex)(target);
              }
            );
            return;
          }
          scrollX.value = withTiming(base, {
            duration: SETTLE_MS,
            easing: Easing.out(Easing.cubic),
          });
          runOnJS(cancelled)();
        }),
    [index, width, hasPrev, hasNext, scrollX, gestureStart, commitIndex, cancelled]
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
          scrollX.value = -indexRef.current * next;
        }
      }}
    >
      {width > 0 && (
        <GestureDetector gesture={pan}>
          <Animated.View style={[styles.row, rowStyle]}>
            {rendered.map(({ index: i, loc }) => (
              // Absolutely positioned from the absolute index, so mounting or
              // unmounting a page cannot move any other page. Chapter-keyed so React
              // migrates a page's instance rather than repurposing it, which is what
              // preserves its scroll position.
              <View key={keyOf(loc)} style={[styles.page, { left: i * width, width }]}>
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
