import { useEffect } from 'react';

let openOverlays = 0;
const holds = new Set<string>();
let lastActivityAt = 0;

export function noteReaderActivity(now: number = Date.now()): void {
  lastActivityAt = now;
}

export function setRatingPromptHold(key: string, held: boolean): void {
  if (held) holds.add(key);
  else holds.delete(key);
  noteReaderActivity();
}

export function isReaderCalm(now: number, calmMs: number): boolean {
  const sinceActivity = now - lastActivityAt;
  const settled = sinceActivity >= calmMs || sinceActivity < 0;
  return openOverlays === 0 && holds.size === 0 && settled;
}

export function useRatingPromptBlocker(open: boolean): void {
  useEffect(() => {
    if (!open) return;
    openOverlays += 1;
    noteReaderActivity();
    return () => {
      openOverlays -= 1;
      noteReaderActivity();
    };
  }, [open]);
}
