import { expect, test } from '@playwright/test';

// Voice guide used to also offer Kokoro-82M, a neural TTS model fetched
// from a CDN on first use, as an opt-in alternate engine. It was removed
// outright (see voice-guide.ts's own doc comment) after staying
// unreliable on real devices for too long — this suite now only covers
// the one remaining engine: the browser's own built-in Web Speech
// Synthesis, always on-device, no network, no download.

test.describe('voice guide: Settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.getByRole('button', { name: 'Skip for now' }).click();
    await page.getByRole('button', { name: 'Settings' }).click();
  });

  test('the voice guide card offers only the built-in voice, with a working preview and zero console errors', async ({
    page,
  }) => {
    const consoleErrors = [];
    page.on('pageerror', (err) => consoleErrors.push(String(err)));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    // No engine picker, no download progress, no per-voice picker — all
    // of that only ever existed for Kokoro.
    await expect(page.locator('#settings-voice-engine')).toHaveCount(0);
    await expect(page.locator('#settings-voice-progress')).toHaveCount(0);
    await expect(page.locator('#settings-voice-kokoro-voice-field')).toHaveCount(0);

    await page.locator('#btn-settings-voice-preview').click();
    await page.waitForTimeout(300);

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

  test('a guided session with voice on plays through on the built-in voice with zero console errors and no third-party network requests', async ({
    page,
  }) => {
    const consoleErrors = [];
    const thirdPartyRequests = [];
    page.on('pageerror', (err) => consoleErrors.push(String(err)));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('request', (req) => {
      const url = new URL(req.url());
      if (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') thirdPartyRequests.push(req.url());
    });

    await page.getByRole('button', { name: 'Focus' }).click();
    await page.getByRole('button', { name: 'Breathing Focus' }).click();
    await expect(page.locator('#guided-session-caption')).not.toHaveText('', { timeout: 3000 });
    await expect(page.locator('#btn-guided-session-voice-toggle')).toHaveAttribute('aria-pressed', 'true');

    await page.locator('#btn-guided-session-end').click();
    await expect(page.locator('#guided-session-grid')).toBeVisible();

    expect(consoleErrors).toEqual([]);
    // The whole point of dropping Kokoro: nothing ever reaches out to a
    // third party for voice guidance anymore.
    expect(thirdPartyRequests).toEqual([]);
  });

  test('keeps a long guided session past the real Chrome ~15s SpeechSynthesis stall bug', async ({ page }) => {
    // Regression coverage for issues.chromium.org/issues/41294170: a
    // still-open Chromium bug where speechSynthesis.speak() silently
    // stalls after ~15s of continuous speech unless something calls
    // pause()/resume() to keep it alive. Installs a minimal fake
    // speechSynthesis (this environment's headless Chromium may have no
    // real voices/timing to trigger the actual bug against) so the
    // keepalive interval's own pause()/resume() calls are directly
    // observable, rather than relying on incidentally reproducing a
    // 15-second stall.
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
});
