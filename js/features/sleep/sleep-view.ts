// Sleep's screen controller: dashboard (quick-log form or a night's
// score — today's by default, but any past date via History), History
// (a real calendar), Wind Down (breathing pacer + ambient sound, driven
// by the same shared engine Focus's own screen uses), and Insights.
import { showScreen } from '../../lib/router.js';
import { initChipGroup } from '../../lib/chip-group.js';
import { attachTilt } from '../../lib/tilt.js';
import { animateCountUp } from '../../lib/count-up.js';
import {
  getSleepLogForDate,
  listAllSleepLogs,
  listRecentSleepLogs,
  listSleepLogsInRange,
  saveSleepLog,
} from '../../db/repositories/sleep-logs.js';
import { getProfile } from '../../db/repositories/profile.js';
import { calculateAge } from '../onboarding/age.js';
import { calculateSleepScore } from './sleep-score.js';
import { calculateSleepDebt, describeSleepDebt, DEFAULT_SLEEP_GOAL_MINUTES } from './sleep-debt.js';
import { bestSleepNightEver, buildWeeklyTrend, calculateLoggingStreak } from './sleep-trends.js';
import { calculateSleepFactorInsights } from './sleep-insights.js';
import { bucketSleepInsightNights, buildSleepInsightAreaGeometry } from './sleep-insight-chart.js';
import type { SleepInsightNight } from './sleep-insight-chart.js';
import { computeSleepLogTimes } from './sleep-duration.js';
import { formatMonthLabel, getMonthGridDays, monthDateRange } from '../../lib/calendar-grid.js';
import { formatClockTime, formatDurationHM, formatTimeInputValue } from './format.js';
import { setSleepTileScore, setSleepTileSubtitle } from '../hub/hub-view.js';
import { getFocusAudioEngine } from '../focus/audio-engine.js';
import type { FocusAudioState } from '../focus/audio-engine.js';
import {
  formatBucketAxisLabel,
  formatBucketDetailLabel,
  timeRangeBounds,
  timeRangeDescription,
} from '../../lib/time-range.js';
import type { TimeRangeKey } from '../../lib/time-range.js';
import type { SleepCategory, SleepLog, SleepScoreResult } from './types.js';

function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`sleep-view: missing #${id}`);
  return el as T;
}

/** Same lookup, for the SVG elements this view touches — SVGElement
 *  doesn't extend HTMLElement, so it needs its own narrow helper. */
function bySvgId<T extends SVGElement = SVGElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`sleep-view: missing #${id}`);
  return el as unknown as T;
}

/** Local calendar date, YYYY-MM-DD — sleep is logged and displayed on the
 *  device's own clock, same convention as every other date-keyed store
 *  (readinessCheckins, cycleLogs, ...). */
function todayDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function greetingForNow(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function formatHeaderDate(dateStr: string, { withYear = false }: { withYear?: boolean } = {}): string {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString(
    undefined,
    withYear ? { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' } : { weekday: 'short', month: 'short', day: 'numeric' }
  );
}

const CATEGORY_LABEL: Record<SleepCategory, string> = {
  poor: 'Poor sleep',
  fair: 'Fair sleep',
  good: 'Good sleep',
  great: 'Great sleep',
};

const RING_RADIUS = 86;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export function initSleepFeature(): void {
  let recentLogs: SleepLog[] = [];
  let viewedDate = todayDateString();
  let viewedLog: SleepLog | null = null;
  let profileAge: number | null = null;

  let historyYear = 0;
  let historyMonth = 0; // 0-11
  let historyLogs: SleepLog[] = [];

  // The Insights chart's own state — a module-scoped cache of every
  // logged night (so switching W/M/6M/Y re-renders instantly from data
  // already fetched, same "cache the whole history, re-render on chip
  // change" contract as Steps/Hydration's own trend range) and which
  // range is currently selected. 'W' is the same default they use.
  let sleepInsightRange: TimeRangeKey = 'W';
  let cachedAllSleepLogs: SleepLog[] = [];

  const qualityChips = initChipGroup<string | null>(byId('sleep-log-quality'), { initial: null });

  // Best-effort — Sleep works with no profile at all (see the README's
  // "Onboarding is optional"), in which case scoring falls back to the
  // general-adult NSF band (sleep-duration-guideline.ts).
  void getProfile()
    .then((profile) => {
      profileAge = profile?.birthdate ? calculateAge(profile.birthdate) : null;
    })
    .catch(() => {
      profileAge = null;
    });

  /** A given night's score, using only the logs on-or-before its own
   *  date — the same "don't use future data to score a past night" rule
   *  renderInsightChart already followed per-point; this is that same
   *  windowing, now shared so viewing an old night from History scores
   *  it the way it would have looked at the time, not with hindsight
   *  from nights logged since. */
  function scoreLogInContext(log: Pick<SleepLog, 'durationMinutes' | 'quality'>, forDate: string): SleepScoreResult {
    const window = recentLogs.filter((l) => l.date <= forDate).slice(0, 14);
    return calculateSleepScore(log, window, profileAge);
  }

  // Same spatial-tilt language as the Hub, scoped to the dashboard — the
  // score ring and its stat tiles are the richest data on this screen, so
  // that's where the depth cue belongs. Insights (a chart-dense screen)
  // and Wind Down (its own breathing-pacer motion language) deliberately
  // don't get it too — restraint, not the effect applied everywhere.
  const dashboardTilt = attachTilt(byId('screen-sleep-dashboard'));
  byId('screen-sleep-dashboard').addEventListener('pointerdown', () => void dashboardTilt.requestMotionPermission(), {
    once: true,
  });

  function renderForm(): void {
    byId('sleep-log-form').hidden = false;
    byId('sleep-dashboard-result').hidden = true;
    byId('btn-sleep-log-save').textContent =
      viewedDate === todayDateString() ? 'Save last night' : `Log ${formatHeaderDate(viewedDate)}`;
  }

  function renderWeekStrip(): void {
    const container = byId('sleep-week-bars');
    container.innerHTML = '';
    const trend = buildWeeklyTrend(recentLogs.slice(0, 7));

    if (trend.length === 0) {
      byId('sleep-week-avg').textContent = '';
      return;
    }

    const avgMinutes = Math.round(trend.reduce((sum, n) => sum + n.durationMinutes, 0) / trend.length);
    byId('sleep-week-avg').textContent = `avg ${formatDurationHM(avgMinutes)}`;

    const maxMinutes = Math.max(...trend.map((n) => n.durationMinutes), DEFAULT_SLEEP_GOAL_MINUTES);

    // A compact sparkline, not a labeled chart — see mini-apps.css's own
    // comment on .sleep-week-strip. The container carries one summary
    // aria-label (role="img" in the markup) instead of a per-bar day
    // letter; each bar keeps a real hover title for anyone using a mouse.
    for (const night of trend) {
      const col = document.createElement('div');
      col.className = `sleep-week-bar-col${night.isBest ? ' is-best' : ''}`;

      const bar = document.createElement('div');
      bar.className = `sleep-week-bar${night.isBest ? ' is-best' : ''}`;
      bar.style.height = `${Math.max(8, Math.round((night.durationMinutes / maxMinutes) * 100))}%`;
      const dayName = new Date(`${night.date}T00:00:00Z`).toLocaleDateString(undefined, {
        weekday: 'short',
        timeZone: 'UTC',
      });
      bar.title = `${dayName}: ${formatDurationHM(night.durationMinutes)}`;

      col.append(bar);
      container.append(col);
    }
  }

  function renderResult(log: SleepLog): void {
    byId('sleep-log-form').hidden = true;
    byId('sleep-dashboard-result').hidden = false;

    const score = scoreLogInContext({ durationMinutes: log.durationMinutes, quality: log.quality }, log.date);

    animateCountUp(byId('sleep-score-value'), score.score);
    byId('sleep-score-label').textContent = CATEGORY_LABEL[score.category];
    bySvgId('sleep-score-ring-fill').setAttribute(
      'stroke-dashoffset',
      String(RING_CIRCUMFERENCE * (1 - score.score / 100))
    );
    byId('sleep-score-description').textContent = score.reasoning[0] ?? '';

    byId('sleep-stat-bedtime').textContent = log.bedTime ? formatClockTime(log.bedTime) : '—';
    byId('sleep-stat-wake').textContent = log.wakeTime ? formatClockTime(log.wakeTime) : '—';
    byId('sleep-stat-duration').textContent = formatDurationHM(log.durationMinutes);

    renderWeekStrip();
    byId('btn-sleep-edit-log').textContent =
      log.date === todayDateString() ? "Edit tonight's log" : `Edit ${formatHeaderDate(log.date)}'s log`;

    // A retroactively-edited past night shouldn't overwrite the Hub
    // tile's "last night" readout with an old score — only today's own
    // log does that.
    if (log.date === todayDateString()) {
      setSleepTileSubtitle(`${score.score} · ${CATEGORY_LABEL[score.category]} last night`);
      setSleepTileScore(score.score);
    }
  }

  /** @param date Defaults to today; History passes any past date to view
   *  or retroactively log it. */
  async function loadDashboard(date: string = todayDateString()): Promise<void> {
    viewedDate = date;
    const isToday = date === todayDateString();
    byId('sleep-dashboard-date').textContent = isToday ? formatHeaderDate(date) : formatHeaderDate(date, { withYear: true });
    byId('sleep-dashboard-greeting').textContent = isToday ? greetingForNow() : `Editing ${formatHeaderDate(date)}`;

    const [log, recent] = await Promise.all([getSleepLogForDate(date), listRecentSleepLogs(14)]);
    viewedLog = log ?? null;
    recentLogs = recent;

    if (viewedLog) {
      renderResult(viewedLog);
    } else {
      // A genuinely blank form for a date with nothing logged yet — clear
      // out whatever was left in these fields from the last date viewed
      // (History's own tap-to-log flow can reach a fresh blank form right
      // after a *different* date's populated one), rather than silently
      // carrying stale values into what should be a new entry.
      byId<HTMLInputElement>('sleep-log-bedtime').value = '';
      byId<HTMLInputElement>('sleep-log-waketime').value = '';
      qualityChips.setValue(null);
      byId<HTMLTextAreaElement>('sleep-log-notes').value = '';
      byId('err-sleep-log').hidden = true;
      renderForm();
    }
  }

  function renderInsights(): void {
    const streak = calculateLoggingStreak(recentLogs);
    animateCountUp(byId('sleep-insight-streak'), streak);

    const debt = calculateSleepDebt(recentLogs.slice(0, 7));
    const debtEl = byId('sleep-insight-debt');
    if (debt.nightsConsidered === 0) debtEl.textContent = '—';
    else animateCountUp(debtEl, debt.debtMinutes, { formatter: formatDurationHM });
    debtEl.title = describeSleepDebt(debt);

    renderInsightFactors();

    byId('sleep-insight-empty').hidden = recentLogs.length > 0;

    void loadInsightChart();
  }

  /** The chart's own data fetch — every logged night ever, not just the
   *  14-night window `recentLogs` caps at, since a 6M/Y view has to reach
   *  further back than that (same "whole history, not a recent-window
   *  illusion" reasoning as Hydration/Steps' own best-day-ever badge). Runs
   *  once per Insights visit; switching W/M/6M/Y afterward just re-renders
   *  from this same cache. */
  async function loadInsightChart(): Promise<void> {
    cachedAllSleepLogs = await listAllSleepLogs();
    renderInsightChart();
  }

  /** This night's score using only logs on-or-before it drawn from the
   *  *whole* history — same "no future data, no hindsight" windowing rule
   *  as scoreLogInContext, just able to reach back further than
   *  recentLogs' own 14-night cap so a 6M/Y chart's older nights still get
   *  a real trailing consistency window instead of an empty one. */
  function scoreNightForChart(sortedLogs: SleepLog[], index: number): number {
    const log = sortedLogs[index] as SleepLog;
    const window = sortedLogs.slice(Math.max(0, index - 13), index + 1);
    return calculateSleepScore({ durationMinutes: log.durationMinutes, quality: log.quality }, window, profileAge).score;
  }

  const CATEGORY_DOT_COLOR: Record<SleepCategory, string> = {
    poor: 'var(--danger)',
    fair: 'var(--warning)',
    good: 'var(--sleep-accent)',
    great: 'var(--success)',
  };

  /** The real per-night visualization: a smooth area of duration (the
   *  shape) with every point/bucket colored by its own sleep score
   *  category (the color) — two of Sleep's own logged metrics in one
   *  picture, not a fabricated third. Bucketing follows the selected
   *  D/W/M/6M/Y range exactly like Hydration/Steps' own trend chart (see
   *  js/lib/time-range.js); tapping/hovering/focusing a point reveals its
   *  exact value, same reveal pattern as js/lib/trend-chart.ts. */
  function renderInsightChart(): void {
    const svg = bySvgId<SVGSVGElement>('sleep-insight-chart');
    const pointsLayer = byId('sleep-insight-chart-points');
    const labelsRow = byId('sleep-insight-chart-labels');
    svg.innerHTML = '';
    pointsLayer.innerHTML = '';
    labelsRow.innerHTML = '';

    const sortedAll = [...cachedAllSleepLogs].sort((a, b) => a.date.localeCompare(b.date));
    const bounds = timeRangeBounds(sleepInsightRange, todayDateString());

    renderBestNightBadge(sortedAll);

    const nightsInRange = sortedAll
      .map((log, index) => ({ log, index }))
      .filter(({ log }) => log.date >= bounds.start && log.date <= bounds.end);
    const insightNights: SleepInsightNight[] = nightsInRange.map(({ log, index }) => ({
      date: log.date,
      durationMinutes: log.durationMinutes,
      score: scoreNightForChart(sortedAll, index),
      quality: log.quality,
    }));

    const buckets = bucketSleepInsightNights(insightNights, bounds.bucket);
    const isBucketed = bounds.bucket !== 'day';

    byId('sleep-insight-range-copy').textContent = isBucketed
      ? `${timeRangeDescription(sleepInsightRange)} Each point averages every logged night in that period — line height is duration, color is sleep score.`
      : `${timeRangeDescription(sleepInsightRange)} Line height is each night's duration; color is that night's sleep score.`;

    byId('sleep-insight-chart-empty').hidden = buckets.length >= 2;
    if (buckets.length < 2) return;

    const width = 320;
    const height = 140;
    const geometry = buildSleepInsightAreaGeometry(
      buckets.map((bucket) => bucket.durationMinutes),
      { width, height }
    );

    const ns = 'http://www.w3.org/2000/svg';
    const defs = document.createElementNS(ns, 'defs');
    defs.innerHTML =
      '<linearGradient id="sleepInsightAreaGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="var(--sleep-accent)" stop-opacity="0.4"/><stop offset="100%" stop-color="var(--sleep-accent)" stop-opacity="0"/></linearGradient>';
    svg.append(defs);

    const area = document.createElementNS(ns, 'path');
    area.setAttribute('d', geometry.areaPath);
    area.setAttribute('fill', 'url(#sleepInsightAreaGrad)');
    area.setAttribute('stroke', 'none');
    svg.append(area);

    const line = document.createElementNS(ns, 'path');
    line.setAttribute('d', geometry.linePath);
    line.setAttribute('fill', 'none');
    line.setAttribute('stroke', 'var(--sleep-accent)');
    line.setAttribute('stroke-width', '2.5');
    line.setAttribute('stroke-linecap', 'round');
    line.setAttribute('stroke-linejoin', 'round');
    svg.append(line);

    buckets.forEach((bucket, i) => {
      const point = geometry.points[i];
      if (!point) return;
      const dotColor = CATEGORY_DOT_COLOR[bucket.category];

      const dot = document.createElementNS(ns, 'circle');
      dot.setAttribute('cx', String(point.x));
      dot.setAttribute('cy', String(point.y));
      dot.setAttribute('r', '4.5');
      dot.setAttribute('fill', dotColor);
      dot.setAttribute('stroke', 'rgba(6,10,8,0.55)');
      dot.setAttribute('stroke-width', '1.5');
      svg.append(dot);

      // A real, natively-focusable/tappable <button> laid over each SVG
      // point — same tap/hover/focus-reveals, blur/leave-hides tooltip
      // contract as js/lib/trend-chart.ts's own bars, just positioned over
      // a curve instead of stacked in a flex row (duration *and* score
      // together don't fit a bar chart's one-value-per-bar shape).
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sleep-insight-chart-point';
      btn.style.left = `${(point.x / width) * 100}%`;
      btn.style.top = `${(point.y / height) * 100}%`;
      btn.style.setProperty('--sleep-insight-point-color', dotColor);

      const detailLabel = formatBucketDetailLabel(bucket.key, bounds.bucket);
      const nightsPart = isBucketed ? `, avg over ${bucket.nightsLogged} night${bucket.nightsLogged === 1 ? '' : 's'}` : '';
      const qualityPart = bucket.quality != null ? ` · felt ${bucket.quality}/5` : '';
      const summary = `${formatDurationHM(bucket.durationMinutes)}${nightsPart}, score ${bucket.score} (${CATEGORY_LABEL[bucket.category]})`;
      btn.setAttribute('aria-label', `${summary}, ${detailLabel}${qualityPart}`);

      const tooltip = document.createElement('span');
      tooltip.className = 'trend-chart-tooltip sleep-insight-chart-tooltip';
      tooltip.hidden = true;
      const tooltipValue = document.createElement('strong');
      tooltipValue.textContent = `${formatDurationHM(bucket.durationMinutes)}${nightsPart}`;
      const tooltipDetail = document.createElement('span');
      tooltipDetail.textContent = `${detailLabel} · ${bucket.score} score, ${CATEGORY_LABEL[bucket.category]}${qualityPart}`;
      tooltip.append(tooltipValue, tooltipDetail);
      btn.append(tooltip);

      const showTooltip = () => {
        for (const other of pointsLayer.querySelectorAll<HTMLElement>('.trend-chart-tooltip')) other.hidden = true;
        tooltip.hidden = false;
      };
      const hideTooltip = () => {
        tooltip.hidden = true;
      };
      btn.addEventListener('click', showTooltip);
      btn.addEventListener('focus', showTooltip);
      btn.addEventListener('blur', hideTooltip);
      btn.addEventListener('pointerenter', showTooltip);
      btn.addEventListener('pointerleave', hideTooltip);

      pointsLayer.append(btn);
    });

    const firstBucket = buckets[0];
    const lastBucket = buckets[buckets.length - 1];
    const first = document.createElement('span');
    first.textContent = firstBucket ? formatBucketAxisLabel(firstBucket.key, bounds.bucket) : '';
    const last = document.createElement('span');
    last.textContent = lastBucket ? formatBucketAxisLabel(lastBucket.key, bounds.bucket) : '';
    labelsRow.append(first, last);
  }

  /** A real "longest night ever" record, drawn from the whole logged
   *  history (never just the visible chart window) — the exact same
   *  honesty contract as Hydration/Steps' own best-day-ever badge. */
  function renderBestNightBadge(sortedAllLogs: SleepLog[]): void {
    const badge = byId('sleep-insight-best-night-badge');
    const best = bestSleepNightEver(sortedAllLogs);
    if (!best) {
      badge.hidden = true;
      return;
    }
    byId('sleep-insight-best-night-text').textContent = `Best: ${formatDurationHM(best.durationMinutes)} on ${formatHeaderDate(best.date)}`;
    badge.hidden = false;
  }

  function renderInsightFactors(): void {
    const container = byId('sleep-insight-factors');
    container.innerHTML = '';
    const factors = calculateSleepFactorInsights(recentLogs);
    if (factors.length === 0) return;

    const heading = document.createElement('div');
    heading.className = 'muted';
    heading.style.cssText = 'font-size:13px; font-weight:600; letter-spacing:0.04em; text-transform:uppercase;';
    heading.textContent = "What's helping";
    container.append(heading);

    for (const factor of factors) {
      const card = document.createElement('div');
      card.className = 'sleep-factor-card';
      const sign = factor.deltaPoints >= 0 ? '+' : '';
      card.innerHTML = `<span>${factor.label}</span><span class="delta ${factor.favorable ? 'favorable' : 'unfavorable'}">${sign}${factor.deltaPoints} pts avg</span>`;
      container.append(card);
    }
  }

  /** One query per visible month (listSleepLogsInRange), then a render —
   *  the calendar's whole data flow. Navigating months just re-runs this
   *  with the new year/month; nothing else needs to change. */
  async function loadHistoryMonth(): Promise<void> {
    const { start, end } = monthDateRange(historyYear, historyMonth);
    historyLogs = await listSleepLogsInRange(start, end);
    renderHistoryCalendar();
  }

  function renderHistoryCalendar(): void {
    byId('sleep-history-month-label').textContent = formatMonthLabel(historyYear, historyMonth);

    const grid = byId('sleep-history-grid');
    grid.innerHTML = '';
    const logsByDate = new Map(historyLogs.map((log) => [log.date, log]));
    const days = getMonthGridDays(historyYear, historyMonth, todayDateString());

    for (const day of days) {
      const log = logsByDate.get(day.date);
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.setAttribute('role', 'gridcell');
      const classes = ['sleep-calendar-day'];
      if (!day.inMonth) classes.push('sleep-calendar-day--out-of-month');
      if (day.isFuture) classes.push('sleep-calendar-day--future');
      if (day.isToday) classes.push('sleep-calendar-day--today');
      let category: SleepCategory | null = null;
      if (log) {
        category = scoreLogInContext({ durationMinutes: log.durationMinutes, quality: log.quality }, log.date).category;
        classes.push('sleep-calendar-day--logged', `sleep-calendar-day--${category}`);
      }
      cell.className = classes.join(' ');
      cell.disabled = day.isFuture;

      const dayNumber = Number(day.date.slice(-2));
      const dot = log ? '<span class="sleep-calendar-day-dot"></span>' : '';
      cell.innerHTML = `<span>${dayNumber}</span>${dot}`;
      cell.setAttribute(
        'aria-label',
        log
          ? `${formatHeaderDate(day.date, { withYear: true })}, logged, ${CATEGORY_LABEL[category as SleepCategory]}`
          : `${formatHeaderDate(day.date, { withYear: true })}, not logged`
      );

      if (!day.isFuture) {
        cell.addEventListener('click', () => {
          showScreen('screen-sleep-dashboard');
          void loadDashboard(day.date);
        });
      }
      grid.append(cell);
    }
  }

  function openHistory(): void {
    const anchor = new Date(`${viewedDate}T00:00:00`);
    historyYear = anchor.getFullYear();
    historyMonth = anchor.getMonth();
    void loadHistoryMonth();
    showScreen('screen-sleep-history');
  }

  function shiftHistoryMonth(delta: number): void {
    const next = new Date(historyYear, historyMonth + delta, 1);
    historyYear = next.getFullYear();
    historyMonth = next.getMonth();
    void loadHistoryMonth();
  }

  /** Wind Down's ambient-sound picker + Begin button drive the exact same
   *  shared engine Focus's own screen uses (see audio-engine.ts's
   *  getFocusAudioEngine()) — picking a quick sound here and opening the
   *  full Focus screen later shows the same playing/stopped state,
   *  not two disconnected players. */
  function wireWindDown(): void {
    const engine = getFocusAudioEngine();
    const picker = byId('wind-down-sound-picker');
    const beginButton = byId<HTMLButtonElement>('btn-wind-down-begin');
    let selectedSoundId = 'rain';

    function selectPill(soundId: string): void {
      selectedSoundId = soundId;
      for (const pill of picker.querySelectorAll<HTMLButtonElement>('.sound-pill')) {
        pill.setAttribute('aria-pressed', String((pill.dataset.value ?? '') === soundId));
      }
    }

    picker.addEventListener('click', (event) => {
      const pill = (event.target as HTMLElement).closest<HTMLButtonElement>('.sound-pill');
      if (!pill || !picker.contains(pill)) return;
      selectPill(pill.dataset.value ?? '');
    });

    function renderBeginButton(state: FocusAudioState): void {
      const isThisSound = state.playing && state.soundscapeId === selectedSoundId && selectedSoundId !== '';
      beginButton.textContent = isThisSound ? 'Playing — tap to stop' : state.blocked ? 'Tap to try again' : 'Begin';
    }

    engine.onStateChange(renderBeginButton);
    renderBeginButton(engine.getState());

    beginButton.addEventListener('click', () => {
      const state = engine.getState();
      if (state.playing && state.soundscapeId === selectedSoundId) {
        engine.stop();
      } else if (selectedSoundId === '') {
        engine.stop(); // "Quiet" — just the breathing pacer, no sound
      } else {
        void engine.start(selectedSoundId);
      }
    });

    byId('btn-wind-down-more-sounds').addEventListener('click', () => showScreen('screen-focus'));
  }

  // --- wiring ---

  byId<HTMLFormElement>('sleep-log-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const errEl = byId('err-sleep-log');
    const bedTimeClock = byId<HTMLInputElement>('sleep-log-bedtime').value;
    const wakeTimeClock = byId<HTMLInputElement>('sleep-log-waketime').value;

    if (!bedTimeClock || !wakeTimeClock) {
      errEl.hidden = false;
      return;
    }

    const date = viewedDate;
    let times;
    try {
      times = computeSleepLogTimes(date, bedTimeClock, wakeTimeClock);
    } catch {
      errEl.hidden = false;
      return;
    }
    if (times.durationMinutes <= 0) {
      errEl.hidden = false;
      return;
    }
    errEl.hidden = true;

    const qualityValue = qualityChips.getValue();
    const saved = await saveSleepLog({
      date,
      bedTime: times.bedTime,
      wakeTime: times.wakeTime,
      durationMinutes: times.durationMinutes,
      quality: qualityValue == null ? null : Number(qualityValue),
      notes: byId<HTMLTextAreaElement>('sleep-log-notes').value.trim(),
    });

    viewedLog = saved;
    recentLogs = [saved, ...recentLogs.filter((l) => l.date !== date)];
    renderResult(saved);
  });

  byId('btn-sleep-edit-log').addEventListener('click', () => {
    if (!viewedLog) return;
    byId<HTMLInputElement>('sleep-log-bedtime').value = viewedLog.bedTime ? formatTimeInputValue(viewedLog.bedTime) : '';
    byId<HTMLInputElement>('sleep-log-waketime').value = viewedLog.wakeTime ? formatTimeInputValue(viewedLog.wakeTime) : '';
    qualityChips.setValue(viewedLog.quality == null ? null : String(viewedLog.quality));
    byId<HTMLTextAreaElement>('sleep-log-notes').value = viewedLog.notes ?? '';
    renderForm();
  });

  byId('btn-sleep-start-wind-down').addEventListener('click', () => showScreen('screen-sleep-wind-down'));
  byId('btn-wind-down-back').addEventListener('click', () => showScreen('screen-sleep-dashboard'));
  wireWindDown();

  // ---------- Insights chart range ----------
  initChipGroup<TimeRangeKey>(byId('sleep-insight-range'), {
    initial: sleepInsightRange,
    onChange: (value) => {
      sleepInsightRange = value;
      renderInsightChart();
    },
  });

  byId('btn-sleep-insights').addEventListener('click', () => {
    renderInsights();
    showScreen('screen-sleep-insights');
  });
  // The "This week" strip itself is a second, larger door to the same
  // Insights screen as the header icon — same handler, just a bigger,
  // more inviting tap target now that it's a real button (see index.html).
  byId('btn-sleep-week-strip').addEventListener('click', () => {
    renderInsights();
    showScreen('screen-sleep-insights');
  });
  byId('btn-sleep-insights-back').addEventListener('click', () => showScreen('screen-sleep-dashboard'));

  byId('btn-sleep-dashboard-date').addEventListener('click', openHistory);
  byId('btn-sleep-log-history-link').addEventListener('click', openHistory);
  byId('btn-sleep-result-history-link').addEventListener('click', openHistory);
  byId('btn-sleep-history-back').addEventListener('click', () => showScreen('screen-sleep-dashboard'));
  byId('btn-sleep-history-prev-month').addEventListener('click', () => shiftHistoryMonth(-1));
  byId('btn-sleep-history-next-month').addEventListener('click', () => shiftHistoryMonth(1));

  byId('btn-sleep-dashboard-back').addEventListener('click', () => showScreen('screen-hub'));

  // The Hub's Sleep tile jumps straight here — reload *today's* state
  // every time this screen becomes current, not just once at boot, so
  // last night's freshly-saved log always shows regardless of whatever
  // date History was last left viewing.
  byId('btn-home-sleep').addEventListener('click', () => {
    void loadDashboard();
  });

  void loadDashboard();
}
