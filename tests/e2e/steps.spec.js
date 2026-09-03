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

  test('the trend chart stays in its honest empty state with fewer than 2 days logged', async ({ page }) => {
    await expect(page.locator('#steps-trend-chart')).toContainText('Log a second day');
    await expect(page.locator('#steps-best-day-badge')).toBeHidden();

    await page.locator('#steps-manual-count').fill('6234');
    await page.locator('#btn-steps-manual-save').click();
    await expect(page.locator('#steps-today-count')).toHaveText('6234', { timeout: 3000 });
    // Still just one real logged day — one bar isn't a trend.
    await expect(page.locator('#steps-trend-chart')).toContainText('Log a second day');
  });

  test('the trend chart renders a real bar per logged day, tap shows its exact value, and goal-met days are highlighted', async ({ page }) => {
    await page.evaluate(async () => {
      const { setStepsForDate } = await import('/js/db/repositories/steps.js');
      const today = new Date();
      const values = [4000, 9000]; // below goal, then above the default 7,500 goal
      for (let i = 0; i < values.length; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - (values.length - 1 - i));
        await setStepsForDate(values[i], d.toISOString().slice(0, 10));
      }
    });
    await page.locator('#btn-steps-back').click();
    await page.getByRole('button', { name: 'Steps' }).click();

    const bars = page.locator('.trend-chart-bar');
    await expect(bars).toHaveCount(2);
    await expect(bars.nth(0).locator('.trend-chart-bar-fill')).not.toHaveClass(/trend-chart-bar-fill--highlighted/);
    await expect(bars.nth(1).locator('.trend-chart-bar-fill')).toHaveClass(/trend-chart-bar-fill--highlighted/);

    await bars.nth(1).click();
    const tooltip = bars.nth(1).locator('.trend-chart-tooltip');
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText('9,000 steps');
    await expect(tooltip).toContainText('Goal met');
  });

  test('the best-day badge reflects a real personal best from the whole history, not just the visible 14-day window', async ({ page }) => {
    await page.evaluate(async () => {
      const { setStepsForDate } = await import('/js/db/repositories/steps.js');
      // A genuinely old day, well outside any 14-day window, with the
      // real highest count — the badge must still find it.
      await setStepsForDate(20000, '2020-01-01');
      const today = new Date().toISOString().slice(0, 10);
      await setStepsForDate(5000, today);
    });
    await page.locator('#btn-steps-back').click();
    await page.getByRole('button', { name: 'Steps' }).click();

    await expect(page.locator('#steps-best-day-badge')).toBeVisible();
    await expect(page.locator('#steps-best-day-text')).toContainText('20,000');
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

test.describe('steps: native runtime (mocked)', () => {
  // window.androidBridge is what a real Capacitor Android WebView
  // actually injects before any page script runs — undefined in every
  // real browser context today. Mocking it here is the only way to
  // exercise the "wrapped natively" branch without an actual native
  // build. Headless Chromium has no FitFlyStepCounter plugin behind
  // this, so every native call genuinely fails — this is exactly the
  // honest-degradation path (see steps-view.ts's own try/catch around
  // every native call), not a simulation of the real native flow.
  test('honestly degrades instead of throwing when the native plugin itself is unreachable', async ({ page }) => {
    const consoleErrors = [];
    await page.addInitScript(() => {
      window.androidBridge = {};
    });
    await page.goto('/');
    await clearAppDb(page);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    await page.getByRole('button', { name: 'Skip for now' }).click();
    await page.getByRole('button', { name: 'Steps' }).click();

    await expect(page.locator('#steps-background-note-text')).toContainText('keeps counting your real steps even with the screen locked');
    await expect(page.locator('#steps-live-status')).toContainText("Couldn't reach this device's step counter");
    await expect(page.locator('#btn-steps-live-toggle')).toBeDisabled();

    // Manual entry still works — the one honest fallback whatever else
    // fails.
    await page.locator('#steps-manual-count').fill('4200');
    await page.locator('#btn-steps-manual-save').click();
    await expect(page.locator('#steps-today-count')).toHaveText('4200', { timeout: 3000 });

    expect(consoleErrors).toEqual([]);
  });
});
