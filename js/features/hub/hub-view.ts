// The Hub: the app's front door. It wires navigation between the mini-app
// tiles and the screens they open — every mini-app owns its own feature
// module (sleep-view.ts, focus-view.ts, ...) the same way every
// pre-existing feature owns its own screen(s). It also owns the tiles'
// kinetic-data readouts (the Sleep ring, the Focus waveform) and the
// spatial-tilt effect, since both are Hub presentation, not something any
// mini-app should need to know exists.
import { showScreen } from '../../lib/router.js';
import { attachTilt } from '../../lib/tilt.js';
import { getFocusAudioEngine } from '../focus/audio-engine.js';
import { renderTrendChart } from '../../lib/trend-chart.js';
import { buildSmoothAreaGeometry } from '../../lib/smooth-chart.js';
import { animateCountUp } from '../../lib/count-up.js';

function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`hub-view: missing #${id}`);
  return el as T;
}

function bySvgId<T extends SVGElement = SVGElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`hub-view: missing #${id}`);
  return el as unknown as T;
}

// Matches .hub-ring-fill's r=16 in index.html/mini-apps.css.
const HUB_RING_CIRCUMFERENCE = 2 * Math.PI * 16;

export function initHubFeature(): void {
  byId('btn-home-fitness-toolkit').addEventListener('click', () => showScreen('screen-home'));
  byId('btn-fitness-toolkit-back').addEventListener('click', () => showScreen('screen-hub'));

  // The hero "Stay Active" banner is a real shortcut into the same
  // Fitness Toolkit the grid tile below already opens (Programs, Run,
  // Nutrition, ...) — not a separate destination invented for the
  // banner, so there's nothing new to keep in sync.
  byId('btn-hub-stay-active').addEventListener('click', () => showScreen('screen-home'));

  byId('btn-home-sleep').addEventListener('click', () => showScreen('screen-sleep-dashboard'));
  byId('btn-sleep-dashboard-back').addEventListener('click', () => showScreen('screen-hub'));

  byId('btn-home-focus').addEventListener('click', () => showScreen('screen-focus'));
  byId('btn-focus-back').addEventListener('click', () => showScreen('screen-hub'));

  byId('btn-home-meditate').addEventListener('click', () => showScreen('screen-meditate'));
  byId('btn-meditate-back').addEventListener('click', () => showScreen('screen-hub'));

  byId('btn-home-vitals').addEventListener('click', () => showScreen('screen-vitals'));
  byId('btn-vitals-back').addEventListener('click', () => showScreen('screen-hub'));

  byId('btn-home-steps').addEventListener('click', () => showScreen('screen-steps'));
  byId('btn-steps-back').addEventListener('click', () => showScreen('screen-hub'));

  byId('btn-home-hydration').addEventListener('click', () => showScreen('screen-hydration'));
  byId('btn-hydration-back').addEventListener('click', () => showScreen('screen-hub'));

  // Run's own back button carries an "end this run without saving?"
  // confirm that only run-tracker.js knows about, so — unlike every tile
  // above — only the forward direction is wired here; the back button
  // stays entirely run-tracker.js's own, same reason its own click
  // handler on btn-home-run (below) is a side effect, not a navigation.
  byId('btn-home-run').addEventListener('click', () => showScreen('screen-run'));

  // Badges' own tile/back navigation is wired in badges-view.ts, not here
  // — same reason Heart Rate's own btn-home-heart-rate is: opening it
  // needs a fresh evaluation of real data first, an async step every
  // other tile above doesn't need before showing its screen. Hearing's
  // own btn-home-hearing (hearing-view.js) is the same case again — its
  // history/trend needs a real fetch before the screen shows.

  // Spatial tilt: one shared reading (pointer, or real device tilt once
  // granted) drives every tile's depth-layered parallax at once. iOS 13+
  // gates device-tilt behind a user gesture — asking on the Hub's own
  // first tap is the least intrusive place to do that, and everywhere
  // else this is simply a silent no-op.
  const tilt = attachTilt(byId('screen-hub'));
  byId('screen-hub').addEventListener('pointerdown', () => void tilt.requestMotionPermission(), { once: true });

  // Focus's mini waveform reflects real playback state, live, from
  // wherever it was started (its own screen or Wind Down) — not just
  // clicks made on this screen.
  const focusWave = byId('hub-focus-wave');
  getFocusAudioEngine().onStateChange((state) => {
    focusWave.classList.toggle('is-live', state.playing);
  });
}

/** Updates the Sleep tile's subtitle on the Hub — e.g. "86 · Great last
 * night" once a score exists, left at its default "Log tonight's sleep"
 * until then. Exported so sleep-view.ts can call it after saving a night's
 * log, without the Hub needing to know anything about how Sleep computes
 * that text. */
export function setSleepTileSubtitle(text: string): void {
  byId('hub-sleep-sub').textContent = text;
}

/** Same handoff as setSleepTileSubtitle, for Meditate's own streak text —
 *  e.g. "4-day streak" once one exists, left at its default description
 *  until a first session is actually logged. */
export function setMeditateTileSubtitle(text: string): void {
  byId('hub-meditate-sub').textContent = text;
}

/** Same handoff again, for Vitals' own logging-streak text. */
export function setVitalsTileSubtitle(text: string): void {
  byId('hub-vitals-sub').textContent = text;
}

/** Same handoff again, for Steps' own logging-streak text. */
export function setStepsTileSubtitle(text: string): void {
  byId('hub-steps-sub').textContent = text;
}

/** Same handoff again, for Hydration's own logging-streak text. */
export function setHydrationTileSubtitle(text: string): void {
  byId('hub-hydration-sub').textContent = text;
}

/** Same handoff again, for Run's own most-recent-run text. */
export function setRunTileSubtitle(text: string): void {
  byId('hub-run-sub').textContent = text;
}

/** Same handoff again, for Badges' own "X earned" count — set from real
 *  evaluated data (badges-view.ts), never a placeholder. */
export function setBadgesTileSubtitle(text: string): void {
  byId('hub-badges-sub').textContent = text;
}

/** Same handoff again, for Hearing's own check-in streak text. */
export function setHearingTileSubtitle(text: string): void {
  byId('hub-hearing-sub').textContent = text;
}

/** Active Energy's real cross-app rollup (active-energy-view.js) — a
 *  `null` text hides the line entirely (no profile weight on file, or
 *  nothing logged yet today), the same "never a fabricated number" rule
 *  as every other honesty-gated readout in this app. */
export function setActiveEnergyText(text: string | null): void {
  const el = byId('hub-active-energy');
  el.hidden = text == null;
  el.textContent = text ?? '';
}

/** Draws the Sleep tile's mini ring in to a real score (0-100), or back to
 * its empty "waiting for data" state for `null` — the same honesty rule as
 * the subtitle: never a number that isn't backed by an actual logged
 * night. */
export function setSleepTileScore(score: number | null): void {
  const fraction = score == null ? 0 : Math.max(0, Math.min(100, score)) / 100;
  const offset = HUB_RING_CIRCUMFERENCE * (1 - fraction);
  bySvgId('hub-sleep-ring-fill').setAttribute('stroke-dashoffset', offset.toFixed(2));
  byId('btn-home-sleep').classList.toggle('hub-tile--no-score', score == null);
}

// ============================================================================
// "Your Recent Stats" hero cards — real cross-app rollups (Steps/Calories/
// Water), each fed by its own orchestrator the same "compute the real data
// elsewhere, hand it to the Hub through a setter" split as everything
// above: js/features/hub/hub-stats-view.ts (Steps/Water) and
// js/features/activity/active-energy-view.js (Calories, its own existing
// rollup — reused here, not recomputed).
// ============================================================================

/** The greeting header — `eyebrow` is a real local-clock-derived time-of-
 *  day greeting (hub-stats.ts's greetingForHour), `name` is either the
 *  real optional profile display name or a plain, honest fallback —
 *  never a fabricated name. */
export function setHubGreeting({ eyebrow, name }: { eyebrow: string; name: string }): void {
  byId('hub-greeting-eyebrow').textContent = eyebrow;
  byId('hub-greeting-name').textContent = name;
}

export interface HeroWeekPoint {
  /** A stable key (ISO date) — used only as a DOM key. */
  key: string;
  value: number;
  axisLabel: string;
  tooltipValue: string;
  tooltipDetail: string;
  isToday: boolean;
}

export interface HeroStepsCardData {
  steps: number;
  /** null with no profile height on file — the same honesty rule as
   *  Steps' own screen (steps-distance-estimate.ts). */
  distanceText: string | null;
  /** Exactly 7 real trailing days, oldest first, zero-filled for days
   *  with nothing logged (hub-stats.ts's trailingDailyTotals). */
  week: HeroWeekPoint[];
}

/** The Steps hero card — a real trailing-7-day bar chart (today's own bar
 *  highlighted) reusing js/lib/trend-chart.ts as-is, plus today's real
 *  count and a real distance estimate. */
export function setHeroStepsCard(data: HeroStepsCardData): void {
  animateCountUp(byId('hub-stat-steps-value'), data.steps);

  const sub = byId('hub-stat-steps-sub');
  sub.hidden = data.distanceText == null;
  sub.textContent = data.distanceText ?? '';

  renderTrendChart(byId('hub-stat-steps-chart'), {
    points: data.week.map((p) => ({
      key: p.key,
      value: p.value,
      axisLabel: p.axisLabel,
      highlighted: p.isToday,
      tooltipValue: p.tooltipValue,
      tooltipDetail: p.tooltipDetail,
    })),
    accentVar: '--steps-accent',
    emptyMessage: 'No steps logged this week yet.',
  });
}

/** Tears the Steps hero chart's real DOM bars back down — every screen
 *  here stays mounted in the background (hidden, never removed), and
 *  js/lib/trend-chart.ts's bars carry the same `.trend-chart-bar` class
 *  Steps/Hydration/Run's own trend charts use for their own unscoped
 *  queries; leaving this one own mounted off-screen would silently double
 *  up any of those. Called from hub-stats-view.ts the moment the Hub
 *  itself stops being the visible screen (router.js's onScreenHidden). */
export function clearHeroStepsChart(): void {
  byId('hub-stat-steps-chart').innerHTML = '';
}

export interface HeroCaloriesSegment {
  source: string;
  kcal: number;
  fraction: number;
}

const CALORIES_RING_R = 24;
const CALORIES_RING_CIRCUMFERENCE = 2 * Math.PI * CALORIES_RING_R;
// One warm hue at decreasing opacity per real contributing source — a
// genuine composition (how much of today's total came from Steps vs Run
// vs Activity vs Strength), never a fabricated goal fraction this app has
// no real target for (see active-energy.ts's buildActiveEnergySegments).
const CALORIES_SEGMENT_OPACITY = [1, 0.72, 0.5, 0.32];

/** The Calories hero card — a real ring composed of Active Energy's own
 *  already-computed per-source kcal values (never recomputed here), or
 *  its honest empty state when there's nothing real to show yet (no
 *  profile weight on file, or nothing logged today). */
export function setHeroCaloriesCard(data: { total: number | null; segments: HeroCaloriesSegment[] }): void {
  const group = bySvgId<SVGGElement>('hub-stat-calories-ring-segments');
  group.innerHTML = '';
  const valueEl = byId('hub-stat-calories-value');
  const emptyEl = byId('hub-stat-calories-empty');

  if (data.total == null) {
    valueEl.hidden = true;
    valueEl.innerHTML = '';
    emptyEl.hidden = false;
    return;
  }

  valueEl.hidden = false;
  valueEl.innerHTML = '';
  const numberEl = document.createElement('strong');
  numberEl.textContent = `~${data.total}`;
  const unitEl = document.createElement('small');
  unitEl.textContent = 'kcal';
  valueEl.append(numberEl, unitEl);
  emptyEl.hidden = true;

  const ns = 'http://www.w3.org/2000/svg';
  let cumulative = 0;
  data.segments.forEach((segment, i) => {
    const arcLength = segment.fraction * CALORIES_RING_CIRCUMFERENCE;
    const circle = document.createElementNS(ns, 'circle');
    circle.setAttribute('class', 'hub-stat-ring-segment');
    circle.setAttribute('cx', '30');
    circle.setAttribute('cy', '30');
    circle.setAttribute('r', String(CALORIES_RING_R));
    circle.setAttribute('stroke', 'var(--calories-accent)');
    circle.setAttribute('stroke-opacity', String(CALORIES_SEGMENT_OPACITY[i] ?? 0.32));
    circle.setAttribute('stroke-dasharray', `${arcLength.toFixed(2)} ${(CALORIES_RING_CIRCUMFERENCE - arcLength).toFixed(2)}`);
    circle.setAttribute('stroke-dashoffset', (-cumulative).toFixed(2));
    group.append(circle);
    cumulative += arcLength;
  });
}

export interface HeroWaterCardData {
  todayMl: number;
  /** Exactly 7 real trailing days, oldest first, zero-filled for days
   *  with nothing logged. */
  week: { date: string; value: number }[];
}

/** The Water hero card — a real smooth trailing-7-day line (the same
 *  Catmull-Rom geometry Sleep's own chart uses, js/lib/smooth-chart.ts),
 *  with today's own value always labeled, not just on hover — a glanceable
 *  hero card, not a drill-down one. */
export function setHeroWaterCard(data: HeroWaterCardData): void {
  byId('hub-stat-water-value').textContent = `${data.todayMl.toLocaleString()} ml`;

  const svg = bySvgId<SVGSVGElement>('hub-stat-water-chart');
  svg.innerHTML = '';
  const width = 120;
  const height = 36;
  const geometry = buildSmoothAreaGeometry(
    data.week.map((d) => d.value),
    { width, height }
  );
  if (geometry.points.length < 2) return;

  const ns = 'http://www.w3.org/2000/svg';
  const defs = document.createElementNS(ns, 'defs');
  defs.innerHTML =
    '<linearGradient id="hubWaterGrad" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0%" stop-color="var(--hydration-accent)" stop-opacity="0.55"/>' +
    '<stop offset="100%" stop-color="var(--hydration-accent)" stop-opacity="0"/>' +
    '</linearGradient>';
  svg.append(defs);

  const area = document.createElementNS(ns, 'path');
  area.setAttribute('d', geometry.areaPath);
  area.setAttribute('fill', 'url(#hubWaterGrad)');
  area.setAttribute('stroke', 'none');
  svg.append(area);

  const line = document.createElementNS(ns, 'path');
  line.setAttribute('d', geometry.linePath);
  line.setAttribute('fill', 'none');
  line.setAttribute('stroke', 'var(--hydration-accent)');
  line.setAttribute('stroke-width', '2');
  line.setAttribute('stroke-linecap', 'round');
  line.setAttribute('stroke-linejoin', 'round');
  line.setAttribute('vector-effect', 'non-scaling-stroke');
  svg.append(line);

  // Today's own point, marked — its exact value is already the card's own
  // big number above, so the mark here is just "which end of the curve is
  // today", not a second copy of the same text.
  const today = geometry.points[geometry.points.length - 1];
  if (today) {
    const dot = document.createElementNS(ns, 'circle');
    dot.setAttribute('cx', String(today.x));
    dot.setAttribute('cy', String(today.y));
    dot.setAttribute('r', '3');
    dot.setAttribute('fill', 'var(--hydration-accent)');
    dot.setAttribute('stroke', 'rgba(8,20,20,0.5)');
    dot.setAttribute('stroke-width', '1');
    dot.setAttribute('vector-effect', 'non-scaling-stroke');
    svg.append(dot);
  }
}
