// A daily PMDD/PMS-*domain* symptom log — pure logic, no I/O (same
// decoupled-from-the-encrypted-store shape as cycle-prediction.js and
// cycle-insights.js; the DOM/encryption wiring lives in
// cycle-log-view.js, same as every other women's-health module here).
//
// WHY THIS EXISTS, AND WHY THE WORDING BELOW IS ORIGINAL:
// A prior research pass (Fit Fly Phase-1 research) found no free/open-
// licensed daily PMDD/PMS symptom instrument this app can legally embed
// for commercial use — the Daily Record of Severity of Problems (DRSP)
// is copyrighted (Endicott & Harrison), COPE is a paid-license Mapi
// Research Trust instrument, PRISM's rights are ambiguous, and the
// DSM-5-TR's own criteria text is APA-copyrighted with strict permission
// caps. Facts and diagnostic *concepts* aren't copyrightable; a specific
// instrument's specific wording is. So every item below is original
// wording, written by this app, mapped to the real DSM-5-TR PMDD
// criterion *domains* (Criterion B1-B4, C1-C7) — it is deliberately NOT
// a reproduction of DRSP, COPE, PRISM, or DSM-5-TR's own item text.
//
// CONFIDENCE NOTE ON THE CRITERION STRUCTURE ITSELF: the research pass
// that mapped these 11 domains could not fetch primary APA/NIH text
// directly (sandboxed, no network egress) and instead relied on several
// independent secondary sources that all converge on the same criterion
// structure — the 2016 Eisenlohr-Moul et al. C-PASS paper (full cite
// below), StatPearls, IAPMD, AAFP, and a Frontiers review. That's
// corroborated-via-multiple-secondary-sources confidence, not a
// primary-text-verified one — stated here plainly rather than implied
// away.
//
// THE 11 DOMAINS (DSM-5-TR PMDD Criterion B1-B4, C1-C7 — labels below
// are for this comment/citation only; see PMDD_SYMPTOM_ITEMS for the
// actual plain-language, non-clinical wording shown to a person):
//   B1 affective lability   B2 irritability/anger   B3 depressed mood
//   B4 anxiety/tension      C1 decreased interest    C2 concentration
//   C3 lethargy/fatigue     C4 appetite change        C5 sleep change
//   C6 feeling overwhelmed  C7 physical symptoms (breast tenderness,
//   bloating, joint/muscle aches, "puffy"/weight-gain feeling)
// Plus one optional 12th item for Criterion D (functional impairment) —
// paired alongside the symptom criteria by standard clinical practice,
// not itself one of the 11 symptom criteria, so it's excluded from the
// severity scoring below and only ever shown/read as its own thing.
//
// CRITERION F — WHY THIS MODULE GATES ANY PATTERN VIEW:
// DSM-5-TR Criterion F requires prospective daily ratings across at
// least 2 symptomatic menstrual cycles before PMDD criteria can even be
// considered met — retrospective recall (someone remembering "how last
// month was") is explicitly NOT sufficient, because it correlates poorly
// with what people actually rate day-by-day in real time. Real citation:
// Eisenlohr-Moul TA, Girdler SS, Schmalenberger KM, et al. "Toward the
// Reliable Diagnosis of DSM-5 Premenstrual Dysphoric Disorder: The
// Carolina Premenstrual Assessment Scoring System (C-PASS)." American
// Journal of Psychiatry, 2016 (the paper that introduced the C-PASS
// coding system, built specifically around that ≥2-cycle prospective
// requirement). hasProspectiveDataForTwoCycles() below is this module's
// honest operationalization of that requirement against what this app
// actually has — real logged days and real logged period starts, never
// a guess — see its own doc comment for exactly where its coverage
// threshold comes from (an app-chosen line, same as
// sleep-timing-variability.ts's ELEVATED_STDDEV_MINUTES, not itself part
// of the cited criterion).
//
// NEVER A DIAGNOSIS — READ THIS BEFORE ADDING ANY UI COPY THAT USES THIS
// MODULE'S OUTPUT:
//   - Nothing here computes, implies, or should ever be presented as a
//     PMDD/PMS diagnosis or a diagnostic verdict. There is no "you have
//     PMDD" anywhere, and there must never be.
//   - This is self-tracking to support a person's own pattern-recognition
//     and a real clinical conversation — the closest real precedent is
//     Clue's own published framing that tracking helps a person show
//     their doctor what's actually happening, not that the app itself
//     concludes anything.
//   - This module implements none of DSM-5-TR's Criterion E/G-equivalent
//     logic (ruling out another mental-health condition, or a medical/
//     substance cause) — that's clinically impossible from self-report
//     alone, and nothing here should ever imply the app attempts it.
//   - isDaySevere/shouldSurfaceCrisisResource below exist only to decide
//     when to surface the same real, static crisis-resource line the
//     Meditate screen already carries (see meditations.ts's own doc
//     comment for the full reasoning this app already settled on) —
//     never a scored risk assessment, never a popup, never branching
//     logic that reads anything else about the person.

import { cycleLengthHistory } from './cycle-prediction.js';

/** 1 = Not at all · 2 = Mild · 3 = Moderate · 4 = Severe · 5 = Extreme —
 *  the one rating scale every item below uses, shown as a real chip
 *  scale (see #pmdd-*'s chip--rating markup, the same pattern Sleep's
 *  own quality chips use for the Consensus Sleep Diary's anchors). */
export const RATING_SCALE = Object.freeze([
  { value: 1, label: 'Not at all' },
  { value: 2, label: 'Mild' },
  { value: 3, label: 'Moderate' },
  { value: 4, label: 'Severe' },
  { value: 5, label: 'Extreme' },
]);

/** The 11 real DSM-5-TR PMDD symptom-criterion domains, each with
 *  original, plain-language wording (see the module doc comment for why
 *  this is original wording, not DSM/DRSP text). `domain` is the real
 *  criterion label, kept for citation/testing purposes only — never
 *  shown to a person as raw clinical jargon; `label` is the short,
 *  plain-language heading actually shown in the log form. */
export const PMDD_SYMPTOM_ITEMS = Object.freeze([
  {
    id: 'mood-swings',
    domain: 'Criterion B1 — affective lability',
    label: 'Mood swings',
    prompt: 'How much did your mood swing up and down today — sudden sadness, tearfulness, or feeling extra sensitive to rejection?',
  },
  {
    id: 'irritability',
    domain: 'Criterion B2 — irritability/anger',
    label: 'Irritability or anger',
    prompt: 'How irritable, angry, or in conflict with people did you feel today?',
  },
  {
    id: 'depressed-mood',
    domain: 'Criterion B3 — depressed mood',
    label: 'Low mood',
    prompt: 'How low, hopeless, or self-critical did you feel today?',
  },
  {
    id: 'anxiety-tension',
    domain: 'Criterion B4 — anxiety/tension',
    label: 'Anxiety or tension',
    prompt: 'How anxious, tense, or "on edge" did you feel today?',
  },
  {
    id: 'decreased-interest',
    domain: 'Criterion C1 — decreased interest',
    label: 'Loss of interest',
    prompt: 'How much less interested were you than usual in things you normally enjoy?',
  },
  {
    id: 'concentration',
    domain: 'Criterion C2 — concentration difficulty',
    label: 'Concentration',
    prompt: 'How hard was it to concentrate or focus today?',
  },
  {
    id: 'fatigue',
    domain: 'Criterion C3 — lethargy/fatigue',
    label: 'Energy and fatigue',
    prompt: 'How low was your energy, or how tired/sluggish did you feel?',
  },
  {
    id: 'appetite-change',
    domain: 'Criterion C4 — appetite change',
    label: 'Appetite changes',
    prompt: 'How much did your appetite change today — overeating, strong cravings, or eating much less?',
  },
  {
    id: 'sleep-change',
    domain: 'Criterion C5 — sleep change',
    label: 'Sleep changes',
    prompt: 'How disrupted was your sleep — sleeping much more or much less than usual?',
  },
  {
    id: 'overwhelmed',
    domain: 'Criterion C6 — feeling overwhelmed',
    label: 'Feeling overwhelmed',
    prompt: 'How overwhelmed or out of control did you feel today?',
  },
  {
    id: 'physical-symptoms',
    domain: 'Criterion C7 — physical symptoms',
    label: 'Physical symptoms',
    prompt:
      'How much physical discomfort did you have — breast tenderness, bloating, joint/muscle aches, or a "puffy"/weight-gain feeling?',
  },
]);

/** The optional 12th item — Criterion D, functional impairment. Paired
 *  alongside the 11 symptom criteria by standard clinical practice, not
 *  itself one of them, so it's kept separate here and excluded from
 *  scoreDay()'s severity math below (mixing "how bad did it feel" with
 *  "how much did it get in the way" into one average would blur two
 *  genuinely different questions). */
export const PMDD_IMPAIRMENT_ITEM = Object.freeze({
  id: 'impairment',
  domain: 'Criterion D — functional impairment',
  label: 'Impact on daily life',
  prompt: 'How much did today\'s symptoms interfere with work, school, relationships, or daily activities?',
});

/** Every real, loggable item in form order — the 11 symptom items, then
 *  the optional impairment item last. What the log form actually
 *  iterates over to build its chip groups. */
export const ALL_PMDD_LOG_ITEMS = Object.freeze([...PMDD_SYMPTOM_ITEMS, PMDD_IMPAIRMENT_ITEM]);

const CORE_ITEM_IDS = Object.freeze(PMDD_SYMPTOM_ITEMS.map((item) => item.id));

// An app-chosen line, not a clinical cutoff — there is no published
// "severe day" threshold for a self-report instrument this app just
// wrote itself. 4.0 is the "Severe" anchor on the 1-5 scale above,
// chosen the same "round, defensible, clearly-labeled-as-ours" way
// sleep-timing-variability.ts's ELEVATED_STDDEV_MINUTES is: an average
// across the 11 real symptom items (impairment excluded, see
// PMDD_IMPAIRMENT_ITEM's own comment) landing at Severe or worse.
const SEVERE_DAY_AVERAGE_THRESHOLD = 4;

// How many of a person's most recent real logged days count as "recent"
// for the repeated-severity check below — a two-week window, long enough
// to span most of a luteal phase without reaching back across an entire
// unrelated earlier cycle.
const RECENT_DAY_WINDOW = 14;

// "Repeatedly" is a judgment call this module makes explicit rather than
// silently: 3 or more severe days within the trailing RECENT_DAY_WINDOW
// real logged days. This is deliberately not a diagnostic threshold and
// not derived from a cited instrument — it exists only to decide when
// this app's UI surfaces the same real, static 988/findahelpline.com
// line Meditate already carries (see meditations.ts's own doc comment),
// the same way a single bad day never triggers it but a real, sustained
// pattern honestly might warrant surfacing it again.
const REPEATED_SEVERE_DAY_TRIGGER_COUNT = 3;

/** A day's real severity, from whatever core items were actually
 *  answered — never assumes a value for an unanswered item, and never
 *  penalizes a partially-filled-in day by treating a blank as a 0. Only
 *  the 11 real symptom items count toward this (the impairment item is
 *  read separately, see PMDD_IMPAIRMENT_ITEM's own comment).
 *
 * @param {Record<string, number>} answers - itemId -> 1-5 rating; missing
 *   or out-of-range entries are simply not counted.
 * @returns {{answeredCount:number, totalItems:number, total:number, average:number, isSevere:boolean}|null}
 *   null when nothing was actually answered — an empty day has no score,
 *   not a fabricated zero.
 */
export function scoreDay(answers) {
  const values = CORE_ITEM_IDS.map((id) => answers?.[id]).filter(
    (v) => typeof v === 'number' && Number.isFinite(v) && v >= 1 && v <= 5
  );
  if (values.length === 0) return null;

  const total = values.reduce((a, b) => a + b, 0);
  const average = Math.round((total / values.length) * 100) / 100;
  return {
    answeredCount: values.length,
    totalItems: CORE_ITEM_IDS.length,
    total,
    average,
    isSevere: average >= SEVERE_DAY_AVERAGE_THRESHOLD,
  };
}

/** How many of a person's most recent real logged days (up to
 *  RECENT_DAY_WINDOW of them) scored as severe — see scoreDay's own
 *  `isSevere`. Real logged days only; a day with no entry isn't counted
 *  either way, never assumed non-severe or severe.
 *
 * @param {{date:string}[]} logs - decrypted daily log entries, each
 *   carrying its own item-id-keyed answers alongside `date`.
 * @returns {number}
 */
export function recentSevereDayCount(logs, { windowSize = RECENT_DAY_WINDOW } = {}) {
  const recent = [...logs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, windowSize);
  return recent.filter((log) => scoreDay(log)?.isSevere).length;
}

/** Whether this app's real, static crisis-resource line (the same
 *  988/findahelpline.com line Meditate already carries — see this
 *  module's own doc comment) should sit alongside today's result. True
 *  only once a real, sustained pattern of severe days exists in the
 *  person's own recent history — see REPEATED_SEVERE_DAY_TRIGGER_COUNT's
 *  own comment for exactly what "repeated" means here and why that's a
 *  judgment call, not a cited threshold. Never a risk score, never shown
 *  as an alarming popup — present and real, same tone as Meditate's. */
export function shouldSurfaceCrisisResource(logs) {
  return recentSevereDayCount(logs) >= REPEATED_SEVERE_DAY_TRIGGER_COUNT;
}

function daysBetween(isoDateA, isoDateB) {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((new Date(isoDateB) - new Date(isoDateA)) / msPerDay);
}

// The coverage bar a completed cycle's real symptom-log days have to
// clear before it counts toward Criterion F's "prospective daily
// ratings" requirement (see the module doc comment) — an app-chosen
// line, not part of the cited criterion itself: 60% of the real calendar
// days in that cycle actually logged. A person who logged 2 days out of
// a 30-day cycle plainly hasn't prospectively tracked that cycle in the
// sense C-PASS means, even though a period *did* start and end on real,
// known dates either side of it.
const MIN_LOG_COVERAGE_RATIO = 0.6;

/** The two most recent *completed* menstrual cycles a person has real
 *  logged period-start dates for — a cycle only counts once a later
 *  period start actually closes it (same "don't guess where real data
 *  can confirm it instead" rule cycle-prediction.js's own still-open-
 *  cycle handling follows). Deliberately re-derives this from the sorted
 *  period-start list itself rather than reusing cycle-prediction.js's
 *  cycleLengthHistory return shape, since what's needed here is each
 *  cycle's real date *range* (to test log coverage inside it), not just
 *  its length.
 *
 * @param {string[]} periodStartDates - ISO date strings
 * @returns {[{start:string end:string}, {start:string end:string}]|null}
 *   null with fewer than 2 completed cycles (fewer than 3 distinct
 *   logged period starts) — cycleLengthHistory's own return length would
 *   agree: history.length = periodStartDates.length - 1, so 2 completed
 *   cycles needs 3 starts.
 */
export function twoMostRecentCompletedCycles(periodStartDates) {
  const sorted = [...new Set(periodStartDates)].sort();
  if (sorted.length < 3) return null;
  const n = sorted.length;
  return [
    { start: sorted[n - 3], end: sorted[n - 2] },
    { start: sorted[n - 2], end: sorted[n - 1] },
  ];
}

/** The real gate behind any pattern-summary view (see the module doc
 *  comment's Criterion F section) — whether this person has genuinely
 *  prospective daily-log coverage across at least 2 full menstrual
 *  cycles yet, computed entirely from real logged data, never a guess.
 *  `completedCycles` in the returned object always reports the real
 *  number found (0, 1, or 2+), so a "not enough yet" UI state can say
 *  something honest and specific ("1 of 2 cycles so far") instead of a
 *  flat no.
 *
 * @param {string[]} periodStartDates - real logged period-start dates
 *   (js/features/womens-health/constants.js's derivePeriodStartDates)
 * @param {string[]} loggedSymptomDates - every date this person has an
 *   actual PMDD symptom-log entry for
 * @returns {{enough:boolean, completedCycles:number, coverage:[number,number]|null}}
 */
export function hasProspectiveDataForTwoCycles(periodStartDates, loggedSymptomDates) {
  const totalCompleted = Math.max(0, cycleLengthHistory(periodStartDates).length);
  const cycles = twoMostRecentCompletedCycles(periodStartDates);
  if (!cycles) {
    return { enough: false, completedCycles: totalCompleted, coverage: null };
  }

  const uniqueLoggedDates = new Set(loggedSymptomDates);
  const coverage = cycles.map((range) => {
    const lengthDays = daysBetween(range.start, range.end);
    if (lengthDays <= 0) return 0;
    let loggedCount = 0;
    for (const date of uniqueLoggedDates) {
      if (date >= range.start && date < range.end) loggedCount += 1;
    }
    return Math.round((loggedCount / lengthDays) * 100) / 100;
  });

  return {
    enough: coverage.every((c) => c >= MIN_LOG_COVERAGE_RATIO),
    completedCycles: totalCompleted,
    coverage,
  };
}
