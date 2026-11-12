import { useEffect } from 'react';

const HOLD_LEASE_MS = 10_000;

let openOverlays = 0;
const holdLeases = new Map<string, number>();
let lastActivityAt = 0;

export function noteReaderActivity(now: number = Date.now()): void {
  lastActivityAt = now;
}

export function setRatingPromptHold(key: string, held: boolean): void {
  const now = Date.now();
  if (held) holdLeases.set(key, now + HOLD_LEASE_MS);
  else holdLeases.delete(key);
  noteReaderActivity(now);
}

function hasLiveHold(now: number): boolean {
  for (const [key, expiresAt] of holdLeases) {
    if (expiresAt > now && expiresAt - now <= HOLD_LEASE_MS) return true;
    holdLeases.delete(key);
  }
  return false;
}

export function isReaderCalm(now: number, calmMs: number): boolean {
  const sinceActivity = now - lastActivityAt;
  const settled = sinceActivity >= calmMs || sinceActivity < 0;
  return openOverlays === 0 && !hasLiveHold(now) && settled;
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
