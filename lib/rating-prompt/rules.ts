export type RatingTrigger = 'finished_chapter' | 'fifth_reading_day';

export type RatingRefusal = 'first_session' | 'first_day' | 'version' | 'too_soon' | 'yearly_cap';

export interface RatingRequestRecord {
  at: string;
  version: string;
  trigger: RatingTrigger;
}

export interface RatingPromptState {
  firstLaunchDay: string;
  firstSessionId: string;
  readingDays: number;
  lastReadingDay: string | null;
  fifthDayRequested: boolean;
  requests: RatingRequestRecord[];
}

export const READING_DAYS_FOR_PROMPT = 5;
export const MIN_READING_MS = 60_000;
const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_DAYS_BETWEEN_REQUESTS = 90;
const MAX_REQUESTS_PER_YEAR = 3;
const YEAR_DAYS = 365;

export function localDay(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function initialRatingState(now: Date, sessionId: string): RatingPromptState {
  return {
    firstLaunchDay: localDay(now),
    firstSessionId: sessionId,
    readingDays: 0,
    lastReadingDay: null,
    fifthDayRequested: false,
    requests: [],
  };
}

export function recordChapterOpen(
  state: RatingPromptState,
  now: Date
): { state: RatingPromptState; fifthDayDue: boolean } {
  const today = localDay(now);
  if (state.lastReadingDay === today) return { state, fifthDayDue: false };
  const next = { ...state, readingDays: state.readingDays + 1, lastReadingDay: today };
  const fifthDayDue = next.readingDays >= READING_DAYS_FOR_PROMPT && !next.fifthDayRequested;
  return { state: next, fifthDayDue };
}

const daysApart = (a: Date, b: Date) => Math.abs(a.getTime() - b.getTime()) / DAY_MS;

function repairRequest(value: unknown, now: Date): RatingRequestRecord {
  const request = (value ?? {}) as Partial<RatingRequestRecord>;
  const at =
    typeof request.at === 'string' && !Number.isNaN(Date.parse(request.at))
      ? request.at
      : now.toISOString();
  return {
    at,
    version: typeof request.version === 'string' ? request.version : 'unknown',
    trigger: request.trigger === 'fifth_reading_day' ? 'fifth_reading_day' : 'finished_chapter',
  };
}

export function repairRatingState(
  value: unknown,
  now: Date,
  sessionId: string
): RatingPromptState {
  const state = (value ?? {}) as Partial<RatingPromptState>;
  const usable =
    typeof state.firstLaunchDay === 'string' &&
    typeof state.firstSessionId === 'string' &&
    Number.isFinite(state.readingDays) &&
    (state.lastReadingDay === null || typeof state.lastReadingDay === 'string') &&
    typeof state.fifthDayRequested === 'boolean' &&
    Array.isArray(state.requests);
  if (!usable) return initialRatingState(now, sessionId);
  const requests = (state.requests as unknown[]).map((request) => repairRequest(request, now));
  return { ...(state as RatingPromptState), requests };
}

export function ratingRefusal(
  state: RatingPromptState,
  now: Date,
  version: string,
  sessionId: string
): RatingRefusal | null {
  if (state.firstSessionId === sessionId) return 'first_session';
  if (state.firstLaunchDay === localDay(now)) return 'first_day';
  if (state.requests.some((request) => request.version === version)) return 'version';
  const gaps = state.requests.map((request) => daysApart(now, new Date(request.at)));
  if (gaps.some((gap) => Number.isNaN(gap) || gap < MIN_DAYS_BETWEEN_REQUESTS)) return 'too_soon';
  if (gaps.filter((gap) => gap < YEAR_DAYS).length >= MAX_REQUESTS_PER_YEAR) return 'yearly_cap';
  return null;
}

export function recordRatingRequest(
  state: RatingPromptState,
  now: Date,
  version: string,
  trigger: RatingTrigger
): RatingPromptState {
  return {
    ...state,
    fifthDayRequested: state.fifthDayRequested || trigger === 'fifth_reading_day',
    requests: [...state.requests, { at: now.toISOString(), version, trigger }],
  };
}
