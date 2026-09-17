import { expect, test } from '@playwright/test';

// Voice guide's default engine is now Piper — a real neural voice,
// vendored into this repo (js/vendor/piper/), not fetched from a CDN —
// with the browser's own built-in Web Speech Synthesis as its silent
// fallback (see voice-guide.ts's own doc comment). This app already
// tried an on-device neural voice once, Kokoro-82M fetched from a CDN,
// and removed it outright after real-device reports of it going silent
// mid-session; this suite exists specifically to exercise the class of
// thing that went unverified back then: that Piper actually produces
// real, playing audio, and that a failure at any point falls back to
// Web Speech instead of ever leaving a session silent.

// The one URL Piper's own vendored library still calls with a
// https://huggingface.co/... address — sw.js intercepts it and answers
// it from the vendored local copy (see sw.js's own comment) — so it
// never reaches the real network. This sandbox's own egress policy
// blocks huggingface.co entirely, which makes this a strong test in
// itself: if the intercept ever stopped working, Piper's init would
// fail for real here (a genuine blocked network call), and every test
// below that depends on Piper actually becoming ready would fail too.
const PIPER_MODEL_PATH = '/diffusionstudio/piper-voices/resolve/main/en/en_US/ljspeech/medium/en_US-ljspeech-medium.onnx';

async function waitForServiceWorkerControl(page) {
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller != null)).toBe(true);
}

test.describe('voice guide: Settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.getByRole('button', { name: 'Skip for now' }).click();
    await page.locator('#btn-hub-settings').click();
  });

  test('the voice guide card offers no picker, just a description and a working preview, with zero console errors', async ({
    page,
  }) => {
    const consoleErrors = [];
    page.on('pageerror', (err) => consoleErrors.push(String(err)));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    // No engine picker, no download progress, no per-voice picker — this
    // app's explicit post-Kokoro design principle still holds even with
    // Piper as the new default.
    await expect(page.locator('#settings-voice-engine')).toHaveCount(0);
    await expect(page.locator('#settings-voice-progress')).toHaveCount(0);
    await expect(page.locator('#settings-voice-kokoro-voice-field')).toHaveCount(0);
    await expect(page.locator('#settings-voice-piper-voice-field')).toHaveCount(0);

    await page.locator('#btn-settings-voice-preview').click();
    await page.waitForTimeout(300); // the very first line always speaks via Web Speech immediately — see voice-guide.ts

    expect(consoleErrors).toEqual([]);
  });
});

test.describe('voice guide: guided sessions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.getByRole('button', { name: 'Skip for now' }).click();
  });

  test('a guided session with voice on plays through with zero console errors, and the only "third-party" URL touched is the one sw.js intercepts and serves locally', async ({
    page,
  }) => {
    const consoleErrors = [];
    const unexpectedThirdPartyRequests = [];
    page.on('pageerror', (err) => consoleErrors.push(String(err)));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('request', (req) => {
      const url = new URL(req.url());
      if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return;
      // These two URLs (the model weights + their sidecar config) are
      // answered entirely by sw.js from a vendored local file — see this
      // file's own top comment for why that's provable in this exact
      // sandbox.
      if (url.hostname === 'huggingface.co' && (url.pathname === PIPER_MODEL_PATH || url.pathname === `${PIPER_MODEL_PATH}.json`)) return;
      unexpectedThirdPartyRequests.push(req.url());
    });

    await page.getByRole('button', { name: 'Focus' }).click();
    await page.getByRole('button', { name: 'Breathing Focus' }).click();
    await expect(page.locator('#guided-session-caption')).not.toHaveText('', { timeout: 3000 });
    await expect(page.locator('#btn-guided-session-voice-toggle')).toHaveAttribute('aria-pressed', 'true');

    await page.locator('#btn-guided-session-end').click();
    await expect(page.locator('#guided-session-grid')).toBeVisible();

    expect(consoleErrors).toEqual([]);
    expect(unexpectedThirdPartyRequests).toEqual([]);
  });

  test('keeps a long guided session past the real Chrome ~15s SpeechSynthesis stall bug (Web Speech fallback path)', async ({
    page,
  }) => {
    // Regression coverage for issues.chromium.org/issues/41294170: a
    // still-open Chromium bug where speechSynthesis.speak() silently
    // stalls after ~15s of continuous speech unless something calls
    // pause()/resume() to keep it alive. Forces the Web Speech path (by
    // never letting Piper report ready) so the keepalive interval's own
    // pause()/resume() calls are directly observable against a fake
    // synth, rather than relying on incidentally reproducing a real
    // 15-second stall or on Piper's own (unrelated) warm-up timing.
    await page.addInitScript(() => {
      window.__speakCalls = 0;
      window.__pauseResumeCalls = 0;
      const fakeSynth = {
        speaking: false,
        pending: false,
        paused: false,
        speak(utterance) {
          window.__speakCalls++;
          this.speaking = true;
          // Never actually resolves on its own — this test only cares
          // whether the keepalive interval calls pause()/resume() while
          // "speaking" stays true, the same shape a real Chrome stall has.
        },
        cancel() {
          this.speaking = false;
        },
        pause() {
          this.paused = true;
          window.__pauseResumeCalls++;
        },
        resume() {
          this.paused = false;
        },
        getVoices: () => [],
        addEventListener() {},
      };
      Object.defineProperty(window, 'speechSynthesis', { value: fakeSynth, configurable: true });
      window.SpeechSynthesisUtterance = function SpeechSynthesisUtterance(text) {
        this.text = text;
      };
    });
    await page.goto('/'); // addInitScript only takes effect on the next navigation
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.getByRole('button', { name: 'Skip for now' }).click();

    await page.clock.install();
    await page.getByRole('button', { name: 'Focus' }).click();
    await page.getByRole('button', { name: 'Breathing Focus' }).click();
    await expect.poll(() => page.evaluate(() => window.__speakCalls)).toBeGreaterThan(0);

    await page.clock.runFor('00:00:31'); // past three real 10s keepalive intervals
    await expect.poll(() => page.evaluate(() => window.__pauseResumeCalls)).toBeGreaterThan(0);

    // Ending the session stops the keepalive too — no calls after that
    // point, not just "eventually stops on its own".
    const callsAtEnd = await page.evaluate(() => window.__pauseResumeCalls);
    await page.locator('#btn-guided-session-end').click();
    await page.clock.runFor('00:00:31');
    expect(await page.evaluate(() => window.__pauseResumeCalls)).toBe(callsAtEnd);
  });

  test('a full guided session runs every beat through to real completion, with zero console errors', async ({ page }) => {
    const consoleErrors = [];
    page.on('pageerror', (err) => consoleErrors.push(String(err)));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.clock.install();
    await page.getByRole('button', { name: 'Focus' }).click(); // Hub -> Focus screen
    await page.locator('#btn-guided-session-focus').click(); // the "Focus" guided session tile
    await expect(page.locator('#guided-session-title')).toHaveText('Focus');

    await page.clock.runFor('00:01:30'); // well past this session's own ~50s total
    await page.waitForTimeout(200);

    await expect(page.locator('#guided-session-grid')).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });

  test('falls back to Web Speech, silently, when Piper is unavailable — a guided session is never left silent', async ({
    page,
  }) => {
    // Simulates "Piper can't load" — e.g. a missing/corrupted vendored
    // file, a real-device WASM quirk this sandbox can't otherwise
    // reproduce — directly at the page's own fetch() call, the one point
    // guaranteed observable regardless of how sw.js's own service-worker
    // -level substitution behaves underneath (Playwright's page.route()
    // cannot reliably intercept a request a Service Worker has already
    // claimed and answered from its own fetch handler — see sw.js's own
    // comment on the huggingface.co intercept for why the real request
    // never even reaches that far). Asserts voice guidance still
    // audibly happens (via Web Speech) rather than the session going
    // quiet.
    await page.addInitScript(() => {
      const realFetch = window.fetch.bind(window);
      window.fetch = (input, init) => {
        const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input);
        if (url.includes('diffusionstudio/piper-voices')) {
          return Promise.reject(new Error('simulated Piper model fetch failure'));
        }
        return realFetch(input, init);
      };
    });

    await page.addInitScript(() => {
      window.__speakCalls = 0;
      const fakeSynth = {
        speaking: false,
        speak() {
          window.__speakCalls++;
          this.speaking = true;
        },
        cancel() {
          this.speaking = false;
        },
        pause() {},
        resume() {},
        getVoices: () => [],
        addEventListener() {},
      };
      Object.defineProperty(window, 'speechSynthesis', { value: fakeSynth, configurable: true });
      window.SpeechSynthesisUtterance = function SpeechSynthesisUtterance(text) {
        this.text = text;
      };
    });
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.getByRole('button', { name: 'Skip for now' }).click();

    await page.getByRole('button', { name: 'Focus' }).click();
    await page.getByRole('button', { name: 'Breathing Focus' }).click();

    // Every beat, including ones after Piper's background load has had
    // time to fail, keeps landing on the Web Speech fallback. Each box-
    // breathing phase is its own several-second beat (see
    // guided-sessions.ts), so the next speak() call — a fresh beat
    // starting, cancelling and replacing whatever the fake synth was
    // "saying" — can take a few seconds to arrive; poll rather than a
    // single fixed wait.
    await expect.poll(() => page.evaluate(() => window.__speakCalls), { timeout: 10_000 }).toBeGreaterThan(0);
    const firstCount = await page.evaluate(() => window.__speakCalls);
    await expect.poll(() => page.evaluate(() => window.__speakCalls), { timeout: 10_000 }).toBeGreaterThan(firstCount);
  });
});

test.describe('voice guide: Piper actually speaks', () => {
  test('Piper loads from the vendored assets and plays real, genuinely-advancing audio through a plain <audio> element', async ({
    page,
  }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.getByRole('button', { name: 'Skip for now' }).click();
    await waitForServiceWorkerControl(page);

    // Instrumented before Piper is ever triggered, so the very first
    // real <audio> element it creates is observed directly — not just
    // inferred from the absence of errors.
    await page.evaluate(() => {
      window.__piperAudio = null;
      window.__piperEvents = [];
      const RealAudio = window.Audio;
      window.Audio = class extends RealAudio {
        constructor(...args) {
          super(...args);
          window.__piperAudio = this;
          this.addEventListener('playing', () => window.__piperEvents.push('playing'));
          this.addEventListener('error', () => window.__piperEvents.push('error'));
          this.addEventListener('ended', () => window.__piperEvents.push('ended'));
        }
      };
    });

    await page.getByRole('button', { name: 'Focus' }).click();
    await page.locator('#btn-guided-session-focus').click(); // "Focus" — 5-4-3-2-1 grounding, several beats long

    // Piper's first-ever load fetches/decodes the whole vendored engine
    // (~99MB) — generous, but this is a one-time cost per browser
    // profile (see piper-tts-web's own OPFS cache).
    await expect.poll(() => page.evaluate(() => window.__piperAudio != null), { timeout: 90_000 }).toBe(true);

    // A real, playing clip: currentTime genuinely advances, and no
    // error event ever fires — exactly the guarantee a hand-rolled
    // AudioContext pipeline couldn't make last time (see
    // piper-voice.ts's own doc comment on why this is a plain
    // HTMLAudioElement instead).
    await expect.poll(() => page.evaluate(() => window.__piperEvents.includes('error'))).toBe(false);
    const t1 = await page.evaluate(() => window.__piperAudio.currentTime);
    await page.waitForTimeout(400);
    const t2 = await page.evaluate(() => window.__piperAudio.currentTime);
    expect(t2).toBeGreaterThan(t1);
    expect(await page.evaluate(() => window.__piperEvents.includes('error'))).toBe(false);

    await page.locator('#btn-guided-session-end').click();
  });
});
