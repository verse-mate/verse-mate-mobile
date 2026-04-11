import AsyncStorage from '@react-native-async-storage/async-storage';
import { getReadingPlanById } from '@/constants/reading-plans';
import type { ReadingPlanEntry, UserReadingPlanProgress } from '@/types/reading-plans';

const STORAGE_KEY = 'versemate:reading-plan:active';

export async function getActiveReadingPlan(): Promise<UserReadingPlanProgress | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  return JSON.parse(raw) as UserReadingPlanProgress;
}

export async function startReadingPlan(planId: string): Promise<UserReadingPlanProgress> {
  const progress: UserReadingPlanProgress = {
    planId,
    startDate: new Date().toISOString().split('T')[0],
    completedDays: [],
    currentDay: 1,
  };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  return progress;
}

export async function markDayComplete(day: number): Promise<UserReadingPlanProgress | null> {
  const progress = await getActiveReadingPlan();
  if (!progress) return null;

  if (!progress.completedDays.includes(day)) {
    progress.completedDays.push(day);
    progress.completedDays.sort((a, b) => a - b);
  }

  // Advance current day to next incomplete day
  const plan = getReadingPlanById(progress.planId);
  if (plan) {
    for (let d = 1; d <= plan.durationDays; d++) {
      if (!progress.completedDays.includes(d)) {
        progress.currentDay = d;
        break;
      }
    }
  }

  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  return progress;
}

export async function stopReadingPlan(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

export function getEntriesForDay(planId: string, day: number): ReadingPlanEntry[] {
  const plan = getReadingPlanById(planId);
  if (!plan) return [];
  return plan.entries.filter((e) => e.day === day);
}

export function getUpcomingEntries(
  planId: string,
  currentDay: number,
  daysAhead = 7
): ReadingPlanEntry[] {
  const plan = getReadingPlanById(planId);
  if (!plan) return [];
  return plan.entries.filter((e) => e.day >= currentDay && e.day < currentDay + daysAhead);
}
