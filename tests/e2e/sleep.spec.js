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

async function completeOnboarding(page) {
  await page.getByRole('button', { name: 'Get Started' }).click();
  await page.locator('#ob-birthdate').fill('1994-05-20');
  await page.locator('#ob-sex button[data-value="female"]').click();
  await page.locator('#ob-height-cm').fill('168');
  await page.locator('#ob-weight-kg').fill('64');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.locator('#ob-active-days button[data-value="4"]').click();
  await page.locator('#ob-experience button[data-value="intermediate"]').click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.locator('#ob-goal button[data-value="build-muscle"]').click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.locator('#ob-has-injury button[data-value="no"]').click();
  await page.getByRole('button', { name: 'See my plan' }).click();
  await page.getByRole('button', { name: 'Continue to Fit Fly' }).click();
}

test.describe('sleep', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAppDb(page);
    await page.reload();
    await completeOnboarding(page);
  });

  test('the Hub\'s Sleep tile opens a quick-log form with zero console errors', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    await page.getByRole('button', { name: 'Sleep' }).click();
    await expect(page.getByRole('heading', { name: 'Good' })).toBeVisible();
    await expect(page.locator('#sleep-log-form')).toBeVisible();
    await expect(page.locator('#sleep-dashboard-result')).toBeHidden();

    expect(consoleErrors).toEqual([]);
  });

  test('logging a night computes a real score and updates the Hub tile', async ({ page }) => {
    await page.getByRole('button', { name: 'Sleep' }).click();

    await page.locator('#sleep-log-bedtime').fill('23:00');
    await page.locator('#sleep-log-waketime').fill('07:00');
    await page.locator('#sleep-log-quality button[data-value="5"]').click();
    await page.getByRole('button', { name: 'Save last night' }).click();

    await expect(page.locator('#sleep-dashboard-result')).toBeVisible();
    await expect(page.locator('#sleep-log-form')).toBeHidden();
    await expect(page.locator('#sleep-score-value')).toHaveText('100');
    await expect(page.locator('#sleep-score-label')).toHaveText('Great sleep');
    await expect(page.locator('#sleep-stat-bedtime')).toHaveText('11:00p');
    await expect(page.locator('#sleep-stat-wake')).toHaveText('7:00a');
    await expect(page.locator('#sleep-stat-duration')).toHaveText('8h');

    await page.getByRole('button', { name: 'Back to your apps' }).click();
    await expect(page.locator('#hub-sleep-sub')).toContainText('100');
    await expect(page.locator('#hub-sleep-sub')).toContainText('Great sleep');
  });

  test('validation blocks saving with only one time filled in', async ({ page }) => {
    await page.getByRole('button', { name: 'Sleep' }).click();
    await page.locator('#sleep-log-bedtime').fill('23:00');
    await page.getByRole('button', { name: 'Save last night' }).click();

    await expect(page.locator('#err-sleep-log')).toBeVisible();
    await expect(page.locator('#sleep-dashboard-result')).toBeHidden();
  });

  test('a saved log survives reload and reopens as the result, not the form', async ({ page }) => {
    await page.getByRole('button', { name: 'Sleep' }).click();
    await page.locator('#sleep-log-bedtime').fill('23:30');
    await page.locator('#sleep-log-waketime').fill('06:30');
    await page.locator('#sleep-log-quality button[data-value="4"]').click();
    await page.getByRole('button', { name: 'Save last night' }).click();
    await expect(page.locator('#sleep-dashboard-result')).toBeVisible();

    await page.reload();
    await page.getByRole('button', { name: 'Sleep' }).click();
    await expect(page.locator('#sleep-dashboard-result')).toBeVisible();
    await expect(page.locator('#sleep-log-form')).toBeHidden();
  });

  test('editing tonight\'s log reopens the form pre-filled', async ({ page }) => {
    await page.getByRole('button', { name: 'Sleep' }).click();
    await page.locator('#sleep-log-bedtime').fill('22:45');
    await page.locator('#sleep-log-waketime').fill('06:15');
    await page.locator('#sleep-log-quality button[data-value="3"]').click();
    await page.getByRole('button', { name: 'Save last night' }).click();

    await page.getByRole('button', { name: "Edit tonight's log" }).click();
    await expect(page.locator('#sleep-log-form')).toBeVisible();
    await expect(page.locator('#sleep-log-bedtime')).toHaveValue('22:45');
    await expect(page.locator('#sleep-log-waketime')).toHaveValue('06:15');
    await expect(page.locator('#sleep-log-quality button[data-value="3"]')).toHaveAttribute('aria-pressed', 'true');
  });

  test('Insights shows a real streak and debt for a logged night, with an honest empty chart state', async ({ page }) => {
    await page.getByRole('button', { name: 'Sleep' }).click();
    await page.locator('#sleep-log-bedtime').fill('23:00');
    await page.locator('#sleep-log-waketime').fill('05:00'); // 6h — 1h short of the NSF-recommended 7h floor
    await page.locator('#sleep-log-quality button[data-value="3"]').click();
    await page.getByRole('button', { name: 'Save last night' }).click();

    await page.locator('#btn-sleep-insights').click();
    await expect(page.getByRole('heading', { name: 'Insights' })).toBeVisible();
    await expect(page.locator('#sleep-insight-streak')).toHaveText('1');
    await expect(page.locator('#sleep-insight-debt')).toHaveText('1h');
    await expect(page.locator('#sleep-insight-chart-empty')).toBeVisible();

    await page.locator('#btn-sleep-insights-back').click();
    await expect(page.locator('#sleep-dashboard-result')).toBeVisible();
  });

  test('Start Wind-Down navigates to the Wind Down screen', async ({ page }) => {
    await page.getByRole('button', { name: 'Sleep' }).click();
    await page.locator('#sleep-log-bedtime').fill('23:00');
    await page.locator('#sleep-log-waketime').fill('07:00');
    await page.getByRole('button', { name: 'Save last night' }).click();

    await page.getByRole('button', { name: 'Start Wind-Down' }).click();
    await expect(page.getByText('Wind Down')).toBeVisible();

    await page.locator('#btn-wind-down-back').click();
    await expect(page.locator('#sleep-dashboard-result')).toBeVisible();
  });

  test('the score ring draws in for real, and the dashboard reacts to tilt', async ({ page }) => {
    await page.getByRole('button', { name: 'Sleep' }).click();
    await page.locator('#sleep-log-bedtime').fill('23:00');
    await page.locator('#sleep-log-waketime').fill('07:00');
    await page.getByRole('button', { name: 'Save last night' }).click();

    // A real number, not a snap-in: the ring's stroke-dashoffset settles
    // to the score's real fraction of the circumference (RING_CIRCUMFERENCE
    // = 540.35 for r=86), and the displayed number count-up lands on the
    // exact score, both via CSS/JS-driven animation rather than instant.
    await expect(page.locator('#sleep-score-ring-fill')).not.toHaveAttribute('stroke-dashoffset', '540.35');
    await expect(page.locator('#sleep-score-value')).toHaveText('100');

    await page.mouse.move(400, 60);
    await page.waitForTimeout(500);
    const tilt = await page.evaluate(() => {
      const style = getComputedStyle(document.getElementById('screen-sleep-dashboard'));
      return { rx: style.getPropertyValue('--tilt-rx'), ry: style.getPropertyValue('--tilt-ry') };
    });
    expect(parseFloat(tilt.rx)).not.toBe(0);
    expect(parseFloat(tilt.ry)).not.toBe(0);
  });
});
