// Chronotype self-assessment — an ORIGINAL 6-item questionnaire, not a
// reproduction of any existing instrument. Pure math/data, no I/O, same
// shape as this app's other pure-logic modules (see
// sleep-timing-variability.ts).
//
// Why original, not a copy: every established morningness/eveningness
// self-report instrument is either directly copyrighted or requires
// author permission for any use, "free" or not —
//   - Horne, J.A. & Östberg, O. (1976). "A self-assessment questionnaire
//     to determine morningness-eveningness in human circadian rhythms."
//     Int. J. Chronobiology, 4(2), 97-110 — the original MEQ. Copyright
//     now held via Taylor & Francis (which acquired Gordon & Breach in
//     2001).
//   - Adan, A. & Almirall, H. (1991). "Horne & Östberg morningness-
//     eveningness questionnaire: A reduced scale." Personality and
//     Individual Differences, 12(3), 241-253 — the reduced MEQ (rMEQ),
//     Elsevier copyright.
//   - Roenneberg, T., Wirz-Justice, A. & Merrow, M. (2003). "Life between
//     clocks: daily temporal patterns of human chronotypes." Journal of
//     Biological Rhythms, 18(1), 80-90 — origin of the Munich ChronoType
//     Questionnaire (MCTQ). Even MCTQ's own "free to use" terms require
//     direct permission from the authors for any use, research or
//     commercial (see thewep.org/documentations/mctq).
// So every question below is newly written for Fit Fly. Where a question
// borrows a *concept* validated in the literature (not any instrument's
// actual wording, response anchors, or scoring), that's cited on the
// question itself:
//   - Q3 (peak mental-sharpness window): circadian temperature-rhythm
//     phase timing differs by chronotype — Baehr, E.K., Revelle, W. &
//     Eastman, C.I. (2000). "Individual differences in the phase and
//     amplitude of the human circadian temperature rhythm: with an
//     emphasis on morningness-eveningness." Journal of Sleep Research,
//     9(2), 117-127.
//   - Q4 (morning grogginess severity): sleep-inertia severity relates to
//     wake time relative to the circadian temperature nadir — Tassi, P.
//     & Muzet, A. (2000). "Sleep inertia." Sleep Medicine Reviews, 4(4),
//     341-353.
//   - Q5 (evening wind-down onset), as a rough proxy for dim-light
//     melatonin onset (DLMO) timing — Kantermann, T., Sung, H. &
//     Burgess, H.J. (2015). "Comparing the Morningness-Eveningness
//     Questionnaire and Munich ChronoType Questionnaire to the Dim Light
//     Melatonin Onset." Journal of Biological Rhythms, 30(5), 449-453.
//   - Q6 (single-item global self-anchor): a one-question "are you a
//     morning or evening person" self-rating correlates well (r ≈ -0.73)
//     with MCTQ's own mid-sleep timing — Zavada, A., Gordijn, M.C.M.,
//     Beersma, D.G.M., Daan, S. & Roenneberg, T. (2005). "Comparison of
//     the Munich Chronotype Questionnaire with the Horne-Östberg's
//     Morningness-Eveningness Score." Chronobiology International,
//     22(2), 267-278.
//
// CRITICAL HONESTY NOTE — the category cutoffs below are NOT validated:
// MEQ/rMEQ's own published cutoffs rest on decades of population data
// tying their exact scores to real sleep-timing outcomes; this app has
// none of that yet for its own original 6-42 scale. The bands below are
// a provisional statistical starting point only: a scale midpoint of 24
// (6 items × middle-of-7 ≈ 4 → 24) with roughly equal-width bands spread
// around it, on the assumption — not yet Fit Fly's own confirmed
// finding — that chronotype is close to normally (Gaussian) distributed
// across a real population, per Roenneberg, T., Kuehnle, T., Juda, M.,
// Kantermann, T., Allebrandt, K., Gordijn, M. & Merrow, M. (2007).
// "Epidemiology of the human circadian clock." Sleep Medicine Reviews,
// 11(6), 429-438. Once Fit Fly has a real sample of its own completions
// (a few hundred+), these cutoffs should be re-derived from Fit Fly's
// *own* response distribution instead of this provisional banding — the
// same "no invented precision" stance sleep-timing-variability.ts takes
// about population norms it can't independently verify. Never present
// these bands to a user as a validated clinical scale; they are not one.
export interface ChronotypeAnswers {
  /** Q1 — free-day rise time. */
  riseTime: number;
  /** Q2 — free-day sleep-readiness time. */
  sleepReadyTime: number;
  /** Q3 — peak mental-sharpness window. */
  peakSharpnessWindow: number;
  /** Q4 — morning grogginess severity. */
  morningGrogginess: number;
  /** Q5 — evening wind-down onset. */
  eveningWindDown: number;
  /** Q6 — global self-anchor. */
  selfAnchor: number;
}

export type ChronotypeCategory =
  | 'definite-evening'
  | 'moderate-evening'
  | 'balanced'
  | 'moderate-morning'
  | 'definite-morning';

export interface ChronotypeResult {
  total: number;
  category: ChronotypeCategory;
}

export interface ChronotypeQuestionOption {
  label: string;
  points: number;
}

export interface ChronotypeQuestion {
  id: keyof ChronotypeAnswers;
  question: string;
  options: ChronotypeQuestionOption[];
}

export const CHRONOTYPE_MIN_TOTAL = 6;
export const CHRONOTYPE_MAX_TOTAL = 42;

// Every question's options are ordered strongest-evening (1) to
// strongest-morning (7) — the view layer renders them in this order and
// reads `points` straight off the picked option, no separate scoring
// table to keep in sync.
export const CHRONOTYPE_QUESTIONS: ChronotypeQuestion[] = [
  {
    id: 'riseTime',
    question:
      'On a day with absolutely nothing scheduled — no alarm, no obligations — what time would your body naturally want to get out of bed?',
    options: [
      { label: 'Before 6:00 am', points: 7 },
      { label: '6:00 – 7:14 am', points: 6 },
      { label: '7:15 – 8:29 am', points: 5 },
      { label: '8:30 – 9:44 am', points: 4 },
      { label: '9:45 – 10:59 am', points: 3 },
      { label: '11:00 am – 12:14 pm', points: 2 },
      { label: '12:15 pm or later', points: 1 },
    ],
  },
  {
    id: 'sleepReadyTime',
    question: 'On that same unscheduled day, what time would you naturally start feeling ready to fall asleep?',
    options: [
      { label: 'Before 9:00 pm', points: 7 },
      { label: '9:00 – 9:59 pm', points: 6 },
      { label: '10:00 – 10:59 pm', points: 5 },
      { label: '11:00 – 11:59 pm', points: 4 },
      { label: '12:00 – 12:59 am', points: 3 },
      { label: '1:00 – 1:59 am', points: 2 },
      { label: '2:00 am or later', points: 1 },
    ],
  },
  {
    id: 'peakSharpnessWindow',
    question: 'Think about a typical week. During which window do you usually feel mentally sharpest and most focused?',
    options: [
      { label: '5:00 – 8:00 am', points: 7 },
      { label: '8:00 – 11:00 am', points: 6 },
      { label: '11:00 am – 2:00 pm', points: 5 },
      { label: '2:00 – 5:00 pm', points: 4 },
      { label: '5:00 – 8:00 pm', points: 3 },
      { label: '8:00 – 11:00 pm', points: 2 },
      { label: '11:00 pm or later', points: 1 },
    ],
  },
  {
    id: 'morningGrogginess',
    question: 'In the first 30 minutes after you wake up on a normal day, how foggy or groggy do you usually feel?',
    options: [
      { label: 'Wide awake almost immediately', points: 7 },
      { label: 'Alert within a few minutes', points: 6 },
      { label: 'Mildly foggy, clears fast', points: 5 },
      { label: 'Noticeably foggy for a while', points: 4 },
      { label: 'Groggy, takes real effort to feel normal', points: 3 },
      { label: 'Very foggy, drags on', points: 2 },
      { label: 'Extremely foggy, need a long time to function', points: 1 },
    ],
  },
  {
    id: 'eveningWindDown',
    question:
      "On most evenings, around what time do you notice your energy and focus really start to drop, even if you're not going to bed yet?",
    options: [
      { label: 'Before 6:00 pm', points: 7 },
      { label: '6:00 – 7:29 pm', points: 6 },
      { label: '7:30 – 8:59 pm', points: 5 },
      { label: '9:00 – 10:29 pm', points: 4 },
      { label: '10:30 – 11:59 pm', points: 3 },
      { label: '12:00 – 1:29 am', points: 2 },
      { label: '1:30 am or later', points: 1 },
    ],
  },
  {
    id: 'selfAnchor',
    question: 'Overall, which best describes you?',
    options: [
      { label: 'Strongly a morning person', points: 7 },
      { label: 'Mostly a morning person', points: 6 },
      { label: 'Somewhat a morning person', points: 5 },
      { label: 'Neither — it really depends on the day', points: 4 },
      { label: 'Somewhat an evening person', points: 3 },
      { label: 'Mostly an evening person', points: 2 },
      { label: 'Strongly an evening/night person', points: 1 },
    ],
  },
];

// Provisional SD-banding around the scale midpoint (24) — see the
// CRITICAL HONESTY NOTE at the top of this file. Both edges of each band
// are inclusive; the five bands partition the full 6-42 range exactly.
const CATEGORY_BOUNDS: Array<{ category: ChronotypeCategory; min: number; max: number }> = [
  { category: 'definite-evening', min: 6, max: 16 },
  { category: 'moderate-evening', min: 17, max: 21 },
  { category: 'balanced', min: 22, max: 27 },
  { category: 'moderate-morning', min: 28, max: 32 },
  { category: 'definite-morning', min: 33, max: 42 },
];

function categorizeTotal(total: number): ChronotypeCategory {
  for (const bound of CATEGORY_BOUNDS) {
    if (total >= bound.min && total <= bound.max) return bound.category;
  }
  // Only reachable if a caller passes an out-of-range total (answers
  // outside 1-7 each) — clamp to the nearest real band rather than
  // throwing, so a defensive caller doesn't crash a whole screen over it.
  return total < CHRONOTYPE_MIN_TOTAL ? 'definite-evening' : 'definite-morning';
}

/** Sums the 6 answers (each 1-7) and buckets the total into a provisional
 *  category — see the CRITICAL HONESTY NOTE above for why "provisional"
 *  is load-bearing here, not decorative. */
export function scoreChronotype(answers: ChronotypeAnswers): ChronotypeResult {
  const total =
    answers.riseTime +
    answers.sleepReadyTime +
    answers.peakSharpnessWindow +
    answers.morningGrogginess +
    answers.eveningWindDown +
    answers.selfAnchor;
  return { total, category: categorizeTotal(total) };
}

const CATEGORY_LABEL: Record<ChronotypeCategory, string> = {
  'definite-evening': 'Definite evening type',
  'moderate-evening': 'Moderate evening type',
  balanced: 'Balanced / neither type',
  'moderate-morning': 'Moderate morning type',
  'definite-morning': 'Definite morning type',
};

// Deliberately descriptive, not prescriptive: this app has no cited study
// tying a specific recommended action (e.g. "exercise at this time") to
// any of these categories, so none is claimed here — see the file's own
// CRITICAL HONESTY NOTE. Each description says what the pattern of
// answers practically looks like day-to-day, nothing more.
const CATEGORY_DESCRIPTION: Record<ChronotypeCategory, string> = {
  'definite-evening':
    'Your answers point strongly toward an evening pattern — a body that naturally wants a later rise time, later wind-down, and later peak focus than most schedules assume.',
  'moderate-evening':
    'Your answers lean toward an evening pattern — somewhat later natural rise, wind-down, and peak-focus timing, without being at the far end of it.',
  balanced:
    "Your answers don't lean clearly toward either end — your natural timing looks close to the middle, or it genuinely varies day to day.",
  'moderate-morning':
    'Your answers lean toward a morning pattern — somewhat earlier natural rise, wind-down, and peak-focus timing, without being at the far end of it.',
  'definite-morning':
    'Your answers point strongly toward a morning pattern — a body that naturally wants an earlier rise time, earlier wind-down, and earlier peak focus than a typical late schedule assumes.',
};

/** Short, factual, non-prescriptive description of what a category
 *  practically looks like — no invented "you should do X at time Y"
 *  advice (see the file's CRITICAL HONESTY NOTE). */
export function describeChronotypeCategory(category: ChronotypeCategory): string {
  return CATEGORY_DESCRIPTION[category] ?? '—';
}

/** Short display label for a category, e.g. for a result badge. */
export function chronotypeCategoryLabel(category: ChronotypeCategory): string {
  return CATEGORY_LABEL[category] ?? '—';
}
