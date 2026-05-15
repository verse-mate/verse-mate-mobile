/**
 * Quick-verse-jump scroll-target math (verse-mate-mobile #77 / VERA-35).
 *
 * react-native-web ships `View.measureLayout` as a stub that never invokes its
 * callbacks, so the native scroll path silently no-ops on web. The web fallback
 * reads positions from the DOM via `getBoundingClientRect` + the ScrollView's
 * current `scrollTop`. Native uses `measureLayout` directly in ChapterPage.
 */

type RectLike = { top: number };
type ScrollableLike = RectLike & { scrollTop: number };

export function computeByLineJumpY(
  scrollRect: ScrollableLike,
  sectionRect: RectLike,
  biasPx: number
): number {
  const y = sectionRect.top - scrollRect.top + scrollRect.scrollTop - biasPx;
  return Math.max(0, y);
}
