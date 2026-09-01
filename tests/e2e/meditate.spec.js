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

test.describe('meditate', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAppDb(page);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.getByRole('button', { name: 'Skip for now' }).click();
    await page.getByRole('button', { name: 'Meditate' }).click();
  });

  test('shows all meditations and breathwork techniques, real icons, zero console errors', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    for (const id of [
      'quiet-mind', 'sadness', 'anger', 'grief', 'change', 'anxiety',
      'self-compassion', 'gratitude', 'resilience', 'quick-reset',
    ]) {
      const tile = page.locator(`#btn-meditate-${id}`);
      await expect(tile).toBeVisible();
      await expect(tile.locator('svg use')).toHaveCount(1);
    }
    for (const id of ['four-seven-eight', 'physiological-sigh']) {
      await expect(page.locator(`#btn-meditate-${id}`)).toBeVisible();
    }

    expect(consoleErrors).toEqual([]);
  });

  test('shows a real streak/minutes card and the crisis-resources note', async ({ page }) => {
    await expect(page.locator('#meditate-stat-streak')).toBeVisible();
    await expect(page.locator('#meditate-stat-minutes')).toBeVisible();
    await expect(page.getByText('988')).toBeVisible();
  });

  test('starting a meditation opens the shared player themed for Meditate, not Focus', async ({ page }) => {
    await page.locator('#btn-meditate-quiet-mind').click();
    await expect(page.locator('#guided-session-title')).toHaveText('A Quiet Mind');
    await expect(page.locator('#screen-guided-session')).toHaveClass(/theme-meditate/);
    await expect(page.locator('#screen-guided-session')).not.toHaveClass(/theme-focus/);
  });

  test('End returns to the Meditate screen, not Focus', async ({ page }) => {
    await page.locator('#btn-meditate-gratitude').click();
    await page.locator('#btn-guided-session-end').click();
    await expect(page.locator('#meditate-meditations-grid')).toBeVisible();
  });

  test('a breathwork technique follows the real pacer, timed to its own beats', async ({ page }) => {
    await page.locator('#btn-meditate-four-seven-eight').click();
    await expect(page.locator('#guided-session-caption')).toHaveText('Breathe in', { timeout: 15_000 });
    // 4-7-8 breathing: the pacer's transition duration must match the real
    // 4-second inhale, not a guessed constant.
    const pacerVar = await page.evaluate(() =>
      getComputedStyle(document.getElementById('guided-session-pacer')).getPropertyValue('--pacer-transition-ms')
    );
    expect(pacerVar.trim()).toBe('4s');
  });

  test('completing a session end-to-end logs it and updates the real streak, with zero console errors', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    await page.clock.install();
    // A Quick Reset genuinely runs under 30s — the fastest real, honest
    // way to exercise a full natural completion (not an early "End").
    await page.locator('#btn-meditate-quick-reset').click();
    await expect(page.locator('#guided-session-title')).toHaveText('A Quick Reset');

    await page.clock.runFor('00:00:35');
    await page.waitForTimeout(200);

    await expect(page.locator('#meditate-meditations-grid')).toBeVisible();
    await expect(page.locator('#meditate-stat-streak')).toHaveText('1', { timeout: 5000 });
    expect(consoleErrors).toEqual([]);
  });

  test('back returns to the Hub', async ({ page }) => {
    await page.locator('#btn-meditate-back').click();
    await expect(page.getByRole('button', { name: 'Sleep' })).toBeVisible();
  });

  test('the screen reacts to tilt, same spatial language as the Hub', async ({ page }) => {
    await page.mouse.move(400, 60);
    await page.waitForTimeout(500);
    const tilt = await page.evaluate(() => {
      const style = getComputedStyle(document.getElementById('screen-meditate'));
      return { rx: style.getPropertyValue('--tilt-rx'), ry: style.getPropertyValue('--tilt-ry') };
    });
    expect(parseFloat(tilt.rx)).not.toBe(0);
    expect(parseFloat(tilt.ry)).not.toBe(0);
  });
});
