import { showScreen } from '../../lib/router.js';
import { attachTilt } from '../../lib/tilt.js';
import { initChipGroup } from '../../lib/chip-group.js';
import { decryptJson, encryptJson, generateIv } from '../../lib/crypto.js';
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
import { predictFertileWindow, predictionConfidence, predictNextPeriodStart } from './cycle-prediction.js';
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
    flowChips.setValue('none');
    symptomsChips.setValue([]);
    moodChips.setValue(null);
    byId('whealth-notes').value = '';

    const existing = await getEncryptedCycleLog(todayIsoDate());
    if (existing) {
      const payload = await decryptJson(getSessionKey(), existing.iv, existing.cipherBytes);
      flowChips.setValue(payload.flowIntensity ?? 'none');
      symptomsChips.setValue(payload.symptoms ?? []);
      moodChips.setValue(payload.mood ?? null);
      byId('whealth-notes').value = payload.notes ?? '';
    }

    await renderPrediction();
    await renderHistory();
    showScreen('screen-whealth-main');
  }

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

  // ---------- save today's entry ----------
  byId('btn-whealth-save').addEventListener('click', async () => {
    const payload = {
      flowIntensity: flowChips.getValue(),
      symptoms: symptomsChips.getValue(),
      mood: moodChips.getValue(),
      notes: byId('whealth-notes').value.trim(),
    };
    const iv = generateIv();
    const cipherBytes = await encryptJson(getSessionKey(), iv, payload);
    await saveEncryptedCycleLog({ date: todayIsoDate(), iv, cipherBytes });

    await renderPrediction();
    await renderHistory();
  });
}

function populateChips(containerId, items) {
  const container = byId(containerId);
  container.innerHTML = items
    .map((item) => `<button type="button" class="chip" data-value="${item.id}" aria-pressed="false">${item.label}</button>`)
    .join('');
  return container;
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

async function renderPrediction() {
  const logs = await decryptAllLogs();
  const periodStartDates = derivePeriodStartDates(logs.map((l) => ({ date: l.date, flowIntensity: l.flowIntensity })));

  const predictionCard = byId('whealth-prediction');
  if (periodStartDates.length === 0) {
    predictionCard.hidden = true;
    return;
  }

  const nextStart = predictNextPeriodStart(periodStartDates);
  const confidence = predictionConfidence(periodStartDates);
  const fertileWindow = predictFertileWindow(periodStartDates);

  byId('whealth-prediction-date').textContent = nextStart;
  byId('whealth-prediction-confidence').textContent = `estimated · ${confidence}`;
  byId('whealth-fertile-window').textContent = fertileWindow
    ? `Estimated fertile window: ${fertileWindow.start} – ${fertileWindow.end}`
    : '';
  predictionCard.hidden = false;
}

async function renderHistory() {
  const logs = await decryptAllLogs();
  const sorted = [...logs].sort((a, b) => b.date.localeCompare(a.date));
  const list = byId('whealth-history-list');

  if (sorted.length === 0) {
    list.innerHTML = '<p class="muted center-text">No entries logged yet.</p>';
    return;
  }

  list.innerHTML = sorted
    .map((log) => {
      const symptomLabels = (log.symptoms ?? [])
        .map((id) => SYMPTOMS.find((s) => s.id === id)?.label ?? id)
        .join(', ');
      return `
        <div class="card stack tilt-card tilt-enter">
          <div class="row-between">
            <span class="row" style="gap:10px; align-items:center;">
              <span class="fitness-row-icon" data-tilt-depth="1" aria-hidden="true"><svg class="icon" width="16" height="16" viewBox="0 0 24 24"><use href="#icon-droplet"></use></svg></span>
              <strong>${log.date}</strong>
            </span>
            <span class="muted" style="font-size:var(--fs-sm); text-transform:capitalize;">${log.flowIntensity}</span>
          </div>
          ${symptomLabels ? `<p class="muted" style="font-size:var(--fs-sm);">${symptomLabels}</p>` : ''}
        </div>
      `;
    })
    .join('');
}
