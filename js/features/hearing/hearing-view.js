import { showScreen } from '../../lib/router.js';
import { attachTilt } from '../../lib/tilt.js';
import { animateCountUp } from '../../lib/count-up.js';
import { createNoiseCaptureSession } from './noise-capture.js';
import { summarizeNoiseTrend, loudReadingsInLastNDays, calculateNoiseCheckStreak } from './hearing-trend.js';
import { listRecentNoiseCheckIns, recordNoiseCheckIn } from '../../db/repositories/noise-checkins.js';
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

export function initHearingFeature() {
  let activeSession = null;

  const hearingScreen = byId('screen-hearing');
  const hearingTilt = attachTilt(hearingScreen);
  hearingScreen.addEventListener('pointerdown', () => void hearingTilt.requestMotionPermission(), { once: true });

  byId('btn-home-hearing').addEventListener('click', async () => {
    await renderHistory();
    showScreen('screen-hearing');
  });
  byId('btn-hearing-back').addEventListener('click', () => {
    activeSession?.cancel();
    showScreen('screen-hub');
  });

  byId('btn-hearing-capture-start').addEventListener('click', () => {
    byId('hearing-error').hidden = true;
    byId('hearing-result').hidden = true;
    byId('hearing-progress').hidden = false;
    byId('hearing-progress-fill').style.width = '0%';
    byId('hearing-live-text').textContent = 'Listening…';
    byId('btn-hearing-capture-start').disabled = true;

    activeSession = createNoiseCaptureSession({
      onProgress: ({ elapsedMs, durationMs }) => {
        byId('hearing-progress-fill').style.width = `${Math.min(100, (elapsedMs / durationMs) * 100)}%`;
      },
      onLiveLevel: (level) => {
        byId('hearing-live-text').textContent = `~${level.estimatedDb} dB — ${level.label}`;
      },
      onComplete: async (result) => {
        byId('hearing-progress').hidden = true;
        byId('btn-hearing-capture-start').disabled = false;
        activeSession = null;

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
        activeSession = null;
        byId('hearing-error-text').textContent =
          error.name === 'NotAllowedError'
            ? 'Microphone access was denied — allow it in your browser settings to check the level around you.'
            : 'Couldn\'t access the microphone on this device.';
        byId('hearing-error').hidden = false;
      },
    });

    activeSession.start();
  });
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
