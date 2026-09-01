import { showScreen } from '../../lib/router.js';
import { attachTilt } from '../../lib/tilt.js';
import { animateCountUp } from '../../lib/count-up.js';
import { createCameraPpgSession } from './camera-ppg.js';
import { connectHeartRateMonitor, isBluetoothAvailable } from './ble-heart-rate.js';
import { summarizeHeartRateTrend } from './trend.js';
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

  // Same spatial-tilt language as the rest of the Fitness Toolkit —
  // scoped to just this screen.
  const heartRateScreen = byId('screen-heart-rate');
  const heartRateTilt = attachTilt(heartRateScreen);
  heartRateScreen.addEventListener('pointerdown', () => void heartRateTilt.requestMotionPermission(), {
    once: true,
  });

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
    byId('hr-camera-torch-note').hidden = true;
    byId('hr-camera-progress').hidden = false;
    byId('hr-camera-progress-fill').style.width = '0%';
    byId('hr-camera-quality-text').textContent = 'Getting a baseline reading…';
    byId('btn-hr-camera-start').disabled = true;

    activeCameraSession = createCameraPpgSession({
      onProgress: ({ elapsedMs, durationMs }) => {
        byId('hr-camera-progress-fill').style.width = `${Math.min(100, (elapsedMs / durationMs) * 100)}%`;
      },
      onQuality: (quality) => {
        byId('hr-camera-quality-text').textContent = quality.message;
      },
      onTorchStatus: (active) => {
        byId('hr-camera-torch-note').hidden = !active;
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

  renderTrend(samples);

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
        <div class="card row-between tilt-card tilt-enter">
          <span class="row" style="gap:10px; align-items:center;">
            <span class="fitness-row-icon" data-tilt-depth="1" aria-hidden="true"><svg class="icon" width="16" height="16" viewBox="0 0 24 24"><use href="#icon-heart-pulse"></use></svg></span>
            <span>
              <strong>${sample.bpm} bpm</strong>
              <p class="muted" style="font-size:var(--fs-sm); margin-top:2px;">${SOURCE_LABELS[sample.source] ?? sample.source} · ${dateLabel}</p>
            </span>
          </span>
          <span class="data-badge ${badgeClass}">${badgeText}</span>
        </div>
      `;
    })
    .join('');
}

/** Real insight from the readings already being auto-saved on every
 *  capture — not just a list to scroll past. Hidden entirely with no
 *  readings yet, rather than showing an empty/zeroed card. */
function renderTrend(samplesNewestFirst) {
  const trend = summarizeHeartRateTrend(samplesNewestFirst);
  const card = byId('hr-trend-card');
  card.hidden = !trend;
  if (!trend) return;

  animateCountUp(byId('hr-trend-latest'), trend.latest, { formatter: (n) => `${Math.round(n)} bpm` });
  byId('hr-trend-count').textContent = String(trend.sampleCount);
  byId('hr-trend-avg').textContent = `${trend.average} bpm`;
  byId('hr-trend-range').textContent = trend.min === trend.max ? `${trend.min} bpm` : `${trend.min}–${trend.max} bpm`;

  const deltaEl = byId('hr-trend-delta');
  if (trend.deltaFromPrevious == null) {
    deltaEl.textContent = '';
  } else if (trend.deltaFromPrevious === 0) {
    deltaEl.textContent = 'same as last';
  } else {
    const sign = trend.deltaFromPrevious > 0 ? '+' : '';
    deltaEl.textContent = `${sign}${trend.deltaFromPrevious} bpm since last`;
  }

  const maxBpm = Math.max(...trend.sparklineOldestFirst);
  byId('hr-trend-bars').innerHTML = trend.sparklineOldestFirst
    .map((bpm, i) => {
      const isLatest = i === trend.sparklineOldestFirst.length - 1;
      const heightPct = Math.max(8, Math.round((bpm / maxBpm) * 100));
      return `<div class="hr-trend-bar-col"><div class="hr-trend-bar${isLatest ? ' is-latest' : ''}" style="height:${heightPct}%" title="${bpm} bpm"></div></div>`;
    })
    .join('');
}
