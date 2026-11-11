import { useEffect } from 'react';

let openOverlays = 0;

export function hasOpenOverlay(): boolean {
  return openOverlays > 0;
}

export function useRatingPromptBlocker(open: boolean): void {
  useEffect(() => {
    if (!open) return;
    openOverlays += 1;
    return () => {
      openOverlays -= 1;
    };
  }, [open]);
}
