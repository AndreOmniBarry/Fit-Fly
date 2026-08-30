import { showScreen } from '../../lib/router.js';
import { loadInlineSvg } from '../../lib/svg-loader.js';
import { getProfile } from '../../db/repositories/profile.js';
import { getLatestCategoryAssignment } from '../../db/repositories/category-assignments.js';
import { listInjuryScreens } from '../../db/repositories/injury-screens.js';
import { createProgram, getActiveProgram, PROGRAM_STATUS, setProgramStatus } from '../../db/repositories/programs.js';
import { addSet, createSession, listRecentSessions, listSetsForExercise } from '../../db/repositories/sessions.js';
import { getLibraryExercise } from '../exercises/exercise-library.js';
import { tagBodyArea } from './body-area-tag.js';
import { generateProgram } from './program-generator.js';
import { getCurrentWeekNumber } from './week-number.js';
import { bestEstimatedOneRepMax } from './one-rep-max.js';

function byId(id) {
  return document.getElementById(id);
}

const DAY_TYPE_LABELS = {
  'full-body': 'Full Body',
  upper: 'Upper Body',
  lower: 'Lower Body',
  cardio: 'Cardio',
  mobility: 'Mobility',
};

let activeProgramId = null;

export function initProgramFeature() {
  byId('btn-home-program').addEventListener('click', async () => {
    await renderProgramScreen();
    showScreen('screen-program');
  });
  byId('btn-program-back').addEventListener('click', () => showScreen('screen-home'));

  byId('program-days').addEventListener('click', async (event) => {
    const button = event.target.closest('[data-log-set]');
    if (!button) return;
    const { dayIndex, exerciseId } = button.dataset;
    const repsInput = byId(repsInputId(dayIndex, exerciseId));
    const weightInput = byId(weightInputId(dayIndex, exerciseId));
    const reps = Number(repsInput.value);
    const weightKg = Number(weightInput.value) || 0;
    if (!(reps >= 1)) return;

    await logSet(exerciseId, reps, weightKg);
    repsInput.value = '';
    weightInput.value = '';
    await renderOneRepMax(exerciseId); // updates every day card showing this exercise, not just this one
  });
}

/** Reuses the person's existing active program for their category if one
 *  exists, so "start date" (and therefore the week/deload count) stays
 *  stable across visits — otherwise creates one. */
async function ensureActiveProgram(category, experienceLevel) {
  const existing = await getActiveProgram(category);
  if (existing) return existing;

  const created = await createProgram({
    category,
    experienceLevel,
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
  const [profile, assignment] = await Promise.all([getProfile(), getLatestCategoryAssignment()]);
  if (!profile || !assignment) return;

  const program = await ensureActiveProgram(assignment.category, profile.experienceLevel);
  activeProgramId = program.id;
  const weekNumber = getCurrentWeekNumber(program.startedAt);
  const injuryBodyAreaTags = await getInjuryBodyAreaTags();

  const generated = generateProgram({
    category: assignment.category,
    experienceLevel: profile.experienceLevel,
    injuryBodyAreaTags,
    weekNumber,
  });

  byId('program-week-label').textContent = `Week ${generated.weekNumber} · Block ${generated.blockNumber}`;
  byId('program-deload-banner').hidden = !generated.isDeload;
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

function renderDay(day) {
  const body =
    day.exercises.length === 0
      ? '<p class="muted">Nothing safe matched this slot this week.</p>'
      : day.exercises.map((exercise) => renderExercise(day.dayIndex, exercise)).join('');

  return `
    <div class="card stack">
      <h3>Day ${day.dayIndex} · ${DAY_TYPE_LABELS[day.dayType] ?? day.dayType}</h3>
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

function renderExercise(dayIndex, exercise) {
  const libraryEntry = getLibraryExercise(exercise.exerciseId);
  return `
    <div class="stack" style="border-top:1px solid var(--border); padding-top:var(--space-3);">
      <div class="row" style="align-items:flex-start;">
        <div id="${svgSlotId(dayIndex, exercise.exerciseId)}" style="width:48px; height:40px; flex-shrink:0; color:var(--ink-2);" aria-hidden="true"></div>
        <div class="stack" style="gap:2px;">
          <strong>${exercise.name}</strong>
          <span class="muted" style="font-size:var(--fs-sm);">${exercise.sets} sets × ${exercise.reps} reps · rest ${exercise.restSec}s</span>
          ${libraryEntry ? `<span class="muted" style="font-size:var(--fs-xs);">${libraryEntry.cues[0]}</span>` : ''}
          <span class="muted" style="font-size:var(--fs-xs);" data-onerepmax-for="${exercise.exerciseId}"></span>
        </div>
      </div>
      <div class="row">
        <input class="input" type="number" min="1" id="${repsInputId(dayIndex, exercise.exerciseId)}" placeholder="reps">
        <input class="input" type="number" min="0" step="0.5" id="${weightInputId(dayIndex, exercise.exerciseId)}" placeholder="kg">
        <button class="btn btn-secondary" data-log-set data-day-index="${dayIndex}" data-exercise-id="${exercise.exerciseId}">Log</button>
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
  const today = new Date().toISOString().slice(0, 10);
  if (latest && latest.type === 'strength' && latest.startedAt.slice(0, 10) === today) {
    return latest;
  }
  return createSession({ type: 'strength', programId: activeProgramId });
}

async function logSet(exerciseId, reps, weightKg) {
  const session = await getOrCreateTodaySession();
  await addSet(session.id, { exerciseId, reps, weightKg });
}

/** Updates every rendered occurrence of this exercise (it can appear on
 *  more than one day) with the same up-to-date estimate. */
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
