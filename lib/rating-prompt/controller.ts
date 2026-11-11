import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import { Platform } from 'react-native';
import { AnalyticsEvent, analytics } from '@/lib/analytics';
import {
  initialRatingState,
  type RatingPromptState,
  type RatingTrigger,
  ratingRefusal,
  recordChapterOpen,
  recordRatingRequest,
} from './rules';
import { requestStoreReview } from './store-review';

export const RATING_PROMPT_STORAGE_KEY = 'rating-prompt:v1';

export type RatingRequestOutcome = 'requested' | 'refused' | 'unavailable' | 'disabled';

const SESSION_ID = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

let statePromise: Promise<RatingPromptState> | null = null;
let fifthDayPending = false;
let requestInFlight = false;

export function isRatingPromptEnabled(): boolean {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return false;
  return process.env.EXPO_PUBLIC_APP_ENV !== 'e2e-test';
}

async function readState(now: Date): Promise<RatingPromptState> {
  const stored = await AsyncStorage.getItem(RATING_PROMPT_STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored) as RatingPromptState;
    } catch {
      return initialRatingState(now, SESSION_ID);
    }
  }
  const fresh = initialRatingState(now, SESSION_ID);
  await AsyncStorage.setItem(RATING_PROMPT_STORAGE_KEY, JSON.stringify(fresh));
  return fresh;
}

function loadState(now: Date): Promise<RatingPromptState> {
  statePromise ??= readState(now);
  return statePromise;
}

async function saveState(state: RatingPromptState): Promise<void> {
  statePromise = Promise.resolve(state);
  await AsyncStorage.setItem(RATING_PROMPT_STORAGE_KEY, JSON.stringify(state));
}

export async function noteChapterOpened(now: Date = new Date()): Promise<void> {
  if (!isRatingPromptEnabled()) return;
  const result = recordChapterOpen(await loadState(now), now);
  await saveState(result.state);
  if (result.fifthDayDue) fifthDayPending = true;
}

export function isFifthDayPending(): boolean {
  return fifthDayPending;
}

export async function requestRating(
  trigger: RatingTrigger,
  now: Date = new Date()
): Promise<RatingRequestOutcome> {
  if (!isRatingPromptEnabled()) return 'disabled';
  if (requestInFlight) return 'refused';
  requestInFlight = true;
  try {
    if (trigger === 'fifth_reading_day') fifthDayPending = false;
    const version = Application.nativeApplicationVersion ?? 'unknown';
    const state = await loadState(now);
    if (ratingRefusal(state, now, version, SESSION_ID)) return 'refused';
    if (!(await requestStoreReview())) return 'unavailable';
    await saveState(recordRatingRequest(state, now, version, trigger));
    analytics.track(AnalyticsEvent.RATING_PROMPT_REQUESTED, {
      trigger,
      app_version: version,
      platform: Platform.OS as 'ios' | 'android',
    });
    return 'requested';
  } catch {
    return 'unavailable';
  } finally {
    requestInFlight = false;
  }
}
