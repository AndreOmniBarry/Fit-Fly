import { expect, test } from '@playwright/test';

// Kokoro's real engine and model together are tens of megabytes fetched
// from a third party (see js/features/focus/kokoro-voice.ts's own doc
// comment for why) — genuinely downloading it here would make this suite
// slow and network-dependent, the one thing this app's test discipline
// never accepts. So every test here blocks that traffic outright and
// asserts on the real, honest failure path instead: Settings never
// silently pretends a blocked download succeeded, and the built-in voice
// (which needs no network at all) is what a guided session actually uses
// throughout.
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

test.describe('voice guide: engine settings', () => {
  test.beforeEach(async ({ page }) => {
    await blockKokoroNetwork(page);
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.getByRole('button', { name: 'Skip for now' }).click();
    await page.getByRole('button', { name: 'Settings' }).click();
  });

  test('defaults to the built-in voice, with the natural-voice option offered but off', async ({ page }) => {
    await expect(page.locator('#settings-voice-engine button[data-value="system"]')).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await expect(page.locator('#settings-voice-engine button[data-value="kokoro"]')).toHaveAttribute(
      'aria-pressed',
      'false'
    );
    await expect(page.locator('#btn-settings-voice-remove')).toBeHidden();
    await expect(page.locator('#settings-voice-kokoro-voice-field')).toBeHidden();
  });

  test('a blocked download reports the real failure and reverts to the built-in voice, no crash', async ({
    page,
  }) => {
    const consoleErrors = [];
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    await page.locator('#settings-voice-engine button[data-value="kokoro"]').click();

    await expect(page.locator('#settings-voice-status')).toContainText("Couldn't download", { timeout: 15000 });
    await expect(page.locator('#settings-voice-engine button[data-value="system"]')).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await expect(page.locator('#settings-voice-engine button[data-value="kokoro"]')).toHaveAttribute(
      'aria-pressed',
      'false'
    );
    await expect(page.locator('#settings-voice-progress')).toBeHidden();
    await expect(page.locator('#settings-voice-kokoro-voice-field')).toBeHidden();

    expect(consoleErrors).toEqual([]);
  });

  test('the failed choice never persists — reopening Settings still shows the built-in voice', async ({ page }) => {
    await page.locator('#settings-voice-engine button[data-value="kokoro"]').click();
    await expect(page.locator('#settings-voice-status')).toContainText("Couldn't download", { timeout: 15000 });

    await page.locator('#btn-settings-back').click();
    await page.getByRole('button', { name: 'Settings' }).click();

    await expect(page.locator('#settings-voice-engine button[data-value="system"]')).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  test('previewing the voice speaks with zero console errors, even where speech synthesis is unavailable', async ({
    page,
  }) => {
    const consoleErrors = [];
    page.on('pageerror', (err) => consoleErrors.push(String(err)));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.locator('#btn-settings-voice-preview').click();
    await page.waitForTimeout(300);

    expect(consoleErrors).toEqual([]);
  });
});

test.describe('voice guide: guided sessions keep working on the built-in voice', () => {
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
      if (msg.type() === 'error') consoleErrors.push(msg.text());
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
