// Wires Active Energy's real cross-app rollup into the Hub — the only
// screen that sits above every contributing source (Steps, Run, Activity
// logging, Strength sessions each live on their own screen; nothing else
// adds them together). Evaluated on app load and every time the Hub
// becomes visible again, same onScreenShown pattern Badges' own tile
// count uses, for the same reason: none of the four sources know to
// tell the Hub they changed.
import { onScreenShown } from '../../lib/router.js';
import { getProfile } from '../../db/repositories/profile.js';
import { getStepEntryForDate } from '../../db/repositories/steps.js';
import { listAllRuns } from '../../db/repositories/runs.js';
import { listAllSessions, listSetsForSession } from '../../db/repositories/sessions.js';
import { estimateStepsCalories } from '../steps/steps-calorie-estimate.js';
import { estimateRunCalories } from '../run/run-calorie-estimate.js';
import { estimateStrengthSessionCalories } from './session-calorie-estimate.js';
import { sumActiveEnergy, isSameLocalDay } from './active-energy.js';
import { setActiveEnergyText } from '../hub/hub-view.js';

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export function initActiveEnergyFeature() {
  void refreshActiveEnergy();
  onScreenShown('screen-hub', () => void refreshActiveEnergy());
}

async function refreshActiveEnergy() {
  const today = new Date();
  const [profile, stepEntry, runs, sessions] = await Promise.all([
    getProfile(),
    getStepEntryForDate(todayIsoDate()),
    listAllRuns(),
    listAllSessions(),
  ]);
  const weightKg = profile?.weightKg;

  const stepsKcal = estimateStepsCalories({ steps: stepEntry?.steps ?? 0, weightKg })?.kcal ?? null;

  const runKcal = sumActiveEnergy(
    runs
      .filter((r) => isSameLocalDay(r.startedAt, today))
      .map((r) => estimateRunCalories({ durationMs: r.durationMs, avgPaceSecPerKm: r.avgPaceSecPerKm, weightKg })?.kcal ?? null)
  );

  // Activity sessions already carry their own real caloriesEstimate,
  // computed and saved at the moment they were logged — reading it back
  // here rather than recomputing keeps this rollup consistent with the
  // exact number Activity's own history already shows for that entry.
  const activityKcal = sumActiveEnergy(
    sessions
      .filter((s) => s.type === 'activity' && isSameLocalDay(s.startedAt, today))
      .map((s) => s.caloriesEstimate?.kcal ?? null)
  );

  const strengthSessions = sessions.filter((s) => s.type === 'strength' && isSameLocalDay(s.startedAt, today));
  const strengthEstimates = await Promise.all(
    strengthSessions.map(async (s) => {
      const sets = await listSetsForSession(s.id);
      return estimateStrengthSessionCalories({ sets, weightKg })?.kcal ?? null;
    })
  );
  const strengthKcal = sumActiveEnergy(strengthEstimates);

  const total = sumActiveEnergy([stepsKcal, runKcal, activityKcal, strengthKcal]);
  setActiveEnergyText(total == null ? null : `~${total} kcal active today`);
}
