// Foster session-RPE training load + Acute:Chronic Workload Ratio (ACWR).
// Pure math, no I/O — same shape as this feature's other modules
// (program-calendar.js, one-rep-max.js, ...). Callers (program-view.js,
// sleep-view.ts's readiness save path) fetch real sessions/sets
// themselves and pass them in.
//
// Session training load — Foster C, Florhaug JA, Franklin J, Gottschall
// L, Hrovatin LA, Parker S, Doleshal P, Dodge C. "A New Approach to
// Monitoring Exercise Training." J Strength Cond Res. 2001;15(1):109-115.
// A person rates the whole session's effort on the Borg CR10 scale
// (0 "nothing at all" - 10 "maximal") once it's over; that single number
// times the session's real duration in minutes gives "session load" in
// arbitrary units (AU) — a training-load measure validated against
// objective heart-rate-based load across a wide range of exercise types,
// not just steady-state cardio.
//
// Acute:Chronic Workload Ratio (ACWR) — the classic *coupled rolling-
// average* method: acute load is the trailing 7-day average of daily
// training load, chronic load is the trailing 28-day average, and the
// ratio between them is a real, widely-cited training-injury-risk
// signal:
//   - Gabbett TJ. "The training-injury prevention paradox: should
//     athletes be training smarter and harder?" Br J Sports Med.
//     2016;50(5):273-280. An ACWR of roughly 0.8-1.3 ("sweet spot") is
//     associated with lower injury risk; ratios at or above 1.5
//     ("danger zone") are associated with a real, meaningfully elevated
//     injury risk.
//   - Hulin BT, Gabbett TJ, Blanch P, Chapman P, Bailey D, Orchard JW.
//     "Spikes in acute workload are associated with increased injury
//     risk in elite cricket fast bowlers." Br J Sports Med.
//     2014;48(8):708-712. Using this exact internal, session-RPE-based
//     workload measure, bowlers whose workload ratio ran above 200% of
//     their own recent baseline carried roughly 4.5x the injury risk of
//     those in a stable 50-99% band.
//
// Honesty note: this implements the *classic coupled rolling-average*
// ACWR only — NOT the exponentially-weighted moving average (EWMA)
// refinement proposed by Williams S, West S, Cross MJ, Stokes KA.
// "Better way to determine the acute:chronic workload ratio?" Br J
// Sports Med. 2017;51(3):209-210 (EWMA weights recent days more heavily
// and addresses some real statistical artifacts of the plain rolling
// average). That refinement is not implemented here — don't claim it is.

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// A session needs a real start and a real end to derive an honest
// duration from — one set alone has no elapsed time to measure between,
// and neither does a session nobody ever gave a session-RPE to. Both
// cases return null rather than guessing a default duration or RPE (see
// this module's own doc comment and the app-wide "never fabricate
// MEASURED-looking data" rule in README.md's "Honesty about measured vs.
// estimated data").
const MIN_SETS_FOR_DURATION = 2;

/**
 * Foster session-RPE training load for one logged session: session-RPE
 * (Borg CR10, 0-10) times real elapsed duration in minutes, derived
 * honestly from the session's own logged sets — the time between the
 * first and last set actually completed, never a fabricated or assumed
 * duration. Returns null (never a fabricated 0 or a default RPE) when
 * there isn't enough real data to say anything:
 *  - no session-RPE recorded at all
 *  - fewer than two sets (no real elapsed time to measure between them)
 *  - sets whose completedAt timestamps don't actually span any time
 *    (e.g. bulk-imported/duplicate timestamps)
 *
 * @param {{sessionRpe?: number|null}} session
 * @param {{completedAt: string}[]} sets - every set logged for this session
 * @returns {number|null} session load in arbitrary units (AU), rounded
 *   to the nearest whole unit — Foster's own method reports load as a
 *   whole-number AU, not a fractionally-precise score
 */
export function sessionTrainingLoad(session, sets) {
  if (session?.sessionRpe == null) return null;
  if (!Array.isArray(sets) || sets.length < MIN_SETS_FOR_DURATION) return null;

  const timestamps = sets
    .map((set) => new Date(set.completedAt).getTime())
    .filter((ms) => Number.isFinite(ms))
    .sort((a, b) => a - b);
  if (timestamps.length < MIN_SETS_FOR_DURATION) return null;

  const first = timestamps[0];
  const last = timestamps[timestamps.length - 1];
  const durationMinutes = (last - first) / 60000;
  if (!(durationMinutes > 0)) return null; // no real elapsed time to multiply against

  return Math.round(session.sessionRpe * durationMinutes);
}

/** Same local-calendar-day rule already established elsewhere for
 *  grouping sessions by the day a person actually experienced them
 *  (see program-calendar.js's own localDateFromIso / sleep-view.ts's
 *  todayDateString) — small enough that this app tolerates a
 *  per-module copy rather than a shared cross-feature import for it. */
function localDateKey(isoTimestamp) {
  const d = new Date(isoTimestamp);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Turns a list of real logged sessions (each with its own logged sets)
 * into one real daily-training-load entry per calendar day that had at
 * least one session whose load could actually be computed — the exact
 * input calculateAcuteChronicWorkloadRatio expects. A day with no
 * qualifying session (see sessionTrainingLoad) simply has no entry here;
 * it's up to the caller/ACWR math to treat an absent day as a real 0,
 * never something this function invents on its own. Two sessions on the
 * same real day (e.g. a strength session and a separate cardio session)
 * sum together, since ACWR measures a day's *total* real training
 * stress, not any one session in isolation.
 *
 * @param {{session: {sessionRpe?: number|null}, sets: {completedAt: string}[]}[]} sessionsWithSets
 * @returns {{date: string, load: number}[]}
 */
export function dailyTrainingLoadsFromSessions(sessionsWithSets) {
  const totals = new Map();
  for (const { session, sets } of sessionsWithSets) {
    const load = sessionTrainingLoad(session, sets);
    if (load == null) continue;
    const date = localDateKey(session.startedAt);
    totals.set(date, (totals.get(date) ?? 0) + load);
  }
  return Array.from(totals, ([date, load]) => ({ date, load }));
}

const ACUTE_WINDOW_DAYS = 7;
const CHRONIC_WINDOW_DAYS = 28;

// Can't say anything honest about a "chronic" (multi-week) baseline, or
// even a full acute week, from less real tracked history than this —
// same "no invented precision from sparse data" spirit as
// cycle-prediction.js's own SPARSE_HISTORY_MARGIN_DAYS/MIN_PREDICTION_
// MARGIN_DAYS handling. A ratio computed from 2-3 real days of history
// would look exactly as confident as one computed from 28 — that's the
// dishonest part this guards against, not the math itself.
const MIN_HISTORY_DAYS_FOR_RATIO = ACUTE_WINDOW_DAYS;

const SWEET_SPOT_LOW = 0.8;
const SWEET_SPOT_HIGH = 1.3;

function addDays(dateKey, delta) {
  const d = new Date(`${dateKey}T00:00:00`);
  d.setDate(d.getDate() + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function daysBetween(startKey, endKey) {
  return Math.round((new Date(`${endKey}T00:00:00`) - new Date(`${startKey}T00:00:00`)) / MS_PER_DAY);
}

/** Sum + real day count of a [startDate, asOfDate] calendar window,
 *  reading 0 for any real calendar day inside that window with no entry
 *  in `loadByDate` (a genuine rest day — see dailyTrainingLoadsFromSessions's
 *  own doc comment on why an absent day means 0, not "unknown"). */
function sumWindow(loadByDate, startDate, asOfDate) {
  let sum = 0;
  let days = 0;
  for (let d = startDate; d <= asOfDate; d = addDays(d, 1)) {
    sum += loadByDate.get(d) ?? 0;
    days += 1;
  }
  return { sum, days };
}

/**
 * Classic coupled-rolling-average Acute:Chronic Workload Ratio, using
 * only real tracked history (see this module's own doc comment — no
 * invented days, no EWMA). `dailyLoads` doesn't need to already cover
 * every calendar day — a day genuinely not in it is treated as a real 0
 * (a rest day), and the *earliest* date present marks where this
 * person's real session-RPE history actually begins, so the acute/
 * chronic windows never silently extend zeros back past that point.
 *
 * @param {{date: string, load: number}[]} dailyLoads - real per-day
 *   training-load totals (see dailyTrainingLoadsFromSessions)
 * @param {string} asOfDate - YYYY-MM-DD to compute the ratio as of
 * @returns {{acute: number|null, chronic: number|null, ratio: number|null,
 *   category: 'building'|'sweet-spot'|'high-risk'|null, daysOfHistory: number}}
 *   every field null (besides daysOfHistory) when there isn't yet a real
 *   week of tracked session-RPE history to compute from at all
 */
export function calculateAcuteChronicWorkloadRatio(dailyLoads, asOfDate) {
  const relevant = dailyLoads.filter((d) => d.date <= asOfDate);
  if (relevant.length === 0) {
    return { acute: null, chronic: null, ratio: null, category: null, daysOfHistory: 0 };
  }

  const loadByDate = new Map();
  let historyStart = relevant[0].date;
  for (const { date, load } of relevant) {
    loadByDate.set(date, (loadByDate.get(date) ?? 0) + load);
    if (date < historyStart) historyStart = date;
  }

  const daysOfHistory = daysBetween(historyStart, asOfDate) + 1;
  if (daysOfHistory < MIN_HISTORY_DAYS_FOR_RATIO) {
    return { acute: null, chronic: null, ratio: null, category: null, daysOfHistory };
  }

  const acuteWindowStart = addDays(asOfDate, -(ACUTE_WINDOW_DAYS - 1));
  const chronicWindowStart = addDays(asOfDate, -(CHRONIC_WINDOW_DAYS - 1));
  // Never extend a window earlier than real tracked history actually
  // starts — a person two weeks into using this feature gets a real
  // 14-day chronic average, not a 28-day one padded with fabricated
  // zero-load days before they ever opened the app.
  const acuteStart = acuteWindowStart > historyStart ? acuteWindowStart : historyStart;
  const chronicStart = chronicWindowStart > historyStart ? chronicWindowStart : historyStart;

  const acuteWindow = sumWindow(loadByDate, acuteStart, asOfDate);
  const chronicWindow = sumWindow(loadByDate, chronicStart, asOfDate);

  const acute = Math.round(acuteWindow.sum / acuteWindow.days);
  const chronic = Math.round(chronicWindow.sum / chronicWindow.days);
  const ratio = chronic > 0 ? Math.round((acute / chronic) * 100) / 100 : null;

  return { acute, chronic, ratio, category: categorizeRatio(ratio), daysOfHistory };
}

function categorizeRatio(ratio) {
  if (ratio == null) return null;
  if (ratio < SWEET_SPOT_LOW) return 'building';
  if (ratio <= SWEET_SPOT_HIGH) return 'sweet-spot';
  return 'high-risk';
}
