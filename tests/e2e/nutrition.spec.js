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
  await page.locator('#ob-experience button[data-value="advanced"]').click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.locator('#ob-goal button[data-value="build-muscle"]').click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.locator('#ob-has-injury button[data-value="no"]').click();
  await page.getByRole('button', { name: 'See my plan' }).click();
  await page.getByRole('button', { name: 'Continue to Fit Fly' }).click();
}

test.describe('nutrition', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAppDb(page);
    await page.reload();
    await completeOnboarding(page);
    await page.locator('#btn-home-nutrition').click();
  });

  test('shows an estimated calorie range and macro targets derived from the profile', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    await expect(page.getByRole('heading', { name: 'Nutrition' })).toBeVisible();
    await expect(page.locator('#nutrition-calorie-target')).toContainText('kcal');
    await expect(page.locator('#nutrition-calorie-confidence')).toContainText('estimated');
    await expect(page.locator('#nutrition-target-protein')).toContainText('g');

    expect(consoleErrors).toEqual([]);
  });

  test('logging food updates today\'s totals and the entry list', async ({ page }) => {
    await page.locator('#nutrition-name').fill('Chicken and rice');
    await page.locator('#nutrition-calories').fill('550');
    await page.locator('#nutrition-protein').fill('40');
    await page.locator('#nutrition-carbs').fill('60');
    await page.locator('#nutrition-fat').fill('12');
    await page.locator('#btn-nutrition-add').click();

    await expect(page.locator('#nutrition-total-calories')).toHaveText('550');
    await expect(page.locator('#nutrition-total-protein')).toHaveText('40g');
    await expect(page.locator('#nutrition-entry-list .card').first()).toContainText('Chicken and rice');
  });

  test('a food name is rendered as text, not injected as HTML', async ({ page }) => {
    await page.locator('#nutrition-name').fill('<img src=x onerror="window.__xss=true">');
    await page.locator('#nutrition-calories').fill('100');
    await page.locator('#btn-nutrition-add').click();

    await expect(page.locator('#nutrition-entry-list .card').first()).toContainText('<img src=x');
    const xssRan = await page.evaluate(() => window.__xss === true);
    expect(xssRan).toBe(false);
  });

  test('validation blocks adding without a name or calories', async ({ page }) => {
    await page.locator('#btn-nutrition-add').click();
    await expect(page.locator('#err-nutrition-entry')).toBeVisible();
  });

  test('deleting an entry removes it and updates totals', async ({ page }) => {
    await page.locator('#nutrition-name').fill('Snack');
    await page.locator('#nutrition-calories').fill('200');
    await page.locator('#btn-nutrition-add').click();
    await expect(page.locator('#nutrition-total-calories')).toHaveText('200');

    await page.locator('[data-delete-id]').click();
    await expect(page.locator('#nutrition-total-calories')).toHaveText('0');
    await expect(page.locator('#nutrition-entry-list')).toContainText('Nothing logged yet today');
  });

  test('an entry survives reload (persisted, not just in-memory)', async ({ page }) => {
    await page.locator('#nutrition-name').fill('Oatmeal');
    await page.locator('#nutrition-calories').fill('300');
    await page.locator('#btn-nutrition-add').click();

    await page.reload();
    await page.locator('#btn-home-nutrition').click();
    await expect(page.locator('#nutrition-entry-list .card').first()).toContainText('Oatmeal');
  });
});
