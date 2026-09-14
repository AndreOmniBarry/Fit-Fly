// A transparent, rule-based readiness score — not a medical assessment,
// just a plain-language blend of what a person can self-report each
// morning, plus how much they've trained recently, plus (when a real
// connected BLE heart-rate strap has actually logged one) their own real
// RMSSD-based HRV relative to their own recent baseline — see
// js/features/heart-rate/hrv-baseline.js's doc comment for the real
// citations behind "compare to your own baseline, not a population
// norm," and hrv.js for why RMSSD from a short BLE session is real
// measured data but still not a clinical HRV protocol. Every score comes
// with its component breakdown so "why this" is never a black box.

import { HRV_LARGE_DEVIATION_PERCENT } from '../heart-rate/hrv-baseline.js';

const WEIGHTS = Object.freeze({ sleep: 0.3, energy: 0.25, soreness: 0.25, load: 0.2, hrv: 0.15 });

const TARGET_SLEEP_HOURS = 8;

// Never below this even at the deepest real drop this module's score
// curve considers (see hrvScore below) — a real HRV drop is one input
// among several real self-reported ones here, same "never zero out on
// one signal" rule acwrLoadScore already follows.
const HRV_SCORE_FLOOR = 25;

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
 *  bottom the score out entirely. The crude fallback used whenever there
 *  isn't yet enough real session-RPE history for a genuine ACWR (see
 *  acwrLoadScore below) — a plain count of recent sessions, no sense of
 *  how hard any of them actually were. */
function loadScore(recentSessionCount) {
  if (recentSessionCount == null) return 100;
  return clamp(100 - Math.min(recentSessionCount, 3) * 20, 40, 100);
}

// The same real, cited Acute:Chronic Workload Ratio zones
// js/features/programs/training-load.js's own calculateAcuteChronicWorkloadRatio
// returns (see that module's doc comment for the full Gabbett 2016 /
// Hulin et al. 2014 citations) — anchor points for a smooth score
// between them, rather than three flat buckets:
//   - ratio <= 0.8 ('building'): low recent load relative to this
//     person's own chronic baseline — scored high (fresh/well-
//     recovered). This reflects less accumulated recent fatigue, not a
//     cited injury-risk finding either way — the *category* still says
//     "building" honestly, this score just isn't penalizing it.
//   - 0.8-1.3 ('sweet-spot'): Gabbett 2016's own well-established
//     lower-injury-risk band — scored solidly high, tapering slightly
//     toward its upper edge, since more relative recent load still means
//     somewhat less freshness for tomorrow even inside the safe range.
//   - above 1.3, scored down steeply, reaching this function's floor at
//     1.5 — Gabbett 2016's own cited "danger zone" threshold — and
//     staying near that floor beyond it, reflecting real elevated
//     injury risk, not just subjective tiredness.
// Never below 15: a real spike is one input among several real
// self-reported ones here, not a reason to zero out every other signal.
function acwrLoadScore(ratio) {
  if (ratio == null) return null;
  if (ratio <= 0.8) return 100;
  if (ratio <= 1.3) return clamp(100 - ((ratio - 0.8) / 0.5) * 20, 80, 100);
  if (ratio <= 1.5) return clamp(80 - ((ratio - 1.3) / 0.2) * 30, 50, 80);
  return clamp(50 - (ratio - 1.5) * 40, 15, 50);
}

// This app's own real Acute:Chronic Workload Ratio is the wearable-free
// signal above; this is the wearable-derived one — a real personal-
// baseline HRV deviation from js/features/heart-rate/hrv-baseline.js's
// calculateHrvBaselineDeviation, computed only from actual BLE-strap
// RMSSD history (never estimated, never available from camera-PPG or
// manual entries — see that module's own doc comment).
//
// Unlike acwrLoadScore above, this is deliberately NOT symmetric-penalty
// in the naive sense of "any deviation is bad": a real, sustained drop
// below this person's own baseline is the more consistently-cited
// fatigue/incomplete-recovery direction in the sports-science literature
// (see hrv-baseline.js's doc comment), so only that direction pulls the
// score down, and it does so smoothly, floored rather than zeroed — one
// real signal among several here, not a verdict on its own. A reading at
// or above baseline scores the same solid-but-not-perfect number
// regardless of how far above — this module deliberately does NOT treat
// "higher than usual" as extra-good, since the same literature notes
// unusually large swings in either direction can also reflect incomplete
// recovery rather than straightforward improvement (see readiness'
// own buildReasoning below, which names that nuance once a rise is large
// enough to be worth mentioning at all).
function hrvScore(deviationPercent) {
  if (deviationPercent == null) return null;
  if (deviationPercent >= 0) return 90;
  const dropPercent = Math.min(-deviationPercent, HRV_LARGE_DEVIATION_PERCENT);
  return clamp(90 - (dropPercent / HRV_LARGE_DEVIATION_PERCENT) * (90 - HRV_SCORE_FLOOR), HRV_SCORE_FLOOR, 90);
}

/**
 * @param {object} input
 * @param {number|null} [input.sleepHours]
 * @param {number|null} [input.energyLevel] - 1-5
 * @param {number|null} [input.sorenessLevel] - 1-5
 * @param {number} [input.recentSessionCount] - sessions in roughly the last 2 days.
 *   Only used as the *fallback* load signal — see `acwr` below, which replaces
 *   it outright whenever real ACWR history exists.
 * @param {number|null} [input.sleepDebtMinutes] - rolling shortfall from Sleep's own
 *   calculateSleepDebt (see sleep-debt.js), if the person has been logging real
 *   nights there. Purely a reasoning input, not a scoring one — last night's
 *   actual hours already drive the score; this only adds context for *why* a
 *   short night hits harder than usual, without double-counting it.
 * @param {{ratio: number|null, category: 'building'|'sweet-spot'|'high-risk'|null}|null} [input.acwr] -
 *   a real Acute:Chronic Workload Ratio from js/features/programs/
 *   training-load.js's calculateAcuteChronicWorkloadRatio, computed from
 *   actual logged session-RPE history. When `acwr.ratio` is a real number,
 *   it REPLACES `recentSessionCount`'s crude session-count heuristic for
 *   the load component entirely (see acwrLoadScore above) — a genuine
 *   injury-risk-informed signal instead of a plain tally. Omit (or pass
 *   null/an object with `ratio: null`, exactly what calculateAcuteChronicWorkloadRatio
 *   itself returns before a real week of history exists) to keep the
 *   existing recentSessionCount fallback — fully backward compatible with
 *   every call site that predates ACWR.
 * @param {{deviationPercent: number|null, category: 'below-baseline'|'at-baseline'|'above-baseline'|null}|null} [input.hrvDeviation] -
 *   a real personal-baseline HRV deviation from js/features/heart-rate/
 *   hrv-baseline.js's calculateHrvBaselineDeviation, computed from actual
 *   logged BLE-strap RMSSD history. When `hrvDeviation.deviationPercent`
 *   is a real number, it adds a new `hrv` component to the weighted blend
 *   (see hrvScore above) and, once notable, its own reasoning line — a
 *   genuine wearable-derived signal on top of the existing self-reported
 *   ones. Omit (or pass null/an object with `deviationPercent: null`,
 *   exactly what calculateHrvBaselineDeviation itself returns before a
 *   real personal baseline exists) to leave the score exactly as it was
 *   before this input existed — fully backward compatible with every call
 *   site that predates it.
 * @returns {{score: number, category: 'low'|'moderate'|'high', reasoning: string[]}|null}
 *   null if there's not enough self-reported input to say anything
 */
export function calculateReadiness({
  sleepHours = null,
  energyLevel = null,
  sorenessLevel = null,
  recentSessionCount = 0,
  sleepDebtMinutes = null,
  acwr = null,
  hrvDeviation = null,
}) {
  const acwrRatio = acwr?.ratio ?? null;
  const hrvDeviationPercent = hrvDeviation?.deviationPercent ?? null;
  const components = {
    sleep: sleepScore(sleepHours),
    energy: energyScore(energyLevel),
    soreness: sorenessScore(sorenessLevel),
    load: acwrRatio != null ? acwrLoadScore(acwrRatio) : loadScore(recentSessionCount),
    hrv: hrvScore(hrvDeviationPercent),
  };

  const known = Object.entries(components).filter(([, value]) => value != null);
  // Neither load nor hrv alone is a real check-in — both are automatic,
  // derived-from-history signals (session count/ACWR, BLE HRV), not
  // something the person actually self-reported this morning.
  if (known.filter(([key]) => key !== 'load' && key !== 'hrv').length === 0) return null;

  const totalWeight = known.reduce((sum, [key]) => sum + WEIGHTS[key], 0);
  const weightedSum = known.reduce((sum, [key, value]) => sum + value * WEIGHTS[key], 0);
  const score = Math.round(weightedSum / totalWeight);

  const category = score < 50 ? 'low' : score < 75 ? 'moderate' : 'high';

  return {
    score,
    category,
    reasoning: buildReasoning(components, category, sleepDebtMinutes, acwrRatio, hrvDeviationPercent),
  };
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

// A debt below this isn't worth calling out on its own — an hour or so
// spread across several nights is normal drift, not a real deficit.
const NOTABLE_SLEEP_DEBT_MINUTES = 60;

function buildReasoning(components, category, sleepDebtMinutes, acwrRatio, hrvDeviationPercent) {
  const reasoning = [];

  if (components.sleep != null && components.sleep < 60) {
    reasoning.push('Sleep was on the short side — that\'s usually the biggest lever for how you\'ll feel.');
  }
  if (sleepDebtMinutes != null && sleepDebtMinutes >= NOTABLE_SLEEP_DEBT_MINUTES) {
    const hours = Math.round((sleepDebtMinutes / 60) * 10) / 10;
    reasoning.push(`You're also carrying about ${hours}h of sleep debt from recent nights — that compounds beyond just last night.`);
  }
  if (components.soreness != null && components.soreness < 60) {
    reasoning.push('You\'re carrying some soreness, worth working around today.');
  }
  if (components.energy != null && components.energy < 60) {
    reasoning.push('Energy is reported low today.');
  }
  if (components.load < 70) {
    if (acwrRatio != null && acwrRatio >= 1.5) {
      // Gabbett 2016's own cited "danger zone" threshold — called out by
      // name, not folded into the generic line below, since this is a
      // real, elevated-injury-risk finding rather than plain tiredness.
      reasoning.push(
        `Your training load has spiked recently (acute:chronic ratio ${acwrRatio.toFixed(2)}) — real research (Gabbett 2016) links a ratio this high to meaningfully higher injury risk, worth easing up.`
      );
    } else if (acwrRatio != null) {
      reasoning.push(
        `Your training load is running a bit hot relative to your own recent baseline (acute:chronic ratio ${acwrRatio.toFixed(2)}) — some of today's fatigue is likely real accumulated load.`
      );
    } else {
      reasoning.push('You\'ve trained recently — some of today\'s fatigue is likely just accumulated load.');
    }
  }

  if (components.hrv != null && components.hrv < 70) {
    // A real, sustained drop below this person's own recent HRV baseline
    // — the more consistently-cited fatigue/incomplete-recovery direction
    // (see hrv-baseline.js's own doc comment and its real citations).
    // Named as a real signal, not a verdict — same "one imperfect input
    // among several" framing as the ACWR lines above.
    const pct = hrvDeviationPercent != null ? ` (about ${Math.abs(Math.round(hrvDeviationPercent))}% below your recent baseline)` : '';
    reasoning.push(
      `Your BLE-measured HRV has dropped${pct} — sports-science research on individual HRV baselines (Plews et al.) links a real, sustained drop like this to accumulated fatigue or incomplete recovery, though it's one imperfect signal among several here, not a diagnosis.`
    );
  } else if (hrvDeviationPercent != null && hrvDeviationPercent >= HRV_LARGE_DEVIATION_PERCENT) {
    // Deliberately NOT phrased as unambiguously good — see hrvScore's own
    // doc comment on why a large rise isn't scored higher than a normal
    // at-baseline reading, and hrv-baseline.js's doc comment for the real
    // research this nuance comes from.
    reasoning.push(
      'Your HRV is running well above your own recent baseline — often a good sign, though the same research has also linked unusually large swings in either direction to incomplete recovery rather than straightforward improvement, so it\'s worth reading alongside how you actually feel.'
    );
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
