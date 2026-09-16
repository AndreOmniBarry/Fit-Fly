// Sidecar types for program-calendar.js (hand-written JS, untouched — see
// tsconfig.json).
import type { SessionRecord } from '../../db/repositories/sessions.js';

export function localDateFromIso(isoTimestamp: string): string;
export function sessionDatesForProgram(sessions: Pick<SessionRecord, 'startedAt'>[]): Set<string>;
export function currentWeekRange(todayDate: string): { start: string; end: string };
export function weeklySessionProgress(
  sessionDates: Set<string>,
  todayDate: string,
  plannedDaysPerWeek: number
): { completed: number; planned: number; percent: number };
export function classifyProgramCalendarDay(input: {
  date: string;
  hasSession: boolean;
  isFuture: boolean;
  programStartDate: string | null;
}): 'logged' | 'future' | 'before-program' | 'rest';
