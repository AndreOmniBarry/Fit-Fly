import { showScreen } from '../../lib/router.js';
import { initChipGroup } from '../../lib/chip-group.js';
import { feetInchesToCm, lbToKg } from '../../lib/units.js';
import { calculateAge } from './age.js';
import { calculateBmi } from './bmi.js';
import { assignCategory, PRIMARY_GOALS } from './category-engine.js';
import { RED_FLAG_SYMPTOMS } from './safety-screen.js';
import { saveProfile } from '../../db/repositories/profile.js';
import { recordInjuryScreen } from '../../db/repositories/injury-screens.js';
import { recordCategoryAssignment } from '../../db/repositories/category-assignments.js';

function showError(id, show) {
  const el = document.getElementById(id);
  if (el) el.hidden = !show;
}

function byId(id) {
  return document.getElementById(id);
}

/** Wires every onboarding screen's inputs and Next/Back buttons.
 *  `onComplete(profile)` fires once the wizard has written the profile,
 *  injury screen, and category assignment to the database. */
export function initOnboardingWizard({ onComplete } = {}) {
  const answers = {};

  const sexChips = initChipGroup(byId('ob-sex'));
  const unitsChips = initChipGroup(byId('ob-units'), {
    initial: 'metric',
    onChange: (value) => {
      byId('ob-height-metric').hidden = value !== 'metric';
      byId('ob-height-imperial').hidden = value === 'metric';
      byId('ob-weight-metric').hidden = value !== 'metric';
      byId('ob-weight-imperial').hidden = value === 'metric';
    },
  });
  const activeDaysChips = initChipGroup(byId('ob-active-days'));
  const experienceChips = initChipGroup(byId('ob-experience'));
  const goalChips = initChipGroup(byId('ob-goal'));
  const hasInjuryChips = initChipGroup(byId('ob-has-injury'), {
    onChange: (value) => {
      byId('ob-injury-details').hidden = value !== 'yes';
    },
  });
  const injurySeverityChips = initChipGroup(byId('ob-injury-severity'));

  // Red-flag chips are generated from the shared list, not hand-copied
  // into the markup, so the two can never drift out of sync.
  const redFlagsContainer = byId('ob-redflags');
  redFlagsContainer.innerHTML = RED_FLAG_SYMPTOMS.map(
    (s) => `<button type="button" class="chip" data-value="${s.id}" aria-pressed="false">${s.label}</button>`
  ).join('');
  const redFlagsChips = initChipGroup(redFlagsContainer, { multi: true });

  // ---------- Step 1: basics ----------
  byId('btn-ob-basics-next').addEventListener('click', () => {
    const birthdate = byId('ob-birthdate').value;
    const sex = sexChips.getValue();
    const units = unitsChips.getValue();

    let heightCm = null;
    let weightKg = null;
    if (units === 'metric') {
      heightCm = Number(byId('ob-height-cm').value) || null;
      weightKg = Number(byId('ob-weight-kg').value) || null;
    } else {
      const ft = Number(byId('ob-height-ft').value);
      const inches = Number(byId('ob-height-in').value) || 0;
      heightCm = ft ? feetInchesToCm(ft, inches) : null;
      const lb = Number(byId('ob-weight-lb').value) || null;
      weightKg = lb ? lbToKg(lb) : null;
    }

    showError('err-ob-birthdate', !birthdate);
    showError('err-ob-sex', !sex);
    showError('err-ob-height', !heightCm || heightCm <= 0);
    showError('err-ob-weight', !weightKg || weightKg <= 0);
    if (!birthdate || !sex || !heightCm || !weightKg) return;

    Object.assign(answers, { birthdate, sex, heightCm, weightKg });
    showScreen('screen-ob-activity');
  });

  // ---------- Step 2: activity ----------
  byId('btn-ob-activity-back').addEventListener('click', () => showScreen('screen-ob-basics'));
  byId('btn-ob-activity-next').addEventListener('click', () => {
    const weeklyActiveDaysStr = activeDaysChips.getValue();
    const experienceLevel = experienceChips.getValue();

    showError('err-ob-active-days', weeklyActiveDaysStr == null);
    showError('err-ob-experience', !experienceLevel);
    if (weeklyActiveDaysStr == null || !experienceLevel) return;

    Object.assign(answers, {
      weeklyActiveDays: Number(weeklyActiveDaysStr),
      experienceLevel,
    });
    showScreen('screen-ob-goal');
  });

  // ---------- Step 3: goal ----------
  byId('btn-ob-goal-back').addEventListener('click', () => showScreen('screen-ob-activity'));
  byId('btn-ob-goal-next').addEventListener('click', () => {
    const primaryGoal = goalChips.getValue();
    showError('err-ob-goal', !primaryGoal || !PRIMARY_GOALS.includes(primaryGoal));
    if (!primaryGoal) return;

    answers.primaryGoal = primaryGoal;
    showScreen('screen-ob-safety');
  });

  // ---------- Step 4: safety ----------
  byId('btn-ob-safety-back').addEventListener('click', () => showScreen('screen-ob-goal'));
  byId('btn-ob-safety-next').addEventListener('click', async () => {
    const hasCurrentInjuryOrPain = hasInjuryChips.getValue();
    showError('err-ob-has-injury', !hasCurrentInjuryOrPain);
    if (!hasCurrentInjuryOrPain) return;

    const redFlagSymptomIds = redFlagsChips.getValue();
    const injuryArea = byId('ob-injury-area').value.trim();
    const injurySeverity = injurySeverityChips.getValue()
      ? Number(injurySeverityChips.getValue())
      : null;
    const injuryNotes = byId('ob-injury-notes').value.trim();

    Object.assign(answers, {
      redFlagSymptomIds,
      hasCurrentInjuryOrPain: hasCurrentInjuryOrPain === 'yes',
      injurySeverity,
    });

    const bmi = calculateBmi(answers.heightCm, answers.weightKg);
    const age = calculateAge(answers.birthdate);
    const categoryResult = assignCategory({ ...answers, bmi });

    // Persist everything now — the result screen is read-only from here.
    const profile = await saveProfile({
      birthdate: answers.birthdate,
      sex: answers.sex,
      heightCm: answers.heightCm,
      weightKg: answers.weightKg,
      age,
      weeklyActiveDays: answers.weeklyActiveDays,
      experienceLevel: answers.experienceLevel,
    });
    await recordInjuryScreen({
      bodyArea: answers.hasCurrentInjuryOrPain ? injuryArea || 'unspecified' : 'none',
      severity: injurySeverity ?? 0,
      redFlags: redFlagSymptomIds,
      notes: injuryNotes,
    });
    await recordCategoryAssignment({
      category: categoryResult.category,
      reasoning: categoryResult.reasoning,
      inputsSnapshot: { ...answers, bmi, age },
    });

    renderResult(categoryResult);
    showScreen('screen-ob-result');

    byId('btn-ob-continue').onclick = () => onComplete?.({ profile, categoryResult });
  });
}

function renderResult(categoryResult) {
  byId('ob-result-category').textContent = formatCategoryLabel(categoryResult.category);
  byId('ob-result-reasoning').innerHTML = categoryResult.reasoning
    .map((line) => `<li>${line}</li>`)
    .join('');
  byId('ob-result-review-banner').hidden = !categoryResult.needsProfessionalReview;
}

const CATEGORY_LABELS = {
  'sedentary-start': 'Building Your Base',
  'cut-fat-loss': 'Fat Loss',
  recomposition: 'Recomposition',
  'rehab-recuperation': 'Rehab & Recuperation',
  hypertrophy: 'Hypertrophy',
  endurance: 'Endurance',
};

export function formatCategoryLabel(category) {
  return CATEGORY_LABELS[category] ?? category;
}
