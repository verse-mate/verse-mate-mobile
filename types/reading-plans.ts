export interface ReadingPlanEntry {
  day: number;
  bookId: number;
  chapterStart: number;
  chapterEnd: number;
}

export interface ReadingPlan {
  id: string;
  name: string;
  description: string;
  durationDays: number;
  entries: ReadingPlanEntry[];
}

export interface UserReadingPlanProgress {
  planId: string;
  startDate: string;
  completedDays: number[];
  currentDay: number;
}
