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
