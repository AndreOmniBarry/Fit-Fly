// Rolling sleep debt: the total shortfall against a goal over a trailing
// stretch of logged nights. Deliberately one-directional — a great night
// doesn't erase two rough ones, since that's not how sleep debt actually
// works physiologically, and pretending otherwise would be exactly the
// kind of fabricated precision this app avoids everywhere else.
import type { SleepDebtResult, SleepLog } from './types.js';

export const DEFAULT_SLEEP_GOAL_MINUTES = 480; // 8 hours

export function calculateSleepDebt(
  recentLogs: SleepLog[],
  goalMinutes: number = DEFAULT_SLEEP_GOAL_MINUTES
): SleepDebtResult {
  if (recentLogs.length === 0) {
    return { debtMinutes: 0, nightsConsidered: 0, goalMinutes, averageMinutes: null };
  }

  const debtMinutes = recentLogs.reduce(
    (total, log) => total + Math.max(0, goalMinutes - log.durationMinutes),
    0
  );
  const averageMinutes = Math.round(
    recentLogs.reduce((sum, log) => sum + log.durationMinutes, 0) / recentLogs.length
  );

  return {
    debtMinutes: Math.round(debtMinutes),
    nightsConsidered: recentLogs.length,
    goalMinutes,
    averageMinutes,
  };
}

/** A short, honest sentence for the debt card — no false precision about
 *  exactly how debt "feels", just the arithmetic in plain language. */
export function describeSleepDebt(debt: SleepDebtResult): string {
  if (debt.nightsConsidered === 0) return 'Log a few nights to see your trend.';
  if (debt.debtMinutes === 0) {
    return `You've hit your ${formatHours(debt.goalMinutes)} goal every night over the last ${debt.nightsConsidered}.`;
  }
  const hours = Math.round((debt.debtMinutes / 60) * 10) / 10;
  return `You're about ${hours}h behind your ${formatHours(debt.goalMinutes)} goal over the last ${debt.nightsConsidered} night${debt.nightsConsidered === 1 ? '' : 's'}.`;
}

function formatHours(minutes: number): string {
  const hours = minutes / 60;
  return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`;
}
