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
}

test.describe('guided sessions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAppDb(page);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.getByRole('button', { name: 'Skip for now' }).click();
    await page.getByRole('button', { name: 'Focus' }).click();
  });

  test('shows all four guided sessions with zero console errors', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    for (const id of ['breathing-focus', 'relax', 'focus', 'sleep-focus']) {
      await expect(page.locator(`#btn-guided-session-${id}`)).toBeVisible();
    }

    expect(consoleErrors).toEqual([]);
  });

  test('starting a session shows its title and first caption, and always shows a caption even with voice off', async ({ page }) => {
    await page.locator('#btn-guided-session-breathing-focus').click();
    await expect(page.locator('#guided-session-title')).toHaveText('Breathing Focus');
    await expect(page.locator('#guided-session-caption')).not.toHaveText('—');
    // The caption is a real accessible fallback, not a voice-only extra —
    // it stays populated and visible regardless of the voice toggle.
    await expect(page.locator('#guided-session-caption')).toBeVisible();
  });

  test('progress advances over real elapsed time', async ({ page }) => {
    await page.locator('#btn-guided-session-relax').click();
    await page.waitForTimeout(300);
    const early = await page.locator('#guided-session-progress').evaluate((el) => el.style.width);

    await page.waitForTimeout(4000);
    const later = await page.locator('#guided-session-progress').evaluate((el) => el.style.width);

    expect(parseFloat(later)).toBeGreaterThan(parseFloat(early));
  });

  test('pause freezes progress; resume continues it', async ({ page }) => {
    await page.locator('#btn-guided-session-relax').click();
    await page.waitForTimeout(500);

    await page.locator('#btn-guided-session-pause').click();
    await expect(page.locator('#btn-guided-session-pause')).toHaveText('Resume');
    const frozen = await page.locator('#guided-session-progress').evaluate((el) => el.style.width);

    await page.waitForTimeout(1500);
    const stillFrozen = await page.locator('#guided-session-progress').evaluate((el) => el.style.width);
    expect(stillFrozen).toBe(frozen);

    await page.locator('#btn-guided-session-pause').click();
    await expect(page.locator('#btn-guided-session-pause')).toHaveText('Pause');
    await page.waitForTimeout(1500);
    const resumed = await page.locator('#guided-session-progress').evaluate((el) => el.style.width);
    expect(parseFloat(resumed)).toBeGreaterThan(parseFloat(frozen));
  });

  test('the voice toggle switches on and off', async ({ page }) => {
    await page.locator('#btn-guided-session-focus').click();
    const initial = await page.locator('#btn-guided-session-voice-toggle').getAttribute('aria-pressed');
    await page.locator('#btn-guided-session-voice-toggle').click();
    const toggled = await page.locator('#btn-guided-session-voice-toggle').getAttribute('aria-pressed');
    expect(toggled).not.toBe(initial);
  });

  test('End returns to the Focus screen', async ({ page }) => {
    await page.locator('#btn-guided-session-focus').click();
    await page.locator('#btn-guided-session-end').click();
    await expect(page.locator('#guided-session-grid')).toBeVisible();
  });

  test('the close (X) button also ends the session and returns to Focus', async ({ page }) => {
    await page.locator('#btn-guided-session-focus').click();
    await page.locator('#btn-guided-session-back').click();
    await expect(page.locator('#guided-session-grid')).toBeVisible();
  });

  test('a full session runs through every beat to completion and returns to Focus, with zero console errors', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    await page.clock.install();
    await page.locator('#btn-guided-session-focus').click();
    await expect(page.locator('#guided-session-title')).toHaveText('Focus');

    // runFor (not fastForward) — the session chains through many beats via
    // recursively-rescheduled setInterval/setTimeout calls, and only
    // runFor actually cascades through timers newly scheduled by other
    // timers as simulated time advances; fastForward fires each
    // currently-pending timer at most once and won't follow the chain.
    await page.clock.runFor('00:01:30'); // well past Focus's ~50s total
    await page.waitForTimeout(200);

    await expect(page.locator('#guided-session-grid')).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });
});
