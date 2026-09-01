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

async function completeOnboarding(page, { goal = 'build-muscle', hasInjury = false, redFlag } = {}) {
  await page.getByRole('button', { name: 'Get Started' }).click();
  await page.locator('#ob-birthdate').fill('1994-05-20');
  await page.locator('#ob-sex button[data-value="female"]').click();
  await page.locator('#ob-height-cm').fill('168');
  await page.locator('#ob-weight-kg').fill('64');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.locator('#ob-active-days button[data-value="4"]').click();
  await page.locator('#ob-experience button[data-value="advanced"]').click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.locator(`#ob-goal button[data-value="${goal}"]`).click();
  await page.getByRole('button', { name: 'Next' }).click();

  if (redFlag) {
    await page.locator(`#ob-redflags button[data-value="${redFlag}"]`).click();
  }
  if (hasInjury) {
    await page.locator('#ob-has-injury button[data-value="yes"]').click();
    await page.locator('#ob-injury-area').fill(hasInjury);
    await page.locator('#ob-injury-severity button[data-value="1"]').click();
  } else {
    await page.locator('#ob-has-injury button[data-value="no"]').click();
  }
  await page.getByRole('button', { name: 'See my plan' }).click();
  await page.getByRole('button', { name: 'Continue to Fit Fly' }).click();
  await page.getByRole('button', { name: 'Fitness Toolkit' }).click(); // Hub -> Fitness Toolkit, where these tests operate
}

test.describe('my program', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAppDb(page);
    await page.reload();
  });

  test('shows a week label, why-this reasoning, and day cards with exercises', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    await completeOnboarding(page, { goal: 'build-muscle' });
    await page.getByRole('button', { name: 'My Program' }).click();

    await expect(page.getByRole('heading', { name: 'My Program' })).toBeVisible();
    await expect(page.locator('#program-week-number')).toHaveText('1');
    await expect(page.locator('#program-block-label')).toContainText('Block');
    await expect(page.locator('#program-reasoning li').first()).toBeVisible();

    const dayCards = page.locator('#program-days > .card');
    await expect(dayCards).toHaveCount(4); // hypertrophy: upper/lower/upper/lower
    await expect(dayCards.first()).toContainText('sets ×');
    await expect(page.locator('#program-deload-banner')).toBeHidden();

    // the demo SVG loaded into the first exercise's slot
    await expect(dayCards.first().locator('svg').first()).toBeVisible();

    expect(consoleErrors).toEqual([]);
  });

  test('the program is stable across visits (same week, same exercises)', async ({ page }) => {
    await completeOnboarding(page, { goal: 'endurance' });
    await page.getByRole('button', { name: 'My Program' }).click();
    await expect(page.locator('#program-days .card').first()).toBeVisible();
    // Demo SVGs load asynchronously per exercise, and their <title> text
    // counts toward textContent — wait for every one of them, or a visit
    // whose fetches haven't all resolved yet reads as "different" from
    // one where they have. Scoped to just the exercise demo slots, not
    // every svg under #program-days — each day card also carries its own
    // (synchronously-rendered) day-type badge icon.
    const exerciseSlots = page.locator('#program-days [id^="program-svg-"]');
    const exerciseSlotCount = await exerciseSlots.count();
    await expect(exerciseSlots.locator('svg')).toHaveCount(exerciseSlotCount);
    const firstVisitText = await page.locator('#program-days').textContent();

    await page.getByRole('button', { name: 'Back' }).click();
    await page.getByRole('button', { name: 'My Program' }).click();
    await expect(page.locator('#program-days .card').first()).toBeVisible();
    await expect(page.locator('#program-days [id^="program-svg-"] svg')).toHaveCount(exerciseSlotCount);
    const secondVisitText = await page.locator('#program-days').textContent();

    expect(secondVisitText).toBe(firstVisitText);
  });

  test('a flagged injury area routes around exercises that load it', async ({ page }) => {
    await completeOnboarding(page, { goal: 'build-muscle', hasInjury: 'right knee' });
    await page.getByRole('button', { name: 'My Program' }).click();
    await expect(page.locator('#program-days .card').first()).toBeVisible();

    // knee-contraindicated exercises (squat/lunge pattern) must not appear
    const daysText = await page.locator('#program-days').textContent();
    expect(daysText).not.toContain('Bodyweight Squat');
    expect(daysText).not.toContain('Goblet Squat');
    expect(daysText).not.toContain('Bodyweight Lunge');

    await expect(page.locator('#program-reasoning')).toContainText('knee');
  });

  test('a red flag on onboarding still produces a program, in rehab-recuperation', async ({ page }) => {
    await completeOnboarding(page, { goal: 'endurance', redFlag: 'chest-pain-pressure' });
    await page.getByRole('button', { name: 'My Program' }).click();

    const dayCards = page.locator('#program-days > .card');
    await expect(dayCards).toHaveCount(3); // rehab-recuperation: 3 mobility days
    await expect(dayCards.first()).toContainText('Mobility');
  });

  test('every day card includes a warm-up and cooldown', async ({ page }) => {
    await completeOnboarding(page, { goal: 'build-muscle' });
    await page.getByRole('button', { name: 'My Program' }).click();

    const firstCard = page.locator('#program-days > .card').first();
    await expect(firstCard.getByText('Warm-up')).toBeVisible();
    await expect(firstCard.getByText('Cooldown')).toBeVisible();
    await firstCard.getByText('Warm-up').click(); // <details> disclosure
    await expect(firstCard).toContainText('minutes');
  });

  test('logging a set shows an estimated 1RM, updated across every occurrence of that exercise', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    await completeOnboarding(page, { goal: 'build-muscle' });
    await page.getByRole('button', { name: 'My Program' }).click();

    // hypertrophy is an upper/lower split — Dumbbell Bench Press appears
    // on both Day 1 and Day 3, so this also proves the id-collision fix
    // holds. (A bodyweight exercise like push-up has no weight to log,
    // so estimateOneRepMax() correctly declines to estimate anything.)
    const logButtons = page.locator('button[data-log-set][data-exercise-id="dumbbell-bench-press"]');
    await expect(logButtons).toHaveCount(2);

    const firstDayIndex = await logButtons.first().getAttribute('data-day-index');
    await page.locator(`#program-reps-${firstDayIndex}-dumbbell-bench-press`).fill('8');
    await page.locator(`#program-weight-${firstDayIndex}-dumbbell-bench-press`).fill('40');
    await logButtons.first().click();

    const oneRmSpans = page.locator('[data-onerepmax-for="dumbbell-bench-press"]');
    await expect(oneRmSpans.first()).toContainText('Estimated 1RM');
    await expect(oneRmSpans.nth(1)).toContainText('Estimated 1RM'); // the Day 3 occurrence updated too

    expect(consoleErrors).toEqual([]);
  });

  test('reacts to tilt, and every day card carries a real day-type icon', async ({ page }) => {
    await completeOnboarding(page, { goal: 'build-muscle' });
    await page.getByRole('button', { name: 'My Program' }).click();
    await expect(page.locator('#program-days .card').first()).toBeVisible();

    await page.mouse.move(400, 60);
    await page.waitForTimeout(500);
    const tilt = await page.evaluate(() => {
      const style = getComputedStyle(document.getElementById('screen-program'));
      return { rx: style.getPropertyValue('--tilt-rx'), ry: style.getPropertyValue('--tilt-ry') };
    });
    expect(parseFloat(tilt.rx)).not.toBe(0);
    expect(parseFloat(tilt.ry)).not.toBe(0);

    const dayCards = page.locator('#program-days > .card');
    const count = await dayCards.count();
    for (let i = 0; i < count; i++) {
      await expect(dayCards.nth(i).locator('.fitness-row-icon .icon')).toBeVisible();
    }
  });
});
