/**
 * GestureChapterPager — chapter paging that owns its own gesture.
 *
 * ## Why this exists
 *
 * `SimpleChapterPager` delegates paging to ViewPager2, and ViewPager2 decides
 * whether a drag becomes a page by measuring its own distance/velocity thresholds
 * against its CURRENT offset. A drag that begins while it is still settling from
 * the previous fling therefore starts mid-transition, never crosses the threshold,
 * and resolves as an over-scroll bounce — the subtle "swiping against the end of a
 * list" feel. A real 38-drag session produced 13 navigations and 14 snap-backs, so
 * roughly half of a fast run was discarded.
 *
 * That refusal is downstream of JS and cannot be talked round. Recovering the
 * intent from `onPageScroll` and calling `setPage` was tried and measured: four
 * forced pages, zero additional navigations, because a pager too busy to accept a
 * drag is equally too busy to accept a programmatic page.
 *
 * So the paging decision moves here. The horizontal offset is a Reanimated shared
 * value driven by a Pan gesture on the UI thread, which buys three things
 * ViewPager2 would not give:
 *
 *  1. **A new flick can interrupt the running animation.** The gesture takes over
 *     from wherever the offset currently is. There is no state in which input is
 *     refused, because there is no state machine to refuse it.
 *  2. **Velocity decides paging, and we choose the threshold.** A fast flick always
 *     pages, even if it travelled a short distance.
 *  3. **The visual is decoupled from the route.** The pager centres on a chapter it
 *     tracks itself and updates on every flick, so the display never waits for
 *     React to commit a navigation. The route still follows, for the header, the
 *     URL and reading position — it just stops being on the critical path.
 *
 * ## Window
 *
 * Pages are rendered two either side of the centre, so a fast run can travel two
 * chapters ahead of React before it runs out of content. Off-centre pages are cheap
 * — `ChapterPage` defers a buffer chapter's real content to idle time and renders
 * exact-height placeholders until then.
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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

/** How many chapters are rendered either side of the centre. */
const WINDOW_RADIUS = 2;

/**
 * Fraction of the screen a slow drag must cross to page.
 *
 * Only consulted when the flick was too slow to qualify on velocity, so this is
 * the "dragged deliberately and let go" threshold rather than the flick one.
 */
const PAGE_DISTANCE_RATIO = 0.28;

/**
 * Velocity above which a gesture pages regardless of distance, in px/s.
 *
 * This is the whole point of owning the gesture: ViewPager2 would decline a short
 * fast flick that began mid-settle, and this will not.
 */
const PAGE_VELOCITY = 450;

/** Settle animation, in ms. Short enough to feel immediate, long enough to read as motion. */
const SETTLE_MS = 190;

/**
 * Horizontal travel before the pan claims the gesture, in px.
 *
 * The reader scrolls vertically inside every page, so the pan must not win on a
 * vertical drag. `failOffsetY` is the other half of that: a gesture that moves
 * vertically first is handed to the ScrollView and never becomes a page turn.
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
   * The chapter the pager is centred on.
   *
   * Deliberately NOT the route's chapter. This advances the instant a flick
   * settles, so the visuals never wait for React to commit a navigation — which is
   * what made fast swiping feel blocked. The route catches up via
   * `onChapterChange` and is reconciled below.
   */
  const [centre, setCentre] = useState<ChapterLocation>({ bookId, chapterNumber });
  const centreRef = useRef(centre);
  centreRef.current = centre;

  /**
   * Chapters dispatched to the route but not yet seen in props, oldest first.
   *
   * Same reasoning as the ViewPager path: with two flicks in flight the FIRST
   * chapter commits first, so treating every committed change as a reason to
   * re-centre would drag the pager backwards. Props only reset the centre once
   * React has caught up with the newest dispatch; a committed chapter that is not
   * ours (dropdown, deep link) is authoritative and resets immediately.
   */
  const dispatchedRef = useRef<string[]>([]);

  const onChapterChangeRef = useRef(onChapterChange);
  onChapterChangeRef.current = onChapterChange;

  /** Horizontal offset from the centred position, in px. Negative = towards next. */
  const offset = useSharedValue(0);
  /** Offset when the current gesture began, so a takeover starts from the right place. */
  const gestureStart = useSharedValue(0);

  const nav = useMemo(
    () => computeChapterNavigation(centre.bookId, centre.chapterNumber, booksMetadata, false),
    [centre, booksMetadata]
  );

  /**
   * The rendered window, centred on `centre`.
   *
   * Built by walking outward with the same pure resolver the rest of the app uses,
   * so book boundaries and the two ends of the Bible need no special cases here.
   */
  const windowChapters = useMemo(() => {
    const before: ChapterLocation[] = [];
    let cursor: ChapterLocation | null = centre;
    for (let i = 0; i < WINDOW_RADIUS && cursor; i++) {
      cursor = computeChapterNavigation(
        cursor.bookId,
        cursor.chapterNumber,
        booksMetadata,
        false
      ).prevChapter;
      if (cursor) before.unshift(cursor);
    }
    const after: ChapterLocation[] = [];
    cursor = centre;
    for (let i = 0; i < WINDOW_RADIUS && cursor; i++) {
      cursor = computeChapterNavigation(
        cursor.bookId,
        cursor.chapterNumber,
        booksMetadata,
        false
      ).nextChapter;
      if (cursor) after.push(cursor);
    }
    return { before, after, all: [...before, centre, ...after] };
  }, [centre, booksMetadata]);

  /**
   * Snap the offset back to the centred position, after the window has moved.
   *
   * `useLayoutEffect` rather than `useEffect` so the correction is issued in the
   * same commit that changed the window, not a frame later. The window shift moves
   * the target chapter one slot towards the centre and this removes the matching
   * amount of offset, so the two cancel and the chapter stays on the same pixels.
   */
  useLayoutEffect(() => {
    offset.value = 0;
  }, [centre, offset]);

  /** Index of the centred chapter within the rendered window. */
  const centreIndex = windowChapters.before.length;

  // Reconcile the route's chapter with the pager's centre.
  useEffect(() => {
    const committed = keyOf({ bookId, chapterNumber });
    const queue = dispatchedRef.current;
    const at = queue.indexOf(committed);
    if (at === -1) {
      // Came from somewhere else entirely — that wins.
      queue.length = 0;
      if (keyOf(centreRef.current) !== committed) {
        // No offset write here either — same one-frame flash. The layout effect
        // below corrects it once the new window is committed.
        setCentre({ bookId, chapterNumber });
      }
      return;
    }
    queue.splice(0, at + 1);
  }, [bookId, chapterNumber]);

  /**
   * Commit a settled flick: move the centre and zero the offset together.
   *
   * Both happen in the same React commit on purpose. The offset is animated to
   * ±width so the target page is fully on screen; re-centring shifts the window by
   * one slot and resets the offset to 0, which lands on the same pixels. The user
   * sees continuous motion, never a jump.
   */
  const commitFlick = useCallback((target: ChapterLocation) => {
    const span = perfSpan('gesturePager.commit', { to: keyOf(target) });
    // The offset is deliberately LEFT at ±width here. It is corrected in the
    // layout effect below, once the shifted window has actually committed.
    //
    // Zeroing it here — the obvious-looking thing — flashed the PREVIOUS chapter
    // for a frame on every single swipe. A shared-value write from the JS thread
    // lands on the UI thread on the next frame, while `setCentre` needs a React
    // render first, so for that frame the offset was zero against the OLD window,
    // which puts the previous chapter under the viewport. Leaving it at ±width
    // keeps the TARGET chapter under the viewport for exactly as long as the old
    // window is still on screen.
    setCentre(target);
    dispatchedRef.current.push(keyOf(target));
    perfAdd('gesturePager.flickPaged', 1);
    onChapterChangeRef.current(target.bookId, target.chapterNumber);
    span();
  }, []);

  const settleBack = useCallback(() => {
    perfAdd('gesturePager.flickCancelled', 1);
  }, []);

  const pan = useMemo(() => {
    const canPrev = nav.prevChapter !== null;
    const canNext = nav.nextChapter !== null;
    const prev = nav.prevChapter;
    const next = nav.nextChapter;

    return Gesture.Pan()
      .activeOffsetX([-ACTIVATE_X, ACTIVATE_X])
      .failOffsetY([-FAIL_Y, FAIL_Y])
      .onStart(() => {
        'worklet';
        // Take over any settle already in flight. This single line is what
        // ViewPager2 would not do: input is never refused because there is no
        // state in which the component owns the position instead of the gesture.
        cancelAnimation(offset);
        gestureStart.value = offset.value;
      })
      .onUpdate((e) => {
        'worklet';
        if (width <= 0) return;
        let next_ = gestureStart.value + e.translationX;
        // Refuse to travel past a boundary rather than rubber-banding into empty
        // space: at Genesis 1 there is no previous chapter to reveal.
        const max = canPrev ? width : 0;
        const min = canNext ? -width : 0;
        if (next_ > max) next_ = max;
        if (next_ < min) next_ = min;
        offset.value = next_;
      })
      .onEnd((e) => {
        'worklet';
        if (width <= 0) return;
        const travelled = offset.value;
        const fast = Math.abs(e.velocityX) > PAGE_VELOCITY;
        const far = Math.abs(travelled) > width * PAGE_DISTANCE_RATIO;
        // Direction comes from velocity when the flick was fast, and from where the
        // finger actually left the page when it was slow — a slow drag can end
        // moving slightly backwards without meaning to reverse.
        const forward = fast ? e.velocityX < 0 : travelled < 0;

        const target = forward ? next : prev;
        if ((fast || far) && target) {
          offset.value = withTiming(
            forward ? -width : width,
            { duration: SETTLE_MS, easing: Easing.out(Easing.cubic) },
            (finished) => {
              'worklet';
              if (finished) runOnJS(commitFlick)(target);
            }
          );
          return;
        }
        offset.value = withTiming(0, { duration: SETTLE_MS, easing: Easing.out(Easing.cubic) });
        runOnJS(settleBack)();
      });
  }, [nav, width, offset, gestureStart, commitFlick, settleBack]);

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -centreIndex * width + offset.value }],
  }));

  return (
    <View
      style={styles.container}
      testID="gesture-chapter-pager"
      onLayout={(e) => {
        const next = Math.round(e.nativeEvent.layout.width);
        if (next > 0 && next !== width) setWidth(next);
      }}
    >
      {width > 0 && (
        <GestureDetector gesture={pan}>
          <Animated.View
            style={[styles.row, { width: width * windowChapters.all.length }, rowStyle]}
          >
            {windowChapters.all.map((loc) => (
              // Chapter-keyed, like the ViewPager path: the window slides, so a
              // slot-based key would have React reuse one page instance for a
              // different chapter and lose its scroll position.
              <View key={keyOf(loc)} style={[styles.page, { width }]}>
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
    flexDirection: 'row',
  },
  page: {
    flex: 1,
  },
});
