import { showScreen } from '../../lib/router.js';
import { loadInlineSvg } from '../../lib/svg-loader.js';
import { attachTilt } from '../../lib/tilt.js';
import { animateCountUp } from '../../lib/count-up.js';
import { initChipGroup } from '../../lib/chip-group.js';
import { createCountdown, formatDuration } from '../../lib/timer.js';
import { playCompletionBeep, primeAudio, vibrateDevice } from '../../lib/audio-cue.js';
import { getProfile } from '../../db/repositories/profile.js';
import { getLatestCategoryAssignment, recordCategoryAssignment } from '../../db/repositories/category-assignments.js';
import { listInjuryScreens } from '../../db/repositories/injury-screens.js';
import { createProgram, getActiveProgram, PROGRAM_STATUS, setProgramStatus } from '../../db/repositories/programs.js';
import { addSet, createSession, listRecentSessions, listSetsForExercise } from '../../db/repositories/sessions.js';
import { getReadinessCheckinForDate } from '../../db/repositories/readiness.js';
import { getLibraryExercise } from '../exercises/exercise-library.js';
import { readinessActionSuggestion } from '../recovery/readiness.js';
import { assignCategory } from '../onboarding/category-engine.js';
import { formatCategoryLabel } from '../onboarding/wizard.js';
import { applyCategoryAccent } from '../../lib/theme.js';
import { tagBodyArea } from './body-area-tag.js';
import { generateProgram } from './program-generator.js';
import { getCurrentWeekNumber } from './week-number.js';
import { bestEstimatedOneRepMax } from './one-rep-max.js';

function byId(id) {
  return document.getElementById(id);
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

const DAY_TYPE_LABELS = {
  'full-body': 'Full Body',
  upper: 'Upper Body',
  lower: 'Lower Body',
  cardio: 'Cardio',
  mobility: 'Mobility',
};

// A badge per day type — real training-signal icons, not the same
// dumbbell repeated regardless of what the day actually is.
const DAY_TYPE_ICONS = {
  'full-body': 'dumbbell',
  upper: 'dumbbell',
  lower: 'dumbbell',
  cardio: 'wind',
  mobility: 'leaf',
};

let activeProgramId = null;

// The one inline rest countdown currently showing (see
// startInlineRestTimer's own doc comment) — { dayIndex, exerciseId,
// pollHandle } or null. Module-level rather than per-row state because
// only one is ever meant to be visible at a time.
let activeRestTimer = null;

export function initProgramFeature() {
  byId('btn-home-program').addEventListener('click', async () => {
    await renderProgramScreen();
    showScreen('screen-program');
  });
  byId('btn-program-back').addEventListener('click', () => showScreen('screen-home'));

  // ---------- change goal ----------
  // "Pick the closest fit — you can change this any time," the
  // onboarding goal screen already says. This is what actually makes
  // that true, instead of "start over" (a full re-onboarding, including
  // re-answering things that haven't changed) being the only way.
  const goalChips = initChipGroup(byId('program-goal-chips'));

  byId('btn-program-change-goal').addEventListener('click', async () => {
    const assignment = await getLatestCategoryAssignment();
    goalChips.setValue(assignment?.inputsSnapshot?.primaryGoal ?? null);
    byId('err-program-goal').hidden = true;
    byId('program-goal-picker').hidden = false;
  });

  byId('btn-program-goal-cancel').addEventListener('click', () => {
    byId('program-goal-picker').hidden = true;
  });

  byId('btn-program-goal-save').addEventListener('click', async () => {
    const newGoal = goalChips.getValue();
    byId('err-program-goal').hidden = Boolean(newGoal);
    if (!newGoal) return;

    const assignment = await getLatestCategoryAssignment();
    if (!assignment) return; // this screen never renders without one — see renderProgramScreen()
    const priorInputs = assignment.inputsSnapshot ?? {};

    if (newGoal !== priorInputs.primaryGoal) {
      const categoryResult = assignCategory({ ...priorInputs, primaryGoal: newGoal });
      await recordCategoryAssignment({
        category: categoryResult.category,
        reasoning: categoryResult.reasoning,
        trainingFocus: categoryResult.trainingFocus,
        inputsSnapshot: { ...priorInputs, primaryGoal: newGoal },
      });

      // Only one program is ever "current" — archive whatever was active
      // for the old category/focus so a later switch back starts a real
      // fresh attempt rather than silently reusing a program abandoned
      // long ago under a stale start date.
      const oldProgram = await getActiveProgram(assignment.category, assignment.trainingFocus);
      if (oldProgram) await setProgramStatus(oldProgram.id, PROGRAM_STATUS.ARCHIVED);

      // The Fitness Toolkit home screen's own category badge/accent is
      // otherwise only ever set at app load or onboarding completion —
      // refreshed right here too so it's never stale by the time someone
      // navigates back to it, regardless of which button they use to
      // leave this screen.
      applyCategoryAccent(categoryResult.category, document.documentElement);
      const homeBadge = document.getElementById('home-category-badge');
      if (homeBadge) homeBadge.textContent = formatCategoryLabel(categoryResult.category, categoryResult.trainingFocus);
    }

    byId('program-goal-picker').hidden = true;
    await renderProgramScreen();
  });

  // Same spatial-tilt language as the Fitness Toolkit home list — scoped
  // to just this screen.
  const programScreen = byId('screen-program');
  const programTilt = attachTilt(programScreen);
  programScreen.addEventListener('pointerdown', () => void programTilt.requestMotionPermission(), {
    once: true,
  });

  byId('program-days').addEventListener('click', async (event) => {
    if (event.target.closest('[data-skip-rest]')) {
      stopInlineRestTimer();
      return;
    }

    const button = event.target.closest('[data-log-set]');
    if (!button) return;
    const { dayIndex, exerciseId, logMetric, restSec } = button.dataset;
    primeAudio(); // inside this click's call stack, so the rest timer's completion beep can play later

    if (logMetric === 'time') {
      const durationInput = byId(durationInputId(dayIndex, exerciseId));
      const durationSec = Number(durationInput.value);
      if (!(durationSec >= 1)) return;
      await logSet(exerciseId, { durationSec });
      durationInput.value = '';
      startInlineRestTimer(dayIndex, exerciseId, Number(restSec));
      return;
    }

    const repsInput = byId(repsInputId(dayIndex, exerciseId));
    const reps = Number(repsInput.value);
    if (!(reps >= 1)) return;

    if (logMetric === 'reps-weight') {
      const weightInput = byId(weightInputId(dayIndex, exerciseId));
      const weightKg = Number(weightInput.value) || 0;
      await logSet(exerciseId, { reps, weightKg });
      weightInput.value = '';
      await renderOneRepMax(exerciseId); // updates every day card showing this exercise, not just this one
    } else {
      await logSet(exerciseId, { reps });
    }
    repsInput.value = '';
    startInlineRestTimer(dayIndex, exerciseId, Number(restSec));
  });
}

/** Reuses the person's existing active program for their (category,
 *  trainingFocus) pair if one exists, so "start date" (and therefore the
 *  week/deload count) stays stable across visits — otherwise creates
 *  one. Scoped by trainingFocus too, not just category, so switching
 *  between "build muscle" and "build strength" (both category
 *  'hypertrophy') never silently reuses the other one's program. */
async function ensureActiveProgram(category, experienceLevel, trainingFocus) {
  const existing = await getActiveProgram(category, trainingFocus);
  if (existing) return existing;

  const created = await createProgram({
    category,
    experienceLevel,
    trainingFocus,
    startedAt: new Date().toISOString(),
  });
  await setProgramStatus(created.id, PROGRAM_STATUS.ACTIVE);
  return { ...created, status: PROGRAM_STATUS.ACTIVE };
}

/** The most recent onboarding safety screen's flagged area, tagged onto
 *  the small vocabulary program-generator.js filters against. No flagged
 *  area (or nothing recognizable) means no exclusions. */
async function getInjuryBodyAreaTags() {
  const [latest] = await listInjuryScreens();
  if (!latest || latest.bodyArea === 'none') return [];
  const tag = tagBodyArea(latest.bodyArea);
  return tag === 'other' ? [] : [tag];
}

async function renderProgramScreen() {
  stopInlineRestTimer(); // #program-days is about to be replaced wholesale below
  const [profile, assignment] = await Promise.all([getProfile(), getLatestCategoryAssignment()]);
  if (!profile || !assignment) return;

  const program = await ensureActiveProgram(assignment.category, profile.experienceLevel, assignment.trainingFocus);
  activeProgramId = program.id;
  const weekNumber = getCurrentWeekNumber(program.startedAt);
  const injuryBodyAreaTags = await getInjuryBodyAreaTags();

  const generated = generateProgram({
    category: assignment.category,
    experienceLevel: profile.experienceLevel,
    trainingFocus: assignment.trainingFocus,
    injuryBodyAreaTags,
    weekNumber,
  });

  byId('program-goal-label').textContent = formatCategoryLabel(assignment.category, assignment.trainingFocus);
  animateCountUp(byId('program-week-number'), generated.weekNumber);
  byId('program-block-label').textContent = `Block ${generated.blockNumber}`;
  byId('program-deload-banner').hidden = !generated.isDeload;
  await renderReadinessBanner();
  byId('program-reasoning').innerHTML = generated.reasoning.map((line) => `<li>${line}</li>`).join('');
  byId('program-days').innerHTML = generated.days.map(renderDay).join('');

  const allExerciseIds = new Set();
  for (const day of generated.days) {
    for (const exercise of day.exercises) {
      loadDemoSvgInto(svgSlotId(day.dayIndex, exercise.exerciseId), getLibraryExercise(exercise.exerciseId)?.demoSvg);
      allExerciseIds.add(exercise.exerciseId);
    }
  }
  for (const exerciseId of allExerciseIds) {
    renderOneRepMax(exerciseId);
  }
}

function svgSlotId(dayIndex, exerciseId) {
  return `program-svg-${dayIndex}-${exerciseId}`;
}
// The same exercise can appear on more than one day (e.g. a hypertrophy
// upper/lower split repeats each pattern twice a week), so every DOM id
// tied to one rendered occurrence is keyed by day *and* exercise —
// otherwise two occurrences would collide on the same id and every
// lookup would silently only ever find the first one.
function repsInputId(dayIndex, exerciseId) {
  return `program-reps-${dayIndex}-${exerciseId}`;
}
function weightInputId(dayIndex, exerciseId) {
  return `program-weight-${dayIndex}-${exerciseId}`;
}
function durationInputId(dayIndex, exerciseId) {
  return `program-duration-${dayIndex}-${exerciseId}`;
}
function restRowId(dayIndex, exerciseId) {
  return `program-rest-row-${dayIndex}-${exerciseId}`;
}
function restDisplayId(dayIndex, exerciseId) {
  return `program-rest-display-${dayIndex}-${exerciseId}`;
}

function renderDay(day) {
  const body =
    day.exercises.length === 0
      ? '<p class="muted">Nothing safe matched this slot this week.</p>'
      : day.exercises.map((exercise) => renderExercise(day.dayIndex, exercise)).join('');
  const icon = DAY_TYPE_ICONS[day.dayType] ?? 'dumbbell';

  return `
    <div class="card stack tilt-card tilt-enter">
      <div class="row" style="gap:10px;">
        <span class="fitness-row-icon" data-tilt-depth="1" aria-hidden="true"><svg class="icon" width="16" height="16" viewBox="0 0 24 24"><use href="#icon-${icon}"></use></svg></span>
        <h3 style="margin:0;">Day ${day.dayIndex} · ${DAY_TYPE_LABELS[day.dayType] ?? day.dayType}</h3>
      </div>
      <details>
        <summary class="muted" style="font-size:var(--fs-sm); cursor:pointer;">Warm-up</summary>
        <ul style="margin:4px 0 0; padding-left:1.2em; font-size:var(--fs-sm);">
          ${day.warmup.map((line) => `<li>${line}</li>`).join('')}
        </ul>
      </details>
      ${body}
      <details>
        <summary class="muted" style="font-size:var(--fs-sm); cursor:pointer;">Cooldown</summary>
        <ul style="margin:4px 0 0; padding-left:1.2em; font-size:var(--fs-sm);">
          ${day.cooldown.map((line) => `<li>${line}</li>`).join('')}
        </ul>
      </details>
    </div>
  `;
}

// A loaded lift shows reps + a real weight and earns an estimated-1RM
// readout; a bodyweight move only ever shows reps (no "kg" field with
// nothing real to put in it); a timed hold/cardio bout shows seconds,
// not a rep count at all — see exercise-library.js's own comment on
// logMetric for why these three genuinely need different forms, not one
// reps+kg pair used for everything regardless of what the exercise is.
function renderExercise(dayIndex, exercise) {
  const libraryEntry = getLibraryExercise(exercise.exerciseId);
  const cueLine = libraryEntry ? `<span class="muted" style="font-size:var(--fs-xs);">${libraryEntry.cues[0]}</span>` : '';

  const prescriptionText =
    exercise.logMetric === 'time'
      ? `${exercise.sets} sets × ${exercise.holdSec}s hold · rest ${exercise.restSec}s`
      : `${exercise.sets} sets × ${exercise.reps} reps · rest ${exercise.restSec}s`;

  const oneRepMaxSlot =
    exercise.logMetric === 'reps-weight'
      ? `<span class="muted" style="font-size:var(--fs-xs);" data-onerepmax-for="${exercise.exerciseId}"></span>`
      : '';

  const logInputs =
    exercise.logMetric === 'time'
      ? `<input class="input" type="number" min="1" id="${durationInputId(dayIndex, exercise.exerciseId)}" placeholder="seconds held">`
      : exercise.logMetric === 'reps-weight'
        ? `<input class="input" type="number" min="1" id="${repsInputId(dayIndex, exercise.exerciseId)}" placeholder="reps">
           <input class="input" type="number" min="0" step="0.5" id="${weightInputId(dayIndex, exercise.exerciseId)}" placeholder="kg">`
        : `<input class="input" type="number" min="1" id="${repsInputId(dayIndex, exercise.exerciseId)}" placeholder="reps">`;

  return `
    <div class="stack" style="border-top:1px solid var(--border); padding-top:var(--space-3);">
      <div class="row" style="align-items:flex-start;">
        <div id="${svgSlotId(dayIndex, exercise.exerciseId)}" data-tilt-depth="2" style="width:48px; height:40px; flex-shrink:0; color:var(--ink-2);" aria-hidden="true"></div>
        <div class="stack" style="gap:2px;">
          <strong>${exercise.name}</strong>
          <span class="muted" style="font-size:var(--fs-sm);">${prescriptionText}</span>
          ${cueLine}
          ${oneRepMaxSlot}
        </div>
      </div>
      <div class="row">
        ${logInputs}
        <button class="btn btn-secondary" data-log-set data-log-metric="${exercise.logMetric}" data-day-index="${dayIndex}" data-exercise-id="${exercise.exerciseId}" data-rest-sec="${exercise.restSec}">Log</button>
      </div>
      <div class="row-between program-rest-timer" id="${restRowId(dayIndex, exercise.exerciseId)}" hidden>
        <span class="row" style="gap:6px;">
          <span class="muted" style="font-size:var(--fs-xs);">Rest</span>
          <strong id="${restDisplayId(dayIndex, exercise.exerciseId)}" style="font-variant-numeric:tabular-nums;"></strong>
        </span>
        <button type="button" class="btn btn-ghost" data-skip-rest>Skip</button>
      </div>
    </div>
  `;
}

async function loadDemoSvgInto(elementId, svgPath) {
  if (!svgPath) return;
  const el = byId(elementId);
  if (!el) return;
  try {
    el.innerHTML = await loadInlineSvg(svgPath);
    const svg = el.querySelector('svg');
    if (svg) {
      svg.setAttribute('width', '100%');
      svg.setAttribute('height', '100%');
    }
  } catch {
    // best-effort demo art — an empty placeholder beats breaking the screen
  }
}

/** Finds (or starts) today's strength session so several logged sets in
 *  one visit land together, rather than a new session per set. */
async function getOrCreateTodaySession() {
  const [latest] = await listRecentSessions(1);
  const today = todayIsoDate();
  if (latest && latest.type === 'strength' && latest.startedAt.slice(0, 10) === today) {
    return latest;
  }
  return createSession({ type: 'strength', programId: activeProgramId });
}

/** Surfaces today's Readiness check-in (see js/features/recovery/) right
 *  where it can actually change a decision — whether to push today's
 *  session or ease up — instead of leaving it stranded on its own
 *  screen with nothing downstream ever reading it. Shows nothing at all
 *  when there's no check-in for today: a nag to go log one would be
 *  noise, not value. */
async function renderReadinessBanner() {
  const checkin = await getReadinessCheckinForDate(todayIsoDate());
  const banner = byId('program-readiness-banner');
  if (!checkin) {
    banner.hidden = true;
    return;
  }
  byId('program-readiness-category').textContent = `${checkin.score} · ${checkin.category}`;
  byId('program-readiness-suggestion').textContent = readinessActionSuggestion(checkin.category);
  banner.hidden = false;
}

async function logSet(exerciseId, fields) {
  const session = await getOrCreateTodaySession();
  await addSet(session.id, { exerciseId, ...fields });
}

function stopInlineRestTimer() {
  if (!activeRestTimer) return;
  clearInterval(activeRestTimer.pollHandle);
  const row = byId(restRowId(activeRestTimer.dayIndex, activeRestTimer.exerciseId));
  if (row) row.hidden = true;
  activeRestTimer = null;
}

/** Starts (or restarts) the one visible inline rest countdown, right under
 *  whichever exercise a set was just logged for. This is the actual point
 *  of a rest timer in a real strength session — every generated exercise
 *  already prescribes its own rest (program-generator.js's restSec,
 *  printed right next to the Log button) that used to go nowhere: resting
 *  correctly meant remembering that number and re-typing it into the
 *  separate, generic Rest Timer screen. Logging a set now starts that
 *  exact rest automatically, in place, with zero extra taps.
 *
 *  Only one shows at a time (the standalone Rest Timer screen — still
 *  reachable from the Fitness Toolkit home list, see rest-timer.js — is
 *  for anything else: an ad hoc rest outside a tracked program, a custom
 *  duration, resting between exercises this program didn't prescribe a
 *  number for). Logging a different exercise's set replaces whichever
 *  countdown was already showing, the same way a lifter only ever rests
 *  from one lift at a time. */
function startInlineRestTimer(dayIndex, exerciseId, restSec) {
  stopInlineRestTimer();
  if (!(restSec > 0)) return; // nothing prescribed to count down from

  const row = byId(restRowId(dayIndex, exerciseId));
  const display = byId(restDisplayId(dayIndex, exerciseId));
  if (!row || !display) return;

  const countdown = createCountdown(restSec * 1000);
  countdown.start();
  row.hidden = false;

  const timerState = { dayIndex, exerciseId, pollHandle: null };
  activeRestTimer = timerState;

  function render() {
    if (countdown.isFinished()) {
      clearInterval(timerState.pollHandle);
      display.textContent = 'Rest complete!';
      playCompletionBeep();
      vibrateDevice();
      // Auto-hides shortly after, rather than sitting there indefinitely
      // — but only if a newer timer (a different exercise's set) hasn't
      // already taken over this same row's slot in the meantime.
      setTimeout(() => {
        if (activeRestTimer === timerState) stopInlineRestTimer();
      }, 3000);
      return;
    }
    display.textContent = formatDuration(countdown.getRemainingMs());
  }
  render();
  timerState.pollHandle = setInterval(render, 250);
}

/** Updates every rendered occurrence of this exercise (it can appear on
 *  more than one day) with the same up-to-date estimate. Only ever
 *  called for logMetric: 'reps-weight' exercises — see renderExercise()
 *  — but guarded anyway since it's cheap and correct either way. */
async function renderOneRepMax(exerciseId) {
  const elements = document.querySelectorAll(`[data-onerepmax-for="${exerciseId}"]`);
  if (elements.length === 0) return;
  const sets = await listSetsForExercise(exerciseId);
  const best = bestEstimatedOneRepMax(sets);
  const text = best == null ? '' : `Estimated 1RM: ${Math.round(best * 2) / 2} kg`;
  elements.forEach((el) => {
    el.textContent = text;
  });
}
