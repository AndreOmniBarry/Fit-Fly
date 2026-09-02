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

test.describe('steps', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAppDb(page);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.getByRole('button', { name: 'Skip for now' }).click();
    await page.getByRole('button', { name: 'Steps' }).click();
  });

  test('shows the screen with zero console errors, starting at zero', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    await expect(page.getByRole('heading', { name: "Today's steps" })).toBeVisible();
    await expect(page.locator('#steps-today-count')).toHaveText('0');
    await expect(page.locator('#steps-goal-label')).toHaveText('of 7,500 goal');
    await expect(page.locator('#steps-history-list')).toContainText('No days logged yet');

    expect(consoleErrors).toEqual([]);
  });

  test('a manual entry sets today\'s total and draws the goal ring in', async ({ page }) => {
    await page.locator('#steps-manual-count').fill('6234');
    await page.locator('#btn-steps-manual-save').click();

    await expect(page.locator('#steps-today-count')).toHaveText('6234', { timeout: 3000 });
    const entry = page.locator('#steps-history-list .steps-card').first();
    await expect(entry).toContainText('6,234 steps');
    await expect(entry).toContainText('Manual');

    const offset = await page.locator('#steps-goal-ring-fill').getAttribute('stroke-dashoffset');
    expect(parseFloat(offset)).toBeLessThan(540.35); // drawn in from the full-circle default
    expect(parseFloat(offset)).toBeGreaterThan(0); // 6234/7500 is real progress, not a full ring
  });

  test('a second manual entry replaces (not adds to) today\'s total — it is the authoritative count', async ({ page }) => {
    await page.locator('#steps-manual-count').fill('3000');
    await page.locator('#btn-steps-manual-save').click();
    await expect(page.locator('#steps-today-count')).toHaveText('3000', { timeout: 3000 });

    await page.locator('#steps-manual-count').fill('9000');
    await page.locator('#btn-steps-manual-save').click();
    await expect(page.locator('#steps-today-count')).toHaveText('9000', { timeout: 3000 });
  });

  test('manual entry rejects a negative or absurd value', async ({ page }) => {
    await page.locator('#steps-manual-count').fill('-5');
    await page.locator('#btn-steps-manual-save').click();
    await expect(page.locator('#err-steps-manual')).toBeVisible();

    await page.locator('#steps-manual-count').fill('999999');
    await page.locator('#btn-steps-manual-save').click();
    await expect(page.locator('#err-steps-manual')).toBeVisible();
    await expect(page.locator('#steps-history-list')).toContainText('No days logged yet');
  });

  test('logging a day updates the streak and 7-day average', async ({ page }) => {
    await expect(page.locator('#steps-stat-streak')).toHaveText('0');

    await page.locator('#steps-manual-count').fill('8000');
    await page.locator('#btn-steps-manual-save').click();

    await expect(page.locator('#steps-stat-streak')).toHaveText('1', { timeout: 3000 });
    await expect(page.locator('#steps-stat-avg')).toHaveText('8000', { timeout: 3000 });
  });

  test('setting a custom daily goal updates the ring label', async ({ page }) => {
    await page.locator('#steps-goal-input').fill('10000');
    await page.locator('#btn-steps-goal-save').click();
    await expect(page.locator('#steps-goal-label')).toHaveText('of 10,000 goal');
  });

  test('live motion sensing degrades gracefully when unsupported', async ({ page }) => {
    const motionSupported = await page.evaluate(() => 'LinearAccelerationSensor' in window);
    if (motionSupported) {
      await expect(page.locator('#btn-steps-live-toggle')).toBeEnabled();
    } else {
      await expect(page.locator('#steps-live-status')).toContainText("log today's total manually instead");
      await expect(page.locator('#btn-steps-live-toggle')).toBeDisabled();
    }
  });

  test('the Hub tile updates with a real streak after logging', async ({ page }) => {
    await page.locator('#steps-manual-count').fill('5000');
    await page.locator('#btn-steps-manual-save').click();
    await page.locator('#btn-steps-back').click();

    await expect(page.locator('#hub-steps-sub')).toHaveText('1-day streak', { timeout: 3000 });
  });

  test('back returns to the Hub', async ({ page }) => {
    await page.locator('#btn-steps-back').click();
    await expect(page.getByRole('button', { name: 'Sleep' })).toBeVisible();
  });

  test('the screen reacts to tilt, same spatial language as the Hub', async ({ page }) => {
    await page.mouse.move(400, 60);
    await page.waitForTimeout(500);
    const tilt = await page.evaluate(() => {
      const style = getComputedStyle(document.getElementById('screen-steps'));
      return { rx: style.getPropertyValue('--tilt-rx'), ry: style.getPropertyValue('--tilt-ry') };
    });
    expect(parseFloat(tilt.rx)).not.toBe(0);
    expect(parseFloat(tilt.ry)).not.toBe(0);
  });
});
