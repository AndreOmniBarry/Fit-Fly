// Real "time to smash your goals today" nudges, within what a browser
// actually allows without a server: this can only ever fire while the
// app is open (there's no push infrastructure here — see
// js/lib/notifications.js's own comment on why), so it's a check-on-open
// nudge, not a true background alarm. Once wrapped with Capacitor (see
// js/lib/native-runtime.js), a real scheduled local notification that
// fires even with the app closed becomes possible via its Local
// Notifications plugin — a genuinely different capability the web
// platform alone can't offer, not something to fake here.
//
// Three real triggers, checked in priority order — something already
// earned and about to be lost outranks something not yet earned, which
// outranks a plain "you haven't logged anything today":
//   1. a real streak (from this goal's own logged history) about to break
//   2. real logged progress that's genuinely close to the target
//   3. no progress logged at all today (the original, plainer nudge)
// Every check reads only real goals and real history — an empty active-
// goals list, or a goal with no history, never produces a notification.

import { calculateStreak } from '../../lib/streak.js';
import { calculateProgressPercent, isGoalAchieved } from './goal-progress.js';
import { inferActivityType } from './goal-activity.js';
import { pickPhrase, STREAK_RISK_PHRASES, CLOSE_TO_TARGET_PHRASES } from './goal-phrases.js';

// A streak of 1 is just "logged once" — not yet something worth an alert
// for potentially losing.
const STREAK_RISK_MIN_STREAK = 2;

// Close enough that a nudge is genuinely useful, not a vague "good job"
// for any amount of progress at all.
const CLOSE_TO_TARGET_PERCENT = 80;

function loggedDates(goal) {
  return (goal.history ?? []).map((entry) => entry.loggedAt.slice(0, 10));
}

function isoDateShiftedBy(isoDate, days) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** A goal "needs today's nudge" if it's never had progress logged at
 *  all, or its most recent entry isn't from today. */
export function goalNeedsTodaysNudge(goal, todayIsoDate) {
  const history = goal.history ?? [];
  if (history.length === 0) return true;
  const lastLoggedDate = history[history.length - 1].loggedAt.slice(0, 10);
  return lastLoggedDate !== todayIsoDate;
}

/** @param {object[]} activeGoals
 *  @param {string} todayIsoDate
 *  @returns {object[]} the subset that could use a nudge today */
export function goalsNeedingTodaysNudge(activeGoals, todayIsoDate) {
  return activeGoals.filter((goal) => goalNeedsTodaysNudge(goal, todayIsoDate));
}

/** True at the exact moment a nudge could still save a real streak: it's
 *  built at least STREAK_RISK_MIN_STREAK consecutive logged days ending
 *  yesterday, and today hasn't been logged yet — the day after this, the
 *  streak's just gone, no nudge can bring it back. */
export function goalAtStreakRisk(goal, todayIsoDate) {
  const dates = loggedDates(goal);
  if (dates.length === 0 || dates.includes(todayIsoDate)) return false;
  const yesterday = isoDateShiftedBy(todayIsoDate, -1);
  if (!dates.includes(yesterday)) return false;
  return calculateStreak(dates) >= STREAK_RISK_MIN_STREAK;
}

/** @returns {{goal: object, streak: number}[]} every active goal at real
 *  streak risk today, each paired with its actual current streak length. */
export function goalsAtStreakRisk(activeGoals, todayIsoDate) {
  return activeGoals
    .filter((goal) => goalAtStreakRisk(goal, todayIsoDate))
    .map((goal) => ({ goal, streak: calculateStreak(loggedDates(goal)) }));
}

/** A goal is "close to target" when real logged progress puts it within
 *  reach but it isn't achieved yet — never true for a goal with no real
 *  progress logged (0% is never "close"). */
export function goalCloseToTarget(goal) {
  if (isGoalAchieved(goal)) return false;
  return calculateProgressPercent(goal) >= CLOSE_TO_TARGET_PERCENT;
}

export function goalsCloseToTarget(activeGoals) {
  return activeGoals.filter(goalCloseToTarget);
}

/** Builds today's single most relevant Goals notification from real data
 *  alone, or null when nothing real applies — this never invents a
 *  reason to notify. `random` is injectable (see goal-phrases.js's
 *  pickPhrase) purely so tests can get a deterministic phrase pick. */
export function buildGoalsNotification(activeGoals, todayIsoDate, random = Math.random) {
  const atRisk = goalsAtStreakRisk(activeGoals, todayIsoDate);
  if (atRisk.length > 0) {
    const { goal, streak } = atRisk[0];
    const phrases = STREAK_RISK_PHRASES[inferActivityType(goal)] ?? STREAK_RISK_PHRASES.generic;
    return {
      title: pickPhrase(phrases, random),
      body: `${goal.name}: ${streak}-day streak — log today to keep it alive.`,
    };
  }

  const close = goalsCloseToTarget(activeGoals);
  if (close.length > 0) {
    const goal = close[0];
    const phrases = CLOSE_TO_TARGET_PHRASES[inferActivityType(goal)] ?? CLOSE_TO_TARGET_PHRASES.generic;
    const percent = Math.round(calculateProgressPercent(goal));
    return {
      title: pickPhrase(phrases, random),
      body: `${goal.name}: ${percent}% there.`,
    };
  }

  const needingNudge = goalsNeedingTodaysNudge(activeGoals, todayIsoDate);
  if (needingNudge.length === 0) return null;
  return {
    title: 'Time to smash your goals today',
    body:
      needingNudge.length === 1
        ? needingNudge[0].name
        : `${needingNudge.length} goals could use an update: ${needingNudge.map((g) => g.name).join(', ')}`,
  };
}
