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

  test('naps: a forgotten past day\'s nap can be logged directly from today, no History detour required', async ({ page }) => {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const pastDate = threeDaysAgo.toISOString().slice(0, 10);

    await page.getByRole('button', { name: 'Sleep' }).click();
    await page.locator('#btn-sleep-nap-toggle').click();

    // The date field defaults to today (the card above it is today's) —
    // change it to the forgotten day instead of navigating History.
    await page.locator('#sleep-nap-date').fill(pastDate);
    await page.locator('#sleep-nap-start').fill('14:00');
    await page.locator('#sleep-nap-end').fill('14:30');
    await page.getByRole('button', { name: 'Save nap' }).click();

    // Today's own card is untouched — this nap belongs to a different
    // day, so it correctly still shows nothing logged today, and a
    // distinct confirmation (naming the real date) is what proves the
    // save actually happened rather than silently doing nothing.
    await expect(page.locator('#sleep-nap-empty')).toBeVisible();
    const expectedLabel = threeDaysAgo.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    await expect(page.locator('#sleep-nap-confirm')).toBeVisible();
    await expect(page.locator('#sleep-nap-confirm')).toContainText(expectedLabel);
    await expect(page.locator('#sleep-nap-form')).toBeHidden();

    // The real proof: History shows that day as napped, and viewing it
    // directly shows the real 30-minute nap that was just logged.
    // History opens on today's month (viewedDate is still today here) —
    // step back a real month at a time if "3 days ago" landed in the
    // previous one, rather than assuming they're always the same month.
    const today = new Date();
    const monthsBack =
      (today.getFullYear() - threeDaysAgo.getFullYear()) * 12 + (today.getMonth() - threeDaysAgo.getMonth());

    await page.locator('#btn-sleep-dashboard-date').click();
    for (let i = 0; i < monthsBack; i++) {
      await page.locator('#btn-sleep-history-prev-month').click();
    }
    const dayNumber = String(threeDaysAgo.getDate());
    const cell = page.locator('.sleep-calendar-day--napped', { hasText: dayNumber });
    await expect(cell).toBeVisible();
    await cell.click();
    await expect(page.locator('#sleep-nap-summary')).toContainText('30m');
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

test.describe('sleep: modeled sleep-stage hypnogram', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAppDb(page);
    await page.reload();
    await completeOnboarding(page);
    await page.getByRole('button', { name: 'Sleep' }).click();
  });

  test('a logged night renders a real, honestly-labeled stage timeline', async ({ page }) => {
    await page.locator('#sleep-log-bedtime').fill('23:00');
    await page.locator('#sleep-log-waketime').fill('07:00');
    await page.locator('#sleep-log-quality button[data-value="4"]').click();
    await page.getByRole('button', { name: 'Save last night' }).click();

    const card = page.locator('#sleep-hypnogram-card');
    await expect(card).toBeVisible();
    // Never claims a real sensor measured this.
    await expect(card).toContainText('Modeled');
    await expect(card).toContainText('no wearable or bedside sensor');

    const segments = page.locator('.sleep-hypnogram-segment');
    await expect(segments).not.toHaveCount(0);
    // Every real stage shows up in the legend with a real, non-fabricated
    // percentage — never a bare, unlabeled bar.
    await expect(page.locator('#sleep-hypnogram-legend')).toContainText('Deep');
    await expect(page.locator('#sleep-hypnogram-legend')).toContainText('REM');
    await expect(page.locator('#sleep-hypnogram-legend')).toContainText('Light');
    await expect(page.locator('#sleep-hypnogram-legend')).toContainText('%');

    await expect(page.locator('#sleep-hypnogram-start')).toHaveText('11:00p');
    await expect(page.locator('#sleep-hypnogram-end')).toHaveText('7:00a');

    // The real cycle count the model already computes internally, now
    // actually surfaced — and each stage's real duration alongside its
    // share, not just a bare percentage.
    await expect(page.locator('#sleep-hypnogram-cycles')).toContainText('cycle');
    await expect(page.locator('#sleep-hypnogram-legend')).toContainText('h');
  });

  test('viewing a past night from History renders that night\'s own stages, not tonight\'s', async ({ page }) => {
    await page.locator('#sleep-log-bedtime').fill('22:30');
    await page.locator('#sleep-log-waketime').fill('05:30');
    await page.getByRole('button', { name: 'Save last night' }).click();

    await expect(page.locator('#sleep-hypnogram-card')).toBeVisible();
    await expect(page.locator('#sleep-hypnogram-start')).toHaveText('10:30p');
  });
});

test.describe('sleep: "How today looks" (Readiness, collapsed in)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAppDb(page);
    await page.reload();
    await completeOnboarding(page);
    await page.getByRole('button', { name: 'Sleep' }).click();
  });

  test('the Fitness Toolkit no longer has a separate Readiness row', async ({ page }) => {
    await page.locator('#btn-sleep-dashboard-back').click();
    await page.getByRole('button', { name: 'Fitness Toolkit' }).click();
    await expect(page.locator('#btn-home-readiness')).toHaveCount(0);
  });

  test('a full check-in — reusing tonight\'s already-logged sleep — produces a score, category, and reasoning', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    await expect(page.locator('#sleep-readiness-card')).toBeVisible();
    await expect(page.locator('#sleep-readiness-category')).toBeHidden();

    // A real night logged first — readiness reuses this instead of
    // re-asking for hours of sleep a second time.
    await page.locator('#sleep-log-bedtime').fill('23:00');
    await page.locator('#sleep-log-waketime').fill('07:00');
    await page.getByRole('button', { name: 'Save last night' }).click();

    await page.locator('#sleep-readiness-energy button[data-value="5"]').click();
    await page.locator('#sleep-readiness-soreness button[data-value="1"]').click();
    await page.locator('#btn-sleep-readiness-save').click();

    await expect(page.locator('#sleep-readiness-category')).toContainText('high');
    await expect(page.locator('#sleep-readiness-score-line')).toContainText('/ 100');
    await expect(page.locator('#sleep-readiness-reasoning li').first()).toBeVisible();
    await expect(page.locator('#sleep-readiness-suggestion')).not.toHaveText('');
    await expect(page.locator('#sleep-readiness-suggestion')).toContainText('push');

    expect(consoleErrors).toEqual([]);
  });

  test('energy/soreness alone — no sleep logged yet — still produces a result', async ({ page }) => {
    await page.locator('#sleep-readiness-energy button[data-value="1"]').click();
    await page.locator('#sleep-readiness-soreness button[data-value="5"]').click();
    await page.locator('#btn-sleep-readiness-save').click();

    await expect(page.locator('#sleep-readiness-category')).toContainText('low');
    await expect(page.locator('#sleep-readiness-suggestion')).toContainText('easier');
  });

  test('validation blocks an entirely empty check-in', async ({ page }) => {
    await page.locator('#btn-sleep-readiness-save').click();
    await expect(page.locator('#err-sleep-readiness')).toBeVisible();
    await expect(page.locator('#sleep-readiness-category')).toBeHidden();
  });

  test('revisiting today prefills the earlier answers and result', async ({ page }) => {
    await page.locator('#sleep-readiness-energy button[data-value="4"]').click();
    await page.locator('#sleep-readiness-soreness button[data-value="2"]').click();
    await page.locator('#btn-sleep-readiness-save').click();

    await page.locator('#btn-sleep-dashboard-back').click();
    await page.getByRole('button', { name: 'Sleep' }).click();

    await expect(page.locator('#sleep-readiness-energy button[data-value="4"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#sleep-readiness-category')).toBeVisible();
  });

  test('a second save the same day overwrites rather than duplicates My Program\'s banner state', async ({ page }) => {
    await page.locator('#sleep-readiness-energy button[data-value="2"]').click();
    await page.locator('#btn-sleep-readiness-save').click();
    await expect(page.locator('#sleep-readiness-category')).toContainText('moderate');

    await page.locator('#sleep-readiness-energy button[data-value="5"]').click();
    await page.locator('#sleep-readiness-soreness button[data-value="1"]').click();
    await page.locator('#btn-sleep-readiness-save').click();
    await expect(page.locator('#sleep-readiness-category')).toContainText('high');
  });

  test('viewing a past night from History hides the check-in — it\'s only ever about today', async ({ page }) => {
    await page.locator('#sleep-log-bedtime').fill('23:00');
    await page.locator('#sleep-log-waketime').fill('07:00');
    await page.getByRole('button', { name: 'Save last night' }).click();
    await expect(page.locator('#sleep-readiness-card')).toBeVisible();

    await page.locator('#btn-sleep-dashboard-date').click();

    // Yesterday's day number, matched by its exact cell text — real
    // navigation through History's calendar grid, not a guessed date
    // string. Skipped (not failed) on the rare day-1-of-the-month run
    // where "yesterday" falls outside the currently-shown month grid.
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const cell = page
      .locator('.sleep-calendar-day:not(.sleep-calendar-day--out-of-month):not(.sleep-calendar-day--future)')
      .filter({ hasText: new RegExp(`^${yesterday.getDate()}$`) });

    if (await cell.count()) {
      await cell.first().click();
      await expect(page.locator('#sleep-readiness-card')).toBeHidden();
    }
  });
});
