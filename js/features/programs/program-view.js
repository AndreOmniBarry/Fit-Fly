import { showScreen } from '../../lib/router.js';
import { loadInlineSvg } from '../../lib/svg-loader.js';
import { getProfile } from '../../db/repositories/profile.js';
import { getLatestCategoryAssignment } from '../../db/repositories/category-assignments.js';
import { listInjuryScreens } from '../../db/repositories/injury-screens.js';
import { createProgram, getActiveProgram, PROGRAM_STATUS, setProgramStatus } from '../../db/repositories/programs.js';
import { getLibraryExercise } from '../exercises/exercise-library.js';
import { tagBodyArea } from './body-area-tag.js';
import { generateProgram } from './program-generator.js';
import { getCurrentWeekNumber } from './week-number.js';

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

export function initProgramFeature() {
  byId('btn-home-program').addEventListener('click', async () => {
    await renderProgramScreen();
    showScreen('screen-program');
  });
  byId('btn-program-back').addEventListener('click', () => showScreen('screen-home'));
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

  for (const day of generated.days) {
    for (const exercise of day.exercises) {
      loadDemoSvgInto(svgSlotId(day.dayIndex, exercise.exerciseId), getLibraryExercise(exercise.exerciseId)?.demoSvg);
    }
  }
}

function svgSlotId(dayIndex, exerciseId) {
  return `program-svg-${dayIndex}-${exerciseId}`;
}

function renderDay(day) {
  const body =
    day.exercises.length === 0
      ? '<p class="muted">Nothing safe matched this slot this week.</p>'
      : day.exercises.map((exercise) => renderExercise(day.dayIndex, exercise)).join('');

  return `
    <div class="card stack">
      <h3>Day ${day.dayIndex} · ${DAY_TYPE_LABELS[day.dayType] ?? day.dayType}</h3>
      ${body}
    </div>
  `;
}

function renderExercise(dayIndex, exercise) {
  const libraryEntry = getLibraryExercise(exercise.exerciseId);
  return `
    <div class="row" style="align-items:flex-start;">
      <div id="${svgSlotId(dayIndex, exercise.exerciseId)}" style="width:48px; height:40px; flex-shrink:0; color:var(--ink-2);" aria-hidden="true"></div>
      <div class="stack" style="gap:2px;">
        <strong>${exercise.name}</strong>
        <span class="muted" style="font-size:var(--fs-sm);">${exercise.sets} sets × ${exercise.reps} reps · rest ${exercise.restSec}s</span>
        ${libraryEntry ? `<span class="muted" style="font-size:var(--fs-xs);">${libraryEntry.cues[0]}</span>` : ''}
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
