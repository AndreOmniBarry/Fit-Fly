// A real "time to smash your goals today" nudge, within what a browser
// actually allows without a server: this can only ever fire while the
// app is open (there's no push infrastructure here — see
// js/lib/notifications.js's own comment on why), so it's a check-on-open
// nudge, not a true background alarm. Once wrapped with Capacitor (see
// js/lib/native-runtime.js), a real scheduled local notification that
// fires even with the app closed becomes possible via its Local
// Notifications plugin — a genuinely different capability the web
// platform alone can't offer, not something to fake here.

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
