import { useIsFocused } from '@react-navigation/native';
import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { isReaderCalm, noteReaderActivity } from '@/lib/rating-prompt/blockers';
import {
  isFifthDayPending,
  isRatingPromptEnabled,
  noteChapterOpened,
  requestRating,
} from '@/lib/rating-prompt/controller';
import { MIN_READING_MS } from '@/lib/rating-prompt/rules';

const TICK_MS = 1_000;
const CALM_MS = 2_000;
const REMEMBERED_FITS = 8;

interface ChapterVisit {
  key: string;
  activeMs: number;
  activeSince: number | null;
  atBottom: boolean;
  finishedPending: boolean;
  finishedHandled: boolean;
}

const chapterKey = (bookId: number, chapterNumber: number) => `${bookId}:${chapterNumber}`;

const newVisit = (key: string, now: number): ChapterVisit => ({
  key,
  activeMs: 0,
  activeSince: AppState.currentState === 'active' ? now : null,
  atBottom: false,
  finishedPending: false,
  finishedHandled: false,
});

const readMs = (visit: ChapterVisit, now: number) =>
  visit.activeMs + (visit.activeSince === null ? 0 : now - visit.activeSince);

function markFinishedIfRead(visit: ChapterVisit, now: number): void {
  if (visit.finishedHandled || readMs(visit, now) < MIN_READING_MS) return;
  visit.finishedHandled = true;
  visit.finishedPending = true;
}

export function useRatingPrompt(bookId: number, chapterNumber: number) {
  const key = chapterKey(bookId, chapterNumber);
  const visitRef = useRef<ChapterVisit>(newVisit(key, Date.now()));
  const fitsRef = useRef<string[]>([]);
  const isFocused = useIsFocused();
  const focusedRef = useRef(isFocused);
  focusedRef.current = isFocused;

  useEffect(() => {
    if (!isRatingPromptEnabled()) return;
    visitRef.current = newVisit(key, Date.now());
    noteChapterOpened().catch(() => undefined);

    const subscription = AppState.addEventListener('change', (next) => {
      const visit = visitRef.current;
      const now = Date.now();
      if (next === 'active') {
        visit.activeSince ??= now;
        noteReaderActivity(now);
        noteChapterOpened().catch(() => undefined);
      } else if (visit.activeSince !== null) {
        visit.activeMs += now - visit.activeSince;
        visit.activeSince = null;
      }
    });

    const timer = setInterval(() => {
      const visit = visitRef.current;
      const now = Date.now();
      if (fitsRef.current.includes(visit.key)) markFinishedIfRead(visit, now);
      const trigger = visit.finishedPending
        ? 'finished_chapter'
        : isFifthDayPending()
          ? 'fifth_reading_day'
          : null;
      if (!trigger) return;
      const calm =
        focusedRef.current && AppState.currentState === 'active' && isReaderCalm(now, CALM_MS);
      if (!calm) return;
      if (trigger === 'finished_chapter') visit.finishedPending = false;
      requestRating(trigger).catch(() => undefined);
    }, TICK_MS);

    return () => {
      subscription.remove();
      clearInterval(timer);
    };
  }, [key]);

  const onReaderScroll = useCallback((isAtBottom: boolean) => {
    const visit = visitRef.current;
    const now = Date.now();
    noteReaderActivity(now);
    if (isAtBottom && !visit.atBottom) markFinishedIfRead(visit, now);
    visit.atBottom = isAtBottom;
  }, []);

  const onChapterFitsScreen = useCallback((pageBookId: number, pageChapterNumber: number) => {
    const fitKey = chapterKey(pageBookId, pageChapterNumber);
    if (fitsRef.current.includes(fitKey)) return;
    fitsRef.current = [fitKey, ...fitsRef.current].slice(0, REMEMBERED_FITS);
  }, []);

  return { onReaderScroll, onChapterFitsScreen };
}
