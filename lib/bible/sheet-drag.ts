/**
 * When a bottom sheet with a scrolling body takes a drag for itself.
 *
 * The body hands a drag to the sheet only when it moves downward with the
 * content already at its top; any other drag stays with the scroll view, so a
 * long analysis can be read to the end and scrolled back up without closing.
 */
const SLOP = 6;

export type SheetDragDecision = 'activate' | 'fail' | 'wait';

export function sheetDragDecision(scrollOffset: number, dy: number): SheetDragDecision {
  if (scrollOffset > 0 || dy < -SLOP) return 'fail';
  if (dy > SLOP) return 'activate';
  return 'wait';
}

export function sheetDragDismisses(dy: number, velocityY: number): boolean {
  return dy > 70 || (dy > 20 && velocityY > 600);
}
