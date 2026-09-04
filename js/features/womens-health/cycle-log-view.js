import { showScreen } from '../../lib/router.js';
import { attachTilt } from '../../lib/tilt.js';
import { initChipGroup } from '../../lib/chip-group.js';
import { decryptJson, encryptJson, generateIv } from '../../lib/crypto.js';
import { formatMonthLabel, getMonthGridDays } from '../../lib/calendar-grid.js';
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
import {
  getEncryptedCycleLog,
  listAllEncryptedCycleLogs,
  saveEncryptedCycleLog,
} from '../../db/repositories/cycle-logs.js';

function byId(id) {
  return document.getElementById(id);
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function formatDayLabel(dateStr, { withYear = false } = {}) {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString(
    undefined,
    withYear
      ? { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }
      : { weekday: 'short', month: 'short', day: 'numeric' }
  );
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

  // The date the log form is currently reading/writing — defaults to
  // today every time the screen is (re-)entered, and changes only when
  // a non-future calendar day is tapped. Every decrypted log this
  // session touches lives in `allLogs`, refreshed once per save/unlock
  // rather than re-decrypted per render.
  let editingDate = todayIsoDate();
  let calendarYear;
  let calendarMonth;
  let allLogs = [];

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

    await refreshAll();
    showScreen('screen-whealth-main');
  }

  /** The whole screen's data flow: decrypt every log once, then render
   *  the prediction/phase card, the calendar, and the log form for
   *  whatever date is currently being edited — same "one decrypt, three
   *  renders" shape whether this runs after unlocking, saving, or
   *  navigating a calendar month. */
  async function refreshAll() {
    allLogs = await decryptAllLogs();
    renderPrediction();
    renderCalendar();
    loadFormForDate(editingDate);
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
}

function populateChips(containerId, items) {
  const container = byId(containerId);
  container.innerHTML = items
    .map((item) => `<button type="button" class="chip" data-value="${item.id}" aria-pressed="false">${item.label}</button>`)
    .join('');
  return container;
}
