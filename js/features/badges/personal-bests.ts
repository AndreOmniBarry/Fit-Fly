// Real personal bests — the one thing the tiered badge system above
// structurally can't represent: a live, evolving "your best real number
// so far" (fastest pace, longest run, best day ever), not a fixed
// threshold crossed once and permanently earned. A tiered badge stays
// true forever once earned (see types.ts's EarnedBadge — "once earned,
// always earned"); a personal best is the opposite by definition — it's
// only ever the current record, and a new one replaces the old rather
// than sitting alongside it. Forcing that into the tiered model would
// mean either a badge that "un-earns" (dishonest — the old EarnedBadge
// contract) or a fixed threshold pretending to be a record (a fabricated
// number). This stays its own, deliberately simpler shape instead: no
// persisted "earned" row at all, just the real current best, recomputed
// fresh every time — the same "read straight from the real data, never
// cached state that can drift" rule every other honest number in this
// app already follows.
import { longestRun, fastestPaceRun } from '../run/personal-records.js';
import { bestStepsDayEver } from '../steps/steps-trend.js';
import { bestHydrationDayEver } from '../hydration/hydration-trend.js';
import { formatDistanceForUnit, formatPaceForUnit } from '../run/run-units.js';
import type { IconName } from '../../lib/icons.js';

export interface PersonalBest {
  id: string;
  category: string;
  icon: IconName;
  label: string;
  /** Already formatted for display (real units, real precision) — the
   *  exact same formatter each source screen already uses, so this card
   *  never shows a number that reads differently anywhere else in the app. */
  value: string;
}

interface RunLike {
  distanceMeters: number;
  avgPaceSecPerKm?: number | null;
}
interface StepEntryLike {
  date: string;
  steps: number;
}
interface HydrationEntryLike {
  date: string;
  amountMl: number;
}

export interface PersonalBestsInput {
  runs: RunLike[];
  stepEntries: StepEntryLike[];
  hydrationEntries: HydrationEntryLike[];
  distanceUnit: 'km' | 'mi';
}

/** Every real personal best this app can currently back with real,
 *  already-logged data — never a placeholder entry for a metric with
 *  nothing recorded yet. Pure: no I/O, so it's trivially testable
 *  against fixed input arrays, the same "pure logic, separate from the
 *  database" split badge-definitions.ts's own evaluator already follows. */
export function computePersonalBests({ runs, stepEntries, hydrationEntries, distanceUnit }: PersonalBestsInput): PersonalBest[] {
  const results: PersonalBest[] = [];

  const longest = longestRun(runs);
  if (longest) {
    results.push({
      id: 'pb-longest-run',
      category: 'Run',
      icon: 'wind',
      label: 'Longest Run',
      value: formatDistanceForUnit(longest.distanceMeters, distanceUnit),
    });
  }

  const fastest = fastestPaceRun(runs);
  if (fastest && fastest.avgPaceSecPerKm != null) {
    results.push({
      id: 'pb-fastest-pace',
      category: 'Run',
      icon: 'wind',
      label: 'Fastest Pace',
      value: formatPaceForUnit(fastest.avgPaceSecPerKm, distanceUnit),
    });
  }

  const bestSteps = bestStepsDayEver(stepEntries);
  if (bestSteps) {
    results.push({
      id: 'pb-best-steps-day',
      category: 'Steps',
      icon: 'footprints',
      label: 'Best Steps Day',
      value: `${bestSteps.steps.toLocaleString()} steps`,
    });
  }

  const bestHydration = bestHydrationDayEver(hydrationEntries);
  if (bestHydration) {
    results.push({
      id: 'pb-best-hydration-day',
      category: 'Hydration',
      icon: 'glass-water',
      label: 'Best Hydration Day',
      value: `${bestHydration.amountMl.toLocaleString()}ml`,
    });
  }

  return results;
}
