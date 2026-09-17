// Wires the Hub's own greeting header + Steps/Water hero cards to real
// data — the same "compute real data on Hub-shown, hand it to hub-view.ts's
// setters" split active-energy-view.js already established for Active
// Energy (which owns the Calories hero card itself, reusing its own
// already-computed rollup — see its own doc comment). Evaluated on app
// load, every time the Hub becomes visible again, and right after a
// profile save (so a new display name/height shows up immediately without
// needing to leave and come back to the Hub).
import { onScreenShown, onScreenHidden } from '../../lib/router.js';
import { getProfile } from '../../db/repositories/profile.js';
import { listAllStepEntries } from '../../db/repositories/steps.js';
import { listHydrationEntriesInRange } from '../../db/repositories/hydration.js';
import { listRecentSleepLogs } from '../../db/repositories/sleep-logs.js';
import { estimateDistanceFromSteps } from '../steps/steps-distance-estimate.js';
import { calculateAge } from '../onboarding/age.js';
import { formatBucketAxisLabel, formatBucketDetailLabel } from '../../lib/time-range.js';
import { greetingForHour, trailingDailyTotals, trailingSleepScores, formatHeroDistanceKm } from './hub-stats.js';
import { setHubGreeting, setHeroStepsCard, setHeroWaterCard, setHeroSleepCard, clearHeroStepsChart } from './hub-view.js';
const TRAILING_DAYS = 7;
function todayIsoDate() {
    return new Date().toISOString().slice(0, 10);
}
export function initHubStatsFeature() {
    void refreshHubStats();
    onScreenShown('screen-hub', () => void refreshHubStats());
    // Settings' own profile save dispatches this — see settings-view.ts —
    // so a newly-set (or cleared) display name updates the greeting right
    // away even while still on the Hub underneath the Settings screen.
    document.addEventListener('profile:changed', () => void refreshHubStats());
    // Every screen here stays mounted, hidden, in the background — this
    // chart's real bars would otherwise still exist off-screen while some
    // other screen (Steps, Hydration, Run, ...) renders its own same-shaped
    // trend chart, silently doubling up any of those screens' own unscoped
    // `.trend-chart-bar` queries. refreshHubStats() rebuilds it fresh the
    // next time the Hub is actually shown again.
    onScreenHidden('screen-hub', () => clearHeroStepsChart());
}
async function refreshHubStats() {
    const today = new Date();
    const endDate = todayIsoDate();
    const startDate = trailingStartDate(endDate, TRAILING_DAYS);
    const [profile, allSteps, hydrationEntries, recentSleepLogs] = await Promise.all([
        getProfile(),
        listAllStepEntries(),
        listHydrationEntriesInRange(startDate, endDate),
        listRecentSleepLogs(14),
    ]);
    renderGreeting(profile, today);
    renderStepsCard(allSteps, profile, endDate);
    renderWaterCard(hydrationEntries, endDate);
    renderSleepCard(recentSleepLogs, profile, endDate);
}
function trailingStartDate(endDate, days) {
    const anchor = new Date(`${endDate}T00:00:00`);
    anchor.setDate(anchor.getDate() - (days - 1));
    return anchor.toISOString().slice(0, 10);
}
function renderGreeting(profile, now) {
    const greeting = greetingForHour(now.getHours());
    setHubGreeting({
        eyebrow: greeting.text,
        // A real, honest name when one is on file; otherwise a plain
        // motivational default — never a fabricated "Hi, Starla".
        name: profile?.displayName ? `Hi, ${profile.displayName}` : 'Keep moving today',
    });
}
function renderStepsCard(allSteps, profile, endDate) {
    const week = trailingDailyTotals(allSteps.map((e) => ({ date: e.date, value: e.steps })), { days: TRAILING_DAYS, endDate });
    const todaySteps = week[week.length - 1]?.value ?? 0;
    // A real distance estimate from the real profile height on file — null,
    // never fabricated, with no height set (same honesty rule as Steps'
    // own screen, steps-distance-estimate.ts).
    const estimate = estimateDistanceFromSteps({ steps: todaySteps, heightCm: profile?.heightCm });
    setHeroStepsCard({
        steps: todaySteps,
        distanceText: estimate ? formatHeroDistanceKm(estimate.meters) : null,
        week: week.map((day, i) => ({
            key: day.date,
            value: day.value,
            axisLabel: formatBucketAxisLabel(day.date, 'day'),
            tooltipValue: `${day.value.toLocaleString()} steps`,
            tooltipDetail: formatBucketDetailLabel(day.date, 'day'),
            isToday: i === week.length - 1,
        })),
    });
}
function renderWaterCard(hydrationEntries, endDate) {
    const week = trailingDailyTotals(hydrationEntries.map((e) => ({ date: e.date, value: e.amountMl })), { days: TRAILING_DAYS, endDate });
    const todayMl = week[week.length - 1]?.value ?? 0;
    setHeroWaterCard({ todayMl, week });
}
function renderSleepCard(recentSleepLogs, profile, endDate) {
    const age = profile?.birthdate ? calculateAge(profile.birthdate) : null;
    const week = trailingSleepScores(recentSleepLogs, { days: TRAILING_DAYS, endDate, age });
    setHeroSleepCard({ week });
}
//# sourceMappingURL=hub-stats-view.js.map