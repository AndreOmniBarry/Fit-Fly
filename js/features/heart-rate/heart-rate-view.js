import { showScreen } from '../../lib/router.js';
import { attachTilt } from '../../lib/tilt.js';
import { animateCountUp } from '../../lib/count-up.js';
import { initChipGroup } from '../../lib/chip-group.js';
import { renderTrendChart } from '../../lib/trend-chart.js';
import {
  bucketDailyPoints,
  formatBucketAxisLabel,
  formatBucketDetailLabel,
  timeRangeBounds,
  timeRangeDescription,
} from '../../lib/time-range.js';
import { createCameraPpgSession } from './camera-ppg.js';
import { connectHeartRateMonitor, isBluetoothAvailable } from './ble-heart-rate.js';
import { groupHeartRateByDate, summarizeHeartRateTrend } from './trend.js';
import { calculateRmssd } from './hrv.js';
import { classifyHeartRateZone, describeHeartRateZone, isConcerningHeartRateZone } from './hr-zone.js';
import { calculateAge } from '../onboarding/age.js';
import { getProfile } from '../../db/repositories/profile.js';
import {
  HR_SOURCE,
  listRecentHeartRateSamples,
  recordHeartRateSample,
} from '../../db/repositories/heart-rate.js';

function byId(id) {
  return document.getElementById(id);
}

// The range chart's own state — see steps-view.ts's identical comment;
// same reasoning, same default range. `cachedSamples` lets the chip
// group's onChange re-render the chart without a fresh DB round trip.
let hrRange = 'W';
let cachedSamples = [];

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

  // ---------- trend range ----------
  initChipGroup(byId('hr-range'), {
    initial: hrRange,
    onChange: (value) => {
      hrRange = value;
      renderRangeChart(cachedSamples);
    },
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

  // RR-intervals accumulated across the whole live BLE connection, in
  // chronological order — a real HRV number needs several successive
  // beats, not just whatever one notification happened to carry. Reset
  // on every new connect, same lifecycle as bleConnection itself.
  let sessionRrIntervalsMs = [];

  byId('btn-hr-ble-connect').addEventListener('click', async () => {
    byId('hr-ble-status').textContent = 'Connecting…';
    byId('hr-ble-hrv').hidden = true;
    sessionRrIntervalsMs = [];
    bleConnection = await connectHeartRateMonitor({
      onReading: async (bpm, rrIntervalsMs) => {
        byId('hr-ble-status').textContent = `Connected — last reading ${bpm} bpm`;
        await recordHeartRateSample({ bpm, source: HR_SOURCE.BLE });

        // Only some straps report RR-intervals at all (see
        // ble-heart-rate.js) — the HRV card stays honestly hidden on one
        // that never does, rather than showing a number derived from
        // nothing.
        if (rrIntervalsMs.length > 0) {
          sessionRrIntervalsMs.push(...rrIntervalsMs);
          const rmssd = calculateRmssd(sessionRrIntervalsMs);
          if (rmssd != null) {
            byId('hr-ble-hrv-value').textContent = `${rmssd} ms`;
            byId('hr-ble-hrv').hidden = false;
          }
        }

        await renderHistory();
      },
      onDisconnect: () => {
        byId('hr-ble-status').textContent = 'Disconnected.';
        bleConnection = null;
        byId('hr-ble-hrv').hidden = true;
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
  // A wide fetch — the same "everything, filtered client-side" shape
  // Steps'/Hydration's own listAll*Entries() take — so the range chart
  // below can genuinely cover a full year, not just whatever a small
  // fixed limit happened to include.
  const [samples, profile] = await Promise.all([listRecentHeartRateSamples(500), getProfile()]);
  const list = byId('hr-history-list');

  // Real age when the person completed onboarding with a birthdate,
  // recomputed live rather than trusting profile.age's one-time snapshot
  // from onboarding day — null (never a guess) when there's no profile at
  // all, same "recompute, don't fabricate" rule as everywhere else this
  // app reads age. classifyHeartRateZone already degrades gracefully to a
  // fixed adult threshold when age is null.
  const age = profile?.birthdate ? calculateAge(profile.birthdate) : null;
  renderTrend(samples, age);
  cachedSamples = samples;
  renderRangeChart(samples);

  // The plain scrollable list stays capped at a scannable recent handful
  // — the wider fetch above exists for the range chart, not to flood
  // this list with a year of readings.
  const recentForList = samples.slice(0, 20);
  if (recentForList.length === 0) {
    list.innerHTML = '<p class="muted center-text">No readings yet.</p>';
    return;
  }

  list.innerHTML = recentForList
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
 *  readings yet, rather than showing an empty/zeroed card.
 *  @param {number|null} age - the person's real age from their profile's
 *   birthdate, or null when unknown — passed straight through to
 *   classifyHeartRateZone, which degrades gracefully either way. */
function renderTrend(samplesNewestFirst, age) {
  const trend = summarizeHeartRateTrend(samplesNewestFirst);
  const card = byId('hr-trend-card');
  card.hidden = !trend;
  if (!trend) return;

  animateCountUp(byId('hr-trend-latest'), trend.latest, { formatter: (n) => `${Math.round(n)} bpm` });
  const isCameraLatest = trend.latestSource === HR_SOURCE.CAMERA_PPG;
  const latestBadge = byId('hr-trend-latest-badge');
  latestBadge.className = `data-badge ${isCameraLatest ? 'estimated' : 'measured'}`;
  latestBadge.textContent = isCameraLatest ? `estimated · ${trend.latestConfidence}` : 'measured';

  // A second, separate badge for *which sensing method* produced this
  // number — measured-vs-estimated already says how much to trust it, but
  // says nothing about whether it came from a fingertip-over-the-camera
  // guess, a real chest/wrist strap, or a hand-typed number. Never
  // conflated with the measured/estimated badge above so neither one has
  // to carry two different kinds of information at once.
  byId('hr-trend-source-badge').textContent = SOURCE_LABELS[trend.latestSource] ?? trend.latestSource ?? '—';

  // Resting/elevated/high zone for the latest reading — see hr-zone.js for
  // the age-based (Tanaka max-HR) math and its no-age fallback. Always
  // computable whenever there's a latest bpm at all, regardless of source.
  const zone = classifyHeartRateZone(trend.latest, age);
  const zoneBadge = byId('hr-trend-zone-badge');
  zoneBadge.hidden = !zone;
  if (zone) {
    zoneBadge.className = `hr-zone-badge ${zone}`;
    zoneBadge.textContent = `${describeHeartRateZone(zone)} zone`;
    zoneBadge.classList.toggle('is-concerning', isConcerningHeartRateZone(zone));
  }

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

}

/** A real D/W/M/6M/Y bpm trend (see js/lib/time-range.js), replacing what
 *  used to be a fixed "last 10 raw readings" sparkline — several
 *  readings on the same day now average into one real daily point
 *  (groupHeartRateByDate) instead of every reading getting its own bar
 *  regardless of how long ago it was. */
function renderRangeChart(samplesNewestFirst) {
  const bounds = timeRangeBounds(hrRange, new Date().toISOString().slice(0, 10));
  byId('hr-range-copy').textContent = timeRangeDescription(hrRange);

  const inRange = samplesNewestFirst.filter((s) => {
    const date = s.recordedAt.slice(0, 10);
    return date >= bounds.start && date <= bounds.end;
  });
  const dailyAverages = groupHeartRateByDate(inRange);
  const daily = [...dailyAverages.entries()].map(([date, bpm]) => ({ date, value: bpm }));
  const buckets = bucketDailyPoints(daily, bounds.bucket);
  const isBucketed = bounds.bucket !== 'day';

  renderTrendChart(byId('hr-range-chart'), {
    points: buckets.map((bucket) => ({
      key: bucket.key,
      value: bucket.value,
      axisLabel: formatBucketAxisLabel(bucket.key, bounds.bucket),
      tooltipValue: `${Math.round(bucket.value)} bpm${isBucketed ? '/day avg' : ''}`,
      tooltipDetail: formatBucketDetailLabel(bucket.key, bounds.bucket),
    })),
    accentVar: '--accent',
    emptyMessage: 'Log a reading on a second day to start a trend.',
  });
}
