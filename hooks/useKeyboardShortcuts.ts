/**
 * Keyboard shortcuts — native no-op
 *
 * Web implementation in useKeyboardShortcuts.web.ts provides
 * arrow key chapter navigation and Escape to close modals.
 */
export function useKeyboardShortcuts(_handlers: {
  onNextChapter?: () => void;
  onPrevChapter?: () => void;
  onEscape?: () => void;
}) {
  // No-op on native — keyboard shortcuts are web-only
}
