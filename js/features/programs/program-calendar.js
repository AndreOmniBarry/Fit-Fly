// Pure helpers for Programs' calendar view — turning a program's own
// logged strength sessions into calendar-day and weekly-completion data.
// No I/O: callers (program-view.js) fetch sessions themselves and pass
// them in, same "pure logic, separate from rendering" split every other
// mini-app's own calendar/insights math already follows.

function pad2(n) {
  return String(n).padStart(2, '0');
}

/** YYYY-MM-DD from a session's startedAt, on the *local* calendar day —
 *  same local-day rule js/features/activity/active-energy.js's own
 *  isSameLocalDay already established, so a session logged late at night
 *  never lands on the wrong date just because ISO's own slice is UTC. */
export function localDateFromIso(isoTimestamp) {
  const d = new Date(isoTimestamp);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Every real calendar day this program has at least one logged session
 *  on — the calendar's entire "something happened this day" signal.
 *  Nothing inferred, nothing predicted: a day with no session is simply
 *  not in this set, never marked as a "missed" or "rest" day the program
 *  never actually prescribed (see program-view.js's own comment on why
 *  Programs has no fixed calendar-day schedule to compare against). */
export function sessionDatesForProgram(sessions) {
  return new Set(sessions.map((session) => localDateFromIso(session.startedAt)));
}

/** The Sunday-start week (inclusive both ends) containing `todayDate` —
 *  the same week convention js/lib/calendar-grid.js's month grid already
 *  uses, so "this week" here always lines up with a real row of it. */
export function currentWeekRange(todayDate) {
  const anchor = new Date(`${todayDate}T00:00:00`);
  const start = new Date(anchor);
  start.setDate(anchor.getDate() - anchor.getDay());
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const fmt = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  return { start: fmt(start), end: fmt(end) };
}

/** Real progress toward a real target: how many distinct days this week
 *  already have a logged session, against this program's own weekly
 *  training-day count (`generated.days.length` — the exact number
 *  already printed as Day 1/2/3 cards on the Programs screen, never a
 *  separately-invented "goal"). `completed` is left uncapped — training
 *  more than the plan calls for is real and worth showing honestly
 *  (e.g. "4 of 3 sessions") — only `percent` clamps at 100 since it
 *  drives a progress bar, not a claim about how much was actually done. */
export function weeklySessionProgress(sessionDates, todayDate, plannedDaysPerWeek) {
  const { start, end } = currentWeekRange(todayDate);
  const completed = [...sessionDates].filter((date) => date >= start && date <= end).length;
  const percent = plannedDaysPerWeek > 0 ? Math.min(100, Math.round((completed / plannedDaysPerWeek) * 100)) : 0;
  return { completed, planned: plannedDaysPerWeek, percent };
}
