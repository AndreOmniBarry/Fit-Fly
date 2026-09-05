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

test.describe('hydration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAppDb(page);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.getByRole('button', { name: 'Skip for now' }).click();
    await page.getByRole('button', { name: 'Hydration' }).click();
  });

  test('shows the screen with zero console errors, starting empty', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    await expect(page.getByRole('heading', { name: 'Stay hydrated' })).toBeVisible();
    await expect(page.locator('#hydration-today-ml')).toHaveText('0');
    await expect(page.locator('#hydration-goal-label')).toHaveText('of 2,200ml goal');
    await expect(page.locator('#hydration-history-list')).toContainText('No drinks logged yet today');

    const height = await page.locator('#hydration-water-fill').getAttribute('height');
    expect(parseFloat(height)).toBe(0); // honestly empty — no water logged yet

    expect(consoleErrors).toEqual([]);
  });

  test('a quick-log tap adds a real serving and fills the figure', async ({ page }) => {
    await page.locator('.hydration-quick-log-btn[data-ml="500"]').click();

    await expect(page.locator('#hydration-today-ml')).toHaveText('500', { timeout: 3000 });
    const entry = page.locator('#hydration-history-list .hydration-card').first();
    await expect(entry).toContainText('500ml');

    const height = await page.locator('#hydration-water-fill').getAttribute('height');
    expect(parseFloat(height)).toBeGreaterThan(0); // real progress drawn in, not decorative
  });

  test('multiple entries in one day sum into the running total', async ({ page }) => {
    await page.locator('.hydration-quick-log-btn[data-ml="250"]').click();
    await expect(page.locator('#hydration-today-ml')).toHaveText('250', { timeout: 3000 });

    await page.locator('.hydration-quick-log-btn[data-ml="500"]').click();
    await expect(page.locator('#hydration-today-ml')).toHaveText('750', { timeout: 3000 });

    await expect(page.locator('#hydration-history-list .hydration-card')).toHaveCount(2);
  });

  test('a custom amount is validated before logging', async ({ page }) => {
    await page.locator('#hydration-custom-ml').fill('0');
    await page.locator('#btn-hydration-custom-save').click();
    await expect(page.locator('#err-hydration-custom')).toBeVisible();

    await page.locator('#hydration-custom-ml').fill('9000');
    await page.locator('#btn-hydration-custom-save').click();
    await expect(page.locator('#err-hydration-custom')).toBeVisible();
    await expect(page.locator('#hydration-history-list')).toContainText('No drinks logged yet today');

    await page.locator('#hydration-custom-ml').fill('330');
    await page.locator('#btn-hydration-custom-save').click();
    await expect(page.locator('#hydration-today-ml')).toHaveText('330', { timeout: 3000 });
  });

  test('logging a day updates the streak and 7-day average', async ({ page }) => {
    await expect(page.locator('#hydration-stat-streak')).toHaveText('0');

    await page.locator('.hydration-quick-log-btn[data-ml="750"]').click();

    await expect(page.locator('#hydration-stat-streak')).toHaveText('1', { timeout: 3000 });
    await expect(page.locator('#hydration-stat-avg')).toHaveText('750', { timeout: 3000 });
  });

  test('setting a custom daily goal updates the label and re-scales the fill', async ({ page }) => {
    await page.locator('.hydration-quick-log-btn[data-ml="500"]').click();
    await expect(page.locator('#hydration-today-ml')).toHaveText('500', { timeout: 3000 });
    const heightBefore = await page.locator('#hydration-water-fill').getAttribute('height');

    await page.locator('#hydration-goal-input').fill('1000');
    await page.locator('#btn-hydration-goal-save').click();
    await expect(page.locator('#hydration-goal-label')).toHaveText('of 1,000ml goal');

    const heightAfter = await page.locator('#hydration-water-fill').getAttribute('height');
    expect(parseFloat(heightAfter)).toBeGreaterThan(parseFloat(heightBefore)); // same 500ml is a bigger share of a smaller goal
  });

  test('the reminder interval control is hidden until notifications are enabled', async ({ page }) => {
    await expect(page.locator('#hydration-interval-row')).toBeHidden();
    await expect(page.locator('#hydration-notify-status')).toContainText('Not enabled yet');
  });

  test('the Hub tile updates with a real streak after logging', async ({ page }) => {
    await page.locator('.hydration-quick-log-btn[data-ml="250"]').click();
    await page.locator('#btn-hydration-back').click();

    await expect(page.locator('#hub-hydration-sub')).toHaveText('1-day streak', { timeout: 3000 });
  });

  test('back returns to the Hub', async ({ page }) => {
    await page.locator('#btn-hydration-back').click();
    await expect(page.getByRole('button', { name: 'Sleep' })).toBeVisible();
  });

  test('the trend chart stays in its honest empty state with fewer than 2 days logged', async ({ page }) => {
    await expect(page.locator('#hydration-trend-chart')).toContainText('Log a second day');
    await expect(page.locator('#hydration-best-day-badge')).toBeHidden();

    await page.locator('.hydration-quick-log-btn[data-ml="250"]').click();
    // Still just one real logged day — one bar isn't a trend.
    await expect(page.locator('#hydration-trend-chart')).toContainText('Log a second day');
  });

  test('the trend chart renders a real bar per logged day, tap shows its exact value, and goal-met days are highlighted', async ({ page }) => {
    await page.evaluate(async () => {
      const { addHydrationEntry } = await import('/js/db/repositories/hydration.js');
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      await addHydrationEntry({ amountMl: 800, date: yesterday.toISOString().slice(0, 10) }); // below the default 2,200ml goal
      await addHydrationEntry({ amountMl: 2500, date: today.toISOString().slice(0, 10) }); // above it
    });
    await page.reload();
    await page.getByRole('button', { name: 'Hydration' }).click();

    const bars = page.locator('.trend-chart-bar');
    await expect(bars).toHaveCount(2);
    await expect(bars.nth(0).locator('.trend-chart-bar-fill')).not.toHaveClass(/trend-chart-bar-fill--highlighted/);
    await expect(bars.nth(1).locator('.trend-chart-bar-fill')).toHaveClass(/trend-chart-bar-fill--highlighted/);

    await bars.nth(1).click();
    const tooltip = bars.nth(1).locator('.trend-chart-tooltip');
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText('2,500ml');
    await expect(tooltip).toContainText('Goal met');
  });

  test('the best-day badge reflects a real personal best from the whole history, not just the visible 14-day window', async ({ page }) => {
    await page.evaluate(async () => {
      const { addHydrationEntry } = await import('/js/db/repositories/hydration.js');
      // A genuinely old day, well outside any 14-day window, with the
      // real highest total — the badge must still find it.
      await addHydrationEntry({ amountMl: 4000, date: '2020-01-01' });
      await addHydrationEntry({ amountMl: 500, date: new Date().toISOString().slice(0, 10) });
    });
    await page.reload();
    await page.getByRole('button', { name: 'Hydration' }).click();

    await expect(page.locator('#hydration-best-day-badge')).toBeVisible();
    await expect(page.locator('#hydration-best-day-text')).toContainText('4,000');
  });

  test('the trend range defaults to a real 7-day week, with no "D" chip (today\'s own per-drink log already covers that)', async ({
    page,
  }) => {
    await expect(page.locator('#hydration-trend-range button[data-value="W"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#hydration-trend-range-copy')).toHaveText('Last 7 days.');
    await expect(page.locator('#hydration-trend-range button[data-value="D"]')).toHaveCount(0);
  });

  test('switching the trend range updates the explanatory copy for every real range', async ({ page }) => {
    const ranges = [
      ['M', 'Last 30 days.'],
      ['6M', 'Last 6 months, grouped by week.'],
      ['Y', 'Last 12 months, grouped by month.'],
      ['W', 'Last 7 days.'],
    ];
    for (const [value, copy] of ranges) {
      await page.locator(`#hydration-trend-range button[data-value="${value}"]`).click();
      await expect(page.locator('#hydration-trend-range-copy')).toHaveText(copy);
      await expect(page.locator(`#hydration-trend-range button[data-value="${value}"]`)).toHaveAttribute(
        'aria-pressed',
        'true'
      );
    }
  });

  test('the 6-month and 1-year ranges bucket real daily totals into week/month averages, not raw daily bars', async ({
    page,
  }) => {
    await page.evaluate(async () => {
      const { addHydrationEntry } = await import('/js/db/repositories/hydration.js');
      const today = new Date();
      // Sunday and the following Monday of the same real week, months
      // back — guaranteed to land in one Sunday-start bucket regardless
      // of which weekday "100 days ago" happens to be. A second,
      // separate week (30 days later) gets its own single logged day,
      // so the chart has two real buckets total — a lone averaged
      // bucket would be only one point, and the trend chart's own
      // honest "not enough to show a trend" empty state only ever
      // renders with fewer than two.
      const sunday = new Date(today);
      sunday.setDate(sunday.getDate() - 100);
      sunday.setDate(sunday.getDate() - sunday.getDay());
      const monday = new Date(sunday);
      monday.setDate(sunday.getDate() + 1);
      const otherWeek = new Date(sunday);
      otherWeek.setDate(sunday.getDate() + 30);
      await addHydrationEntry({ amountMl: 1000, date: sunday.toISOString().slice(0, 10) });
      await addHydrationEntry({ amountMl: 2000, date: monday.toISOString().slice(0, 10) });
      await addHydrationEntry({ amountMl: 500, date: otherWeek.toISOString().slice(0, 10) });
    });
    await page.reload();
    await page.getByRole('button', { name: 'Hydration' }).click();

    await page.locator('#hydration-trend-range button[data-value="6M"]').click();
    // The first pair averages (1000 + 2000) / 2 = 1500 into one real
    // week bucket, labeled as a real span.
    const bars = page.locator('#hydration-trend-chart .trend-chart-bar');
    await expect(bars.first()).toBeVisible();
    await expect(bars).toHaveCount(2);
    const labels = await bars.evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')));
    const averagedBarLabel = labels.find((label) => label?.includes('1,500ml/day avg'));
    expect(averagedBarLabel).toContain('Week of');
  });

  test('the screen reacts to tilt, same spatial language as the Hub', async ({ page }) => {
    await page.mouse.move(400, 60);
    await page.waitForTimeout(500);
    const tilt = await page.evaluate(() => {
      const style = getComputedStyle(document.getElementById('screen-hydration'));
      return { rx: style.getPropertyValue('--tilt-rx'), ry: style.getPropertyValue('--tilt-ry') };
    });
    expect(parseFloat(tilt.rx)).not.toBe(0);
    expect(parseFloat(tilt.ry)).not.toBe(0);
  });
});

test.describe('hydration: notifications enabled', () => {
  test.use({ permissions: ['notifications'] });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAppDb(page);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.getByRole('button', { name: 'Skip for now' }).click();
    await page.getByRole('button', { name: 'Hydration' }).click();
  });

  test('shows notifications as already enabled, hides the enable button, and reveals the interval control', async ({
    page,
  }) => {
    await expect(page.locator('#hydration-notify-status')).toContainText('Enabled');
    await expect(page.locator('#btn-hydration-enable-notify')).toBeHidden();
    await expect(page.locator('#hydration-interval-row')).toBeVisible();
  });

  test('the reminder interval persists across a reload', async ({ page }) => {
    await page.locator('#hydration-interval-hours').fill('4');
    await page.locator('#hydration-interval-hours').dispatchEvent('change');
    await page.reload();
    await page.getByRole('button', { name: 'Hydration' }).click();

    await expect(page.locator('#hydration-interval-hours')).toHaveValue('4');
  });

  test('a real reminder fires on load once the interval has passed and today\'s goal is unmet', async ({ page }) => {
    // Force the "last reminder" further back than the interval, so the
    // check-on-open logic is guaranteed to decide a reminder is due —
    // regardless of whatever the app's own check already did on this
    // test's initial load, before the notification proxy existed to
    // observe it. The proxy has to go in via addInitScript, before any
    // page script runs on the reload, same reason goals.spec.js's own
    // reminder test does the same.
    await page.evaluate(() => {
      const old = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
      localStorage.setItem('fitfly:lastHydrationReminderAt', old);
    });

    await page.addInitScript(() => {
      window.__notificationTitle = null;
      const OriginalNotification = window.Notification;
      window.Notification = new Proxy(OriginalNotification, {
        construct(target, args) {
          window.__notificationTitle = args[0];
          return new target(...args);
        },
      });
    });
    await page.reload();
    await page.getByRole('button', { name: 'Hydration' }).click();

    await expect.poll(() => page.evaluate(() => window.__notificationTitle)).toContain('Time for some water');
  });
});
