// A transparent, rule-based readiness score — not a medical assessment,
// not a wearable-derived HRV score (this app has no wearable
// integration), just a plain-language blend of what a person can
// self-report each morning plus how much they've trained recently.
// Every score comes with its component breakdown so "why this" is never
// a black box.

const WEIGHTS = Object.freeze({ sleep: 0.3, energy: 0.25, soreness: 0.25, load: 0.2 });

const TARGET_SLEEP_HOURS = 8;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function sleepScore(sleepHours) {
  if (sleepHours == null) return null;
  return clamp((sleepHours / TARGET_SLEEP_HOURS) * 100, 0, 100);
}

/** 1 (exhausted) - 5 (energized). */
function energyScore(energyLevel) {
  if (energyLevel == null) return null;
  return clamp((energyLevel / 5) * 100, 0, 100);
}

/** 1 (none) - 5 (severe) — inverted, since more soreness means lower readiness. */
function sorenessScore(sorenessLevel) {
  if (sorenessLevel == null) return null;
  return clamp(((6 - sorenessLevel) / 5) * 100, 0, 100);
}

/** More sessions in the last couple of days means less recovery time —
 *  each recent session knocks points off, capped so a busy week doesn't
 *  bottom the score out entirely. */
function loadScore(recentSessionCount) {
  if (recentSessionCount == null) return 100;
  return clamp(100 - Math.min(recentSessionCount, 3) * 20, 40, 100);
}

/**
 * @param {object} input
 * @param {number|null} [input.sleepHours]
 * @param {number|null} [input.energyLevel] - 1-5
 * @param {number|null} [input.sorenessLevel] - 1-5
 * @param {number} [input.recentSessionCount] - sessions in roughly the last 2 days
 * @returns {{score: number, category: 'low'|'moderate'|'high', reasoning: string[]}|null}
 *   null if there's not enough self-reported input to say anything
 */
export function calculateReadiness({ sleepHours = null, energyLevel = null, sorenessLevel = null, recentSessionCount = 0 }) {
  const components = {
    sleep: sleepScore(sleepHours),
    energy: energyScore(energyLevel),
    soreness: sorenessScore(sorenessLevel),
    load: loadScore(recentSessionCount),
  };

  const known = Object.entries(components).filter(([, value]) => value != null);
  if (known.filter(([key]) => key !== 'load').length === 0) return null; // load alone isn't a real check-in

  const totalWeight = known.reduce((sum, [key]) => sum + WEIGHTS[key], 0);
  const weightedSum = known.reduce((sum, [key, value]) => sum + value * WEIGHTS[key], 0);
  const score = Math.round(weightedSum / totalWeight);

  const category = score < 50 ? 'low' : score < 75 ? 'moderate' : 'high';

  return { score, category, reasoning: buildReasoning(components, category) };
}

/** A plain-language nudge for the category alone — used wherever a
 *  screen only has the stored score/category to show (e.g. My Program's
 *  own readiness banner, see program-view.js) and no fresh component
 *  breakdown to reason from. Deliberately a suggestion, not an
 *  instruction — this app is a software developer's tool, not a coach or
 *  a doctor, and the actual decision always stays with the person. */
export function readinessActionSuggestion(category) {
  switch (category) {
    case 'high':
      return "You're primed to push a bit harder today, if you want to.";
    case 'low':
      return 'Worth going easier today, or trading today\'s session for extra rest.';
    default:
      return "A fairly average day — go by feel on how hard to push.";
  }
}

function buildReasoning(components, category) {
  const reasoning = [];

  if (components.sleep != null && components.sleep < 60) {
    reasoning.push('Sleep was on the short side — that\'s usually the biggest lever for how you\'ll feel.');
  }
  if (components.soreness != null && components.soreness < 60) {
    reasoning.push('You\'re carrying some soreness, worth working around today.');
  }
  if (components.energy != null && components.energy < 60) {
    reasoning.push('Energy is reported low today.');
  }
  if (components.load < 70) {
    reasoning.push('You\'ve trained recently — some of today\'s fatigue is likely just accumulated load.');
  }

  if (reasoning.length === 0) {
    reasoning.push(
      category === 'high'
        ? 'Sleep, energy, and recent training load all look solid.'
        : 'Nothing stands out strongly either way — a fairly average day.'
    );
  }

  return reasoning;
}
