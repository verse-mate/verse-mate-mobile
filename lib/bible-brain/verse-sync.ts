/**
 * Verse-level audio sync for Bible Brain narration.
 *
 * The backend's `/bible/brain/timestamps/...` route returns one entry per
 * verse — `{ verse, seconds }`, ascending, with the verse-0 heading marker
 * already stripped. This module turns that into "which verse is being read
 * right now", which the reader uses to highlight along with the audio.
 *
 * Pure and dependency-free so it can be tested exhaustively without a player.
 */

export interface VerseTimestamp {
  verse: number;
  seconds: number;
}

/**
 * Index of the verse active at `currentSeconds`, or -1 before the first verse
 * starts. Binary search: this runs on every player tick (every 250ms), so a
 * linear scan over a 176-verse chapter is avoidable waste.
 *
 * `timestamps` must be ascending by `seconds`; use `normalizeTimestamps` on
 * anything coming off the wire.
 */
export function findActiveVerseIndex(
  timestamps: readonly VerseTimestamp[],
  currentSeconds: number,
): number {
  if (timestamps.length === 0) return -1;
  if (currentSeconds < timestamps[0].seconds) return -1;

  let low = 0;
  let high = timestamps.length - 1;
  let answer = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (timestamps[mid].seconds <= currentSeconds) {
      answer = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return answer;
}

/** The active verse number, or null before narration reaches verse 1. */
export function findActiveVerse(
  timestamps: readonly VerseTimestamp[],
  currentSeconds: number,
): number | null {
  const index = findActiveVerseIndex(timestamps, currentSeconds);
  return index === -1 ? null : timestamps[index].verse;
}

/**
 * Playback offset for a verse, for tap-to-jump. Returns null for a verse the
 * fileset has no timing for (some filesets omit trailing verses).
 */
export function seekSecondsForVerse(
  timestamps: readonly VerseTimestamp[],
  verse: number,
): number | null {
  const hit = timestamps.find((entry) => entry.verse === verse);
  return hit ? hit.seconds : null;
}

/**
 * Sort ascending, drop entries that aren't usable, and de-duplicate by verse
 * keeping the earliest offset.
 *
 * Upstream is normally well-formed, but a malformed entry silently breaks the
 * binary search's ordering assumption — which would surface as verses
 * highlighting out of order rather than as an error, so it is cheaper to
 * normalize once at the boundary.
 */
export function normalizeTimestamps(
  raw: readonly { verse?: number | null; seconds?: number | null }[],
): VerseTimestamp[] {
  const byVerse = new Map<number, number>();
  for (const entry of raw) {
    // Reject null/undefined before coercing: Number(null) is 0, not NaN, so a
    // null offset would otherwise be kept as "this verse starts at 0s" and the
    // verse would highlight from the very beginning of the chapter.
    if (entry?.verse == null || entry?.seconds == null) continue;
    const verse = Number(entry.verse);
    const seconds = Number(entry.seconds);
    if (!Number.isFinite(verse) || verse <= 0) continue;
    if (!Number.isFinite(seconds) || seconds < 0) continue;
    const existing = byVerse.get(verse);
    if (existing === undefined || seconds < existing) byVerse.set(verse, seconds);
  }
  return [...byVerse.entries()]
    .map(([verse, seconds]) => ({ verse, seconds }))
    .sort((a, b) => a.seconds - b.seconds || a.verse - b.verse);
}

/**
 * Window of verses to keep rendered/highlighted around the active one. The
 * reader is viewport-windowed, so this keeps the highlight cheap on long
 * chapters.
 */
export function verseHighlightWindow(
  timestamps: readonly VerseTimestamp[],
  currentSeconds: number,
  radius = 2,
): { active: number | null; nearby: number[] } {
  const index = findActiveVerseIndex(timestamps, currentSeconds);
  if (index === -1) return { active: null, nearby: [] };
  const from = Math.max(0, index - radius);
  const to = Math.min(timestamps.length - 1, index + radius);
  const nearby: number[] = [];
  for (let i = from; i <= to; i++) nearby.push(timestamps[i].verse);
  return { active: timestamps[index].verse, nearby };
}
