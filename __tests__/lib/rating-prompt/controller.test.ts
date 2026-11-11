import type { RatingPromptState } from '@/lib/rating-prompt/rules';

jest.mock('expo', () => ({ requireOptionalNativeModule: jest.fn(() => ({})) }));
jest.mock('expo-store-review', () => ({
  isAvailableAsync: jest.fn(() => Promise.resolve(true)),
  requestReview: jest.fn(() => Promise.resolve()),
}));
jest.mock('expo-application', () => ({ nativeApplicationVersion: '1.8.0' }));
jest.mock('@/lib/analytics', () => ({
  ...jest.requireActual('@/lib/analytics/types'),
  analytics: { track: jest.fn() },
}));

const KEY = 'rating-prompt:v1';
const at = (day: string) => new Date(`${day}T10:00:00`);

type Session = {
  controller: typeof import('@/lib/rating-prompt/controller');
  storage: { getItem: jest.Mock; setItem: jest.Mock };
  storeReview: { isAvailableAsync: jest.Mock; requestReview: jest.Mock };
  expo: { requireOptionalNativeModule: jest.Mock };
  analytics: { track: jest.Mock };
  platform: { OS: string };
};

async function startSession(stored?: RatingPromptState): Promise<Session> {
  jest.resetModules();
  const session: Session = {
    controller: require('@/lib/rating-prompt/controller'),
    storage: require('@react-native-async-storage/async-storage'),
    storeReview: require('expo-store-review'),
    expo: require('expo'),
    analytics: require('@/lib/analytics').analytics,
    platform: require('react-native').Platform,
  };
  if (stored) await session.storage.setItem(KEY, JSON.stringify(stored));
  return session;
}

const earlierState = (overrides: Partial<RatingPromptState> = {}): RatingPromptState => ({
  firstLaunchDay: '2026-12-01',
  firstSessionId: 'an-earlier-session',
  readingDays: 2,
  lastReadingDay: '2026-12-02',
  fifthDayRequested: false,
  requests: [],
  ...overrides,
});

const storedState = async (session: Session): Promise<RatingPromptState> =>
  JSON.parse((await session.storage.getItem(KEY)) as string);

describe('rating prompt controller', () => {
  const originalEnv = process.env.EXPO_PUBLIC_APP_ENV;
  afterEach(() => {
    process.env.EXPO_PUBLIC_APP_ENV = originalEnv;
  });

  it('never asks in the first session', async () => {
    const session = await startSession();
    await session.controller.noteChapterOpened(at('2026-12-01'));
    expect(await session.controller.requestRating('finished_chapter', at('2026-12-02'))).toBe(
      'refused'
    );
    expect(session.storeReview.requestReview).not.toHaveBeenCalled();
  });

  it('requests the sheet, records the request and tracks the event', async () => {
    const session = await startSession(earlierState());
    expect(await session.controller.requestRating('finished_chapter', at('2026-12-05'))).toBe(
      'requested'
    );
    expect(session.storeReview.requestReview).toHaveBeenCalledTimes(1);
    expect((await storedState(session)).requests).toEqual([
      { at: at('2026-12-05').toISOString(), version: '1.8.0', trigger: 'finished_chapter' },
    ]);
    expect(session.analytics.track).toHaveBeenCalledWith('RATING_PROMPT_REQUESTED', {
      trigger: 'finished_chapter',
      app_version: '1.8.0',
      platform: 'ios',
    });
  });

  it('keeps the caps across restarts', async () => {
    const first = await startSession(earlierState());
    await first.controller.requestRating('finished_chapter', at('2026-12-05'));
    const persisted = await storedState(first);
    const restarted = await startSession(persisted);
    expect(await restarted.controller.requestRating('finished_chapter', at('2027-03-05'))).toBe(
      'refused'
    );
    expect(restarted.storeReview.requestReview).not.toHaveBeenCalled();
  });

  it('stores nothing when the platform reports no review sheet', async () => {
    const session = await startSession(earlierState());
    session.storeReview.isAvailableAsync.mockResolvedValueOnce(false);
    expect(await session.controller.requestRating('finished_chapter', at('2026-12-05'))).toBe(
      'unavailable'
    );
    expect(session.storeReview.requestReview).not.toHaveBeenCalled();
    expect((await storedState(session)).requests).toEqual([]);
  });

  it('never opens the store when the native module is missing', async () => {
    const session = await startSession(earlierState());
    session.expo.requireOptionalNativeModule.mockReturnValueOnce(null);
    expect(await session.controller.requestRating('finished_chapter', at('2026-12-05'))).toBe(
      'unavailable'
    );
    expect(session.storeReview.requestReview).not.toHaveBeenCalled();
    expect((await storedState(session)).requests).toEqual([]);
  });

  it('never asks on the web build', async () => {
    const session = await startSession(earlierState());
    const original = session.platform.OS;
    session.platform.OS = 'web';
    try {
      expect(await session.controller.requestRating('finished_chapter', at('2026-12-05'))).toBe(
        'disabled'
      );
    } finally {
      session.platform.OS = original;
    }
    expect(session.storeReview.requestReview).not.toHaveBeenCalled();
  });

  it('never asks in the e2e test build', async () => {
    process.env.EXPO_PUBLIC_APP_ENV = 'e2e-test';
    const session = await startSession(earlierState());
    expect(await session.controller.requestRating('finished_chapter', at('2026-12-05'))).toBe(
      'disabled'
    );
  });

  it('marks the fifth reading day as pending and records the request for it', async () => {
    const session = await startSession(
      earlierState({ readingDays: 4, lastReadingDay: '2026-12-06' })
    );
    await session.controller.noteChapterOpened(at('2026-12-09'));
    expect(session.controller.isFifthDayPending()).toBe(true);
    expect(await session.controller.requestRating('fifth_reading_day', at('2026-12-09'))).toBe(
      'requested'
    );
    expect(session.controller.isFifthDayPending()).toBe(false);
    expect((await storedState(session)).fifthDayRequested).toBe(true);
  });
});
