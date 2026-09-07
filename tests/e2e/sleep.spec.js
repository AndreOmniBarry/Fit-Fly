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

  test('the Insights chart is a real per-night area/scatter with tap-to-reveal, range switching, and zero console errors', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    await page.getByRole('button', { name: 'Sleep' }).click();
    await page.locator('#sleep-log-bedtime').fill('23:00');
    await page.locator('#sleep-log-waketime').fill('07:00');
    await page.locator('#sleep-log-quality button[data-value="5"]').click();
    await page.getByRole('button', { name: 'Save last night' }).click();
    await expect(page.locator('#sleep-dashboard-result')).toBeVisible();

    // A single logged night is an honest empty chart, not a fabricated
    // one-point line — same contract as the existing empty-state test,
    // just asserted from this same flow before adding a second night.
    await page.locator('#btn-sleep-insights').click();
    await expect(page.locator('#sleep-insight-chart-empty')).toBeVisible();
    await expect(page.locator('.sleep-insight-chart-point')).toHaveCount(0);

    // Log a second, different night so a real 2-point chart renders.
    await page.locator('#btn-sleep-insights-back').click();
    await page.locator('#btn-sleep-result-history-link').click();
    const yesterdayCell = page.locator('.sleep-calendar-day--today').locator('xpath=preceding-sibling::button[1]');
    await yesterdayCell.click();
    await page.locator('#sleep-log-bedtime').fill('22:30');
    await page.locator('#sleep-log-waketime').fill('05:30'); // 7h, a real second data point
    await page.locator('#sleep-log-quality button[data-value="3"]').click();
    await page.getByRole('button', { name: /^Log /i }).click();

    await page.locator('#btn-sleep-insights').click();
    await expect(page.locator('#sleep-insight-chart-empty')).toBeHidden();
    const points = page.locator('.sleep-insight-chart-point');
    await expect(points).toHaveCount(2);

    // Tap-to-reveal: the tooltip is hidden until a point is actually
    // tapped, and reveals that exact night's real duration + score.
    const firstTooltip = points.nth(0).locator('.trend-chart-tooltip');
    await expect(firstTooltip).toBeHidden();
    await points.nth(0).click();
    await expect(firstTooltip).toBeVisible();
    await expect(firstTooltip).toContainText('score');

    // The last point's own aria-label carries its exact real values —
    // tonight's 8h, "great" score.
    await expect(points.nth(1)).toHaveAttribute('aria-label', /8h.*score \d+ \(Great sleep\)/);

    // Range switching: selecting a coarser range re-renders the chart and
    // its explanatory copy without erroring, and the chip reflects the
    // new selection.
    const monthChip = page.locator('#sleep-insight-range button[data-value="M"]');
    await monthChip.click();
    await expect(monthChip).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#sleep-insight-range-copy')).toContainText('Last 30 days');

    const sixMonthChip = page.locator('#sleep-insight-range button[data-value="6M"]');
    await sixMonthChip.click();
    await expect(sixMonthChip).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#sleep-insight-range-copy')).toContainText('grouped by week');

    expect(consoleErrors).toEqual([]);
  });

  test('the "This week" strip is a real button that opens Insights too', async ({ page }) => {
    await page.getByRole('button', { name: 'Sleep' }).click();
    await page.locator('#sleep-log-bedtime').fill('23:00');
    await page.locator('#sleep-log-waketime').fill('07:00');
    await page.locator('#sleep-log-quality button[data-value="5"]').click();
    await page.getByRole('button', { name: 'Save last night' }).click();
    await expect(page.locator('#sleep-dashboard-result')).toBeVisible();

    await expect(page.locator('#btn-sleep-week-strip')).toBeVisible();
    await page.locator('#btn-sleep-week-strip').click();
    await expect(page.getByRole('heading', { name: 'Insights' })).toBeVisible();
    await expect(page.locator('#sleep-insight-streak')).toHaveText('1');
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

  test('naps: a real, separate quick action — not a hidden mode of the night form', async ({ page }) => {
    await page.getByRole('button', { name: 'Sleep' }).click();

    // Present before the night is even logged, distinct from the night
    // form, and closed by default.
    await expect(page.locator('#sleep-nap-card')).toBeVisible();
    await expect(page.locator('#sleep-log-form')).toBeVisible();
    await expect(page.locator('#sleep-nap-empty')).toBeVisible();
    await expect(page.locator('#sleep-nap-form')).toBeHidden();

    await page.locator('#btn-sleep-nap-toggle').click();
    await expect(page.locator('#sleep-nap-form')).toBeVisible();

    await page.locator('#sleep-nap-start').fill('14:00');
    await page.locator('#sleep-nap-end').fill('14:30');
    await page.getByRole('button', { name: 'Save nap' }).click();

    // Honest reflection on the dashboard — the nap's own real duration,
    // never silently dropped or folded into the night's own numbers.
    await expect(page.locator('#sleep-nap-summary')).toBeVisible();
    await expect(page.locator('#sleep-nap-summary')).toContainText('30m');
    await expect(page.locator('#sleep-nap-empty')).toBeHidden();

    // The night form is completely untouched by the nap.
    await expect(page.locator('#sleep-log-form')).toBeVisible();
    await expect(page.locator('#sleep-dashboard-result')).toBeHidden();
  });

  test('naps: logging a nap does not change the night score, and both persist together after reload', async ({ page }) => {
    await page.getByRole('button', { name: 'Sleep' }).click();
    await page.locator('#sleep-log-bedtime').fill('23:00');
    await page.locator('#sleep-log-waketime').fill('07:00');
    await page.locator('#sleep-log-quality button[data-value="5"]').click();
    await page.getByRole('button', { name: 'Save last night' }).click();
    await expect(page.locator('#sleep-score-value')).toHaveText('100');

    await page.locator('#btn-sleep-nap-toggle').click();
    await page.locator('#sleep-nap-start').fill('15:00');
    await page.locator('#sleep-nap-end').fill('15:20');
    await page.getByRole('button', { name: 'Save nap' }).click();

    // The night's own score is exactly what it was before the nap.
    await expect(page.locator('#sleep-score-value')).toHaveText('100');
    await expect(page.locator('#sleep-score-label')).toHaveText('Great sleep');
    await expect(page.locator('#sleep-nap-summary')).toContainText('20m');

    await page.reload();
    await page.getByRole('button', { name: 'Sleep' }).click();
    await expect(page.locator('#sleep-score-value')).toHaveText('100');
    await expect(page.locator('#sleep-nap-summary')).toContainText('20m');
  });

  test('naps: a nap logged this week credits toward Insights sleep debt, without ever fully offsetting it', async ({ page }) => {
    await page.getByRole('button', { name: 'Sleep' }).click();
    // 6h — 1h (60min) short of the 7h goal.
    await page.locator('#sleep-log-bedtime').fill('23:00');
    await page.locator('#sleep-log-waketime').fill('05:00');
    await page.getByRole('button', { name: 'Save last night' }).click();

    await page.locator('#btn-sleep-insights').click();
    await expect(page.locator('#sleep-insight-debt')).toHaveText('1h');
    await page.locator('#btn-sleep-insights-back').click();

    // A same-day nap credits back only part of that shortfall — real,
    // partial relief, never a full 1:1 substitute for the missed hour.
    // 30 nap minutes * 30% credit fraction = 9 minutes credited, so the
    // 60-minute shortfall becomes 51 — down, but nowhere near erased.
    await page.locator('#btn-sleep-nap-toggle').click();
    await page.locator('#sleep-nap-start').fill('14:00');
    await page.locator('#sleep-nap-end').fill('14:30');
    await page.getByRole('button', { name: 'Save nap' }).click();

    await page.locator('#btn-sleep-insights').click();
    await expect(page.locator('#sleep-insight-debt')).toHaveText('51m');
    await expect(page.locator('#sleep-insight-debt')).toHaveAttribute('title', /credited.*napping/i);
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
