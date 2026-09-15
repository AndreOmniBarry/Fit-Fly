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
import {
  listNapLogsForDate,
  listNapLogsInRange,
  saveNapLog,
} from '../../db/repositories/nap-logs.js';
import { getProfile } from '../../db/repositories/profile.js';
import { calculateAge } from '../onboarding/age.js';
import { calculateSleepScore } from './sleep-score.js';
import { calculateSleepDebt, describeSleepDebt, DEFAULT_SLEEP_GOAL_MINUTES } from './sleep-debt.js';
import { calculateSleepDebtWithNaps, describeNapDebtCredit } from './nap-debt.js';
import { bestSleepNightEver, buildWeeklyTrend, calculateLoggingStreak } from './sleep-trends.js';
import { calculateSleepFactorInsights } from './sleep-insights.js';
import { bucketSleepInsightNights, buildSleepInsightAreaGeometry } from './sleep-insight-chart.js';
import type { SleepInsightNight } from './sleep-insight-chart.js';
import { computeNapTimes, computeSleepLogTimes } from './sleep-duration.js';
import { describeNapsForDate } from './nap-summary.js';
import { buildHypnogramModel, STAGE_LABEL } from './sleep-hypnogram.js';
import type { SleepStage } from './sleep-hypnogram.js';
import { formatMonthLabel, getMonthGridDays, monthDateRange } from '../../lib/calendar-grid.js';
import { formatClockTime, formatDurationHM, formatTimeInputValue } from './format.js';
import { setSleepTileScore, setSleepTileSubtitle } from '../hub/hub-view.js';
import { calculateReadiness, readinessActionSuggestion } from '../recovery/readiness.js';
import type { ReadinessCategory } from '../recovery/readiness.js';
import {
  getReadinessCheckinForDate,
  saveReadinessCheckin,
} from '../../db/repositories/readiness.js';
import { listRecentSessions } from '../../db/repositories/sessions.js';
import { getFocusAudioEngine } from '../focus/audio-engine.js';
import type { FocusAudioState } from '../focus/audio-engine.js';
import {
  formatBucketAxisLabel,
  formatBucketDetailLabel,
  timeRangeBounds,
  timeRangeDescription,
} from '../../lib/time-range.js';
import type { TimeRangeKey } from '../../lib/time-range.js';
import type { NapLog, SleepCategory, SleepLog, SleepScoreResult } from './types.js';

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
  // Naps logged across recentLogs' own date window — fetched alongside it
  // in loadDashboard, so calculateSleepDebtWithNaps always has a real,
  // already-loaded set to credit against by the time Insights is opened
  // (same "populated during loadDashboard, read synchronously later"
  // contract recentLogs itself already follows).
  let recentNaps: NapLog[] = [];
  let viewedDate = todayDateString();
  let viewedLog: SleepLog | null = null;
  // Every nap logged for viewedDate specifically — a night's own log and
  // its date's naps are two independent things, so this is tracked apart
  // from viewedLog and never folds into it.
  let viewedNaps: NapLog[] = [];
  let profileAge: number | null = null;

  let historyYear = 0;
  let historyMonth = 0; // 0-11
  let historyLogs: SleepLog[] = [];
  let historyNapDates: Set<string> = new Set();

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

  /** Renders the nap card for whatever date is currently viewed — honest
   *  either way: a real "also napped for X" summary when one exists, an
   *  explicit "not logged yet" otherwise, never silence. Also resets the
   *  inline nap form back to closed/blank, the same "fresh state per
   *  viewed date" contract loadDashboard already applies to the night
   *  form.
   *
   *  The date field defaults to viewedDate (matches this card's own
   *  summary/empty state above it) but stays a real, editable date
   *  input — logging a forgotten nap from days ago doesn't require
   *  first navigating History to that date, the way editing that date's
   *  actual night log still does. Capped at today: a nap can't be
   *  logged for a day that hasn't happened yet. */
  function renderNapCard(): void {
    const summaryEl = byId('sleep-nap-summary');
    const emptyEl = byId('sleep-nap-empty');
    const description = describeNapsForDate(viewedNaps);

    summaryEl.textContent = description ?? '';
    summaryEl.hidden = description == null;
    emptyEl.hidden = description != null;

    byId('sleep-nap-form').hidden = true;
    const dateInput = byId<HTMLInputElement>('sleep-nap-date');
    dateInput.value = viewedDate;
    dateInput.max = todayDateString();
    byId<HTMLInputElement>('sleep-nap-start').value = '';
    byId<HTMLInputElement>('sleep-nap-end').value = '';
    byId('err-sleep-nap').hidden = true;
    byId('sleep-nap-confirm').hidden = true;
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

  const STAGE_ORDER: SleepStage[] = ['deep', 'light', 'rem', 'awake'];

  /** Renders the modeled sleep-stage timeline for whichever night just got
   *  scored — a real, honestly-labeled visualization (see
   *  sleep-hypnogram.ts's own doc comment on why "modeled", never
   *  "measured") built purely from that night's own logged bed/wake span
   *  and self-rated quality. Works the same whether `log` is tonight's
   *  freshly-saved entry or a past night opened from History — the model
   *  only needs a real duration, not "today". */
  function renderHypnogram(log: SleepLog): void {
    const card = byId('sleep-hypnogram-card');
    const model = buildHypnogramModel(log.durationMinutes, log.quality);
    if (model.segments.length === 0) {
      card.hidden = true;
      return;
    }
    card.hidden = false;

    const bar = byId('sleep-hypnogram-bar');
    bar.innerHTML = '';
    for (const segment of model.segments) {
      const span = document.createElement('span');
      span.className = `sleep-hypnogram-segment sleep-hypnogram-segment--${segment.stage}`;
      span.style.flexGrow = String(segment.endMinutes - segment.startMinutes);
      bar.append(span);
    }

    byId('sleep-hypnogram-start').textContent = log.bedTime ? formatClockTime(log.bedTime) : '—';
    byId('sleep-hypnogram-end').textContent = log.wakeTime ? formatClockTime(log.wakeTime) : '—';

    byId('sleep-hypnogram-cycles').textContent =
      model.cycleCount > 0 ? `· ${model.cycleCount} cycle${model.cycleCount === 1 ? '' : 's'}` : '';

    // Duration alongside share — "18% · 1h 26m" reads as a real quantity,
    // not just a proportion of the night, the same "give the actual
    // number, not only its share" rule Steps'/Hydration's own trend
    // tooltips already follow.
    const legend = byId('sleep-hypnogram-legend');
    legend.innerHTML = STAGE_ORDER.map(
      (stage) =>
        `<span><i class="sleep-hypnogram-dot sleep-hypnogram-dot--${stage}"></i> ${STAGE_LABEL[stage]} ${model.stagePercent[stage]}% · ${formatDurationHM(model.stageMinutes[stage])}</span>`
    ).join('');
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

    renderHypnogram(log);
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

    const [log, recent, napsForDate] = await Promise.all([
      getSleepLogForDate(date),
      listRecentSleepLogs(14),
      listNapLogsForDate(date),
    ]);
    viewedLog = log ?? null;
    recentLogs = recent;
    viewedNaps = napsForDate;

    // recentNaps only needs the real coverage recentLogs itself spans —
    // fetched as one range query (like listSleepLogsInRange) rather than
    // per-date, since a night without a nap is the common case and this
    // avoids N queries for N nights.
    if (recentLogs.length > 0) {
      const oldest = recentLogs[recentLogs.length - 1] as SleepLog;
      const newest = recentLogs[0] as SleepLog;
      recentNaps = await listNapLogsInRange(oldest.date, newest.date);
    } else {
      recentNaps = [];
    }

    renderNapCard();
    void loadReadiness(date);

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

    // Nap-aware debt: exactly calculateSleepDebt's own arithmetic, plus
    // each night's own logged naps credited back per nap-debt.ts's rule —
    // a night with no naps that same date gets zero credit and reads
    // identically to plain calculateSleepDebt (see that module's own
    // doc comment on why this is additive, not a replacement).
    const debt = calculateSleepDebtWithNaps(recentLogs.slice(0, 7), recentNaps);
    const debtEl = byId('sleep-insight-debt');
    if (debt.nightsConsidered === 0) debtEl.textContent = '—';
    else animateCountUp(debtEl, debt.debtMinutes, { formatter: formatDurationHM });
    const napCreditNote = describeNapDebtCredit(debt.napCreditMinutes);
    debtEl.title = napCreditNote ? `${describeSleepDebt(debt)} ${napCreditNote}` : describeSleepDebt(debt);

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
    const [logs, naps] = await Promise.all([
      listSleepLogsInRange(start, end),
      listNapLogsInRange(start, end),
    ]);
    historyLogs = logs;
    historyNapDates = new Set(naps.map((nap) => nap.date));
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
      const napped = historyNapDates.has(day.date);
      if (napped) classes.push('sleep-calendar-day--napped');
      cell.className = classes.join(' ');
      cell.disabled = day.isFuture;

      const dayNumber = Number(day.date.slice(-2));
      const dot = log ? '<span class="sleep-calendar-day-dot"></span>' : '';
      cell.innerHTML = `<span>${dayNumber}</span>${dot}`;
      const nightLabel = log
        ? `logged, ${CATEGORY_LABEL[category as SleepCategory]}`
        : 'not logged';
      const napLabel = napped ? ', also napped' : '';
      cell.setAttribute('aria-label', `${formatHeaderDate(day.date, { withYear: true })}, ${nightLabel}${napLabel}`);

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

  // ---------- "How today looks" — Readiness, collapsed into Sleep ----------
  // Same transparent, rule-based score this app always had (see
  // js/features/recovery/readiness.js, untouched) — only its home moved.
  // A quick energy/soreness check-in and last night's own sleep are the
  // same morning routine, not two separate destinations to visit; this
  // card reuses tonight's already-logged duration directly instead of
  // asking the person to re-type hours they just entered above it.
  const readinessEnergyChips = initChipGroup<string | null>(byId('sleep-readiness-energy'), { initial: null });
  const readinessSorenessChips = initChipGroup<string | null>(byId('sleep-readiness-soreness'), { initial: null });

  async function countRecentReadinessSessions(withinDays = 2): Promise<number> {
    const sessions = await listRecentSessions(20);
    const cutoff = Date.now() - withinDays * 24 * 60 * 60 * 1000;
    return sessions.filter((s) => new Date(s.startedAt).getTime() >= cutoff).length;
  }

  function renderReadinessResult(result: { score: number; category: ReadinessCategory; reasoning: string[] }): void {
    const categoryEl = byId('sleep-readiness-category');
    categoryEl.hidden = false;
    categoryEl.textContent = `estimated · ${result.category}`;
    const scoreLineEl = byId('sleep-readiness-score-line');
    scoreLineEl.hidden = false;
    scoreLineEl.textContent = `${result.score} / 100`;
    const suggestionEl = byId('sleep-readiness-suggestion');
    suggestionEl.hidden = false;
    suggestionEl.textContent = readinessActionSuggestion(result.category);
    const reasoningEl = byId('sleep-readiness-reasoning');
    reasoningEl.hidden = result.reasoning.length === 0;
    reasoningEl.innerHTML = result.reasoning.map((line) => `<li>${line}</li>`).join('');
  }

  function hideReadinessResult(): void {
    byId('sleep-readiness-category').hidden = true;
    byId('sleep-readiness-score-line').hidden = true;
    byId('sleep-readiness-suggestion').hidden = true;
    byId('sleep-readiness-reasoning').hidden = true;
  }

  /** Readiness is only ever about *today* — a past night opened from
   *  History doesn't get a retroactive check-in (the same restriction the
   *  standalone screen this replaced always had), so the whole card hides
   *  itself for any other viewed date instead of showing controls that
   *  don't make sense for a day that's already over. */
  async function loadReadiness(date: string): Promise<void> {
    const card = byId('sleep-readiness-card');
    if (date !== todayDateString()) {
      card.hidden = true;
      return;
    }
    card.hidden = false;
    byId('err-sleep-readiness').hidden = true;

    const existing = await getReadinessCheckinForDate(date);
    if (existing) {
      readinessEnergyChips.setValue(existing.energyLevel != null ? String(existing.energyLevel) : null);
      readinessSorenessChips.setValue(existing.sorenessLevel != null ? String(existing.sorenessLevel) : null);
      renderReadinessResult({ score: existing.score, category: existing.category, reasoning: [] });
    } else {
      readinessEnergyChips.setValue(null);
      readinessSorenessChips.setValue(null);
      hideReadinessResult();
    }
  }

  byId('btn-sleep-readiness-save').addEventListener('click', async () => {
    const energyLevel = readinessEnergyChips.getValue() ? Number(readinessEnergyChips.getValue()) : null;
    const sorenessLevel = readinessSorenessChips.getValue() ? Number(readinessSorenessChips.getValue()) : null;
    // Never re-asked here — today's own Sleep log (right above this card
    // once it exists) is the real number; this card only ever adds
    // energy/soreness on top of it, not a second sleep-hours field.
    const sleepHours = viewedLog && viewedDate === todayDateString() ? viewedLog.durationMinutes / 60 : null;

    const hasInput = sleepHours != null || energyLevel != null || sorenessLevel != null;
    byId('err-sleep-readiness').hidden = hasInput;
    if (!hasInput) return;

    const recentSessionCount = await countRecentReadinessSessions();
    const sleepDebtMinutes = recentLogs.length > 0 ? calculateSleepDebt(recentLogs).debtMinutes : null;
    const result = calculateReadiness({ sleepHours, energyLevel, sorenessLevel, recentSessionCount, sleepDebtMinutes });
    if (!result) return; // calculateReadiness's own "not enough input" guard — unreachable given the hasInput check above, kept for type safety

    await saveReadinessCheckin({
      date: viewedDate,
      sleepHours,
      energyLevel,
      sorenessLevel,
      recentSessionCount,
      score: result.score,
      category: result.category,
    });

    renderReadinessResult(result);
  });

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

  // Nap: a real, separate quick action — its own toggle button, its own
  // form, its own save handler, never routed through sleep-log-form's
  // night-only submit above. Toggling reveals/hides the inline form; a
  // fresh loadDashboard (a new viewed date) always closes it again via
  // renderNapCard.
  byId('btn-sleep-nap-toggle').addEventListener('click', () => {
    const form = byId('sleep-nap-form');
    form.hidden = !form.hidden;
    if (!form.hidden) byId('sleep-nap-confirm').hidden = true; // a fresh entry, not last save's leftover confirmation
  });

  byId<HTMLFormElement>('sleep-nap-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const errEl = byId('err-sleep-nap');
    const napDate = byId<HTMLInputElement>('sleep-nap-date').value;
    const startClock = byId<HTMLInputElement>('sleep-nap-start').value;
    const endClock = byId<HTMLInputElement>('sleep-nap-end').value;

    // The date field's own max=today (set in renderNapCard) already
    // stops most browsers from offering a future date in the picker UI,
    // but that's a UI hint, not a guarantee — still worth a real check
    // before ever writing a "nap" that hasn't happened yet.
    if (!napDate || napDate > todayDateString() || !startClock || !endClock) {
      errEl.hidden = false;
      return;
    }

    let times;
    try {
      times = computeNapTimes(napDate, startClock, endClock);
    } catch {
      errEl.hidden = false;
      return;
    }
    if (times.durationMinutes <= 0) {
      errEl.hidden = false;
      return;
    }
    errEl.hidden = true;

    const saved = await saveNapLog({
      date: napDate,
      startTime: times.startTime,
      endTime: times.endTime,
      durationMinutes: times.durationMinutes,
    });

    recentNaps = [...recentNaps, saved];

    if (napDate === viewedDate) {
      // The card's own summary is for viewedDate — this nap belongs on
      // it, so a full re-render (which also closes/resets the form) is
      // the real confirmation: the summary line updating *is* the
      // "saved" feedback.
      viewedNaps = [...viewedNaps, saved];
      renderNapCard();
    } else {
      // Logged a *different* day's nap while viewing this one (exactly
      // the "forgot Sunday's nap, remembered it today" case) — the
      // card above still correctly shows viewedDate's own naps, so
      // silently doing nothing else here would look like the save
      // didn't happen. A distinct confirmation, naming the date it
      // actually landed on, is what makes that legible instead.
      byId('sleep-nap-form').hidden = true;
      byId<HTMLInputElement>('sleep-nap-start').value = '';
      byId<HTMLInputElement>('sleep-nap-end').value = '';
      const confirmEl = byId('sleep-nap-confirm');
      confirmEl.textContent = `Nap logged for ${formatHeaderDate(napDate)}.`;
      confirmEl.hidden = false;
    }
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
