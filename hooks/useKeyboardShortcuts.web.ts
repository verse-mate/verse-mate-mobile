import { useEffect } from 'react';

/**
 * Keyboard shortcuts for web desktop
 *
 * - Left/Right arrows: chapter navigation
 * - Escape: close modals
 */
export function useKeyboardShortcuts(handlers: {
  onNextChapter?: () => void;
  onPrevChapter?: () => void;
  onEscape?: () => void;
}) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if user is typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault();
          handlers.onNextChapter?.();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          handlers.onPrevChapter?.();
          break;
        case 'Escape':
          handlers.onEscape?.();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlers.onNextChapter, handlers.onPrevChapter, handlers.onEscape]);
}
