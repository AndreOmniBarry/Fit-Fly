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

async function completeOnboarding(page, { goal = 'build-muscle' } = {}) {
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
  await page.locator('#ob-has-injury button[data-value="no"]').click();
  await page.getByRole('button', { name: 'See my plan' }).click();
  await page.getByRole('button', { name: 'Continue to Fit Fly' }).click(); // lands on the Hub
}

test.describe('hub: recommended program card', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAppDb(page);
    await page.reload();
  });

  test('stays hidden until a real program has actually been opened, never a fabricated placeholder', async ({ page }) => {
    await completeOnboarding(page);
    await expect(page.locator('#btn-hub-recommended-program')).toBeHidden();
  });

  test('shows the real category and an honest zero once a program exists, and opens My Program on tap', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    await completeOnboarding(page, { goal: 'build-muscle' });
    await page.getByRole('button', { name: 'Fitness Toolkit' }).click();
    await page.getByRole('button', { name: 'My Program' }).click();
    await expect(page.getByRole('heading', { name: 'My Program' })).toBeVisible();

    await page.locator('#btn-program-back').click();
    await page.locator('#btn-nav-home').click();

    const card = page.locator('#btn-hub-recommended-program');
    await expect(card).toBeVisible();
    await expect(page.locator('#hub-recommended-category')).toHaveText('Hypertrophy');
    await expect(page.locator('#hub-recommended-sub')).toHaveText('0 sessions logged this week');

    await card.click();
    await expect(page.getByRole('heading', { name: 'My Program' })).toBeVisible();

    expect(consoleErrors).toEqual([]);
  });

  test('reflects a real logged session, live, in the singular', async ({ page }) => {
    await completeOnboarding(page, { goal: 'build-muscle' });
    await page.getByRole('button', { name: 'Fitness Toolkit' }).click();
    await page.getByRole('button', { name: 'My Program' }).click();

    const logButton = page.locator('button[data-log-set][data-exercise-id="dumbbell-bench-press"]').first();
    const dayIndex = await logButton.getAttribute('data-day-index');
    await page.locator(`#program-reps-${dayIndex}-dumbbell-bench-press`).fill('8');
    await page.locator(`#program-weight-${dayIndex}-dumbbell-bench-press`).fill('40');
    await logButton.click();

    await page.locator('#btn-program-back').click();
    await page.locator('#btn-nav-home').click();

    await expect(page.locator('#hub-recommended-sub')).toHaveText('1 session logged this week');
  });
});
