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
import { derivePeriodStartDates, MOODS, SYMPTOMS } from './constants.js';
import { currentCyclePhase, predictFertileWindow, predictionConfidence, predictNextPeriodStart } from './cycle-prediction.js';
import { dueDateFromLmp, gestationalAge, daysUntilDue, trimesterForWeek } from './pregnancy.js';
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

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

const PHASE_LABEL = {
  follicular: 'Follicular phase',
  fertile: 'Fertile window',
  luteal: 'Luteal phase',
};

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

  function renderPrediction() {
    const periodStartDates = derivePeriodStartDates(
      allLogs.map((l) => ({ date: l.date, flowIntensity: l.flowIntensity }))
    );

    const predictionCard = byId('whealth-prediction');
    if (periodStartDates.length === 0) {
      predictionCard.hidden = true;
      return;
    }

    const nextStart = predictNextPeriodStart(periodStartDates);
    const confidence = predictionConfidence(periodStartDates);
    const fertileWindow = predictFertileWindow(periodStartDates);

    // "Day N · phase" only when today itself is inside the current
    // cycle (currentCyclePhase returns null once genuinely past the
    // estimated next start) — real logged flow today always wins over a
    // guessed phase label, the same "measured beats estimated" rule
    // every other screen's badges already follow.
    const today = todayIsoDate();
    const isBleedingToday = allLogs.some((l) => l.date === today && l.flowIntensity && l.flowIntensity !== 'none');
    const phase = currentCyclePhase(periodStartDates, today);
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

    byId('whealth-prediction-date').textContent = `Next period estimated: ${nextStart}`;
    byId('whealth-prediction-confidence').textContent = `estimated · ${confidence}`;
    byId('whealth-fertile-window').textContent = fertileWindow
      ? `Estimated fertile window: ${fertileWindow.start} – ${fertileWindow.end}`
      : '';
    predictionCard.hidden = false;
  }

  function renderCalendar() {
    byId('whealth-calendar-month-label').textContent = formatMonthLabel(calendarYear, calendarMonth);

    const logsByDate = new Map(allLogs.map((l) => [l.date, l]));
    const periodStartDates = derivePeriodStartDates(
      allLogs.map((l) => ({ date: l.date, flowIntensity: l.flowIntensity }))
    );
    const nextStart = predictNextPeriodStart(periodStartDates);
    const fertileWindow = predictFertileWindow(periodStartDates);

    const grid = byId('whealth-calendar-grid');
    grid.innerHTML = '';
    const days = getMonthGridDays(calendarYear, calendarMonth, todayIsoDate());

    for (const day of days) {
      const log = logsByDate.get(day.date);
      const hasRealFlow = log?.flowIntensity && log.flowIntensity !== 'none';
      const isFertile = fertileWindow && day.date >= fertileWindow.start && day.date <= fertileWindow.end;
      const isPredictedStart = day.date === nextStart;

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
      } else if (isFertile) {
        classes.push('whealth-calendar-day--fertile');
        ariaSuffix = 'estimated fertile window';
      } else if (isPredictedStart) {
        classes.push('whealth-calendar-day--predicted-period');
        ariaSuffix = 'estimated next period start';
      } else if (log) {
        classes.push('whealth-calendar-day--logged');
        ariaSuffix = 'logged';
      }
      cell.className = classes.join(' ');
      cell.disabled = day.isFuture;

      const dayNumber = Number(day.date.slice(-2));
      const dot = !hasRealFlow && (isFertile || isPredictedStart || log) ? '<span class="whealth-calendar-day-dot"></span>' : '';
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
