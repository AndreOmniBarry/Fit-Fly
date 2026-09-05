import { expect, test } from '@playwright/test';

// Kokoro's real engine and model together are tens of megabytes fetched
// from a third party (see js/features/focus/kokoro-voice.ts's own doc
// comment for why) — genuinely downloading it here would make this suite
// slow and network-dependent, the one thing this app's test discipline
// never accepts. So every test here blocks that traffic outright and
// asserts on the real, honest failure/fallback path instead: Kokoro is
// this app's default voice engine, so every guided-session speak() call
// (including the very first beat, launched synchronously from a tile
// click) fires off a background download attempt that this suite always
// forces to fail — the built-in voice is what actually narrates
// throughout, and Settings never pretends a blocked download succeeded.
//
// One real gap this leaves: the per-voice picker (#settings-voice-
// kokoro-voice) only ever appears once Kokoro has actually finished
// loading, which — by design — never happens in this suite. Its own
// gating logic (hidden until getVoiceEngine()==='kokoro' && isKokoroReady())
// is exercised below; the picker's own click-to-select behavior isn't,
// for the same reason a genuine download isn't exercised here either.
async function blockKokoroNetwork(page) {
  await page.route('https://cdn.jsdelivr.net/**', (route) => route.abort());
  await page.route('https://huggingface.co/**', (route) => route.abort());
}

// route.abort() on those requests still makes Chromium itself log a real
// "Failed to load resource" console entry — a genuine browser artifact of
// deliberately blocking that traffic, not an app bug, so it's filtered
// out of every "zero console errors" assertion below rather than either
// masking real errors by skipping the check, or fighting an unwinnable
// battle to stop the browser logging a failed network request.
function isExpectedKokoroNetworkNoise(text) {
  return text.includes('Failed to load resource');
}

test.describe('voice guide: engine settings', () => {
  test.beforeEach(async ({ page }) => {
    await blockKokoroNetwork(page);
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.getByRole('button', { name: 'Skip for now' }).click();
    await page.getByRole('button', { name: 'Settings' }).click();
  });

  test('defaults to the natural voice, with no download started just from opening Settings', async ({ page }) => {
    await expect(page.locator('#settings-voice-engine button[data-value="kokoro"]')).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await expect(page.locator('#settings-voice-engine button[data-value="system"]')).toHaveAttribute(
      'aria-pressed',
      'false'
    );
    await expect(page.locator('#settings-voice-status')).toContainText('Starts automatically');
    await expect(page.locator('#settings-voice-progress')).toBeHidden();
    await expect(page.locator('#btn-settings-voice-remove')).toBeHidden();
    await expect(page.locator('#settings-voice-kokoro-voice-field')).toBeHidden();
  });

  test('switching to the built-in voice needs no network and persists', async ({ page }) => {
    await page.locator('#settings-voice-engine button[data-value="system"]').click();
    await expect(page.locator('#settings-voice-engine button[data-value="system"]')).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await expect(page.locator('#settings-voice-status')).toHaveText('');

    await page.locator('#btn-settings-back').click();
    await page.getByRole('button', { name: 'Settings' }).click();
    await expect(page.locator('#settings-voice-engine button[data-value="system"]')).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  test('explicitly retrying the download reports the real failure, no crash — and never silently reverts the choice', async ({
    page,
  }) => {
    const consoleErrors = [];
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    await page.locator('#settings-voice-engine button[data-value="kokoro"]').click();

    await expect(page.locator('#settings-voice-status')).toContainText("Couldn't download", { timeout: 15000 });
    // Still the standing choice — a failed attempt is an honest status,
    // never a silent downgrade back to the built-in voice.
    await expect(page.locator('#settings-voice-engine button[data-value="kokoro"]')).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await expect(page.locator('#settings-voice-progress')).toBeHidden();
    await expect(page.locator('#settings-voice-kokoro-voice-field')).toBeHidden();

    expect(consoleErrors).toEqual([]);
  });

  test('a failure this session is remembered — reopening Settings reports it rather than silently retrying', async ({
    page,
  }) => {
    await page.locator('#settings-voice-engine button[data-value="kokoro"]').click();
    await expect(page.locator('#settings-voice-status')).toContainText("Couldn't download", { timeout: 15000 });

    await page.locator('#btn-settings-back').click();
    await page.getByRole('button', { name: 'Settings' }).click();

    await expect(page.locator('#settings-voice-engine button[data-value="kokoro"]')).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await expect(page.locator('#settings-voice-status')).toContainText("Couldn't load your natural voice last time");
  });

  test('previewing the voice speaks with zero console errors, even mid an in-progress download attempt', async ({
    page,
  }) => {
    const consoleErrors = [];
    page.on('pageerror', (err) => consoleErrors.push(String(err)));
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !isExpectedKokoroNetworkNoise(msg.text())) consoleErrors.push(msg.text());
    });

    await page.locator('#btn-settings-voice-preview').click();
    await page.waitForTimeout(300);

    expect(consoleErrors).toEqual([]);
  });
});

test.describe('voice guide: guided sessions keep working while Kokoro downloads/fails in the background', () => {
  test.beforeEach(async ({ page }) => {
    await blockKokoroNetwork(page);
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.getByRole('button', { name: 'Skip for now' }).click();
  });

  test('a guided session with voice on plays through with zero console errors', async ({ page }) => {
    const consoleErrors = [];
    page.on('pageerror', (err) => consoleErrors.push(String(err)));
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !isExpectedKokoroNetworkNoise(msg.text())) consoleErrors.push(msg.text());
    });

    await page.getByRole('button', { name: 'Focus' }).click();
    await page.getByRole('button', { name: 'Breathing Focus' }).click();
    await expect(page.locator('#guided-session-caption')).not.toHaveText('', { timeout: 3000 });
    await expect(page.locator('#btn-guided-session-voice-toggle')).toHaveAttribute('aria-pressed', 'true');

    await page.locator('#btn-guided-session-end').click();
    await expect(page.locator('#guided-session-grid')).toBeVisible();

    expect(consoleErrors).toEqual([]);
  });
});
