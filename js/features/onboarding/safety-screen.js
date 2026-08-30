// The universal red-flag checklist. Independent of what category the
// person ends up in — any one of these means "talk to a professional
// before starting," full stop, not something a workout program can screen
// around. Kept intentionally short: these are widely-used exercise
// pre-participation red flags, not a general symptom checker.

export const RED_FLAG_SYMPTOMS = Object.freeze([
  {
    id: 'radiating-numbness-tingling',
    label: 'Numbness or tingling that radiates down an arm or leg',
  },
  {
    id: 'chest-pain-pressure',
    label: 'Chest pain, pressure, or tightness — at rest or during activity',
  },
  {
    id: 'dizziness-fainting',
    label: 'Dizziness, fainting, or lightheadedness during activity',
  },
  {
    id: 'unexplained-swelling',
    label: 'Sudden or unexplained swelling, especially in one leg',
  },
  {
    id: 'recent-fracture-surgery',
    label: 'A fracture, joint injury, or surgery in the last 6 weeks',
  },
  {
    id: 'severe-worsening-pain',
    label: 'Pain that is severe, getting worse, or does not ease with rest',
  },
]);

const RED_FLAG_IDS = new Set(RED_FLAG_SYMPTOMS.map((s) => s.id));

/** Filters an arbitrary list of selected ids down to the ones that are
 *  actually recognized red flags — defensive against stray/renamed ids. */
export function evaluateRedFlags(selectedSymptomIds = []) {
  return selectedSymptomIds.filter((id) => RED_FLAG_IDS.has(id));
}

export function hasRedFlags(selectedSymptomIds = []) {
  return evaluateRedFlags(selectedSymptomIds).length > 0;
}

/** Pain/injury severity scale shared with js/db/repositories/injury-screens.js. */
export const SEVERITY = Object.freeze({ MILD: 1, MODERATE: 2, SEVERE: 3 });
