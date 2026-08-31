// "What's helping" — real correlations pulled from a person's own logged
// nights, never a fabricated or generic stat. Deliberately conservative:
// a factor only renders once there's enough data on both sides of it to
// say anything meaningful, and the comparison sidesteps the composite
// Sleep score's own consistency component (using it here would be
// circular — see nightQualityProxy below) in favor of a simpler,
// independent proxy: duration weighed with self-rated quality.
import { DEFAULT_SLEEP_GOAL_MINUTES } from './sleep-debt.js';
import type { SleepLog } from './types.js';

const MIN_NIGHTS_PER_GROUP = 3;
const LATE_BEDTIME_START_HOUR = 1; // 1am
const LATE_BEDTIME_END_HOUR = 12; // up to (not including) noon
const CONSISTENT_BEDTIME_WINDOW_MINUTES = 30;

export interface SleepFactorInsight {
  label: string;
  deltaPoints: number;
  favorable: boolean;
  nightsWithFactor: number;
  nightsWithoutFactor: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Duration + self-rated quality only — intentionally simpler than
 *  calculateSleepScore, and independent of bedtime consistency, so it can
 *  be safely compared *across* a consistency split without circularity. */
function nightQualityProxy(log: SleepLog, goalMinutes: number): number {
  const durationPart = clamp((log.durationMinutes / goalMinutes) * 100, 0, 100);
  if (log.quality == null) return durationPart;
  const qualityPart = clamp((log.quality / 5) * 100, 0, 100);
  return durationPart * 0.6 + qualityPart * 0.4;
}

function average(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function bedtimeMinutesSinceNoon(bedTime: string): number {
  const d = new Date(bedTime);
  const totalMinutes = d.getUTCHours() * 60 + d.getUTCMinutes();
  return ((totalMinutes - 720 + 1440) % 1440);
}

function compareGroups<T extends SleepLog>(
  logs: T[],
  goalMinutes: number,
  inFactorGroup: (log: T) => boolean,
  label: string
): SleepFactorInsight | null {
  const withFactor = logs.filter(inFactorGroup);
  const withoutFactor = logs.filter((log) => !inFactorGroup(log));

  if (withFactor.length < MIN_NIGHTS_PER_GROUP || withoutFactor.length < MIN_NIGHTS_PER_GROUP) {
    return null;
  }

  const avgWith = average(withFactor.map((log) => nightQualityProxy(log, goalMinutes)));
  const avgWithout = average(withoutFactor.map((log) => nightQualityProxy(log, goalMinutes)));
  const deltaPoints = Math.round(avgWith - avgWithout);

  return {
    label,
    deltaPoints,
    favorable: deltaPoints >= 0,
    nightsWithFactor: withFactor.length,
    nightsWithoutFactor: withoutFactor.length,
  };
}

export function calculateSleepFactorInsights(
  logs: SleepLog[],
  goalMinutes: number = DEFAULT_SLEEP_GOAL_MINUTES
): SleepFactorInsight[] {
  const withBedTime = logs.filter((log): log is SleepLog & { bedTime: string } => log.bedTime != null);

  const insights: SleepFactorInsight[] = [];

  if (withBedTime.length >= MIN_NIGHTS_PER_GROUP * 2) {
    const shifted = withBedTime.map((log) => bedtimeMinutesSinceNoon(log.bedTime));
    const sorted = [...shifted].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const medianVal = sorted.length % 2 === 0 ? ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2 : (sorted[mid] as number);

    const consistent = compareGroups(
      withBedTime,
      goalMinutes,
      (log) => Math.abs(bedtimeMinutesSinceNoon(log.bedTime) - medianVal) <= CONSISTENT_BEDTIME_WINDOW_MINUTES,
      'Consistent bedtime'
    );
    if (consistent) insights.push(consistent);

    const lateNights = compareGroups(
      withBedTime,
      goalMinutes,
      (log) => {
        const hour = new Date(log.bedTime).getUTCHours();
        return hour >= LATE_BEDTIME_START_HOUR && hour < LATE_BEDTIME_END_HOUR;
      },
      'Nights logged past 1am'
    );
    if (lateNights) insights.push(lateNights);
  }

  return insights;
}
