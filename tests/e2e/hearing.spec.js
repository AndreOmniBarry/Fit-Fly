import { expect, test } from '@playwright/test';

async function clearAppDb(page) {
  await page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const req = indexedDB.deleteDatabase('fit-fly');
        req.onsuccess = resolve;
        req.onerror = reject;
        req.onblocked = resolve;
      })
  );
  await page.evaluate(() => localStorage.clear());
}

test.describe('hearing health', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAppDb(page);
    await page.reload();
    await page.getByRole('button', { name: 'Skip for now' }).click();
  });

  test('starts honest — no check-ins yet, trend card hidden, real Hub tile default text', async ({ page }) => {
    await expect(page.locator('#hub-hearing-sub')).toHaveText('Check the sound level around you');

    await page.getByRole('button', { name: 'Hearing' }).click();
    await expect(page.getByRole('heading', { name: 'Sound level check-in' })).toBeVisible();
    await expect(page.locator('#hearing-trend-card')).toBeHidden();
    await expect(page.locator('#hearing-history-list')).toContainText('No check-ins yet');
  });

  test('a real check-in runs the full capture pipeline, saves, and updates the Hub tile — with zero console errors', async ({
    page,
  }) => {
    test.setTimeout(30000);
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    await page.getByRole('button', { name: 'Hearing' }).click();
    await page.locator('#btn-hearing-capture-start').click();
    await expect(page.locator('#hearing-progress')).toBeVisible();
    await expect(page.locator('#btn-hearing-capture-start')).toBeDisabled();

    // The fake audio device produces a synthetic, non-silent tone — real
    // signal processing runs against it end to end (getUserMedia ->
    // AnalyserNode -> RMS -> dBFS -> estimated dB), so this always
    // produces a real result, unlike camera-PPG's fake video pattern
    // which can honestly fail to yield a heart rate.
    await expect(page.locator('#btn-hearing-capture-start')).toBeEnabled({ timeout: 15000 });
    await expect(page.locator('#hearing-progress')).toBeHidden();
    await expect(page.locator('#hearing-result')).toBeVisible();
    await expect(page.locator('#hearing-result-db')).toContainText('dB');

    const entry = page.locator('#hearing-history-list .card').first();
    await expect(entry).toContainText('dB');
    await expect(entry.locator('.data-badge.estimated')).toHaveText('estimated');

    await expect(page.locator('#hearing-trend-card')).toBeVisible();
    await expect(page.locator('#hearing-trend-streak')).toHaveText('1');

    await page.locator('#btn-hearing-back').click();
    await expect(page.locator('#hub-hearing-sub')).toHaveText('1-day check-in streak', { timeout: 3000 });

    expect(consoleErrors).toEqual([]);
  });

  test('shows a live in-progress readout during capture, not just a result after 5 seconds', async ({ page }) => {
    test.setTimeout(30000);
    await page.getByRole('button', { name: 'Hearing' }).click();
    await page.locator('#btn-hearing-capture-start').click();
    await expect(page.locator('#hearing-progress')).toBeVisible();
    // The fake audio device's synthetic tone is strong enough that the
    // live readout can update within the very first ~200ms poll — too
    // fast to reliably catch the initial "Listening…" placeholder still
    // showing, so this checks the real thing that matters: a live dB
    // readout appears *during* capture, well before the 5s result.
    await expect(page.locator('#hearing-live-text')).toContainText('dB', { timeout: 3000 });
    await expect(page.locator('#btn-hearing-capture-start')).toBeEnabled({ timeout: 15000 });
  });

  test('reacts to tilt, same spatial language as the rest of the app', async ({ page }) => {
    await page.getByRole('button', { name: 'Hearing' }).click();
    await page.mouse.move(400, 60);
    await page.waitForTimeout(500);
    const tilt = await page.evaluate(() => {
      const style = getComputedStyle(document.getElementById('screen-hearing'));
      return { rx: style.getPropertyValue('--tilt-rx'), ry: style.getPropertyValue('--tilt-ry') };
    });
    expect(parseFloat(tilt.rx)).not.toBe(0);
    expect(parseFloat(tilt.ry)).not.toBe(0);
  });

  test('back returns to the Hub', async ({ page }) => {
    await page.getByRole('button', { name: 'Hearing' }).click();
    await page.locator('#btn-hearing-back').click();
    await expect(page.getByRole('button', { name: 'Hearing' })).toBeVisible();
  });
});
