// The pure-tone hearing screening test's UI — drives
// pure-tone-test.js's real ascending staircase, one frequency/ear
// combination at a time, via pure-tone-generator.js's real Web Audio
// tone playback. See both those modules' own doc comments for the
// honesty limits (relative gain thresholds, never a calibrated dB HL
// figure) this whole screen is built around.
import { showScreen } from '../../lib/router.js';
import { attachTilt } from '../../lib/tilt.js';
import { renderTrendChart } from '../../lib/trend-chart.js';
import { isPureToneSupported, playPureTone, primeToneAudio } from './pure-tone-generator.js';
import {
  EARS,
  TEST_FREQUENCIES_HZ,
  compareThresholdChange,
  createAscendingStaircase,
  flagElevatedThresholds,
  notDetectedResults,
} from './pure-tone-test.js';
import { listHearingScreeningTests, saveHearingScreeningTest } from '../../db/repositories/hearing-screening.js';

function byId(id) {
  return document.getElementById(id);
}

const TONE_DURATION_SECONDS = 1.8;
// A real, silent gap between tones — never back-to-back — so a person
// can register "that tone ended" before the next one starts, the same
// real audiometric-testing practice clinical equipment follows.
const INTER_TONE_PAUSE_MS = 500;

function frequencyLabel(hz) {
  return hz >= 1000 ? `${hz / 1000}kHz` : `${hz}Hz`;
}

export function initHearingTestFeature() {
  let combos = []; // {ear, frequencyHz}[], in test order
  let comboIndex = 0;
  let staircase = null;
  let stopCurrentTone = null;
  let toneTimeoutHandle = null;
  let results = [];
  let running = false;

  const screen = byId('screen-hearing-test');
  const tilt = attachTilt(screen);
  screen.addEventListener('pointerdown', () => void tilt.requestMotionPermission(), { once: true });

  function cancelRun() {
    running = false;
    if (toneTimeoutHandle != null) clearTimeout(toneTimeoutHandle);
    toneTimeoutHandle = null;
    stopCurrentTone?.();
    stopCurrentTone = null;
  }

  function resetToIntro() {
    cancelRun();
    byId('hearing-test-running').hidden = true;
    byId('hearing-test-results').hidden = true;
    byId('hearing-test-intro').hidden = false;
  }

  byId('btn-hearing-test-back').addEventListener('click', () => {
    cancelRun();
    showScreen('screen-hearing');
  });

  byId('btn-hearing-test-done').addEventListener('click', () => {
    resetToIntro();
    showScreen('screen-hearing');
  });

  byId('btn-hearing-test-start').addEventListener('click', () => {
    if (!isPureToneSupported()) {
      // Same feature-detected, never-throws contract as every other Web
      // Audio integration here — no support, an honest inline message,
      // never a test that silently can't play anything.
      byId('hearing-test-intro').innerHTML =
        '<p class="muted center-text">Tone playback isn\'t available in this browser.</p>';
      return;
    }

    primeToneAudio();
    combos = [];
    for (const ear of EARS) {
      for (const frequencyHz of TEST_FREQUENCIES_HZ) combos.push({ ear, frequencyHz });
    }
    comboIndex = 0;
    results = [];
    running = true;

    byId('hearing-test-intro').hidden = true;
    byId('hearing-test-results').hidden = true;
    byId('hearing-test-running').hidden = false;
    runCurrentCombo();
  });

  function runCurrentCombo() {
    if (!running) return;
    const combo = combos[comboIndex];
    if (!combo) {
      void finishTest();
      return;
    }
    staircase = createAscendingStaircase();
    const frequencyIndex = TEST_FREQUENCIES_HZ.indexOf(combo.frequencyHz) + 1;
    byId('hearing-test-progress-label').textContent =
      `${combo.ear === 'left' ? 'Left' : 'Right'} ear · Tone ${frequencyIndex} of ${TEST_FREQUENCIES_HZ.length}`;
    playCurrentTone(combo);
  }

  function playCurrentTone(combo) {
    if (!running) return;
    stopCurrentTone = playPureTone({
      frequencyHz: combo.frequencyHz,
      gain: staircase.getCurrentGain(),
      ear: combo.ear,
      durationSeconds: TONE_DURATION_SECONDS,
    });

    toneTimeoutHandle = setTimeout(() => {
      if (!running) return;
      staircase.reportNotHeard();
      advance(combo);
    }, TONE_DURATION_SECONDS * 1000 + INTER_TONE_PAUSE_MS);
  }

  function advance(combo) {
    if (staircase.isFinished()) {
      results.push({ ear: combo.ear, frequencyHz: combo.frequencyHz, thresholdGain: staircase.getThresholdGain() });
      comboIndex++;
      runCurrentCombo();
    } else {
      playCurrentTone(combo);
    }
  }

  byId('btn-hearing-test-heard').addEventListener('click', () => {
    if (!running || !staircase) return;
    if (toneTimeoutHandle != null) clearTimeout(toneTimeoutHandle);
    toneTimeoutHandle = null;
    stopCurrentTone?.();
    stopCurrentTone = null;
    const combo = combos[comboIndex];
    staircase.reportHeard();
    advance(combo);
  });

  async function finishTest() {
    running = false;
    byId('hearing-test-running').hidden = true;

    // The most recent test on file, if any, *before* this one is saved
    // — the real baseline compareThresholdChange needs to detect a
    // change over time, not this test compared against itself.
    const previousTests = await listHearingScreeningTests();
    await saveHearingScreeningTest(results);

    renderResults(results, previousTests[0] ?? null);
    byId('hearing-test-results').hidden = false;
  }

  function renderResults(currentResults, previousTest) {
    const messages = [];
    const notDetected = notDetectedResults(currentResults);
    if (notDetected.length > 0) {
      const list = notDetected.map((r) => `${frequencyLabel(r.frequencyHz)} (${r.ear})`).join(', ');
      messages.push(
        `Didn't detect ${list} even at this device's maximum volume — the most notable result here, worth a real hearing check regardless of anything else on this page.`
      );
    }
    const elevated = flagElevatedThresholds(currentResults);
    if (elevated.length > 0) {
      messages.push(`${elevated.map(frequencyLabel).join(', ')} needed notably more volume than your other frequencies today.`);
    }
    const elevatedFlag = byId('hearing-test-elevated-flag');
    elevatedFlag.hidden = messages.length === 0;
    byId('hearing-test-elevated-text').textContent = messages.join(' ');

    const changeFlag = byId('hearing-test-change-flag');
    changeFlag.hidden = true;
    if (previousTest) {
      const changes = compareThresholdChange(previousTest.results, currentResults);
      if (changes.length > 0) {
        const worst = changes[0];
        byId('hearing-test-change-text').textContent =
          `Your ${worst.ear} ear needed meaningfully more volume at ${frequencyLabel(worst.frequencyHz)} than your last test — real change over time is worth a real follow-up, more than any single test's own numbers.`;
        changeFlag.hidden = false;
      }
    }

    renderEarChart('left', currentResults);
    renderEarChart('right', currentResults);
  }

  function renderEarChart(ear, allResults) {
    const earResults = [...allResults].filter((r) => r.ear === ear).sort((a, b) => a.frequencyHz - b.frequencyHz);
    renderTrendChart(byId(`hearing-test-chart-${ear}`), {
      points: earResults.map((r) => ({
        key: String(r.frequencyHz),
        value: r.thresholdGain ?? 1,
        axisLabel: r.frequencyHz >= 1000 ? `${r.frequencyHz / 1000}k` : String(r.frequencyHz),
        highlighted: r.thresholdGain == null,
        tooltipValue: r.thresholdGain == null ? 'Not detected' : `Needed ${Math.round(r.thresholdGain * 100)}% volume`,
        tooltipDetail: `${r.frequencyHz} Hz`,
      })),
      accentVar: '--hearing-accent',
      emptyMessage: 'No results for this ear.',
    });
  }
}
