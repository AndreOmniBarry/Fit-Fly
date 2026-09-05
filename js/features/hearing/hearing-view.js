import { showScreen } from '../../lib/router.js';
import { attachTilt } from '../../lib/tilt.js';
import { animateCountUp } from '../../lib/count-up.js';
import { initChipGroup } from '../../lib/chip-group.js';
import { formatDuration } from '../../lib/timer.js';
import { renderTrendChart } from '../../lib/trend-chart.js';
import {
  bucketDailyPoints,
  formatBucketAxisLabel,
  formatBucketDetailLabel,
  timeRangeBounds,
  timeRangeDescription,
} from '../../lib/time-range.js';
import { createNoiseCaptureSession } from './noise-capture.js';
import { createNoiseMonitorSession } from './noise-monitor.js';
import { summarizeNoiseTrend, loudReadingsInLastNDays, calculateNoiseCheckStreak } from './hearing-trend.js';
import { dailyDoseFromSessions, summarizeMonitorSession } from './hearing-exposure.js';
import { listRecentNoiseCheckIns, recordNoiseCheckIn } from '../../db/repositories/noise-checkins.js';
import {
  addMonitorSample,
  finishMonitorSession,
  listAllMonitorSessions,
  startMonitorSession,
} from '../../db/repositories/noise-monitor.js';
import { setHearingTileSubtitle } from '../hub/hub-view.js';

function byId(id) {
  return document.getElementById(id);
}

const CATEGORY_LABELS = {
  quiet: 'Quiet',
  moderate: 'Moderate',
  'very-loud': 'Very loud',
  loud: 'Loud',
  harmful: 'Harmful with prolonged exposure',
  dangerous: 'Dangerous',
};

// Each reported Monitor sample is a real Leq integrated over this whole
// span (see noise-monitor.js) — 10s is frequent enough to catch a real
// pattern (a loud commute, a quiet office) without sampling so often the
// dose/spike UI updates feel like noise themselves.
const MONITOR_SAMPLE_INTERVAL_MS = 10_000;

export function initHearingFeature() {
  let activeCheckInSession = null;
  let activeMonitorSession = null;
  let monitorSessionId = null;
  let monitorSamples = [];
  let monitorStartMs = null;
  let monitorElapsedHandle = null;
  let exposureRange = 'W';

  const hearingScreen = byId('screen-hearing');
  const hearingTilt = attachTilt(hearingScreen);
  hearingScreen.addEventListener('pointerdown', () => void hearingTilt.requestMotionPermission(), { once: true });

  byId('btn-home-hearing').addEventListener('click', async () => {
    await renderHistory();
    showScreen('screen-hearing');
  });

  function stopActiveMonitorSession() {
    if (!activeMonitorSession) return;
    activeMonitorSession.stop();
    activeMonitorSession = null;
    if (monitorElapsedHandle != null) clearInterval(monitorElapsedHandle);
    monitorElapsedHandle = null;
    // Leaves the session record's endedAt null — a real, honest record
    // of an interrupted session, never silently finished with a
    // fabricated end time (see noise-monitor.js repository's own doc
    // comment).
    monitorSessionId = null;
    // The UI itself must go back to idle too — an interrupted session
    // (leaving the screen, or switching back to Check-in mode) has no
    // real summary to show, so this resets straight past the "active"
    // panel rather than leaving a stale live readout on screen for
    // whenever Monitor mode is shown again.
    byId('hearing-monitor-active').hidden = true;
    byId('hearing-monitor-summary').hidden = true;
    byId('hearing-monitor-idle').hidden = false;
  }

  byId('btn-hearing-back').addEventListener('click', () => {
    activeCheckInSession?.cancel();
    stopActiveMonitorSession();
    showScreen('screen-hub');
  });

  byId('btn-hearing-test-entry').addEventListener('click', () => {
    activeCheckInSession?.cancel();
    stopActiveMonitorSession();
    showScreen('screen-hearing-test');
  });

  // ---------- mode toggle ----------
  initChipGroup(byId('hearing-mode-toggle'), {
    initial: 'checkin',
    onChange: (value) => {
      byId('hearing-checkin-mode').hidden = value !== 'checkin';
      byId('hearing-monitor-mode').hidden = value !== 'monitor';
      if (value === 'monitor') void renderExposureChart();
      else stopActiveMonitorSession(); // switching back to Check-in stops any running Monitor session
    },
  });

  // ---------- check-in ----------
  byId('btn-hearing-capture-start').addEventListener('click', () => {
    byId('hearing-error').hidden = true;
    byId('hearing-result').hidden = true;
    byId('hearing-progress').hidden = false;
    byId('hearing-progress-fill').style.width = '0%';
    byId('hearing-live-text').textContent = 'Listening…';
    byId('btn-hearing-capture-start').disabled = true;

    activeCheckInSession = createNoiseCaptureSession({
      onProgress: ({ elapsedMs, durationMs }) => {
        byId('hearing-progress-fill').style.width = `${Math.min(100, (elapsedMs / durationMs) * 100)}%`;
      },
      onLiveLevel: (level) => {
        byId('hearing-live-text').textContent = `~${level.estimatedDb} dB — ${level.label}`;
      },
      onComplete: async (result) => {
        byId('hearing-progress').hidden = true;
        byId('btn-hearing-capture-start').disabled = false;
        activeCheckInSession = null;

        if (!result) {
          byId('hearing-error-text').textContent = 'Couldn\'t get a reading — try again somewhere with a bit of sound.';
          byId('hearing-error').hidden = false;
          return;
        }

        await recordNoiseCheckIn({ estimatedDb: result.estimatedDb, category: result.category });
        byId('hearing-result-db').textContent = `~${result.estimatedDb} dB`;
        byId('hearing-result-label').textContent = result.label;
        byId('hearing-result-message').textContent = result.message;
        byId('hearing-result').hidden = false;
        await renderHistory();
      },
      onError: (error) => {
        byId('hearing-progress').hidden = true;
        byId('btn-hearing-capture-start').disabled = false;
        activeCheckInSession = null;
        byId('hearing-error-text').textContent =
          error.name === 'NotAllowedError'
            ? 'Microphone access was denied — allow it in your browser settings to check the level around you.'
            : 'Couldn\'t access the microphone on this device.';
        byId('hearing-error').hidden = false;
      },
    });

    activeCheckInSession.start();
  });

  // ---------- monitor ----------
  byId('btn-hearing-monitor-start').addEventListener('click', async () => {
    byId('hearing-monitor-error').hidden = true;
    monitorSamples = [];

    activeMonitorSession = createNoiseMonitorSession({
      intervalMs: MONITOR_SAMPLE_INTERVAL_MS,
      onSample: async (sample) => {
        monitorSamples.push(sample);
        if (monitorSessionId) await addMonitorSample(monitorSessionId, sample);
        byId('hearing-monitor-live-db').textContent = `~${sample.estimatedDb} dB`;
        byId('hearing-monitor-live-label').textContent = sample.label;
        const summary = summarizeMonitorSession(monitorSamples);
        byId('hearing-monitor-dose').textContent = `${summary.dosePercent}%`;
        byId('hearing-monitor-spikes').textContent = String(summary.spikeCount);
      },
      onError: (error) => {
        activeMonitorSession = null;
        byId('hearing-monitor-error-text').textContent =
          error.name === 'NotAllowedError'
            ? 'Microphone access was denied — allow it in your browser settings to monitor the sound around you.'
            : "Couldn't access the microphone on this device.";
        byId('hearing-monitor-error').hidden = false;
      },
    });

    // Real permission/hardware access is confirmed before a DB session
    // is ever created — a denied prompt should never leave behind an
    // empty, orphaned session record.
    const started = await activeMonitorSession.start();
    if (!started) return;

    const session = await startMonitorSession();
    monitorSessionId = session.id;
    monitorStartMs = performance.now();

    byId('hearing-monitor-idle').hidden = true;
    byId('hearing-monitor-summary').hidden = true;
    byId('hearing-monitor-active').hidden = false;
    byId('hearing-monitor-live-db').textContent = '— dB';
    byId('hearing-monitor-live-label').textContent = '';
    byId('hearing-monitor-dose').textContent = '0%';
    byId('hearing-monitor-spikes').textContent = '0';
    byId('hearing-monitor-elapsed').textContent = '0:00';

    monitorElapsedHandle = setInterval(() => {
      byId('hearing-monitor-elapsed').textContent = formatDuration(performance.now() - monitorStartMs);
    }, 1000);
  });

  byId('btn-hearing-monitor-stop').addEventListener('click', async () => {
    activeMonitorSession?.stop();
    activeMonitorSession = null;
    if (monitorElapsedHandle != null) clearInterval(monitorElapsedHandle);
    monitorElapsedHandle = null;

    const summary = summarizeMonitorSession(monitorSamples);
    await finishMonitorSession(monitorSessionId, summary);
    monitorSessionId = null;

    byId('hearing-monitor-active').hidden = true;
    byId('hearing-monitor-summary').hidden = false;
    byId('hearing-monitor-summary-duration').textContent = formatDuration(summary.totalHours * 3_600_000);
    byId('hearing-monitor-summary-twa').textContent = summary.twaDb != null ? `~${summary.twaDb} dB` : '—';
    byId('hearing-monitor-summary-dose').textContent = `${summary.dosePercent}%`;
    byId('hearing-monitor-summary-spikes').textContent = String(summary.spikeCount);
    renderSessionChart(monitorSamples);
  });

  byId('btn-hearing-monitor-done').addEventListener('click', () => {
    byId('hearing-monitor-summary').hidden = true;
    byId('hearing-monitor-idle').hidden = false;
    void renderExposureChart();
  });

  // ---------- exposure over time ----------
  initChipGroup(byId('hearing-exposure-range'), {
    initial: exposureRange,
    onChange: (value) => {
      exposureRange = value;
      void renderExposureChart();
    },
  });

  async function renderExposureChart() {
    const sessions = (await listAllMonitorSessions()).filter((s) => s.dosePercent != null);
    byId('hearing-exposure-card').hidden = sessions.length === 0;
    if (sessions.length === 0) return;

    const todayIso = new Date().toISOString().slice(0, 10);
    const bounds = timeRangeBounds(exposureRange, todayIso);
    byId('hearing-exposure-range-copy').textContent = timeRangeDescription(exposureRange);

    const daily = dailyDoseFromSessions(sessions).filter((d) => d.date >= bounds.start && d.date <= bounds.end);
    const buckets = bucketDailyPoints(daily, bounds.bucket);
    const isBucketed = bounds.bucket !== 'day';

    renderTrendChart(byId('hearing-exposure-chart'), {
      points: buckets.map((bucket) => ({
        key: bucket.key,
        value: bucket.value,
        axisLabel: formatBucketAxisLabel(bucket.key, bounds.bucket),
        highlighted: bucket.value >= 100,
        tooltipValue: `${Math.round(bucket.value * 10) / 10}%${isBucketed ? '/day avg' : ''} dose`,
        tooltipDetail: `${formatBucketDetailLabel(bucket.key, bounds.bucket)}${bucket.value >= 100 ? ' · Full daily dose or more' : ''}`,
      })),
      accentVar: '--hearing-accent',
      referenceValue: 100,
      emptyMessage: 'Run a Monitor session to start a trend.',
    });
  }

  /** This one session's own readings across its real timeline — the
   *  detail behind the summary numbers, not just a headline dose/TWA. */
  function renderSessionChart(samplesOldestFirst) {
    renderTrendChart(byId('hearing-monitor-summary-chart'), {
      points: samplesOldestFirst.map((sample) => {
        const timeLabel = new Date(sample.recordedAt).toLocaleTimeString(undefined, {
          hour: 'numeric',
          minute: '2-digit',
        });
        return {
          key: sample.recordedAt,
          value: sample.estimatedDb,
          axisLabel: timeLabel.replace(/\s?[AP]M$/i, ''),
          highlighted: sample.category === 'harmful' || sample.category === 'dangerous',
          tooltipValue: `~${sample.estimatedDb} dB`,
          tooltipDetail: `${timeLabel} · ${sample.label}`,
        };
      }),
      accentVar: '--hearing-accent',
      emptyMessage: 'Not enough samples for a chart.',
    });
  }
}

async function renderHistory() {
  const checkIns = await listRecentNoiseCheckIns(30);
  const list = byId('hearing-history-list');

  renderTrend(checkIns);

  if (checkIns.length === 0) {
    list.innerHTML = '<p class="muted center-text">No check-ins yet.</p>';
    setHearingTileSubtitle('Check the sound level around you');
    return;
  }

  list.innerHTML = checkIns
    .map((c) => {
      const dateLabel = new Date(c.recordedAt).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
      return `
        <div class="card row-between tilt-card tilt-enter">
          <span class="row" style="gap:10px; align-items:center;">
            <span class="fitness-row-icon" data-tilt-depth="1" aria-hidden="true"><svg class="icon" width="16" height="16" viewBox="0 0 24 24"><use href="#icon-ear"></use></svg></span>
            <span>
              <strong>~${c.estimatedDb} dB</strong>
              <p class="muted" style="font-size:var(--fs-sm); margin-top:2px;">${CATEGORY_LABELS[c.category] ?? c.category} · ${dateLabel}</p>
            </span>
          </span>
          <span class="data-badge estimated">estimated</span>
        </div>
      `;
    })
    .join('');
}

/** Real insight from the check-ins already being auto-saved on every
 *  capture — hidden entirely with no check-ins yet, rather than showing
 *  an empty/zeroed card. */
function renderTrend(checkInsNewestFirst) {
  const trend = summarizeNoiseTrend(checkInsNewestFirst);
  const card = byId('hearing-trend-card');
  card.hidden = !trend;
  if (!trend) return;

  animateCountUp(byId('hearing-trend-latest'), trend.latest, { formatter: (n) => `~${Math.round(n)} dB` });
  byId('hearing-trend-latest-label').textContent = CATEGORY_LABELS[trend.latestCategory] ?? trend.latestCategory;
  byId('hearing-trend-average').textContent = `~${trend.average} dB`;
  byId('hearing-trend-max').textContent = `~${trend.max} dB`;

  const streak = calculateNoiseCheckStreak(checkInsNewestFirst);
  byId('hearing-trend-streak').textContent = String(streak);

  const loudCount = loudReadingsInLastNDays(checkInsNewestFirst, 7);
  byId('hearing-trend-loud-count').textContent =
    loudCount === 0
      ? 'No very-loud+ readings this week.'
      : `${loudCount} very-loud+ reading${loudCount === 1 ? '' : 's'} this week.`;

  setHearingTileSubtitle(streak > 0 ? `${streak}-day check-in streak` : 'Check the sound level around you');

  const maxLevel = Math.max(...trend.sparklineOldestFirst);
  byId('hearing-trend-bars').innerHTML = trend.sparklineOldestFirst
    .map((db, i) => {
      const isLatest = i === trend.sparklineOldestFirst.length - 1;
      const heightPct = Math.max(8, Math.round((db / maxLevel) * 100));
      return `<div class="hr-trend-bar-col"><div class="hr-trend-bar${isLatest ? ' is-latest' : ''}" style="height:${heightPct}%" title="~${db} dB"></div></div>`;
    })
    .join('');
}
