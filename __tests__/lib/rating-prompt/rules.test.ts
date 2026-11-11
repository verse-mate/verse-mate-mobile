import {
  initialRatingState,
  localDay,
  type RatingPromptState,
  ratingRefusal,
  recordChapterOpen,
  recordRatingRequest,
  repairRatingState,
} from '@/lib/rating-prompt/rules';

const at = (day: string, time = '10:00') => new Date(`${day}T${time}:00`);
const FIRST_SESSION = 'session-1';
const LATER_SESSION = 'session-2';

function readOn(state: RatingPromptState, days: string[]) {
  let current = state;
  let fifthDayDue = false;
  for (const day of days) {
    ({ state: current, fifthDayDue } = recordChapterOpen(current, at(day)));
  }
  return { state: current, fifthDayDue };
}

describe('rating prompt rules', () => {
  it('uses the local calendar day, not the UTC one', () => {
    const originalTz = process.env.TZ;
    process.env.TZ = 'America/Sao_Paulo';
    try {
      const lateEvening = new Date(2026, 0, 2, 23, 30);
      expect(lateEvening.toISOString().slice(0, 10)).toBe('2026-01-03');
      expect(localDay(lateEvening)).toBe('2026-01-02');
    } finally {
      process.env.TZ = originalTz;
    }
  });

  it('refuses during the first session, even after midnight', () => {
    const state = initialRatingState(at('2026-12-01', '23:50'), FIRST_SESSION);
    expect(ratingRefusal(state, at('2026-12-02', '00:20'), '1.8.0', FIRST_SESSION)).toBe(
      'first_session'
    );
  });

  it('refuses on the first-launch day in a later session', () => {
    const state = initialRatingState(at('2026-12-01', '08:00'), FIRST_SESSION);
    expect(ratingRefusal(state, at('2026-12-01', '20:00'), '1.8.0', LATER_SESSION)).toBe(
      'first_day'
    );
  });

  it('allows a later day in a later session', () => {
    const state = initialRatingState(at('2026-12-01'), FIRST_SESSION);
    expect(ratingRefusal(state, at('2026-12-02'), '1.8.0', LATER_SESSION)).toBeNull();
  });

  it('counts the first-launch day and fires on the fifth reading day, not before', () => {
    const start = initialRatingState(at('2026-12-01'), FIRST_SESSION);
    const fourDays = readOn(start, [
      '2026-12-01',
      '2026-12-03',
      '2026-12-04',
      '2026-12-04',
      '2026-12-06',
    ]);
    expect(fourDays.state.readingDays).toBe(4);
    expect(fourDays.fifthDayDue).toBe(false);
    const fifth = readOn(fourDays.state, ['2026-12-09']);
    expect(fifth.state.readingDays).toBe(5);
    expect(fifth.fifthDayDue).toBe(true);
  });

  it('keeps the fifth-day moment armed for a later reading day, not the same day', () => {
    const start = initialRatingState(at('2026-12-01'), FIRST_SESSION);
    const fifth = readOn(start, [
      '2026-12-01',
      '2026-12-03',
      '2026-12-04',
      '2026-12-06',
      '2026-12-09',
    ]);
    expect(fifth.fifthDayDue).toBe(true);
    const sameDay = recordChapterOpen(fifth.state, at('2026-12-09', '18:00'));
    expect(sameDay.fifthDayDue).toBe(false);
    const later = recordChapterOpen(sameDay.state, at('2026-12-12'));
    expect(later.fifthDayDue).toBe(true);
  });

  it('disarms the fifth-day moment once a request was made for it', () => {
    const start = initialRatingState(at('2026-12-01'), FIRST_SESSION);
    const fifth = readOn(start, [
      '2026-12-01',
      '2026-12-03',
      '2026-12-04',
      '2026-12-06',
      '2026-12-09',
    ]);
    const asked = recordRatingRequest(fifth.state, at('2026-12-09'), '1.8.0', 'fifth_reading_day');
    expect(recordChapterOpen(asked, at('2026-12-12')).fifthDayDue).toBe(false);
  });

  it('asks once per store version', () => {
    const start = initialRatingState(at('2026-08-01'), FIRST_SESSION);
    const asked = recordRatingRequest(start, at('2026-12-01'), '1.8.0', 'finished_chapter');
    expect(ratingRefusal(asked, at('2027-03-05'), '1.8.0', LATER_SESSION)).toBe('version');
  });

  it('waits 90 days after a request, even on a new version', () => {
    const start = initialRatingState(at('2026-01-01'), FIRST_SESSION);
    const asked = recordRatingRequest(start, at('2026-03-01'), '1.7.0', 'finished_chapter');
    expect(ratingRefusal(asked, at('2026-04-10'), '1.8.0', LATER_SESSION)).toBe('too_soon');
    expect(ratingRefusal(asked, at('2026-06-29'), '1.8.0', LATER_SESSION)).toBeNull();
  });

  it('asks at most three times in 365 days', () => {
    let state = initialRatingState(at('2025-01-01'), FIRST_SESSION);
    state = recordRatingRequest(state, at('2025-01-10'), '1.1.0', 'finished_chapter');
    state = recordRatingRequest(state, at('2025-04-15'), '1.2.0', 'finished_chapter');
    state = recordRatingRequest(state, at('2025-07-20'), '1.3.0', 'finished_chapter');
    expect(ratingRefusal(state, at('2025-11-01'), '1.4.0', LATER_SESSION)).toBe('yearly_cap');
    expect(ratingRefusal(state, at('2026-01-11'), '1.4.0', LATER_SESSION)).toBeNull();
  });

  it('starts over when the stored state is unusable', () => {
    expect(repairRatingState({ requests: 'oops' }, at('2026-12-05'), LATER_SESSION)).toEqual(
      initialRatingState(at('2026-12-05'), LATER_SESSION)
    );
  });

  it('keeps the request history when one stored request is damaged', () => {
    const start = initialRatingState(at('2026-01-01'), FIRST_SESSION);
    const asked = recordRatingRequest(start, at('2026-03-01'), '1.7.0', 'finished_chapter');
    const damaged = {
      ...asked,
      requests: [
        ...asked.requests,
        { at: 'not a date', version: '1.7.1', trigger: 'finished_chapter' },
      ],
    };
    const repaired = repairRatingState(damaged, at('2026-04-01'), LATER_SESSION);
    expect(repaired.requests).toHaveLength(2);
    expect(repaired.requests[0]).toEqual(asked.requests[0]);
    expect(ratingRefusal(repaired, at('2026-04-10'), '1.8.0', LATER_SESSION)).toBe('too_soon');
  });

  it('refuses rather than skipping the caps when a stored date is unreadable', () => {
    const start = initialRatingState(at('2026-01-01'), FIRST_SESSION);
    const broken = {
      ...start,
      requests: [{ at: 'not a date', version: '1.7.0', trigger: 'finished_chapter' as const }],
    };
    expect(ratingRefusal(broken, at('2026-06-01'), '1.8.0', LATER_SESSION)).toBe('too_soon');
  });

  it('does not stay blocked when the clock moved backwards', () => {
    const start = initialRatingState(at('2026-01-01'), FIRST_SESSION);
    const asked = recordRatingRequest(start, at('2030-01-01'), '1.7.0', 'finished_chapter');
    expect(ratingRefusal(asked, at('2029-12-01'), '1.8.0', LATER_SESSION)).toBe('too_soon');
    expect(ratingRefusal(asked, at('2026-06-01'), '1.8.0', LATER_SESSION)).toBeNull();
  });
});
