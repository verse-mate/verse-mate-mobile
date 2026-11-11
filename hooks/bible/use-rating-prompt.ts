import { useIsFocused } from '@react-navigation/native';
import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { hasOpenOverlay } from '@/lib/rating-prompt/blockers';
import {
  isFifthDayPending,
  noteChapterOpened,
  requestRating,
} from '@/lib/rating-prompt/controller';
import { MIN_READING_MS } from '@/lib/rating-prompt/rules';

const TICK_MS = 1_000;
const CALM_MS = 2_000;

interface ChapterVisit {
  activeMs: number;
  activeSince: number | null;
  reachedEnd: boolean;
  finishedPending: boolean;
  finishedHandled: boolean;
  lastActivity: number;
}

const newVisit = (now: number): ChapterVisit => ({
  activeMs: 0,
  activeSince: AppState.currentState === 'active' ? now : null,
  reachedEnd: false,
  finishedPending: false,
  finishedHandled: false,
  lastActivity: now,
});

export function useRatingPrompt(bookId: number, chapterNumber: number) {
  const visitRef = useRef<ChapterVisit>(newVisit(Date.now()));
  const isFocused = useIsFocused();
  const focusedRef = useRef(isFocused);
  focusedRef.current = isFocused;

  useEffect(() => {
    visitRef.current = newVisit(Date.now());
    noteChapterOpened().catch(() => undefined);
    const subscription = AppState.addEventListener('change', (next) => {
      const visit = visitRef.current;
      const now = Date.now();
      if (next === 'active') {
        visit.activeSince ??= now;
        visit.lastActivity = now;
      } else if (visit.activeSince !== null) {
        visit.activeMs += now - visit.activeSince;
        visit.activeSince = null;
      }
    });

    const timer = setInterval(() => {
      const visit = visitRef.current;
      const now = Date.now();
      const readMs = visit.activeMs + (visit.activeSince === null ? 0 : now - visit.activeSince);
      if (!visit.finishedHandled && visit.reachedEnd && readMs >= MIN_READING_MS) {
        visit.finishedHandled = true;
        visit.finishedPending = true;
      }
      const trigger = visit.finishedPending
        ? 'finished_chapter'
        : isFifthDayPending()
          ? 'fifth_reading_day'
          : null;
      if (!trigger) return;
      const calm =
        focusedRef.current &&
        AppState.currentState === 'active' &&
        !hasOpenOverlay() &&
        now - visit.lastActivity >= CALM_MS;
      if (!calm) return;
      if (trigger === 'finished_chapter') visit.finishedPending = false;
      requestRating(trigger).catch(() => undefined);
    }, TICK_MS);

    return () => {
      subscription.remove();
      clearInterval(timer);
    };
  }, [bookId, chapterNumber]);

  const onReaderScroll = useCallback((isAtBottom: boolean) => {
    const visit = visitRef.current;
    visit.lastActivity = Date.now();
    if (isAtBottom) visit.reachedEnd = true;
  }, []);

  return { onReaderScroll };
}
