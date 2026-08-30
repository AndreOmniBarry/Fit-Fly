import { showScreen } from '../../lib/router.js';
import { createCameraPpgSession } from './camera-ppg.js';
import { connectHeartRateMonitor, isBluetoothAvailable } from './ble-heart-rate.js';
import {
  HR_SOURCE,
  listRecentHeartRateSamples,
  recordHeartRateSample,
} from '../../db/repositories/heart-rate.js';

function byId(id) {
  return document.getElementById(id);
}

export function initHeartRateFeature() {
  let activeCameraSession = null;
  let bleConnection = null;

  byId('btn-home-heart-rate').addEventListener('click', async () => {
    await renderHistory();
    showScreen('screen-heart-rate');
  });
  byId('btn-hr-back').addEventListener('click', () => {
    activeCameraSession?.cancel();
    showScreen('screen-home');
  });

  // ---------- camera PPG ----------
  byId('btn-hr-camera-start').addEventListener('click', () => {
    byId('hr-camera-error').hidden = true;
    byId('hr-camera-result').hidden = true;
    byId('hr-camera-progress').hidden = false;
    byId('hr-camera-progress-fill').style.width = '0%';
    byId('btn-hr-camera-start').disabled = true;

    activeCameraSession = createCameraPpgSession({
      onProgress: ({ elapsedMs, durationMs }) => {
        byId('hr-camera-progress-fill').style.width = `${Math.min(100, (elapsedMs / durationMs) * 100)}%`;
      },
      onComplete: async (result) => {
        byId('hr-camera-progress').hidden = true;
        byId('btn-hr-camera-start').disabled = false;
        activeCameraSession = null;

        if (!result) {
          byId('hr-camera-error-text').textContent =
            'Couldn\'t get a clear enough reading — try holding your fingertip still, fully covering the camera.';
          byId('hr-camera-error').hidden = false;
          return;
        }

        await recordHeartRateSample({
          bpm: result.bpm,
          source: HR_SOURCE.CAMERA_PPG,
          confidence: result.confidence,
        });
        byId('hr-camera-bpm').textContent = `${result.bpm} bpm`;
        byId('hr-camera-confidence').textContent = `estimated · ${result.confidence}`;
        byId('hr-camera-result').hidden = false;
        await renderHistory();
      },
      onError: (error) => {
        byId('hr-camera-progress').hidden = true;
        byId('btn-hr-camera-start').disabled = false;
        activeCameraSession = null;
        byId('hr-camera-error-text').textContent =
          error.name === 'NotAllowedError'
            ? 'Camera access was denied — allow it in your browser settings to try a reading.'
            : 'Couldn\'t access the camera on this device.';
        byId('hr-camera-error').hidden = false;
      },
    });

    activeCameraSession.start();
  });

  // ---------- manual entry ----------
  byId('btn-hr-manual-save').addEventListener('click', async () => {
    const bpm = Number(byId('hr-manual-bpm').value);
    const valid = bpm >= 30 && bpm <= 250;
    byId('err-hr-manual').hidden = valid;
    if (!valid) return;

    await recordHeartRateSample({ bpm, source: HR_SOURCE.MANUAL });
    byId('hr-manual-bpm').value = '';
    await renderHistory();
  });

  // ---------- BLE ----------
  if (isBluetoothAvailable()) {
    byId('hr-ble-status').textContent = 'A compatible strap can connect over Bluetooth.';
  } else {
    byId('hr-ble-status').textContent = 'Bluetooth heart-rate straps aren\'t supported in this browser — use the camera or a manual entry instead.';
    byId('btn-hr-ble-connect').disabled = true;
  }

  byId('btn-hr-ble-connect').addEventListener('click', async () => {
    byId('hr-ble-status').textContent = 'Connecting…';
    bleConnection = await connectHeartRateMonitor({
      onReading: async (bpm) => {
        byId('hr-ble-status').textContent = `Connected — last reading ${bpm} bpm`;
        await recordHeartRateSample({ bpm, source: HR_SOURCE.BLE });
        await renderHistory();
      },
      onDisconnect: () => {
        byId('hr-ble-status').textContent = 'Disconnected.';
        bleConnection = null;
      },
      onError: (error) => {
        byId('hr-ble-status').textContent = error.message;
      },
    });
  });
}

const SOURCE_LABELS = {
  [HR_SOURCE.CAMERA_PPG]: 'Camera',
  [HR_SOURCE.MANUAL]: 'Manual',
  [HR_SOURCE.BLE]: 'BLE Strap',
};

async function renderHistory() {
  const samples = await listRecentHeartRateSamples(20);
  const list = byId('hr-history-list');

  if (samples.length === 0) {
    list.innerHTML = '<p class="muted center-text">No readings yet.</p>';
    return;
  }

  list.innerHTML = samples
    .map((sample) => {
      const badgeClass = sample.source === HR_SOURCE.CAMERA_PPG ? 'estimated' : 'measured';
      const badgeText =
        sample.source === HR_SOURCE.CAMERA_PPG ? `estimated · ${sample.confidence}` : 'measured';
      const dateLabel = new Date(sample.recordedAt).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
      return `
        <div class="card row-between">
          <span>
            <strong>${sample.bpm} bpm</strong>
            <p class="muted" style="font-size:var(--fs-sm); margin-top:2px;">${SOURCE_LABELS[sample.source] ?? sample.source} · ${dateLabel}</p>
          </span>
          <span class="data-badge ${badgeClass}">${badgeText}</span>
        </div>
      `;
    })
    .join('');
}
