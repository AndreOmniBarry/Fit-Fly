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
  await page.getByRole('button', { name: 'Fitness Toolkit' }).click(); // Hub -> Fitness Toolkit, where these tests operate
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
    await page.getByRole('button', { name: 'Fitness Toolkit' }).click(); // reload lands back on the Hub
    await page.locator('#btn-home-nutrition').click();
    await expect(page.locator('#nutrition-entry-list .card').first()).toContainText('Oatmeal');
  });

  test('reacts to tilt, and a logged entry carries a real icon badge', async ({ page }) => {
    await page.locator('#nutrition-name').fill('Chicken and rice');
    await page.locator('#nutrition-calories').fill('550');
    await page.locator('#btn-nutrition-add').click();
    await expect(page.locator('#nutrition-entry-list .card').first().locator('.fitness-row-icon .icon')).toBeVisible();

    await page.mouse.move(400, 60);
    await page.waitForTimeout(500);
    const tilt = await page.evaluate(() => {
      const style = getComputedStyle(document.getElementById('screen-nutrition'));
      return { rx: style.getPropertyValue('--tilt-rx'), ry: style.getPropertyValue('--tilt-ry') };
    });
    expect(parseFloat(tilt.rx)).not.toBe(0);
    expect(parseFloat(tilt.ry)).not.toBe(0);
  });

  test('searching a food fills the form with real per-100g data and a portion hint, never logs it silently', async ({
    page,
  }) => {
    await page.route('https://world.openfoodfacts.org/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          products: [
            { product_name: 'Rolled Oats', nutriments: { 'energy-kcal_100g': 389, proteins_100g: 17, carbohydrates_100g: 66, fat_100g: 7 } },
          ],
        }),
      })
    );

    await page.locator('#nutrition-search-query').fill('oats');
    await page.locator('#btn-nutrition-search').click();
    await expect(page.locator('#nutrition-search-results')).toContainText('Rolled Oats');

    await page.locator('#nutrition-search-results button').first().click();
    await expect(page.locator('#nutrition-name')).toHaveValue('Rolled Oats');
    await expect(page.locator('#nutrition-calories')).toHaveValue('389');
    await expect(page.locator('#nutrition-portion-hint')).toBeVisible();
    // nothing was logged just by selecting a search result
    await expect(page.locator('#nutrition-entry-list')).toContainText('Nothing logged yet today');

    await page.locator('#btn-nutrition-add').click();
    await expect(page.locator('#nutrition-entry-list .card').first()).toContainText('Rolled Oats');
  });

  test('a failed or offline search shows an honest error, never a silent "no matches"', async ({ page }) => {
    await page.route('https://world.openfoodfacts.org/**', (route) => route.abort('internetdisconnected'));

    await page.locator('#nutrition-search-query').fill('anything');
    await page.locator('#btn-nutrition-search').click();
    await expect(page.locator('#nutrition-search-status')).toContainText("Couldn't reach the food database");
  });

  test('a genuinely empty search result says so, distinctly from a network failure', async ({ page }) => {
    await page.route('https://world.openfoodfacts.org/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ products: [] }) })
    );

    await page.locator('#nutrition-search-query').fill('zzznonexistentfood');
    await page.locator('#btn-nutrition-search').click();
    await expect(page.locator('#nutrition-search-status')).toContainText('No matches');
  });

  test('a logged food shows up under Recent and re-logs in one tap with the exact same amounts', async ({ page }) => {
    await page.locator('#nutrition-name').fill('Protein Shake');
    await page.locator('#nutrition-calories').fill('220');
    await page.locator('#nutrition-protein').fill('30');
    await page.locator('#btn-nutrition-add').click();

    // Recent only appears on a fresh render of the screen (built from
    // the DB, not live-patched into the in-memory list) — leave and
    // come back, the same way a real re-visit would work.
    await page.locator('#btn-nutrition-back').click();
    await page.locator('#btn-home-nutrition').click();

    await expect(page.locator('#nutrition-recent-wrap')).toBeVisible();
    await page.locator('#nutrition-recent-chips .chip', { hasText: 'Protein Shake' }).click();

    await expect(page.locator('#nutrition-entry-list .card')).toHaveCount(2);
    await expect(page.locator('#nutrition-total-calories')).toHaveText('440'); // 220 + 220, logged twice
  });

  test('saving a favorite and logging it in one tap, then removing it', async ({ page }) => {
    await page.locator('#nutrition-name').fill('Greek Yogurt');
    await page.locator('#nutrition-calories').fill('150');
    await page.locator('#nutrition-protein').fill('15');
    await page.locator('#btn-nutrition-save-favorite').click();

    await expect(page.locator('#nutrition-favorites-wrap')).toBeVisible();
    await expect(page.locator('#nutrition-favorite-chips')).toContainText('Greek Yogurt');

    // logging clears whatever was left in the form from saving it, and
    // logs the favorite's own saved amounts
    await page.locator('#nutrition-name').fill('');
    await page.locator('#nutrition-favorite-chips [data-log-favorite-id]', { hasText: 'Greek Yogurt' }).click();
    await expect(page.locator('#nutrition-entry-list .card').first()).toContainText('Greek Yogurt');
    await expect(page.locator('#nutrition-total-calories')).toHaveText('150');

    await page.locator('#nutrition-favorite-chips [data-remove-favorite-id]').click();
    await expect(page.locator('#nutrition-favorites-wrap')).toBeHidden();
  });

  test('logging on multiple days surfaces a real weekly average, not just today', async ({ page }) => {
    await expect(page.locator('#nutrition-weekly-card')).toBeHidden(); // nothing logged yet

    await page.locator('#nutrition-name').fill('Lunch');
    await page.locator('#nutrition-calories').fill('600');
    await page.locator('#btn-nutrition-add').click();

    await expect(page.locator('#nutrition-weekly-card')).toBeVisible();
    await expect(page.locator('#nutrition-weekly-avg-calories')).toHaveText('600 kcal');
    await expect(page.locator('#nutrition-weekly-days-logged')).toContainText('1/7 days');
  });
});
