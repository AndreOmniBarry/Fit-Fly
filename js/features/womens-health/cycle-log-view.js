import { showScreen } from '../../lib/router.js';
import { attachTilt } from '../../lib/tilt.js';
import { initChipGroup } from '../../lib/chip-group.js';
import { decryptJson, encryptJson, generateIv } from '../../lib/crypto.js';
import { formatMonthLabel, getMonthGridDays } from '../../lib/calendar-grid.js';
import { renderTrendChart } from '../../lib/trend-chart.js';
import {
  getSessionKey,
  hasPinSet,
  isUnlocked,
  lock,
  resetForgottenPin,
  setUpPin,
  unlockWithPin,
} from './pin.js';
import { averagePeriodLengthDays, derivePeriodStartDates, MOODS, SYMPTOMS } from './constants.js';
import {
  currentCyclePhase,
  cycleLengthHistory,
  cyclePhaseSegments,
  predictFertileWindow,
  predictionConfidence,
  predictNextPeriodRange,
  predictNextPeriodStart,
} from './cycle-prediction.js';
import { cycleLengthVariability, symptomFrequency } from './cycle-insights.js';
import { buildCycleWheelSegments, markerPosition } from './cycle-wheel-geometry.js';
import { dueDateFromLmp, dueDateRange, gestationalAge, daysUntilDue, trimesterForWeek } from './pregnancy.js';
import { milestoneForWeek, PREGNANCY_SYMPTOMS } from './pregnancy-content.js';
import { summarizeKickSession } from './kick-counter.js';
import { formatDayLabel } from './day-label.js';
import {
  getEncryptedCycleLog,
  listAllEncryptedCycleLogs,
  saveEncryptedCycleLog,
} from '../../db/repositories/cycle-logs.js';
import {
  getEncryptedPregnancySetup,
  listAllEncryptedPregnancyLogs,
  saveEncryptedPregnancyLog,
  saveEncryptedPregnancySetup,
} from '../../db/repositories/pregnancy.js';

function byId(id) {
  return document.getElementById(id);
}

const SVG_NS = 'http://www.w3.org/2000/svg';
// Matches the #whealth-cycle-wheel viewBox in index.html — a 160x160 box
// with a ring thick enough to read each phase's real share of the cycle
// at a glance, and a hole wide enough for the day/phase readout at its
// center.
const WHEEL_CENTER = { cx: 80, cy: 80 };
const WHEEL_OUTER_R = 70;
const WHEEL_INNER_R = 46;
const WHEEL_GEOMETRY = { center: WHEEL_CENTER, outerRadius: WHEEL_OUTER_R, innerRadius: WHEEL_INNER_R };

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

const PHASE_LABEL = {
  menstrual: 'Menstrual phase',
  follicular: 'Follicular phase',
  ovulation: 'Ovulation phase',
  luteal: 'Luteal phase',
};

// Real, semantically-matched icons per phase (all already in index.html's
// shared icon sprite) — a droplet for bleeding, a leaf for the growth-
// phase follicular stage, a sparkle for the fertile/ovulation peak, a
// moon for the waning luteal phase. Purely decorative (aria-hidden), the
// text label next to it is the real information.
const PHASE_ICON = {
  menstrual: 'icon-droplet',
  follicular: 'icon-leaf',
  ovulation: 'icon-sparkle',
  luteal: 'icon-moon',
};

// Fewer logged days than this and "symptom patterns" would really just be
// whatever happened on one or two specific days — not a pattern yet. Same
// "say so honestly instead of a guess" rule the prediction/insight
// functions themselves already follow for too-small a sample.
const MIN_LOGGED_DAYS_FOR_SYMPTOM_PATTERNS = 3;

export function initWomensHealthFeature() {
  // Same spatial-tilt language as the rest of the Fitness Toolkit — both
  // the lock and main screens get their own scoped instance.
  for (const screenId of ['screen-whealth-lock', 'screen-whealth-main']) {
    const screen = byId(screenId);
    const tilt = attachTilt(screen);
    screen.addEventListener('pointerdown', () => void tilt.requestMotionPermission(), { once: true });
  }

  const symptomsChips = initChipGroup(populateChips('whealth-symptoms', SYMPTOMS), { multi: true });
  const moodChips = initChipGroup(populateChips('whealth-mood', MOODS));
  const flowChips = initChipGroup(byId('whealth-flow'), { initial: 'none' });

  const pregnancySymptomsChips = initChipGroup(populateChips('whealth-pregnancy-symptoms', PREGNANCY_SYMPTOMS), {
    multi: true,
  });
  const pregnancyMoodChips = initChipGroup(populateChips('whealth-pregnancy-mood', MOODS));

  // The date the log form is currently reading/writing — defaults to
  // today every time the screen is (re-)entered, and changes only when
  // a non-future calendar day is tapped. Every decrypted log this
  // session touches lives in `allLogs`, refreshed once per save/unlock
  // rather than re-decrypted per render.
  let editingDate = todayIsoDate();
  let calendarYear;
  let calendarMonth;
  let allLogs = [];

  // Pregnancy mode's own equivalent state — a second, independent set of
  // real encrypted data under the exact same PIN, never mixed into
  // `allLogs` above (a person could plausibly have historical cycle logs
  // and a current pregnancy at once).
  let pregnancyEditingDate = todayIsoDate();
  let pregnancyDueDate = null; // null until real setup data exists
  let pregnancyLogs = [];
  let kickTaps = [];
  let kickIntervalHandle = null;

  const modeToggle = initChipGroup(byId('whealth-mode-toggle'), {
    initial: 'cycle',
    onChange: (mode) => {
      byId('whealth-cycle-mode').hidden = mode !== 'cycle';
      byId('whealth-pregnancy-mode').hidden = mode !== 'pregnancy';
    },
  });

  byId('btn-home-womens-health').addEventListener('click', async () => {
    if (isUnlocked()) {
      await enterMain();
    } else {
      await enterLockScreen();
    }
  });
  byId('btn-whealth-lock-back').addEventListener('click', () => showScreen('screen-home'));
  byId('btn-whealth-lock').addEventListener('click', () => {
    lock();
    showScreen('screen-home');
  });

  async function enterLockScreen() {
    const pinAlreadySet = await hasPinSet();
    byId('whealth-setup-pane').hidden = pinAlreadySet;
    byId('whealth-unlock-pane').hidden = !pinAlreadySet;
    byId('whealth-forgot-confirm').hidden = true;
    byId('whealth-pin-new').value = '';
    byId('whealth-pin-confirm').value = '';
    byId('whealth-pin-unlock').value = '';
    showScreen('screen-whealth-lock');
  }

  async function enterMain() {
    const today = new Date(`${todayIsoDate()}T00:00:00`);
    calendarYear = today.getFullYear();
    calendarMonth = today.getMonth();
    editingDate = todayIsoDate();
    pregnancyEditingDate = todayIsoDate();

    // Always reopen on Cycle — same "reset to a known default every
    // (re-)entry" rule editingDate itself already follows.
    modeToggle.setValue('cycle');
    byId('whealth-cycle-mode').hidden = false;
    byId('whealth-pregnancy-mode').hidden = true;

    await refreshAll();
    showScreen('screen-whealth-main');
  }

  /** The whole screen's data flow: decrypt every log once, then render
   *  the prediction/phase card, the calendar, and the log form for
   *  whatever date is currently being edited — same "one decrypt, three
   *  renders" shape whether this runs after unlocking, saving, or
   *  navigating a calendar month. Pregnancy mode gets the exact same
   *  treatment alongside it, decrypted every time too — cheap, and it
   *  means switching modes never shows stale data from before a save. */
  async function refreshAll() {
    allLogs = await decryptAllLogs();
    renderPrediction();
    renderCalendar();
    renderInsights();
    loadFormForDate(editingDate);

    const setup = await decryptPregnancySetup();
    pregnancyDueDate = setup?.dueDate ?? null;
    pregnancyLogs = await decryptAllPregnancyLogs();
    renderPregnancy();
  }

  function loadFormForDate(date) {
    editingDate = date;
    const isToday = date === todayIsoDate();
    byId('whealth-log-heading').textContent = isToday ? 'Log Today' : `Log ${formatDayLabel(date)}`;
    byId('btn-whealth-editing-today').hidden = isToday;

    const existing = allLogs.find((l) => l.date === date);
    flowChips.setValue(existing?.flowIntensity ?? 'none');
    symptomsChips.setValue(existing?.symptoms ?? []);
    moodChips.setValue(existing?.mood ?? null);
    byId('whealth-notes').value = existing?.notes ?? '';
  }

  byId('btn-whealth-editing-today').addEventListener('click', () => {
    loadFormForDate(todayIsoDate());
  });

  // ---------- PIN setup ----------
  byId('btn-whealth-pin-set').addEventListener('click', async () => {
    const pin = byId('whealth-pin-new').value;
    const confirm = byId('whealth-pin-confirm').value;
    const valid = pin.length >= 4 && pin === confirm;
    byId('err-whealth-pin-setup').hidden = valid;
    if (!valid) return;

    await setUpPin(pin);
    await enterMain();
  });

  // ---------- PIN unlock ----------
  byId('btn-whealth-pin-unlock').addEventListener('click', async () => {
    const pin = byId('whealth-pin-unlock').value;
    const ok = await unlockWithPin(pin);
    byId('err-whealth-pin-unlock').hidden = ok;
    if (!ok) return;
    await enterMain();
  });

  // ---------- forgot PIN ----------
  byId('btn-whealth-pin-forgot').addEventListener('click', () => {
    byId('whealth-forgot-confirm').hidden = false;
  });
  byId('btn-whealth-forgot-cancel').addEventListener('click', () => {
    byId('whealth-forgot-confirm').hidden = true;
  });
  byId('btn-whealth-forgot-confirm').addEventListener('click', async () => {
    await resetForgottenPin();
    await enterLockScreen();
  });

  // ---------- save the entry currently being edited ----------
  byId('btn-whealth-save').addEventListener('click', async () => {
    const payload = {
      flowIntensity: flowChips.getValue(),
      symptoms: symptomsChips.getValue(),
      mood: moodChips.getValue(),
      notes: byId('whealth-notes').value.trim(),
    };
    const iv = generateIv();
    const cipherBytes = await encryptJson(getSessionKey(), iv, payload);
    await saveEncryptedCycleLog({ date: editingDate, iv, cipherBytes });

    await refreshAll();
  });

  // ---------- pregnancy: due-date setup ----------
  byId('btn-whealth-pregnancy-setup-save').addEventListener('click', async () => {
    const lmp = byId('whealth-pregnancy-lmp').value;
    const directDueDate = byId('whealth-pregnancy-due-date').value;
    const dueDate = lmp ? dueDateFromLmp(lmp) : directDueDate || null;

    byId('err-whealth-pregnancy-setup').hidden = dueDate != null;
    if (!dueDate) return;

    const iv = generateIv();
    const cipherBytes = await encryptJson(getSessionKey(), iv, { dueDate });
    await saveEncryptedPregnancySetup({ iv, cipherBytes });

    byId('whealth-pregnancy-lmp').value = '';
    byId('whealth-pregnancy-due-date').value = '';
    await refreshAll();
  });

  byId('btn-whealth-pregnancy-change-date').addEventListener('click', () => {
    byId('whealth-pregnancy-due-date').value = pregnancyDueDate ?? '';
    byId('whealth-pregnancy-lmp').value = '';
    byId('whealth-pregnancy-setup').hidden = false;
    byId('whealth-pregnancy-setup').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // ---------- pregnancy: daily log ----------
  byId('btn-whealth-pregnancy-editing-today').addEventListener('click', () => {
    loadPregnancyFormForDate(todayIsoDate());
  });

  byId('btn-whealth-pregnancy-save').addEventListener('click', async () => {
    const weightRaw = byId('whealth-pregnancy-weight').value;
    // A save here must never silently drop a kick session already
    // logged for this same date — merge onto whatever's already there,
    // the same real reason renderTrend-style saves elsewhere in this app
    // always read-then-write rather than blindly overwrite.
    const existing = pregnancyLogs.find((l) => l.date === pregnancyEditingDate);
    const payload = {
      symptoms: pregnancySymptomsChips.getValue(),
      mood: pregnancyMoodChips.getValue(),
      weightKg: weightRaw ? Number(weightRaw) : null,
      notes: byId('whealth-pregnancy-notes').value.trim(),
      kickSessions: existing?.kickSessions ?? [],
    };
    const iv = generateIv();
    const cipherBytes = await encryptJson(getSessionKey(), iv, payload);
    await saveEncryptedPregnancyLog({ date: pregnancyEditingDate, iv, cipherBytes });

    await refreshAll();
  });

  // ---------- pregnancy: kick counter ----------
  byId('btn-whealth-kick-start').addEventListener('click', () => {
    kickTaps = [];
    byId('whealth-kick-idle-text').hidden = true;
    byId('whealth-kick-active').hidden = false;
    byId('btn-whealth-kick-start').hidden = true;
    byId('btn-whealth-kick-tap').hidden = false;
    byId('btn-whealth-kick-finish').hidden = false;
    byId('whealth-kick-count').textContent = '0';
    byId('whealth-kick-elapsed').textContent = '0:00';

    const startMs = Date.now();
    kickIntervalHandle = setInterval(() => {
      const elapsedSec = Math.floor((Date.now() - startMs) / 1000);
      const mm = Math.floor(elapsedSec / 60);
      const ss = String(elapsedSec % 60).padStart(2, '0');
      byId('whealth-kick-elapsed').textContent = `${mm}:${ss}`;
    }, 1000);
  });

  byId('btn-whealth-kick-tap').addEventListener('click', () => {
    kickTaps.push(Date.now());
    byId('whealth-kick-count').textContent = String(kickTaps.length);
  });

  byId('btn-whealth-kick-finish').addEventListener('click', async () => {
    clearInterval(kickIntervalHandle);
    kickIntervalHandle = null;

    const summary = summarizeKickSession(kickTaps);
    if (summary.count > 0) {
      const today = todayIsoDate();
      const existing = pregnancyLogs.find((l) => l.date === today);
      const payload = {
        symptoms: existing?.symptoms ?? [],
        mood: existing?.mood ?? null,
        weightKg: existing?.weightKg ?? null,
        notes: existing?.notes ?? '',
        kickSessions: [
          ...(existing?.kickSessions ?? []),
          { count: summary.count, durationMs: summary.durationMs, recordedAt: new Date().toISOString() },
        ],
      };
      const iv = generateIv();
      const cipherBytes = await encryptJson(getSessionKey(), iv, payload);
      await saveEncryptedPregnancyLog({ date: today, iv, cipherBytes });
    }

    kickTaps = [];
    byId('whealth-kick-idle-text').hidden = false;
    byId('whealth-kick-active').hidden = true;
    byId('btn-whealth-kick-start').hidden = false;
    byId('btn-whealth-kick-tap').hidden = true;
    byId('btn-whealth-kick-finish').hidden = true;

    await refreshAll();
  });

  // ---------- calendar month navigation ----------
  byId('btn-whealth-prev-month').addEventListener('click', () => shiftCalendarMonth(-1));
  byId('btn-whealth-next-month').addEventListener('click', () => shiftCalendarMonth(1));

  function shiftCalendarMonth(delta) {
    const next = new Date(calendarYear, calendarMonth + delta, 1);
    calendarYear = next.getFullYear();
    calendarMonth = next.getMonth();
    renderCalendar();
  }

  byId('whealth-calendar-grid').addEventListener('click', (event) => {
    const cell = event.target.closest('[data-date]');
    if (!cell || cell.disabled) return;
    loadFormForDate(cell.dataset.date);
    byId('whealth-log-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  /** The two numbers almost everything on this screen (phase, prediction,
   *  the phase bar, the calendar) is ultimately derived from — computed
   *  once per render from the exact same `allLogs` decrypt rather than
   *  recomputed slightly differently in three different places. */
  function getPeriodStartDates() {
    return derivePeriodStartDates(allLogs.map((l) => ({ date: l.date, flowIntensity: l.flowIntensity })));
  }
  function getPeriodLengthDays() {
    return averagePeriodLengthDays(allLogs.map((l) => ({ date: l.date, flowIntensity: l.flowIntensity })));
  }

  function renderPrediction() {
    const periodStartDates = getPeriodStartDates();

    const predictionCard = byId('whealth-prediction');
    if (periodStartDates.length === 0) {
      predictionCard.hidden = true;
      return;
    }

    const periodLengthDays = getPeriodLengthDays();
    const phaseOptions = { averagePeriodLengthDays: periodLengthDays };
    const nextStart = predictNextPeriodStart(periodStartDates);
    const range = predictNextPeriodRange(periodStartDates);
    const confidence = predictionConfidence(periodStartDates);
    const fertileWindow = predictFertileWindow(periodStartDates);
    const cyclesLogged = cycleLengthHistory(periodStartDates).length;

    // "Day N · phase" only when today itself is inside the current
    // cycle (currentCyclePhase returns null once genuinely past the
    // estimated next start) — real logged flow today always wins over a
    // guessed phase label, the same "measured beats estimated" rule
    // every other screen's badges already follow.
    const today = todayIsoDate();
    const isBleedingToday = allLogs.some((l) => l.date === today && l.flowIntensity && l.flowIntensity !== 'none');
    const phase = currentCyclePhase(periodStartDates, today, phaseOptions);
    if (isBleedingToday) {
      byId('whealth-cycle-day-label').textContent = phase ? `Day ${phase.cycleDayNumber} · Period` : 'Period';
    } else if (phase) {
      byId('whealth-cycle-day-label').textContent = `Day ${phase.cycleDayNumber} · ${PHASE_LABEL[phase.phase]}`;
    } else {
      // currentCyclePhase only ever returns null here (periodStartDates
      // is non-empty, so it's not that) once today is at or past the
      // estimated next start — say so honestly instead of a vague label.
      byId('whealth-cycle-day-label').textContent = 'Next period overdue (estimated)';
    }

    const iconUse = byId('whealth-phase-icon-use');
    iconUse.setAttribute('href', `#${PHASE_ICON[phase?.phase ?? 'menstrual']}`);
    // A quiet color tint per phase on the card itself (see the
    // .whealth-phase-* rules in css/components.css) — real logged flow
    // still always renders as "Period" above regardless of which bucket
    // the estimate itself lands in.
    predictionCard.dataset.phase = isBleedingToday ? 'menstrual' : phase?.phase ?? '';

    // A real earliest–latest window, not one unqualified date — see
    // predictNextPeriodRange's own doc comment for where the margin
    // comes from. marginDays === 0 can't happen (the function floors
    // it), so "earliest === latest" never renders as a false single date.
    byId('whealth-prediction-date').textContent = range
      ? `Next period estimated: ${formatDayLabel(range.earliest)} – ${formatDayLabel(range.latest)}`
      : `Next period estimated: ${formatDayLabel(nextStart)}`;
    // Names the real basis for that window (±N days, from M actual
    // logged cycles) instead of a bare confidence word on its own — a
    // person can see *why* it's "low" or "high", not just be told.
    byId('whealth-prediction-confidence').textContent = range
      ? `±${range.marginDays} day${range.marginDays === 1 ? '' : 's'} · ${confidence} confidence${
          cyclesLogged > 0 ? ` · from ${cyclesLogged} logged cycle${cyclesLogged === 1 ? '' : 's'}` : ' · not enough history yet'
        }`
      : `estimated · ${confidence}`;
    byId('whealth-fertile-window').textContent = fertileWindow
      ? `Estimated fertile window: ${formatDayLabel(fertileWindow.start)} – ${formatDayLabel(fertileWindow.end)} (ovulation ~${formatDayLabel(fertileWindow.ovulationDate)})`
      : '';
    predictionCard.hidden = false;

    renderCycleWheel(periodStartDates, phaseOptions, phase);
  }

  /** The actual visual "phase indicator" — a ring shaped by the person's
   *  own real cycle/period lengths (cyclePhaseSegments), each wedge's real
   *  angular share of the circle (never four equal quarters), with a
   *  marker dot at today's real position in it and the day/phase readout
   *  at the ring's own center. Hidden whenever there's no phase to place
   *  a marker at (currentCyclePhase itself returned null — see its own
   *  doc comment for exactly when that is), since a ring with no "you are
   *  here" marker would be misleading rather than useful. */
  function renderCycleWheel(periodStartDates, phaseOptions, phase) {
    const wrap = byId('whealth-cycle-wheel-wrap');
    const segmentsGroup = byId('whealth-cycle-wheel-segments');
    segmentsGroup.innerHTML = '';

    const segments = cyclePhaseSegments(periodStartDates, phaseOptions);
    if (!segments || !phase) {
      wrap.hidden = true;
      return;
    }
    wrap.hidden = false;

    const orderedSegments = [
      ['menstrual', segments.menstrualDays],
      ['follicular', segments.follicularDays],
      ['ovulation', segments.ovulationDays],
      ['luteal', segments.lutealDays],
    ];
    const wheelSegments = buildCycleWheelSegments(orderedSegments, WHEEL_GEOMETRY);
    for (const segment of wheelSegments) {
      const path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('d', segment.d);
      path.setAttribute('class', 'whealth-cycle-wheel-segment');
      path.dataset.phase = segment.phase;
      segmentsGroup.append(path);
    }

    const marker = markerPosition(phase.cycleDayNumber, segments.cycleLengthDays, WHEEL_GEOMETRY);
    const markerEl = byId('whealth-cycle-wheel-marker');
    markerEl.setAttribute('cx', String(marker.x));
    markerEl.setAttribute('cy', String(marker.y));

    byId('whealth-cycle-wheel-day').textContent = `Day ${phase.cycleDayNumber}`;
    // The ring's own center is small — the trailing " phase" the legend/
    // label elsewhere spells out in full adds nothing here that the
    // wedge color + legend below it doesn't already say.
    byId('whealth-cycle-wheel-phase').textContent = PHASE_LABEL[phase.phase].replace(/ phase$/, '');

    for (const el of document.querySelectorAll('#whealth-phase-bar-legend [data-phase]')) {
      el.classList.toggle('is-current', el.dataset.phase === phase.phase);
    }
  }

  /** Real insights only — every number here comes straight from
   *  cycle-prediction.js/cycle-insights.js's pure functions, which
   *  themselves return null/empty rather than a guess whenever there
   *  isn't enough real history yet (same convention Hydration's own
   *  trend chart already follows for a too-short history). The whole
   *  card only hides completely with zero logged days ever — once there's
   *  *any* real history, each sub-section shows either real numbers or
   *  its own honest "not enough yet" message, never both hidden at once. */
  function renderInsights() {
    const card = byId('whealth-insights');
    if (allLogs.length === 0) {
      card.hidden = true;
      return;
    }
    card.hidden = false;

    const periodStartDates = getPeriodStartDates();

    const points = cycleLengthHistory(periodStartDates).map((h) => ({
      key: h.periodStartDate,
      value: h.lengthDays,
      axisLabel: h.periodStartDate.slice(5),
      tooltipValue: `${h.lengthDays} days`,
      tooltipDetail: formatDayLabel(h.periodStartDate, { withYear: true }),
    }));
    renderTrendChart(byId('whealth-cycle-length-chart'), {
      points,
      accentVar: '--accent',
      emptyMessage: 'Log at least 3 periods to see your cycle-length trend.',
    });

    const variability = cycleLengthVariability(periodStartDates);
    byId('whealth-cycle-variability').textContent = variability
      ? `Average ${Math.round(variability.averageDays)}-day cycle, varying ±${Math.round(variability.stdDevDays)} days (${variability.minDays}–${variability.maxDays} days) — ${variability.regularity}.`
      : 'Log a few more cycles to see how regular yours are.';

    const frequencies = symptomFrequency(allLogs, SYMPTOMS);
    const symptomWrap = byId('whealth-symptom-frequency');
    symptomWrap.innerHTML = '';
    if (allLogs.length < MIN_LOGGED_DAYS_FOR_SYMPTOM_PATTERNS) {
      symptomWrap.append(buildMutedNote('Log a few more days to see your symptom patterns.'));
    } else if (frequencies.length === 0) {
      symptomWrap.append(buildMutedNote('No symptoms logged yet.'));
    } else {
      for (const symptom of frequencies) {
        symptomWrap.append(buildSymptomFrequencyRow(symptom));
      }
    }
  }

  function buildMutedNote(text) {
    const note = document.createElement('p');
    note.className = 'muted center-text';
    note.style.fontSize = 'var(--fs-sm)';
    note.textContent = text;
    return note;
  }

  function buildSymptomFrequencyRow(symptom) {
    const row = document.createElement('div');
    row.className = 'stack';
    row.style.gap = '4px';

    const labelRow = document.createElement('div');
    labelRow.className = 'row-between';
    labelRow.style.fontSize = 'var(--fs-sm)';
    const label = document.createElement('span');
    label.textContent = symptom.label;
    const stat = document.createElement('span');
    stat.className = 'muted';
    stat.textContent = `${symptom.percent}% · ${symptom.count} day${symptom.count === 1 ? '' : 's'}`;
    labelRow.append(label, stat);

    const track = document.createElement('div');
    track.className = 'goal-progress-track';
    const fill = document.createElement('div');
    fill.className = 'goal-progress-fill';
    fill.style.width = `${symptom.percent}%`;
    track.append(fill);

    row.append(labelRow, track);
    return row;
  }

  function renderCalendar() {
    byId('whealth-calendar-month-label').textContent = formatMonthLabel(calendarYear, calendarMonth);

    const logsByDate = new Map(allLogs.map((l) => [l.date, l]));
    const periodStartDates = getPeriodStartDates();
    const phaseOptions = { averagePeriodLengthDays: getPeriodLengthDays() };
    // The whole predicted earliest-latest window gets marked, not just
    // one pinpoint day — a single dashed dot on one specific date reads
    // as far more confident than any cycle prediction actually is (see
    // predictNextPeriodRange's own doc comment). day.date is a plain
    // ISO string, so a lexicographic range check is exact here.
    const range = predictNextPeriodRange(periodStartDates);

    const grid = byId('whealth-calendar-grid');
    grid.innerHTML = '';
    const days = getMonthGridDays(calendarYear, calendarMonth, todayIsoDate());

    for (const day of days) {
      const log = logsByDate.get(day.date);
      const hasRealFlow = log?.flowIntensity && log.flowIntensity !== 'none';
      const isPredictedStart = range != null && day.date >= range.earliest && day.date <= range.latest;
      // currentCyclePhase looks across *every* logged period, not just
      // the latest — so a past month's days get colored by whichever of
      // their own (possibly fully historical, possibly-estimated-current)
      // cycle they actually fall in, same phase model as the card above.
      const phase = !hasRealFlow && !isPredictedStart ? currentCyclePhase(periodStartDates, day.date, phaseOptions) : null;

      const cell = document.createElement('button');
      cell.type = 'button';
      cell.setAttribute('role', 'gridcell');
      cell.dataset.date = day.date;

      const classes = ['whealth-calendar-day'];
      if (!day.inMonth) classes.push('whealth-calendar-day--out-of-month');
      if (day.isFuture) classes.push('whealth-calendar-day--future');
      if (day.isToday) classes.push('whealth-calendar-day--today');

      let ariaSuffix = 'not logged';
      if (hasRealFlow) {
        classes.push('whealth-calendar-day--period');
        cell.dataset.flow = log.flowIntensity;
        ariaSuffix = `period logged, ${log.flowIntensity} flow`;
      } else if (isPredictedStart) {
        classes.push('whealth-calendar-day--predicted-period');
        ariaSuffix = day.date === range.likely ? 'most likely next period start' : 'possible next period start';
      } else if (phase?.phase === 'ovulation') {
        // Same familiar "fertile window" name/color the legend and the
        // top prediction card's own copy already use for this window.
        classes.push('whealth-calendar-day--fertile');
        ariaSuffix = 'estimated fertile window';
      } else if (phase) {
        classes.push(`whealth-calendar-day--phase-${phase.phase}`);
        ariaSuffix = `estimated ${PHASE_LABEL[phase.phase].toLowerCase()}`;
      } else if (log) {
        classes.push('whealth-calendar-day--logged');
        ariaSuffix = 'logged';
      }
      cell.className = classes.join(' ');
      cell.disabled = day.isFuture;

      const dayNumber = Number(day.date.slice(-2));
      const dot = !hasRealFlow && (phase || isPredictedStart || log) ? '<span class="whealth-calendar-day-dot"></span>' : '';
      cell.innerHTML = `<span>${dayNumber}</span>${dot}`;
      cell.setAttribute('aria-label', `${formatDayLabel(day.date, { withYear: true })}, ${ariaSuffix}`);

      grid.append(cell);
    }
  }

  async function decryptAllLogs() {
    const encrypted = await listAllEncryptedCycleLogs();
    const key = getSessionKey();
    const decrypted = [];
    for (const log of encrypted) {
      const payload = await decryptJson(key, log.iv, log.cipherBytes);
      decrypted.push({ date: log.date, ...payload });
    }
    return decrypted;
  }

  async function decryptPregnancySetup() {
    const encrypted = await getEncryptedPregnancySetup();
    if (!encrypted) return null;
    return decryptJson(getSessionKey(), encrypted.iv, encrypted.cipherBytes);
  }

  async function decryptAllPregnancyLogs() {
    const encrypted = await listAllEncryptedPregnancyLogs();
    const key = getSessionKey();
    const decrypted = [];
    for (const log of encrypted) {
      const payload = await decryptJson(key, log.iv, log.cipherBytes);
      decrypted.push({ date: log.date, ...payload });
    }
    return decrypted;
  }

  function loadPregnancyFormForDate(date) {
    pregnancyEditingDate = date;
    const isToday = date === todayIsoDate();
    byId('whealth-pregnancy-log-heading').textContent = isToday ? 'Log Today' : `Log ${formatDayLabel(date)}`;
    byId('btn-whealth-pregnancy-editing-today').hidden = isToday;

    const existing = pregnancyLogs.find((l) => l.date === date);
    pregnancySymptomsChips.setValue(existing?.symptoms ?? []);
    pregnancyMoodChips.setValue(existing?.mood ?? null);
    byId('whealth-pregnancy-weight').value = existing?.weightKg ?? '';
    byId('whealth-pregnancy-notes').value = existing?.notes ?? '';
  }

  /** Real due-date math throughout — no fabricated precision. With no
   *  due date set yet, only the setup card shows; every other pregnancy
   *  card stays hidden rather than rendering around a number that
   *  doesn't exist. */
  function renderPregnancy() {
    byId('whealth-pregnancy-setup').hidden = pregnancyDueDate != null;
    const hasDueDate = pregnancyDueDate != null;
    for (const id of [
      'whealth-pregnancy-overview',
      'whealth-pregnancy-milestone',
      'whealth-kick-counter',
      'whealth-pregnancy-log-card',
    ]) {
      byId(id).hidden = !hasDueDate;
    }
    if (!hasDueDate) {
      byId('whealth-pregnancy-weight-trend').hidden = true;
      return;
    }

    const today = todayIsoDate();
    const age = gestationalAge(pregnancyDueDate, today);
    const daysLeft = daysUntilDue(pregnancyDueDate, today);
    const trimester = trimesterForWeek(age.weeks);
    const TRIMESTER_LABEL = { 1: 'First trimester', 2: 'Second trimester', 3: 'Third trimester' };

    byId('whealth-pregnancy-week-label').textContent = `Week ${age.weeks}, day ${age.days}`;
    byId('whealth-pregnancy-due-label').textContent =
      daysLeft >= 0
        ? `Estimated due ${formatDayLabel(pregnancyDueDate, { withYear: true })} (${daysLeft} day${daysLeft === 1 ? '' : 's'} to go)`
        : `Estimated due date has passed (${formatDayLabel(pregnancyDueDate, { withYear: true })}) — many pregnancies go past their estimate`;
    // The real ACOG-cited 37-42 week term window, not just the single
    // Naegele date above — see dueDateRange's own doc comment for where
    // that comes from. Only ~5% of babies actually arrive on their exact
    // due date, so a bare single date reads as far more precise than
    // obstetric practice treats it.
    const range = dueDateRange(pregnancyDueDate);
    byId('whealth-pregnancy-range-label').textContent =
      `Likely to arrive ${formatDayLabel(range.earliest)} – ${formatDayLabel(range.latest)} (full-term window)`;
    byId('whealth-pregnancy-trimester-label').textContent = TRIMESTER_LABEL[trimester];

    const milestone = milestoneForWeek(age.weeks);
    byId('whealth-pregnancy-milestone-title').textContent = `Week ${milestone.week}: ${milestone.title}`;
    byId('whealth-pregnancy-milestone-text').textContent = milestone.text;

    loadPregnancyFormForDate(pregnancyEditingDate);

    const weightPoints = pregnancyLogs
      .filter((l) => l.weightKg != null)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((l) => ({
        key: l.date,
        value: l.weightKg,
        axisLabel: l.date.slice(8),
        tooltipValue: `${l.weightKg} kg`,
        tooltipDetail: formatDayLabel(l.date),
      }));
    const weightCard = byId('whealth-pregnancy-weight-trend');
    weightCard.hidden = weightPoints.length < 2;
    if (weightPoints.length >= 2) {
      renderTrendChart(byId('whealth-pregnancy-weight-chart'), {
        points: weightPoints,
        accentVar: '--accent',
        emptyMessage: 'Log a weight to start a trend.',
      });
    }
  }
}

function populateChips(containerId, items) {
  const container = byId(containerId);
  container.innerHTML = items
    .map((item) => `<button type="button" class="chip" data-value="${item.id}" aria-pressed="false">${item.label}</button>`)
    .join('');
  return container;
}
