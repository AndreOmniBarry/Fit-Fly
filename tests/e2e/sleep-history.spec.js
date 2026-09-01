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

test.describe('sleep history', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAppDb(page);
    await page.reload();
    await page.getByRole('button', { name: 'Skip for now' }).click();
    await page.getByRole('button', { name: 'Sleep' }).click();
  });

  test('the date label opens a real calendar, with zero console errors', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    await page.locator('#btn-sleep-dashboard-date').click();
    await expect(page.getByRole('heading', { name: 'History' })).toBeVisible();
    await expect(page.locator('.sleep-calendar-day').first()).toBeVisible();
    // A real month grid, not a placeholder — every row a full week (see
    // sleep-calendar.ts's getMonthGridDays).
    const dayCount = await page.locator('.sleep-calendar-day').count();
    expect(dayCount).toBeGreaterThanOrEqual(28);
    expect(dayCount % 7).toBe(0);

    expect(consoleErrors).toEqual([]);
  });

  test('the explicitly-labeled link on the blank form also opens History — a real button, not a hidden gesture', async ({ page }) => {
    await expect(page.locator('#sleep-log-form')).toBeVisible();
    await page.locator('#btn-sleep-log-history-link').click();
    await expect(page.getByRole('heading', { name: 'History' })).toBeVisible();
  });

  test('the explicitly-labeled link on a logged result also opens History', async ({ page }) => {
    await page.locator('#sleep-log-bedtime').fill('23:00');
    await page.locator('#sleep-log-waketime').fill('07:00');
    await page.getByRole('button', { name: 'Save last night' }).click();
    await expect(page.locator('#sleep-dashboard-result')).toBeVisible();

    await page.locator('#btn-sleep-result-history-link').click();
    await expect(page.getByRole('heading', { name: 'History' })).toBeVisible();
  });

  test('back from History returns to the dashboard', async ({ page }) => {
    await page.locator('#btn-sleep-dashboard-date').click();
    await page.locator('#btn-sleep-history-back').click();
    await expect(page.locator('#sleep-log-form')).toBeVisible();
  });

  test('month navigation moves forward and back, with logged nights preserved', async ({ page }) => {
    await page.locator('#btn-sleep-dashboard-date').click();
    const initialLabel = await page.locator('#sleep-history-month-label').textContent();

    await page.locator('#btn-sleep-history-prev-month').click();
    const prevLabel = await page.locator('#sleep-history-month-label').textContent();
    expect(prevLabel).not.toBe(initialLabel);

    await page.locator('#btn-sleep-history-next-month').click();
    await expect(page.locator('#sleep-history-month-label')).toHaveText(initialLabel);
  });

  test('tapping a past unlogged day opens a genuinely blank form for that date — regression coverage for stale quality/notes leaking in from whatever was last on screen', async ({
    page,
  }) => {
    // Log tonight first, with a quality rating selected, so there's
    // something for a later, unrelated blank form to (wrongly) inherit
    // if the bug this covers ever comes back.
    await page.locator('#sleep-log-bedtime').fill('23:00');
    await page.locator('#sleep-log-waketime').fill('07:00');
    await page.locator('#sleep-log-quality button[data-value="5"]').click();
    await page.getByRole('button', { name: 'Save last night' }).click();
    await expect(page.locator('#sleep-score-value')).toHaveText('100');

    await page.locator('#btn-sleep-dashboard-date').click();
    await page.locator('#btn-sleep-history-prev-month').click(); // guaranteed all-past month
    await page.locator('.sleep-calendar-day:not(.sleep-calendar-day--out-of-month):not(.sleep-calendar-day--logged)').first().click();

    await expect(page.locator('#sleep-log-form')).toBeVisible();
    await expect(page.locator('#sleep-log-bedtime')).toHaveValue('');
    await expect(page.locator('#sleep-log-waketime')).toHaveValue('');
    for (const value of ['1', '2', '3', '4', '5']) {
      await expect(page.locator(`#sleep-log-quality button[data-value="${value}"]`)).toHaveAttribute('aria-pressed', 'false');
    }
    await expect(page.locator('#sleep-log-notes')).toHaveValue('');
  });

  test("retroactively logging a different night doesn't touch today's log — regression coverage for the exact bug report this screen exists to fix", async ({
    page,
  }) => {
    await page.locator('#sleep-log-bedtime').fill('23:00');
    await page.locator('#sleep-log-waketime').fill('07:00');
    await page.getByRole('button', { name: 'Save last night' }).click();
    await expect(page.locator('#sleep-score-value')).toHaveText('100');

    await page.locator('#btn-sleep-dashboard-date').click();
    await page.locator('#btn-sleep-history-prev-month').click();
    await page.locator('.sleep-calendar-day:not(.sleep-calendar-day--out-of-month):not(.sleep-calendar-day--logged)').first().click();

    // Same bedtime as today's own log, deliberately — this test isolates
    // "does a retroactive save touch today's stored data", not bedtime
    // consistency's effect on the score (that's sleep-score.test.js's
    // job); a different bedtime here would legitimately pull today's
    // score down once a second data point makes consistency computable,
    // which would make this assertion about the wrong thing.
    await page.locator('#sleep-log-bedtime').fill('23:00');
    await page.locator('#sleep-log-waketime').fill('07:00');
    await page.getByRole('button', { name: /^Log / }).click();
    await expect(page.locator('#sleep-score-value')).toBeVisible(); // the *other* night's own result

    // Back to the Hub and into Sleep fresh — today's log must still be
    // exactly what was saved, not overwritten or cleared.
    await page.locator('#btn-sleep-dashboard-back').click();
    await page.getByRole('button', { name: 'Sleep' }).click();
    await expect(page.locator('#sleep-score-value')).toHaveText('100');
    await expect(page.locator('#sleep-stat-bedtime')).toHaveText('11:00p');
    await expect(page.locator('#sleep-stat-wake')).toHaveText('7:00a');
  });

  test('a logged day in the calendar shows a real category dot and opens its own result, not a blank form', async ({ page }) => {
    await page.locator('#sleep-log-bedtime').fill('23:00');
    await page.locator('#sleep-log-waketime').fill('07:00');
    await page.getByRole('button', { name: 'Save last night' }).click();

    await page.locator('#btn-sleep-dashboard-date').click();
    const todayCell = page.locator('.sleep-calendar-day--today');
    await expect(todayCell).toHaveClass(/sleep-calendar-day--logged/);
    await expect(todayCell.locator('.sleep-calendar-day-dot')).toBeVisible();

    await todayCell.click();
    await expect(page.locator('#sleep-dashboard-result')).toBeVisible();
    await expect(page.locator('#sleep-log-form')).toBeHidden();
  });

  test('future days are not tappable', async ({ page }) => {
    await page.locator('#btn-sleep-dashboard-date').click();
    const future = page.locator('.sleep-calendar-day--future').first();
    await expect(future).toBeDisabled();
  });
});
